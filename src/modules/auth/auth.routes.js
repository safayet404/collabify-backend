const express  = require('express');
const router   = express.Router();
const ctrl     = require('./auth.controller');
const { protect } = require('../../middleware/auth.middleware');
const { uploadAvatar } = require('../../middleware/upload.middleware');
const validate = require('../../middleware/validate.middleware');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  updateProfileValidator,
} = require('./auth.validator');

// Public routes
router.post('/register',        registerValidator,       validate, ctrl.register);
router.post('/login',           loginValidator,          validate, ctrl.login);
router.post('/refresh-token',                                      ctrl.refreshToken);
router.post('/forgot-password', forgotPasswordValidator, validate, ctrl.forgotPassword);
router.post('/reset-password',  resetPasswordValidator,  validate, ctrl.resetPassword);

// Protected routes
router.use(protect);
router.post  ('/logout',          ctrl.logout);
router.get   ('/me',              ctrl.getMe);
router.patch ('/profile',         updateProfileValidator, validate, ctrl.updateProfile);
router.post  ('/avatar',          uploadAvatar,                     ctrl.uploadAvatar);
router.patch ('/change-password', changePasswordValidator, validate, ctrl.changePassword);
router.delete('/account',         ctrl.deleteAccount);

module.exports = router;
