import { all, get, run } from '../config/db.js';
import {
  deleteStoredUpload,
  fileExists,
  relativeUploadPath,
  removeUploadedRequestFile,
  resolveStoredUpload
} from '../services/file-storage.js';
import { dueState } from '../services/maintenance-calculations.js';

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function categoryRows() {
  return all(`
    SELECT c.id_inspection, c.name_inspection, c.notes,
           (SELECT COUNT(*) FROM inspection_detail d WHERE d.id_inspection = c.id_inspection) AS usage_count
    FROM inspection_category c
    ORDER BY c.name_inspection COLLATE NOCASE
  `);
}

function inspectionRows() {
  return all(`
    SELECT
      d.id,
      d.id_inspection,
      d.id_asset_list,
      d.inspection_date,
      d.inspection_exp,
      d.cert,
      d.notes,
      c.name_inspection,
      a.asset_name,
      a.company_asset
    FROM inspection_detail d
    LEFT JOIN inspection_category c ON c.id_inspection = d.id_inspection
    LEFT JOIN assets_list a ON a.id = d.id_asset_list
    ORDER BY d.inspection_exp ASC, d.id DESC
  `).map(row => ({ ...row, dueState: dueState(row.inspection_exp), hasFile: fileExists(row.cert) }));
}

function requireInspectionCategory(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Inspection category is required.');
  const category = get('SELECT id_inspection FROM inspection_category WHERE id_inspection = ? LIMIT 1', [id]);
  if (!category) throw new Error('Inspection category was not found.');
  return id;
}

function requireAsset(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Asset is required.');
  const asset = get('SELECT id FROM assets_list WHERE id = ? LIMIT 1', [id]);
  if (!asset) throw new Error('Asset was not found.');
  return id;
}

export function inspectionIndex(req, res, next) {
  try {
    res.render('inspection/index', {
      title: 'Inspection',
      categories: categoryRows(),
      inspections: inspectionRows(),
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export function createInspectionCategory(req, res, next) {
  try {
    const name = clean(req.body.name_inspection);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('Inspection category name is required.');

    run(
      `INSERT INTO inspection_category (name_inspection, notes, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`,
      [name, notes || null]
    );

    res.redirect('/inspection?notice=' + encodeURIComponent('Inspection category created.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect('/inspection?notice=' + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function updateInspectionCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const name = clean(req.body.name_inspection);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('Inspection category name is required.');
    if (!get('SELECT id_inspection FROM inspection_category WHERE id_inspection = ?', [id])) {
      return res.status(404).render('errors/404', { title: 'Inspection category not found' });
    }

    run(
      `UPDATE inspection_category SET name_inspection = ?, notes = ?, updated_at = datetime('now')
       WHERE id_inspection = ?`,
      [name, notes || null, id]
    );
    res.redirect('/inspection?notice=' + encodeURIComponent('Inspection category updated.'));
  } catch (error) {
    next(error);
  }
}

export function deleteInspectionCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const usage = Number(get(
      'SELECT COUNT(*) AS total FROM inspection_detail WHERE id_inspection = ?',
      [id]
    )?.total ?? 0);

    if (usage > 0) {
      return res.redirect('/inspection?notice=' + encodeURIComponent('Category is in use and cannot be deleted.'));
    }
    run('DELETE FROM inspection_category WHERE id_inspection = ?', [id]);
    res.redirect('/inspection?notice=' + encodeURIComponent('Inspection category deleted.'));
  } catch (error) {
    next(error);
  }
}

export function saveAssetInspection(req, res, next) {
  try {
    const assetId = requireAsset(req.params.assetId);
    const categoryId = requireInspectionCategory(req.body.id_inspection);
    const inspectionDate = clean(req.body.inspection_date, 10);
    const inspectionExp = clean(req.body.inspection_exp, 10);
    const notes = clean(req.body.notes, 4000);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) throw new Error('Inspection date is required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inspectionExp)) throw new Error('Inspection expiry date is required.');
    if (inspectionExp < inspectionDate) throw new Error('Inspection expiry cannot be before inspection date.');

    const existing = get(
      `SELECT * FROM inspection_detail WHERE id_asset_list = ? AND id_inspection = ? LIMIT 1`,
      [assetId, categoryId]
    );
    const newCert = relativeUploadPath(req.file);
    const cert = newCert || existing?.cert || null;

    if (existing) {
      run(
        `UPDATE inspection_detail
         SET inspection_date = ?, inspection_exp = ?, cert = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [inspectionDate, inspectionExp, cert, notes || null, existing.id]
      );
      if (newCert && existing.cert && existing.cert !== newCert) deleteStoredUpload(existing.cert);
    } else {
      run(
        `INSERT INTO inspection_detail
         (id_inspection, id_asset_list, inspection_date, inspection_exp, cert, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [categoryId, assetId, inspectionDate, inspectionExp, cert, notes || null]
      );
    }

    res.redirect(`/assets/${assetId}?notice=` + encodeURIComponent('Inspection record saved.'));
  } catch (error) {
    removeUploadedRequestFile(req);
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect(`/assets/${Number(req.params.assetId) || ''}?notice=` + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function deleteInspection(req, res, next) {
  try {
    const id = Number(req.params.inspectionId);
    const record = get('SELECT id, id_asset_list, cert FROM inspection_detail WHERE id = ? LIMIT 1', [id]);
    if (!record) return res.status(404).render('errors/404', { title: 'Inspection record not found' });

    run('DELETE FROM inspection_detail WHERE id = ?', [id]);
    deleteStoredUpload(record.cert);
    res.redirect(`/assets/${record.id_asset_list}?notice=` + encodeURIComponent('Inspection record deleted.'));
  } catch (error) {
    next(error);
  }
}

export function downloadInspectionCertificate(req, res, next) {
  try {
    const id = Number(req.params.inspectionId);
    const record = get('SELECT cert FROM inspection_detail WHERE id = ? LIMIT 1', [id]);
    if (!record?.cert) return res.status(404).render('errors/404', { title: 'Certificate not found' });
    const absolute = resolveStoredUpload(record.cert);
    if (!absolute || !fileExists(record.cert)) {
      return res.status(404).render('errors/404', { title: 'Certificate file not found' });
    }
    res.download(absolute);
  } catch (error) {
    next(error);
  }
}
