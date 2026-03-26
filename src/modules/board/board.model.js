const mongoose = require('mongoose');

const boardMemberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const labelSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    color: { type: String, required: true },
});

const boardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Board title is required'],
        trim: true,
        minlength: [1, 'Title must be at least 1 character'],
        maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: { type: String, maxlength: 1000, default: '' },

    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Background — color, gradient, or image url
    background: {
        type: { type: String, enum: ['color', 'gradient', 'image'], default: 'color' },
        value: { type: String, default: '#4F46E5' },
    },

    // Board-level members
    members: [boardMemberSchema],

    // Labels available for cards on this board
    labels: {
        type: [labelSchema],
        default: () => [
            { name: 'Bug', color: '#EF4444' },
            { name: 'Feature', color: '#8B5CF6' },
            { name: 'Design', color: '#EC4899' },
            { name: 'Backend', color: '#F59E0B' },
            { name: 'Frontend', color: '#10B981' },
            { name: 'Urgent', color: '#DC2626' },
        ],
    },

    visibility: { type: String, enum: ['workspace', 'private'], default: 'workspace' },
    isStarred: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    isTemplate: { type: Boolean, default: false },
    templateName: { type: String },

    // Counters
    cardCount: { type: Number, default: 0 },
    listCount: { type: Number, default: 0 },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────
boardSchema.index({ workspace: 1, isArchived: 1 });
boardSchema.index({ 'members.user': 1 });
boardSchema.index({ createdBy: 1 });
boardSchema.index({ isTemplate: 1 });

// ── Methods ───────────────────────────────────────────────────
boardSchema.methods.isMember = function (userId) {
    return this.members.some(m => m.user.toString() === userId.toString());
};

boardSchema.methods.getMemberRole = function (userId) {
    const m = this.members.find(m => m.user.toString() === userId.toString());
    return m?.role || null;
};

boardSchema.methods.canEdit = function (userId) {
    const role = this.getMemberRole(userId);
    return role === 'admin' || role === 'member';
};

module.exports = mongoose.model('Board', boardSchema);