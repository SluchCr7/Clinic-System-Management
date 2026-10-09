const User = require("./user.model");
const bcrypt = require("bcrypt");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../utils/cloudinary");
const { validateFileSignature } = require("../../utils/validateFileSignature");
const { AppError } = require("../../middlewares/errorHandler");
const auditLogService = require("../AuditLog/auditLog.service");
const { paginateQuery } = require("../../utils/pagination");
const { getSearchRegex, getSort } = require("../../utils/listQuery");

const createUser = async (data, currentUser = null) => {
  const hashedPassword = await bcrypt.hash(data.password, 12);

  const user = await User.create({
    ...data,
    password: hashedPassword,
  });

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "USER_CREATED",
      resource: "User",
      resourceId: user._id,
      details: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    });
  }

  return user;
};

const getUsers = async (query = {}) => {
  const filter = {};

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isActive !== undefined) {
    filter.isActive =
      query.isActive === true || query.isActive === "true";
  }

  const searchRegex = getSearchRegex(query.search);
  if (searchRegex) {
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  return paginateQuery(
    User.find(filter).sort(
      getSort(
        query,
        [
          "firstName",
          "lastName",
          "email",
          "role",
          "lastLogin",
          "createdAt",
          "updatedAt",
        ],
        "createdAt"
      )
    ),
    User.countDocuments(filter),
    query.page,
    query.limit
  );
};

const getUserById = async (id) => {
  const user = await User.findById(id);

  return user;
};

const updateUser = async (id, data, currentUser = null) => {
  const user = await User.findById(id);

  if (!user) {
    return null;
  }

  if (
    user.role === "admin" &&
    ((data.isActive !== undefined && !data.isActive) ||
      (data.role && data.role !== "admin"))
  ) {
    const activeAdminsCount = await User.countDocuments({
      role: "admin",
      isActive: true,
      _id: { $ne: user._id },
    });

    if (activeAdminsCount === 0) {
      throw new AppError(
        "Cannot deactivate or reassign the last active administrator",
        400,
        "CANNOT_DEACTIVATE_LAST_ADMIN"
      );
    }
  }

  const previousValues = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
  };

  Object.assign(user, data);

  if (currentUser?._id) {
    user.updatedBy = currentUser._id;
  }

  await user.save();

  const newValues = {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
  };

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "USER_UPDATED",
      resource: "User",
      resourceId: user._id,
      details: {
        previousValues,
        newValues,
      },
    });
  }

  return user;
};

const deactivateUser = async (id, currentUser = null) => {
  const user = await User.findById(id);

  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    const activeAdminsCount = await User.countDocuments({
      role: "admin",
      isActive: true,
      _id: { $ne: user._id },
    });

    if (activeAdminsCount === 0) {
      throw new AppError(
        "Cannot deactivate the last active administrator",
        400,
        "CANNOT_DEACTIVATE_LAST_ADMIN"
      );
    }
  }

  const previousIsActive = user.isActive;

  user.isActive = false;

  if (currentUser?._id) {
    user.updatedBy = currentUser._id;
  }

  await user.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "USER_DEACTIVATED",
      resource: "User",
      resourceId: user._id,
      details: {
        previousIsActive,
        newIsActive: false,
      },
    });
  }

  return user;
};

const updateProfilePhoto = async (userId, file, currentUser = null) => {
  if (!file) {
    throw new AppError(
      "Profile photo is required",
      400,
      "PROFILE_PHOTO_REQUIRED"
    );
  }

  validateFileSignature(file.buffer, ["image"]);

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(
      "User not found",
      404,
      "USER_NOT_FOUND"
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Account is inactive",
      403,
      "ACCOUNT_INACTIVE"
    );
  }

  const previousPhoto = user.profilePhoto
    ? {
        publicId: user.profilePhoto.publicId,
      }
    : null;

  const uploadedImage = await uploadToCloudinary(
    file.buffer,
    "clinic-management/users"
  );

  user.profilePhoto = {
    url: uploadedImage.url,
    publicId: uploadedImage.publicId,
  };

  await user.save();

  if (currentUser?._id) {
    await auditLogService.logActivity({
      actor: currentUser,
      action: "PROFILE_PHOTO_UPDATED",
      resource: "User",
      resourceId: user._id,
      details: {
        previousPhoto,
        newPhoto: {
          publicId: uploadedImage.publicId,
        },
      },
    });
  }

  if (previousPhoto?.publicId) {
    try {
      await deleteFromCloudinary(previousPhoto.publicId);
    } catch (error) {
      console.error(
        "Failed to delete old profile photo:",
        error.message
      );
    }
  }

  return user;
};

module.exports = {
  createUser,
  getUsers,
  updateProfilePhoto,
  getUserById,
  updateUser,
  deactivateUser,
};