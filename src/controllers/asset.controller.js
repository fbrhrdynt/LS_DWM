import { all, get, run, transaction } from '../config/db.js';
import {
  deleteStoredUpload,
  fileExists,
  relativeUploadPath,
  removeUploadedRequestFile,
  resolveStoredUpload
} from '../services/file-storage.js';
import { dueState, todayInTimeZone } from '../services/maintenance-calculations.js';

const MANAGERS = new Set(['MASTER', 'Supervisor']);

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function canManage(user) {
  return MANAGERS.has(user?.level);
}

function requireCategory(id) {
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId < 1) throw new Error('Asset category is required.');
  const category = get('SELECT id, name FROM pm_categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!category) throw new Error('Selected asset category was not found.');
  return categoryId;
}

function assetCategories() {
  return all('SELECT id, name, notes FROM pm_categories ORDER BY name COLLATE NOCASE');
}

function inspectionCategories() {
  return all('SELECT id_inspection, name_inspection, notes FROM inspection_category ORDER BY name_inspection COLLATE NOCASE');
}

function maintenanceCategories() {
  return all('SELECT id, pm_name, frequency, frequency_unit, notes FROM pm_detail_category ORDER BY pm_name COLLATE NOCASE');
}

function assetRows() {
  return all(`
    SELECT
      a.id,
      a.id_pm_category,
      a.asset_name,
      a.mfg_sn,
      a.company_asset,
      a.coc,
      a.status,
      a.notes,
      c.name AS category_name,
      (SELECT MIN(pm.pm_due) FROM pm_details pm
       WHERE pm.id_asset_list = a.id AND COALESCE(pm.pm_status, '') NOT IN ('Completed', 'Cancelled')) AS next_pm_due,
      (SELECT MIN(i.inspection_exp) FROM inspection_detail i
       WHERE i.id_asset_list = a.id) AS next_inspection_due,
      (SELECT COUNT(*) FROM pm_details pm WHERE pm.id_asset_list = a.id) AS pm_count,
      (SELECT COUNT(*) FROM inspection_detail i WHERE i.id_asset_list = a.id) AS inspection_count
    FROM assets_list a
    LEFT JOIN pm_categories c ON c.id = a.id_pm_category
    ORDER BY a.asset_name COLLATE NOCASE, a.company_asset COLLATE NOCASE
  `).map(row => ({
    ...row,
    pmDueState: dueState(row.next_pm_due),
    inspectionDueState: dueState(row.next_inspection_due)
  }));
}

function validateAsset(body) {
  const assetName = clean(body.asset_name);
  const companyAsset = clean(body.company_asset);
  const mfgSn = clean(body.mfg_sn);
  const status = clean(body.status, 50) || 'Active';
  const notes = clean(body.notes, 4000);
  const categoryId = requireCategory(body.id_pm_category);

  if (!assetName) throw new Error('Asset name is required.');
  if (!companyAsset) throw new Error('Company asset number is required.');
  if (!mfgSn) throw new Error('Manufacturer serial number is required.');

  return { assetName, companyAsset, mfgSn, status, notes, categoryId };
}

export function assetsIndex(req, res, next) {
  try {
    res.render('assets/index', {
      title: 'Assets',
      assets: assetRows(),
      categories: assetCategories(),
      canManage: canManage(req.user),
      notice: clean(req.query.notice, 300),
      error: null,
      values: {}
    });
  } catch (error) {
    next(error);
  }
}

export function createAsset(req, res, next) {
  try {
    const input = validateAsset(req.body);
    const coc = relativeUploadPath(req.file);

    run(
      `INSERT INTO assets_list
       (id_pm_category, asset_name, mfg_sn, company_asset, coc, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [input.categoryId, input.assetName, input.mfgSn, input.companyAsset, coc, input.status, input.notes || null]
    );

    res.redirect('/assets?notice=' + encodeURIComponent('Asset created successfully.'));
  } catch (error) {
    removeUploadedRequestFile(req);
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.status(422).render('assets/index', {
        title: 'Assets',
        assets: assetRows(),
        categories: assetCategories(),
        canManage: canManage(req.user),
        notice: '',
        error: error.message,
        values: req.body
      });
    }
    next(error);
  }
}

export function assetDetail(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const asset = get(`
      SELECT a.*, c.name AS category_name
      FROM assets_list a
      LEFT JOIN pm_categories c ON c.id = a.id_pm_category
      WHERE a.id = ? LIMIT 1
    `, [assetId]);

    if (!asset) return res.status(404).render('errors/404', { title: 'Asset not found' });
    asset.cocExists = fileExists(asset.coc);

    const inspections = all(`
      SELECT i.*, c.name_inspection
      FROM inspection_detail i
      LEFT JOIN inspection_category c ON c.id_inspection = i.id_inspection
      WHERE i.id_asset_list = ?
      ORDER BY i.inspection_exp ASC, i.id DESC
    `, [assetId]).map(row => ({ ...row, dueState: dueState(row.inspection_exp), hasFile: fileExists(row.cert) }));

    const maintenance = all(`
      SELECT pm.*, c.pm_name, c.frequency, c.frequency_unit
      FROM pm_details pm
      LEFT JOIN pm_detail_category c ON c.id = pm.id_pm_detail_category
      WHERE pm.id_asset_list = ?
      ORDER BY pm.pm_due ASC, pm.id DESC
    `, [assetId]).map(row => ({
      ...row,
      dueState: dueState(row.pm_due, { completed: row.pm_status === 'Completed' })
    }));

    res.render('assets/detail', {
      title: asset.asset_name || 'Asset',
      asset,
      categories: assetCategories(),
      inspectionCategories: inspectionCategories(),
      maintenanceCategories: maintenanceCategories(),
      inspections,
      maintenance,
      canManage: canManage(req.user),
      notice: clean(req.query.notice, 300),
      today: todayInTimeZone()
    });
  } catch (error) {
    next(error);
  }
}

export function updateAsset(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const current = get('SELECT * FROM assets_list WHERE id = ? LIMIT 1', [assetId]);
    if (!current) {
      removeUploadedRequestFile(req);
      return res.status(404).render('errors/404', { title: 'Asset not found' });
    }

    const input = validateAsset(req.body);
    const newCoc = relativeUploadPath(req.file);
    const coc = newCoc || current.coc || null;

    run(
      `UPDATE assets_list
       SET id_pm_category = ?, asset_name = ?, mfg_sn = ?, company_asset = ?, coc = ?, status = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [input.categoryId, input.assetName, input.mfgSn, input.companyAsset, coc, input.status, input.notes || null, assetId]
    );

    if (newCoc && current.coc && current.coc !== newCoc) deleteStoredUpload(current.coc);
    res.redirect(`/assets/${assetId}?notice=` + encodeURIComponent('Asset updated successfully.'));
  } catch (error) {
    removeUploadedRequestFile(req);
    next(error);
  }
}

export function deleteAsset(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const asset = get('SELECT id, coc FROM assets_list WHERE id = ? LIMIT 1', [assetId]);
    if (!asset) return res.status(404).render('errors/404', { title: 'Asset not found' });

    const inspectionFiles = all(
      'SELECT cert FROM inspection_detail WHERE id_asset_list = ? AND cert IS NOT NULL',
      [assetId]
    ).map(row => row.cert);

    transaction(() => {
      run('DELETE FROM inspection_detail WHERE id_asset_list = ?', [assetId]);
      run('DELETE FROM pm_details WHERE id_asset_list = ?', [assetId]);
      run('DELETE FROM assets_list WHERE id = ?', [assetId]);
    });

    deleteStoredUpload(asset.coc);
    inspectionFiles.forEach(deleteStoredUpload);

    res.redirect('/assets?notice=' + encodeURIComponent('Asset and related records deleted.'));
  } catch (error) {
    next(error);
  }
}

export function downloadCoc(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const asset = get('SELECT company_asset, coc FROM assets_list WHERE id = ? LIMIT 1', [assetId]);
    if (!asset?.coc) return res.status(404).render('errors/404', { title: 'COC not found' });
    const absolute = resolveStoredUpload(asset.coc);
    if (!absolute || !fileExists(asset.coc)) {
      return res.status(404).render('errors/404', { title: 'COC file not found' });
    }
    res.download(absolute);
  } catch (error) {
    next(error);
  }
}

export function assetSelectApi(req, res, next) {
  try {
    const q = clean(req.query.q, 100);
    const term = `%${q}%`;
    const rows = q
      ? all(
          `SELECT id, asset_name, company_asset FROM assets_list
           WHERE asset_name LIKE ? OR company_asset LIKE ?
           ORDER BY asset_name COLLATE NOCASE LIMIT 10`,
          [term, term]
        )
      : all('SELECT id, asset_name, company_asset FROM assets_list ORDER BY asset_name COLLATE NOCASE LIMIT 10');
    res.json(rows);
  } catch (error) {
    next(error);
  }
}
