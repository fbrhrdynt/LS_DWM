import { all, get, run, tableExists, transaction } from '../config/db.js';
import { deleteStoredUpload } from '../services/file-storage.js';

const MANAGERS = new Set(['MASTER', 'Supervisor']);
function clean(value, max = 255) { return String(value ?? '').trim().slice(0, max); }
function canManage(user) { return MANAGERS.has(user?.level); }

function accessibleProjects(user) {
  if (canManage(user)) {
    return all(`SELECT id_project, contract, operator_name, drillingrig, wellname
                FROM projects ORDER BY operator_name COLLATE NOCASE, id_project DESC`);
  }
  return all(`SELECT id_project, contract, operator_name, drillingrig, wellname
              FROM projects WHERE id_project = ? LIMIT 1`, [user.id_project]);
}

function generalCategoryId() {
  let row = get(`SELECT id FROM pm_categories WHERE lower(name) = 'general' LIMIT 1`);
  if (row) return Number(row.id);
  const result = run(
    `INSERT INTO pm_categories (name, notes, created_at, updated_at)
     VALUES ('General', 'Internal compatibility category for simplified DWM Assets.', datetime('now'), datetime('now'))`
  );
  return Number(result.lastInsertRowid);
}

function requireProject(raw) {
  const projectId = Number(raw);
  if (!Number.isInteger(projectId) || projectId < 1) throw new Error('Assign the asset to a project / job.');
  if (!get('SELECT 1 FROM projects WHERE id_project = ? LIMIT 1', [projectId])) throw new Error('Selected project was not found.');
  return projectId;
}

function validateAsset(body) {
  const assetName = clean(body.asset_name);
  const companyAsset = clean(body.company_asset);
  const mfgSn = clean(body.mfg_sn);
  const status = clean(body.status, 50) || 'Active';
  const notes = clean(body.notes, 4000);
  const projectId = requireProject(body.id_project);
  if (!assetName) throw new Error('Asset name is required.');
  if (!companyAsset) throw new Error('Asset number is required.');
  if (!mfgSn) throw new Error('Manufacturer serial number is required.');
  return { assetName, companyAsset, mfgSn, status, notes, projectId };
}

function assetRows(user) {
  const where = canManage(user) ? '' : 'WHERE a.id_project = ?';
  const params = canManage(user) ? [] : [Number(user.id_project)];
  return all(`
    SELECT a.id, a.id_project, a.asset_name, a.mfg_sn, a.company_asset, a.status, a.notes,
           p.contract, p.operator_name, p.drillingrig, p.wellname
    FROM assets_list a
    LEFT JOIN projects p ON p.id_project = a.id_project
    ${where}
    ORDER BY p.operator_name COLLATE NOCASE, a.asset_name COLLATE NOCASE, a.company_asset COLLATE NOCASE
  `, params);
}

export function assetsIndex(req, res, next) {
  try {
    res.render('assets/index', {
      title: 'Assets', assets: assetRows(req.user), projects: accessibleProjects(req.user),
      canManage: canManage(req.user), notice: clean(req.query.notice, 300), error: null, values: {}
    });
  } catch (error) { next(error); }
}

export function createAsset(req, res, next) {
  try {
    const input = validateAsset(req.body);
    const categoryId = generalCategoryId();
    run(
      `INSERT INTO assets_list
       (id_pm_category, id_project, asset_name, mfg_sn, company_asset, coc, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))`,
      [categoryId, input.projectId, input.assetName, input.mfgSn, input.companyAsset, input.status, input.notes || null]
    );
    res.redirect('/assets?notice=' + encodeURIComponent('Asset created and assigned to project.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.status(422).render('assets/index', {
        title: 'Assets', assets: assetRows(req.user), projects: accessibleProjects(req.user),
        canManage: canManage(req.user), notice: '', error: error.message, values: req.body
      });
    }
    next(error);
  }
}

export function assetDetail(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const asset = get(`
      SELECT a.id, a.id_project, a.asset_name, a.mfg_sn, a.company_asset, a.status, a.notes,
             p.contract, p.operator_name, p.drillingrig, p.wellname
      FROM assets_list a
      LEFT JOIN projects p ON p.id_project = a.id_project
      WHERE a.id = ? LIMIT 1`, [assetId]);
    if (!asset) return res.status(404).render('errors/404', { title: 'Asset not found' });
    res.render('assets/detail', {
      title: asset.asset_name || 'Asset', asset, projects: accessibleProjects(req.user),
      canManage: canManage(req.user), notice: clean(req.query.notice, 300), error: null
    });
  } catch (error) { next(error); }
}

export function updateAsset(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    if (!get('SELECT 1 FROM assets_list WHERE id = ? LIMIT 1', [assetId])) {
      return res.status(404).render('errors/404', { title: 'Asset not found' });
    }
    const input = validateAsset(req.body);
    run(
      `UPDATE assets_list
       SET id_project = ?, asset_name = ?, mfg_sn = ?, company_asset = ?, status = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [input.projectId, input.assetName, input.mfgSn, input.companyAsset, input.status, input.notes || null, assetId]
    );
    res.redirect(`/assets/${assetId}?notice=` + encodeURIComponent('Asset updated.'));
  } catch (error) { next(error); }
}

export function deleteAsset(req, res, next) {
  try {
    const assetId = Number(req.params.assetId);
    const asset = get('SELECT id, coc FROM assets_list WHERE id = ? LIMIT 1', [assetId]);
    if (!asset) return res.status(404).render('errors/404', { title: 'Asset not found' });

    const certs = tableExists('inspection_detail')
      ? all('SELECT cert FROM inspection_detail WHERE id_asset_list = ? AND cert IS NOT NULL', [assetId]).map(row => row.cert)
      : [];

    transaction(() => {
      // Retired Maintenance/Inspection records are removed only as legacy child data
      // so they cannot block deletion of the simplified Asset record.
      if (tableExists('inspection_detail')) run('DELETE FROM inspection_detail WHERE id_asset_list = ?', [assetId]);
      if (tableExists('pm_details')) run('DELETE FROM pm_details WHERE id_asset_list = ?', [assetId]);
      run('DELETE FROM assets_list WHERE id = ?', [assetId]);
    });

    if (asset.coc) deleteStoredUpload(asset.coc);
    certs.forEach(deleteStoredUpload);
    res.redirect('/assets?notice=' + encodeURIComponent('Asset deleted.'));
  } catch (error) { next(error); }
}

export function assetSelectApi(req, res, next) {
  try {
    const q = clean(req.query.q, 100);
    const scoped = !canManage(req.user);
    const sql = `SELECT a.id, a.asset_name, a.company_asset, a.id_project
                 FROM assets_list a
                 WHERE (a.asset_name LIKE ? OR a.company_asset LIKE ?)
                 ${scoped ? 'AND a.id_project = ?' : ''}
                 ORDER BY a.asset_name COLLATE NOCASE LIMIT 20`;
    const params = [`%${q}%`, `%${q}%`, ...(scoped ? [Number(req.user.id_project)] : [])];
    res.json(all(sql, params));
  } catch (error) { next(error); }
}
