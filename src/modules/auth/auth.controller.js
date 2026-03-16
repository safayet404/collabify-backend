const path    = require('path');
const fs      = require('fs');
const authService = require('./auth.service');
const catchAsync  = require('../../utils/catchAsync');
const AppError    = require('../../utils/AppError');
const { sendSuccess } = require('../../utils/response');

exports.register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;
  const result = await authService.register({ name, email, password });
  sendSuccess(res, 201, 'Account created successfully', result);
});

exports.login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  sendSuccess(res, 200, 'Logged in successfully', result);
});

exports.logout = catchAsync(async (req, res) => {
  await authService.logout(req.user._id);
  sendSuccess(res, 200, 'Logged out successfully');
});

exports.refreshToken = catchAsync(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await authService.refreshAccessToken(refreshToken);
  sendSuccess(res, 200, 'Token refreshed', result);
});

exports.getMe = catchAsync(async (req, res) => {
  sendSuccess(res, 200, 'OK', { user: req.user.toPublicJSON ? req.user.toPublicJSON() : req.user });
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, bio, preferences } = req.body;
  const user = await authService.updateProfile(req.user._id, { name, bio, preferences });
  sendSuccess(res, 200, 'Profile updated', { user });
});

exports.uploadAvatar = catchAsync(async (req, res) => {
  if (!req.file) throw new AppError('Please upload an image', 400);
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  // Delete old avatar
  if (req.user.avatar && req.user.avatar.startsWith('/uploads/')) {
    const oldPath = path.join(__dirname, '../../../', req.user.avatar);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const user = await authService.updateAvatar(req.user._id, avatarUrl);
  sendSuccess(res, 200, 'Avatar updated', { user });
});

exports.forgotPassword = catchAsync(async (req, res) => {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, 200, 'If that email exists, a reset link has been sent.');
});

exports.resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;
  const result = await authService.resetPassword({ token, password });
  sendSuccess(res, 200, 'Password reset successfully', result);
});

exports.changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user._id, { currentPassword, newPassword });
  sendSuccess(res, 200, 'Password changed successfully', result);
});

exports.deleteAccount = catchAsync(async (req, res) => {
  const User = require('./user.model');
  await User.findByIdAndUpdate(req.user._id, { isDeactivated: true, refreshToken: null });
  sendSuccess(res, 200, 'Account deactivated');
});
