const multer = require("multer");
const path = require("path");

const { AppError } = require("./errorHandler");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ];

  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const isValidMimeType =
    allowedMimeTypes.includes(file.mimetype);

  const isValidExtension =
    allowedExtensions.includes(extension);

  if (!isValidMimeType || !isValidExtension) {
    return cb(
      new AppError(
        "Only JPEG, PNG, and WebP images are allowed",
        400,
        "INVALID_FILE_TYPE"
      )
    );
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = upload;