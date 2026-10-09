const multer = require("multer");
const path = require("path");
const { AppError } = require("./errorHandler");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
  ];

  const fileExtension = path
    .extname(file.originalname)
    .toLowerCase();

  const isValidMimeType =
    allowedMimeTypes.includes(file.mimetype);

  const isValidExtension =
    allowedExtensions.includes(fileExtension);

  if (!isValidMimeType || !isValidExtension) {
    return cb(
      new AppError(
        "Only JPEG, PNG, WebP, and PDF files are allowed",
        400,
        "INVALID_FILE_TYPE"
      )
    );
  }

  cb(null, true);
};

const medicalAttachmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = medicalAttachmentUpload;