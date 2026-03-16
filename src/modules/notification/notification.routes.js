const express    = require('express');
const router     = express.Router();
const { protect } = require('../../middleware/auth.middleware');
const Notification = require('./notification.model');
const { sendSuccess, sendPaginated } = require('../../utils/response');
const catchAsync = require('../../utils/catchAsync');

// GET /api/notifications
router.get('/', protect, catchAsync(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip  = (page - 1) * limit;

  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).populate('sender', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  res.json({ success: true, data: items, unreadCount, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
}));

// GET /api/notifications/unread-count
router.get('/unread-count', protect, catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  sendSuccess(res, 200, 'OK', { count });
}));

// PATCH /api/notifications/:id/read
router.patch('/:id/read', protect, catchAsync(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true, readAt: new Date() });
  sendSuccess(res, 200, 'Marked as read');
}));

// PATCH /api/notifications/read-all
router.patch('/read-all', protect, catchAsync(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  sendSuccess(res, 200, 'All notifications marked as read');
}));

// DELETE /api/notifications/:id
router.delete('/:id', protect, catchAsync(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  sendSuccess(res, 200, 'Notification deleted');
}));

// DELETE /api/notifications/clear-read
router.delete('/clear-read', protect, catchAsync(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id, isRead: true });
  sendSuccess(res, 200, 'Read notifications cleared');
}));

module.exports = router;
