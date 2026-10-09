const express = require("express");

const router = express.Router();

const userController = require("./user.controller");
const {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} = require("./user.validation");

const { validate, validateQuery, validateId } = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const authorize = require("../../middlewares/authorize");
const upload = require("../../middlewares/upload");

router.patch(
  "/profile-photo",
  protect,
  upload.single("profilePhoto"),
  userController.updateProfilePhoto
);

// Create User
router.post(
  "/",
  protect,
  authorize("admin"),
  validate(createUserSchema),
  userController.createUser
);

// Get All Users
router.get(
  "/",
  protect,
  authorize("admin"),
  validateQuery(userListQuerySchema),
  userController.getUsers
);

// Get User By ID
router.get(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "user ID"),
  userController.getUserById
);

// Update User
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "user ID"),
  validate(updateUserSchema),
  userController.updateUser
);

// Deactivate User
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  validateId("id", "user ID"),
  userController.deactivateUser
);

module.exports = router;