const mongoose = require('mongoose');
const slugify = require('slugify');

const memberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['owner', 'admin', 'member', 'viewer'],
        default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const inviteSchema = new mongoose.Schema({
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
    token: { type: String, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true },
    accepted: { type: Boolean, default: false },
}, { _id: false });

const workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Workspace name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    slug: {
        type: String,
        unique: true,
    },
    description: {
        type: String,
        maxlength: [500, 'Description cannot exceed 500 characters'],
        default: '',
    },
    logo: {
        type: String,
        default: null,
    },
    color: {
        type: String,
        default: '#4F46E5',
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    members: [memberSchema],
    invites: [inviteSchema],
    isPersonal: { type: Boolean, default: false },
    boardCount: { type: Number, default: 0 },
    memberCount: { type: Number, default: 1 },
}, { timestamps: true });

workspaceSchema.index({ slug: 1 });
workspaceSchema.index({ owner: 1 });
workspaceSchema.index({ 'members.user': 1 });

workspaceSchema.pre('save', async function (next) {
    if (!this.isModified('name')) return next();

    let slug = slugify(this.name, { lower: true, strict: true });
    const existing = await this.constructor.findOne({ slug, _id: { $ne: this._id } });
    if (existing) slug = `${slug}-${Date.now()}`;
    this.slug = slug;
    next();
});

workspaceSchema.methods.getMemberRole = function (userId) {
    const member = this.members.find(m => m.user.toString() === userId.toString());
    return member?.role || null;
};

workspaceSchema.methods.isMember = function (userId) {
    return this.members.some(m => m.user.toString() === userId.toString());
};

workspaceSchema.methods.isOwnerOrAdmin = function (userId) {
    const role = this.getMemberRole(userId);
    return role === 'owner' || role === 'admin';
};

module.exports = mongoose.model('Workspace', workspaceSchema);