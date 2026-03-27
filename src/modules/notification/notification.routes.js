const express    = require('express');
const router     = express.Router();
const { protect } = require('../../middleware/auth.middleware');
const Notification = require('./notification.model');
const { sendSuccess, sendPaginated } = require('../../utils/response');
const catchAsync = require('../../utils/catchAsync');

router.use(protect);

// ── Specific routes FIRST ─────────────────────────────────────
router.get('/unread-count', catchAsync(async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  sendSuccess(res, 200, 'OK', { count });
}));

router.patch('/read-all', catchAsync(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
  sendSuccess(res, 200, 'All notifications marked as read');
}));

router.delete('/clear-read', catchAsync(async (req, res) => {
  await Notification.deleteMany({ recipient: req.user._id, isRead: true });
  sendSuccess(res, 200, 'Read notifications cleared');
}));

router.get('/', catchAsync(async (req, res) => {
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

// ── Parameterized routes AFTER ────────────────────────────────
router.patch('/:id/read', catchAsync(async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true, readAt: new Date() });
  sendSuccess(res, 200, 'Marked as read');
}));

router.delete('/:id', catchAsync(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
  sendSuccess(res, 200, 'Notification deleted');
}));

module.exports = router;
