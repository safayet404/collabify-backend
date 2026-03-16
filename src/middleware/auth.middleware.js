const jwt      = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Lazy load User model to avoid circular deps
const getUser = () => require('../modules/auth/user.model');

// ── Protect routes ────────────────────────────────────────────
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) throw new AppError('You are not logged in. Please log in to continue.', 401);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const User = getUser();
  const user = await User.findById(decoded.id).select('-password -refreshToken -passwordResetToken -passwordResetExpires');

  if (!user) throw new AppError('User no longer exists.', 401);
  if (user.isDeactivated) throw new AppError('Your account has been deactivated.', 403);

  req.user = user;
  next();
});

// ── Optional auth (attach user if token exists) ───────────────
exports.optionalAuth = catchAsync(async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const User = getUser();
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (_) {}
  next();
});
