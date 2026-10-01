import { all, get, run } from '../config/db.js';
import {
  deleteStoredUpload,
  fileExists,
  relativeUploadPath,
  removeUploadedRequestFile,
  resolveStoredUpload
} from '../services/file-storage.js';
import {
  DEFAULT_REPORT_SETTINGS,
  getReportSettings,
  setReportSetting
} from '../services/report-settings.service.js';

function clean(value, max = 220) {
  return String(value ?? '').trim().slice(0, max);
}

function clientProjects() {
  return all(
    `SELECT id_project, contract, operator_name, drillingrig, logo
     FROM projects
     ORDER BY operator_name COLLATE NOCASE, drillingrig COLLATE NOCASE`
  );
}

export function reportSettingsPage(req, res, next) {
  try {
    const settings = getReportSettings();
    res.render('settings/report', {
      title: 'Report settings',
      settings,
      projects: clientProjects(),
      hasCompanyLogo: Boolean(settings.company_logo && fileExists(settings.company_logo)),
      notice: clean(req.query.notice, 300),
      error: null
    });
  } catch (error) {
    next(error);
  }
}

export function updateReportSettings(req, res, next) {
  try {
    const titleTemplate = clean(req.body.report_title_template, 120);
    const line1 = clean(req.body.company_header_line_1, 180);
    const line2 = clean(req.body.company_header_line_2, 220);

    if (!titleTemplate) throw new Error('Report title is required.');
    if (!line1) throw new Error('Header line 1 is required.');
    if (!line2) throw new Error('Header line 2 is required.');

    const current = getReportSettings();
    const uploadedPath = req.file ? relativeUploadPath(req.file) : null;
    const removeLogo = String(req.body.remove_company_logo || '') === '1';

    setReportSetting('report_title_template', titleTemplate);
    setReportSetting('company_header_line_1', line1);
    setReportSetting('company_header_line_2', line2);

    if (uploadedPath) {
      setReportSetting('company_logo', uploadedPath);
      if (current.company_logo && current.company_logo !== uploadedPath) {
        deleteStoredUpload(current.company_logo);
      }
    } else if (removeLogo) {
      setReportSetting('company_logo', '');
      if (current.company_logo) deleteStoredUpload(current.company_logo);
    }

    res.redirect('/settings/report?notice=' + encodeURIComponent('PDF report settings updated.'));
  } catch (error) {
    removeUploadedRequestFile(req);

    try {
      const settings = {
        ...DEFAULT_REPORT_SETTINGS,
        ...getReportSettings(),
        report_title_template: req.body?.report_title_template ?? '',
        company_header_line_1: req.body?.company_header_line_1 ?? '',
        company_header_line_2: req.body?.company_header_line_2 ?? ''
      };

      return res.status(422).render('settings/report', {
        title: 'Report settings',
        settings,
        projects: clientProjects(),
        hasCompanyLogo: Boolean(settings.company_logo && fileExists(settings.company_logo)),
        notice: '',
        error: error.message || 'Unable to update report settings.'
      });
    } catch {
      next(error);
    }
  }
}

export function companyLogo(req, res, next) {
  try {
    const settings = getReportSettings();
    const absolute = resolveStoredUpload(settings.company_logo);
    if (!absolute || !fileExists(settings.company_logo)) {
      return res.status(404).send('Company logo not found');
    }

    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(absolute);
  } catch (error) {
    next(error);
  }
}


export function updateClientLogo(req, res, next) {
  try {
    const projectId = Number(req.body.project_id);
    if (!Number.isInteger(projectId) || projectId < 1) {
      throw new Error('Select a valid project.');
    }

    const project = get(
      'SELECT id_project, logo FROM projects WHERE id_project = ? LIMIT 1',
      [projectId]
    );
    if (!project) throw new Error('Project was not found.');

    const uploadedPath = req.file ? relativeUploadPath(req.file) : null;
    const removeLogo = String(req.body.remove_client_logo || '') === '1';

    if (!uploadedPath && !removeLogo) {
      throw new Error('Choose a client logo file or select remove logo.');
    }

    const nextLogo = uploadedPath || null;
    run(
      `UPDATE projects
       SET logo = ?, updated_at = datetime('now')
       WHERE id_project = ?`,
      [nextLogo, projectId]
    );

    if (project.logo && project.logo !== nextLogo) {
      deleteStoredUpload(project.logo);
    }

    res.redirect('/settings/report?notice=' + encodeURIComponent('Client logo updated.'));
  } catch (error) {
    removeUploadedRequestFile(req);
    try {
      const settings = getReportSettings();
      return res.status(422).render('settings/report', {
        title: 'Report settings',
        settings,
        projects: clientProjects(),
        hasCompanyLogo: Boolean(settings.company_logo && fileExists(settings.company_logo)),
        notice: '',
        error: error.message || 'Unable to update client logo.'
      });
    } catch {
      next(error);
    }
  }
}
