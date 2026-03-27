const multer  = require('multer');
const AppError = require('../utils/AppError');

// Use memory storage for serverless (no filesystem)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImages = ['image/jpeg','image/png','image/webp','image/gif'];
  const allowedFiles  = [...allowedImages,
    'application/pdf','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain','application/zip'
  ];

  const allowed = file.fieldname === 'avatar' ? allowedImages : allowedFiles;
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} is not allowed`, 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

exports.uploadAvatar     = upload.single('avatar');
exports.uploadAttachment = upload.single('file');
exports.uploadMultiple   = upload.array('files', 10);
