import { notificationSummary } from '../services/notification.service.js';

export function loadNotificationSummary(req, res, next) {
  try {
    res.locals.notificationCount = 0;
    res.locals.notificationUrgent = 0;
    if (req.user) {
      const summary = notificationSummary();
      res.locals.notificationCount = summary.total;
      res.locals.notificationUrgent = summary.overdue + summary.due7;
    }
    next();
  } catch (error) {
    res.locals.notificationCount = 0;
    res.locals.notificationUrgent = 0;
    next();
  }
}
