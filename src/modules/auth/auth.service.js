const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('./user.model');
const AppError = require('../../utils/AppError');
const { sendEmail, emailTemplates } = require('../../utils/email');

// ── Token generation ──────────────────────────────────────────
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
};

const generateTokenPair = async (user) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Store refresh token hash
  user.refreshToken = refreshToken;
  user.lastSeen     = new Date();
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// ── Register ──────────────────────────────────────────────────
const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new AppError('Email already in use', 400);

  const user = await User.create({ name, email, password });

  // Send welcome email (non-blocking)
  sendEmail({
    to:      user.email,
    ...emailTemplates.welcomeEmail({ name: user.name }),
  }).catch(console.error);

  const tokens = await generateTokenPair(user);
  return { user: user.toPublicJSON(), ...tokens };
};

// ── Login ─────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) throw new AppError('Invalid email or password', 401);
  if (user.isDeactivated) throw new AppError('Your account has been deactivated', 403);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const tokens = await generateTokenPair(user);
  return { user: user.toPublicJSON(), ...tokens };
};

// ── Refresh Token ─────────────────────────────────────────────
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) throw new AppError('Refresh token required', 401);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new AppError('Refresh token is invalid or has been revoked', 401);
  }

  const tokens = await generateTokenPair(user);
  return { user: user.toPublicJSON(), ...tokens };
};

// ── Logout ────────────────────────────────────────────────────
const logout = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

// ── Forgot Password ───────────────────────────────────────────
const forgotPassword = async (email) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Always return success (don't reveal if email exists)
  if (!user) return;

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

  await sendEmail({
    to: user.email,
    ...emailTemplates.resetPassword({ name: user.name, resetUrl }),
  });
};

// ── Reset Password ────────────────────────────────────────────
const resetPassword = async ({ token, password }) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+password');

  if (!user) throw new AppError('Token is invalid or has expired', 400);

  user.password             = password;
  user.passwordResetToken   = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken         = null;
  await user.save();

  const tokens = await generateTokenPair(user);
  return { user: user.toPublicJSON(), ...tokens };
};

// ── Change Password ───────────────────────────────────────────
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 400);

  user.password     = newPassword;
  user.refreshToken = null;
  await user.save();

  const tokens = await generateTokenPair(user);
  return { user: user.toPublicJSON(), ...tokens };
};

// ── Update Profile ────────────────────────────────────────────
const updateProfile = async (userId, { name, bio, preferences }) => {
  const updates = {};
  if (name !== undefined)        updates.name        = name;
  if (bio  !== undefined)        updates.bio         = bio;
  if (preferences !== undefined) updates.preferences = preferences;

  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw new AppError('User not found', 404);
  return user.toPublicJSON();
};

// ── Update Avatar ─────────────────────────────────────────────
const updateAvatar = async (userId, avatarPath) => {
  const user = await User.findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true });
  return user.toPublicJSON();
};

module.exports = {
  register, login, logout,
  refreshAccessToken,
  forgotPassword, resetPassword, changePassword,
  updateProfile, updateAvatar,
  generateTokenPair,
};
