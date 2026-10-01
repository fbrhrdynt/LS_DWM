import path from 'node:path';
import { all, get, run, transaction } from '../config/db.js';
import {
  deleteStoredUpload,
  fileExists,
  relativeUploadPath,
  removeUploadedRequestFile,
  resolveStoredUpload
} from '../services/file-storage.js';
import { calculatePmDue, dueState } from '../services/maintenance-calculations.js';

function clean(value, max = 255) {
  return String(value ?? '').trim().slice(0, max);
}

function maintenanceCategories() {
  return all(`
    SELECT c.id, c.pm_name, c.frequency, c.frequency_unit, c.notes,
           (SELECT COUNT(*) FROM pm_details d WHERE d.id_pm_detail_category = c.id) AS usage_count
    FROM pm_detail_category c
    ORDER BY c.pm_name COLLATE NOCASE
  `);
}

function documentCategories() {
  return all(`
    SELECT c.id, c.name, c.notes,
           (SELECT COUNT(*) FROM pm_data d WHERE d.category_id = c.id) AS document_count,
           (SELECT COUNT(*) FROM assets_list a WHERE a.id_pm_category = c.id) AS asset_count
    FROM pm_categories c
    ORDER BY c.name COLLATE NOCASE
  `);
}

function maintenanceRows() {
  return all(`
    SELECT
      pm.id,
      pm.id_pm_detail_category,
      pm.id_asset_list,
      pm.pm_start,
      pm.pm_due,
      pm.pm_status,
      pm.performed_by,
      pm.notes,
      c.pm_name,
      c.frequency,
      c.frequency_unit,
      a.asset_name,
      a.company_asset
    FROM pm_details pm
    LEFT JOIN pm_detail_category c ON c.id = pm.id_pm_detail_category
    LEFT JOIN assets_list a ON a.id = pm.id_asset_list
    ORDER BY pm.pm_due ASC, pm.id DESC
  `).map(row => ({
    ...row,
    dueState: dueState(row.pm_due, { completed: row.pm_status === 'Completed' })
  }));
}

function documents() {
  return all(`
    SELECT d.*, c.name AS category_name, u.employee_name AS uploader_name
    FROM pm_data d
    LEFT JOIN pm_categories c ON c.id = d.category_id
    LEFT JOIN xusers u ON u.id_user = d.id_user
    ORDER BY d.created_at DESC, d.id DESC
  `).map(row => ({ ...row, hasFile: fileExists(row.file_path) }));
}

function requireMaintenanceCategory(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error('PM category is required.');
  const category = get('SELECT * FROM pm_detail_category WHERE id = ? LIMIT 1', [id]);
  if (!category) throw new Error('PM category was not found.');
  return category;
}

function requireDocumentCategory(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Document category is required.');
  const category = get('SELECT * FROM pm_categories WHERE id = ? LIMIT 1', [id]);
  if (!category) throw new Error('Document category was not found.');
  return category;
}

function requireAsset(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new Error('Asset is required.');
  const asset = get('SELECT id FROM assets_list WHERE id = ? LIMIT 1', [id]);
  if (!asset) throw new Error('Asset was not found.');
  return id;
}

export function maintenanceIndex(req, res, next) {
  try {
    res.render('maintenance/index', {
      title: 'Preventive Maintenance',
      records: maintenanceRows(),
      categories: maintenanceCategories(),
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export function documentsIndex(req, res, next) {
  try {
    res.render('maintenance/documents', {
      title: 'PM Documents',
      categories: documentCategories(),
      documents: documents(),
      notice: clean(req.query.notice, 300)
    });
  } catch (error) {
    next(error);
  }
}

export function createMaintenanceCategory(req, res, next) {
  try {
    const name = clean(req.body.pm_name);
    const frequency = Number(req.body.frequency);
    const unit = clean(req.body.frequency_unit, 20);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('PM category name is required.');
    if (!Number.isInteger(frequency) || frequency < 1) throw new Error('Frequency must be at least 1.');
    if (!['Day', 'Week', 'Month', 'Year'].includes(unit)) throw new Error('Invalid frequency unit.');

    run(
      `INSERT INTO pm_detail_category (pm_name, frequency, frequency_unit, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [name, frequency, unit, notes || null]
    );
    res.redirect('/maintenance?notice=' + encodeURIComponent('PM category created.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect('/maintenance?notice=' + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function updateMaintenanceCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const name = clean(req.body.pm_name);
    const frequency = Number(req.body.frequency);
    const unit = clean(req.body.frequency_unit, 20);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('PM category name is required.');
    if (!Number.isInteger(frequency) || frequency < 1) throw new Error('Frequency must be at least 1.');
    if (!['Day', 'Week', 'Month', 'Year'].includes(unit)) throw new Error('Invalid frequency unit.');

    transaction(() => {
      run(
        `UPDATE pm_detail_category SET pm_name = ?, frequency = ?, frequency_unit = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [name, frequency, unit, notes || null, id]
      );

      const affected = all('SELECT id, pm_start FROM pm_details WHERE id_pm_detail_category = ?', [id]);
      for (const record of affected) {
        const due = calculatePmDue(record.pm_start, frequency, unit);
        if (due) run(`UPDATE pm_details SET pm_due = ?, updated_at = datetime('now') WHERE id = ?`, [due, record.id]);
      }
    });
    res.redirect('/maintenance?notice=' + encodeURIComponent('PM category updated and existing due dates recalculated.'));
  } catch (error) {
    next(error);
  }
}

export function deleteMaintenanceCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const usage = Number(get('SELECT COUNT(*) AS total FROM pm_details WHERE id_pm_detail_category = ?', [id])?.total ?? 0);
    if (usage > 0) {
      return res.redirect('/maintenance?notice=' + encodeURIComponent('PM category is in use and cannot be deleted.'));
    }
    run('DELETE FROM pm_detail_category WHERE id = ?', [id]);
    res.redirect('/maintenance?notice=' + encodeURIComponent('PM category deleted.'));
  } catch (error) {
    next(error);
  }
}

export function saveMaintenanceRecord(req, res, next) {
  try {
    const assetId = requireAsset(req.params.assetId || req.body.id_asset_list);
    const category = requireMaintenanceCategory(req.body.id_pm_detail_category);
    const start = clean(req.body.pm_start, 10);
    const status = clean(req.body.pm_status, 30) || 'Scheduled';
    const performedBy = clean(req.body.performed_by) || clean(req.user.employee_name);
    const notes = clean(req.body.notes, 4000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('PM start date is required.');
    if (!['Scheduled', 'Completed', 'Deferred', 'Cancelled'].includes(status)) throw new Error('Invalid PM status.');

    const due = calculatePmDue(start, category.frequency, category.frequency_unit);
    if (!due) throw new Error('Unable to calculate PM due date.');

    run(
      `INSERT INTO pm_details
       (id_pm_detail_category, id_asset_list, pm_start, pm_due, pm_status, performed_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [category.id, assetId, start, due, status, performedBy, notes || null]
    );

    res.redirect(`/assets/${assetId}?notice=` + encodeURIComponent(`PM saved. Due date calculated as ${due}.`));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect(`/assets/${Number(req.params.assetId) || ''}?notice=` + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function updateMaintenanceRecord(req, res, next) {
  try {
    const id = Number(req.params.recordId);
    const existing = get('SELECT * FROM pm_details WHERE id = ? LIMIT 1', [id]);
    if (!existing) return res.status(404).render('errors/404', { title: 'PM record not found' });

    const category = requireMaintenanceCategory(req.body.id_pm_detail_category || existing.id_pm_detail_category);
    const start = clean(req.body.pm_start || existing.pm_start, 10);
    const status = clean(req.body.pm_status || existing.pm_status, 30);
    const performedBy = clean(req.body.performed_by || existing.performed_by);
    const notes = clean(req.body.notes ?? existing.notes, 4000);
    const due = calculatePmDue(start, category.frequency, category.frequency_unit);
    if (!due) throw new Error('Unable to calculate PM due date.');

    run(
      `UPDATE pm_details
       SET id_pm_detail_category = ?, pm_start = ?, pm_due = ?, pm_status = ?, performed_by = ?, notes = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [category.id, start, due, status, performedBy, notes || null, id]
    );

    res.redirect(`/assets/${existing.id_asset_list}?notice=` + encodeURIComponent('PM record updated.'));
  } catch (error) {
    next(error);
  }
}

export function deleteMaintenanceRecord(req, res, next) {
  try {
    const id = Number(req.params.recordId);
    const existing = get('SELECT id_asset_list FROM pm_details WHERE id = ? LIMIT 1', [id]);
    if (!existing) return res.status(404).render('errors/404', { title: 'PM record not found' });
    run('DELETE FROM pm_details WHERE id = ?', [id]);
    res.redirect(`/assets/${existing.id_asset_list}?notice=` + encodeURIComponent('PM record deleted.'));
  } catch (error) {
    next(error);
  }
}

export function createDocumentCategory(req, res, next) {
  try {
    const name = clean(req.body.name);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('Category name is required.');
    run(
      `INSERT INTO pm_categories (name, notes, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`,
      [name, notes || null]
    );
    res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Equipment/document category created.'));
  } catch (error) {
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect('/maintenance/documents?notice=' + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function updateDocumentCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const name = clean(req.body.name);
    const notes = clean(req.body.notes, 4000);
    if (!name) throw new Error('Category name is required.');
    run('UPDATE pm_categories SET name = ?, notes = ?, updated_at = datetime(\'now\') WHERE id = ?', [name, notes || null, id]);
    res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Category updated.'));
  } catch (error) {
    next(error);
  }
}

export function deleteDocumentCategory(req, res, next) {
  try {
    const id = Number(req.params.categoryId);
    const docs = Number(get('SELECT COUNT(*) AS total FROM pm_data WHERE category_id = ?', [id])?.total ?? 0);
    const assets = Number(get('SELECT COUNT(*) AS total FROM assets_list WHERE id_pm_category = ?', [id])?.total ?? 0);
    if (docs > 0 || assets > 0) {
      return res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Category is still used by assets/documents and cannot be deleted.'));
    }
    run('DELETE FROM pm_categories WHERE id = ?', [id]);
    res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Category deleted.'));
  } catch (error) {
    next(error);
  }
}

export function uploadDocument(req, res, next) {
  try {
    const category = requireDocumentCategory(req.params.categoryId);
    const title = clean(req.body.title);
    if (!title) throw new Error('Document title is required.');
    if (!req.file) throw new Error('Document file is required.');

    const relative = relativeUploadPath(req.file);
    run(
      `INSERT INTO pm_data
       (category_id, title, file_path, file_type, file_size, id_user, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [category.id, title, relative, req.file.mimetype || 'application/octet-stream', req.file.size || 0, req.user.id_user]
    );

    res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Document uploaded successfully.'));
  } catch (error) {
    removeUploadedRequestFile(req);
    if (error instanceof Error && !String(error.message).includes('SQLITE')) {
      return res.redirect('/maintenance/documents?notice=' + encodeURIComponent(error.message));
    }
    next(error);
  }
}

export function downloadDocument(req, res, next) {
  try {
    const id = Number(req.params.documentId);
    const doc = get('SELECT title, file_path FROM pm_data WHERE id = ? LIMIT 1', [id]);
    if (!doc?.file_path) return res.status(404).render('errors/404', { title: 'Document not found' });
    const absolute = resolveStoredUpload(doc.file_path);
    if (!absolute || !fileExists(doc.file_path)) {
      return res.status(404).render('errors/404', { title: 'Document file not found' });
    }
    res.download(absolute, path.basename(absolute));
  } catch (error) {
    next(error);
  }
}

export function deleteDocument(req, res, next) {
  try {
    const id = Number(req.params.documentId);
    const doc = get('SELECT file_path FROM pm_data WHERE id = ? LIMIT 1', [id]);
    if (!doc) return res.status(404).render('errors/404', { title: 'Document not found' });
    run('DELETE FROM pm_data WHERE id = ?', [id]);
    deleteStoredUpload(doc.file_path);
    res.redirect('/maintenance/documents?notice=' + encodeURIComponent('Document deleted.'));
  } catch (error) {
    next(error);
  }
}

export function maintenanceCategoryApi(req, res, next) {
  try {
    res.json(all('SELECT id, pm_name, frequency, frequency_unit FROM pm_detail_category ORDER BY pm_name COLLATE NOCASE'));
  } catch (error) {
    next(error);
  }
}
