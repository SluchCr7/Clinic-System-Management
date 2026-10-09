const { AppError } = require("../middlewares/errorHandler");

const validateFileSignature = (buffer, allowedTypes = ["image", "pdf"]) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new AppError("Invalid or empty file content", 400, "INVALID_FILE");
  }

  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  const isWebp =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  const isPdf =
    buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";

  const isImage = isJpeg || isPng || isWebp;

  if (allowedTypes.includes("image") && isImage) {
    return isJpeg ? "image/jpeg" : isPng ? "image/png" : "image/webp";
  }

  if (allowedTypes.includes("pdf") && isPdf) {
    return "application/pdf";
  }

  throw new AppError(
    `File signature does not match allowed file formats (${allowedTypes.join(", ")})`,
    400,
    "INVALID_FILE_SIGNATURE"
  );
};

module.exports = { validateFileSignature };
