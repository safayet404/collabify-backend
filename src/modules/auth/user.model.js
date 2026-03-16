const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type:      String,
    required:  [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select:    false,
  },
  avatar: {
    type:    String,
    default: null,
  },
  bio: {
    type:      String,
    maxlength: [200, 'Bio cannot exceed 200 characters'],
    default:   '',
  },
  initials: {
    type: String,
  },
  color: {
    type:    String,
    default: '#4F46E5',
  },

  // Auth
  refreshToken:           { type: String, select: false },
  passwordResetToken:     { type: String, select: false },
  passwordResetExpires:   { type: Date,   select: false },
  emailVerificationToken: { type: String, select: false },
  isEmailVerified:        { type: Boolean, default: false },
  isDeactivated:          { type: Boolean, default: false },

  // Preferences
  preferences: {
    theme:         { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    notifications: {
      email:    { type: Boolean, default: true },
      inApp:    { type: Boolean, default: true },
      cardDue:  { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
    },
  },

  lastSeen: { type: Date, default: Date.now },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────

// ── Pre-save: hash password + set initials/color ──────────────
userSchema.pre('save', async function (next) {
  // Initials
  if (this.isModified('name')) {
    const parts = this.name.trim().split(' ');
    this.initials = parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : this.name.slice(0, 2).toUpperCase();
  }

  // Random avatar color
  if (this.isNew && !this.color) {
    const colors = ['#4F46E5', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#059669', '#0891B2', '#2563EB'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  // Hash password
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Methods ───────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken   = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(token).digest('hex');
  return token;
};

userSchema.methods.toPublicJSON = function () {
  return {
    _id:             this._id,
    name:            this.name,
    email:           this.email,
    avatar:          this.avatar,
    bio:             this.bio,
    initials:        this.initials,
    color:           this.color,
    isEmailVerified: this.isEmailVerified,
    preferences:     this.preferences,
    lastSeen:        this.lastSeen,
    createdAt:       this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
