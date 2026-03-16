const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
  },
  type: {
    type: String,
    required: true,
    enum: [
      'card.assigned',
      'card.comment',
      'card.mention',
      'card.due_soon',
      'card.overdue',
      'board.invited',
      'workspace.invited',
      'workspace.role_changed',
      'board.activity',
    ],
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String },
  isRead:  { type: Boolean, default: false },
  readAt:  { type: Date },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
