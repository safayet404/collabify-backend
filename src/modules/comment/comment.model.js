const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const commentSchema = new mongoose.Schema({
    card: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card',
        required: true,
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
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    text: {
        type: String,
        required: [true, 'Comment text is required'],
        trim: true,
        maxlength: [5000, 'Comment cannot exceed 5000 characters'],
    },

    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],

    reactions: [reactionSchema],

    parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null,
    },
    repliesCount: { type: Number, default: 0 },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

}, { timestamps: true });

commentSchema.index({ card: 1, createdAt: 1 });
commentSchema.index({ board: 1 });
commentSchema.index({ author: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ mentions: 1 });

module.exports = mongoose.model('Comment', commentSchema);