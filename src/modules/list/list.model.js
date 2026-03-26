const mongoose = require('mongoose');

const listSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'List title is required'],
        trim: true,
        minlength: [1, 'Title must be at least 1 character'],
        maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Board',
        required: true,
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
    },
    position: { type: Number, required: true, default: 0 },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    cardCount: { type: Number, default: 0 },

    // Card limit (WIP limit for kanban)
    cardLimit: { type: Number, default: null },

    // List color indicator
    color: { type: String, default: null },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────
listSchema.index({ board: 1, position: 1 });
listSchema.index({ board: 1, isArchived: 1 });

module.exports = mongoose.model('List', listSchema);