const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { AppError } = require("./errorHandler");

/**
 * Resolves the storage directory safely for both standard servers and
 * serverless / read-only execution environments (such as AWS Lambda or Vercel).
 */
const getStorageDir = () => {
  if (process.env.LAB_RESULTS_STORAGE_DIR) {
    return path.resolve(process.env.LAB_RESULTS_STORAGE_DIR);
  }

  // Detect serverless environment (/var/task or Lambda / Vercel env vars)
  const isServerless = Boolean(
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.VERCEL ||
    __dirname.startsWith("/var/task")
  );

  if (isServerless) {
    return path.join(os.tmpdir(), "clinic-storage", "lab-results");
  }

  return path.resolve(__dirname, "../../storage/lab-results");
};

let resolvedStorageDir = getStorageDir();

/**
 * Ensures the target storage folder exists, falling back to os.tmpdir() if read-only.
 */
const ensureStorageDir = async () => {
  try {
    if (!fs.existsSync(resolvedStorageDir)) {
      await fs.promises.mkdir(resolvedStorageDir, { recursive: true });
    }
  } catch {
    // If standard path is not writable (e.g. read-only container), fallback to temp directory
    resolvedStorageDir = path.join(os.tmpdir(), "clinic-storage", "lab-results");
    if (!fs.existsSync(resolvedStorageDir)) {
      await fs.promises.mkdir(resolvedStorageDir, { recursive: true });
    }
  }
  return resolvedStorageDir;
};

// Safe non-crashing initialization at module load
try {
  if (!fs.existsSync(resolvedStorageDir)) {
    fs.mkdirSync(resolvedStorageDir, { recursive: true });
  }
} catch {
  try {
    resolvedStorageDir = path.join(os.tmpdir(), "clinic-storage", "lab-results");
    if (!fs.existsSync(resolvedStorageDir)) {
      fs.mkdirSync(resolvedStorageDir, { recursive: true });
    }
  } catch {
    // Silently continue at load time; ensureStorageDir will handle it on upload
  }
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

  const targetDir = await ensureStorageDir();
  const diskPath = path.join(targetDir, randomizedName);

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
  STORAGE_DIR: resolvedStorageDir,
  getStorageDir,
  ensureStorageDir,
  detectRealMimeType,
  saveInspectedFile,
};
