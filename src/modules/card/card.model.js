const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────────────────────────
const checklistItemSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: true });

const checklistSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    items: [checklistItemSchema],
}, { _id: true });

const attachmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: true });

const cardLabelSchema = new mongoose.Schema({
    labelId: { type: mongoose.Schema.Types.ObjectId },
    name: { type: String },
    color: { type: String, required: true },
}, { _id: false });

// ── Main card schema ──────────────────────────────────────────
const cardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Card title is required'],
        trim: true,
        minlength: [1, 'Title must be at least 1 character'],
        maxlength: [500, 'Title cannot exceed 500 characters'],
    },
    description: {
        type: String,
        default: '',
        maxlength: [50000, 'Description is too long'],
    },

    // Location
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    position: { type: Number, required: true, default: 0 },

    // People
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    watchers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Labels
    labels: [cardLabelSchema],

    // Dates
    dueDate: { type: Date },
    dueDateReminder: { type: String, enum: ['none', '1day', '2days', '1week'], default: 'none' },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date },
    startDate: { type: Date },

    cover: {
        type: { type: String, enum: ['color', 'image'], default: null },
        value: { type: String, default: null },
    },

    checklists: [checklistSchema],
    attachments: [attachmentSchema],

    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },

    priority: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'critical'],
        default: 'none',
    },

    storyPoints: { type: Number, default: null },

    cardNumber: { type: Number },

    commentsCount: { type: Number, default: 0 },

}, { timestamps: true });

cardSchema.index({ list: 1, position: 1 });
cardSchema.index({ board: 1, isArchived: 1 });
cardSchema.index({ assignees: 1 });
cardSchema.index({ dueDate: 1 });
cardSchema.index({ board: 1, cardNumber: 1 }, { unique: true, sparse: true });

cardSchema.pre('save', async function (next) {
    if (this.isNew && !this.cardNumber) {
        const last = await this.constructor
            .findOne({ board: this.board })
            .sort({ cardNumber: -1 })
            .select('cardNumber');
        this.cardNumber = (last?.cardNumber || 0) + 1;
    }
    next();
});

cardSchema.virtual('checklistProgress').get(function () {
    const total = this.checklists.reduce((sum, cl) => sum + cl.items.length, 0);
    const completed = this.checklists.reduce((sum, cl) => sum + cl.items.filter(i => i.isCompleted).length, 0);
    return { total, completed, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
});

cardSchema.set('toJSON', { virtuals: true });
cardSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Card', cardSchema);