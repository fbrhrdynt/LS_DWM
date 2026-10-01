import { loadDailyReport, loadProjectSummary } from '../services/report-export-data.js';
import { pipeDailyReportPdf } from '../services/pdf-report.service.js';
import { buildWellSummaryWorkbook } from '../services/well-summary.service.js';
import { formatReportNumber } from '../services/report-sequence.js';

function safePart(value, fallback = 'dwm') {
  const text = String(value ?? '').trim();
  const safe = text.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || fallback;
}

export function dailyReportPdf(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const wellId = Number(req.params.wellId);
    const data = loadDailyReport(projectId, wellId);

    if (!data) {
      return res.status(404).render('errors/404', { title: 'Report not found' });
    }

    const filename = [
      'DWM',
      safePart(data.project.operator_name, 'Project'),
      safePart(data.report.wellname, 'Well'),
      `Report-${safePart(formatReportNumber(data.report.urut, data.report.id_wellinfo))}`
    ].join('-') + '.pdf';

    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    pipeDailyReportPdf(res, data);
  } catch (error) {
    next(error);
  }
}

export async function projectWellSummary(req, res, next) {
  try {
    const projectId = Number(req.params.projectId);
    const data = loadProjectSummary(projectId);

    if (!data) {
      return res.status(404).render('errors/404', { title: 'Project not found' });
    }

    const workbook = await buildWellSummaryWorkbook(data);
    const filename = `DWM-Well-Summary-${safePart(data.project.operator_name, 'Project')}-${safePart(data.project.contract)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
}
