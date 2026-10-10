const asyncHandler = require("express-async-handler")
const { AppError } = require("../../middlewares/errorHandler")
const userService = require("./user.service")


const createUser = asyncHandler(async (req, res) => {
    const user = await userService.createUser(req.body, req.user);
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
        success: true,
        message: "User created successfully",
        data: userResponse,
    });
});

const getUsers = asyncHandler(async (req, res) => {
    const { data: users, pagination } =
        await userService.getUsers(req.validatedQuery);

    res.status(200).json({
        success: true,
        data: users,
        pagination,
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await userService.getUserById(req.params.id)

    if (!user) {
        throw new AppError(
            "User not found",
            404,
            "USER_NOT_FOUND"
        );
    }

    res.status(200).json({
        success: true,
        data: user,
    });
})


const updateUser = asyncHandler(async (req, res) => {
    const user = await userService.updateUser(
        req.params.id,
        req.body,
        req.user
    )

    if (!user) {
        throw new AppError(
            "User not found",
            404,
            "USER_NOT_FOUND"
        );
    }

    res.status(200).json({
        success: true,
        message : "User Updated Successfully",
        data: user,
    });
})

const deactivateUser = asyncHandler(async (req, res) => {
    const user = await userService.deactivateUser(req.params.id, req.user);
    if (!user) {
        throw new AppError(
            "User not found",
            404,
            "USER_NOT_FOUND"
        );
    }
    res.status(200).json({
        success: true,
        message: "User deactivated successfully",
    });
});

const updateProfilePhoto = asyncHandler(async (req, res) => {
  const user = await userService.updateProfilePhoto(
    req.user._id,
    req.file,
    req.user
  );

  res.status(200).json({
    success: true,
    message: "Profile photo updated successfully",
    data: {
      profilePhoto: user.profilePhoto,
    },
  });
});

module.exports = {
    getUsers,getUserById,createUser,deactivateUser,updateUser,updateProfilePhoto
}