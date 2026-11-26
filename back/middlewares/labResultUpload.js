const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { AppError } = require("./errorHandler");

// Ensure storage directory exists outside of public folder
const STORAGE_DIR = path.resolve(__dirname, "../../storage/lab-results");
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// Memory storage to inspect raw buffer magic bytes before saving to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
    if (!allowedExts.includes(ext)) {
      return cb(
        new AppError(
          "Invalid file extension. Only PDF, JPG, and PNG are allowed.",
          400,
          "INVALID_FILE_TYPE"
        )
      );
    }
    cb(null, true);
  },
});

/**
 * Validates real magic numbers of the file buffer to prevent spoofing
 */
const detectRealMimeType = (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "application/pdf";
  }

  // PNG: 0x89 0x50 0x4E 0x47
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // JPEG / JPG: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  return null;
};

/**
 * Persists an inspected memory file to disk with randomized filename
 */
const saveInspectedFile = async (file) => {
  const realMime = detectRealMimeType(file.buffer);
  if (!realMime) {
    throw new AppError(
      `File "${file.originalname}" failed server MIME validation. Only valid PDF, JPG, and PNG files are accepted.`,
      400,
      "INVALID_FILE_CONTENT"
    );
  }

  const extMap = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
  };
  const ext = extMap[realMime] || path.extname(file.originalname).toLowerCase();
  const randomizedName = `${crypto.randomUUID()}${ext}`;
  const diskPath = path.join(STORAGE_DIR, randomizedName);

  await fs.promises.writeFile(diskPath, file.buffer);

  return {
    fileName: randomizedName,
    originalName: file.originalname,
    mimeType: realMime,
    size: file.size,
    path: diskPath,
    uploadedAt: new Date(),
  };
};

module.exports = {
  labResultUpload: upload,
  STORAGE_DIR,
  detectRealMimeType,
  saveInspectedFile,
};
