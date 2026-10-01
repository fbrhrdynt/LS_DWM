import { listNotifications, notificationSummary } from '../services/notification.service.js';

export function notificationsPage(req, res, next) {
  try {
    res.render('notifications/index', {
      title: 'Notifications',
      notifications: listNotifications({ warningDays: 30, limit: 300 }),
      summary: notificationSummary()
    });
  } catch (error) {
    next(error);
  }
}
