const cloudinary = require("../config/cloudinary");
const {AppError} = require("../middlewares/errorHandler");

const uploadToCloudinary = (
  buffer,
  folder,
  resourceType = "auto"
) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          return reject(
            new AppError(
              "Failed to upload file",
              500,
              "CLOUDINARY_UPLOAD_FAILED"
            )
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;

  const result = await cloudinary.uploader.destroy(
    publicId,
    {
      resource_type: resourceType,
    }
  );

  if (
    result.result !== "ok" &&
    result.result !== "not found"
  ) {
    throw new AppError(
      "Failed to delete file",
      500,
      "CLOUDINARY_DELETE_FAILED"
    );
  }

  return result;
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};