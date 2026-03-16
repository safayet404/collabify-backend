const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  // Who did it
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    required: true,
  },

  // Context
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Workspace',
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Board',
  },
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Card',
  },

  // What happened
  action: {
    type: String,
    required: true,
    enum: [
      // Board
      'board.created', 'board.updated', 'board.deleted', 'board.archived',
      'board.member_added', 'board.member_removed',
      // List
      'list.created', 'list.updated', 'list.deleted', 'list.moved',
      // Card
      'card.created', 'card.updated', 'card.deleted', 'card.moved',
      'card.archived', 'card.restored',
      'card.member_added', 'card.member_removed',
      'card.label_added', 'card.label_removed',
      'card.due_date_set', 'card.due_date_removed', 'card.due_date_completed',
      'card.attachment_added', 'card.attachment_removed',
      'card.checklist_added', 'card.checklist_removed',
      'card.checklist_item_checked', 'card.checklist_item_unchecked',
      'card.cover_updated',
      // Comment
      'comment.created', 'comment.updated', 'comment.deleted',
      // Workspace
      'workspace.created', 'workspace.updated',
      'workspace.member_added', 'workspace.member_removed',
      'workspace.member_role_changed',
    ],
  },

  // Human-readable description
  description: { type: String, required: true },

  // Before/after data for detailed logs
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true });

// Indexes for fast queries
activitySchema.index({ board: 1, createdAt: -1 });
activitySchema.index({ card: 1, createdAt: -1 });
activitySchema.index({ workspace: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
