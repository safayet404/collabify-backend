const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => ({ field: e.path, message: e.msg }));
    return res.status(400).json({ success: false, message: 'Validation failed', errors: messages });
  }
  next();
};

module.exports = validate;
