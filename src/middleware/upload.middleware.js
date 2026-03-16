const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const AppError = require('../utils/AppError');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = file.fieldname === 'avatar' ? 'avatars' : 'attachments';
    const dir = path.join(uploadDir, subDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = {
    avatar:     ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    attachment: ['image/jpeg', 'image/png', 'image/gif', 'image/webp',
                 'application/pdf', 'application/msword',
                 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                 'application/vnd.ms-excel',
                 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                 'text/plain', 'application/zip'],
  };

  const type = file.fieldname === 'avatar' ? 'avatar' : 'attachment';
  if (allowed[type].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${file.mimetype} is not allowed`, 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

exports.uploadAvatar     = upload.single('avatar');
exports.uploadAttachment = upload.single('file');
exports.uploadMultiple   = upload.array('files', 10);
