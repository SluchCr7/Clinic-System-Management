const express = require("express");

const router = express.Router();

const authController = require("./auth.controller");
const validate = require("../../middlewares/validation");
const protect = require("../../middlewares/auth");
const {
    loginSchema,
    changePasswordSchema
} = require("./auth.validation");


// Login
router.post(
  "/login",
  validate(loginSchema),
  authController.login
);

router.get(
  "/me",
  protect,
  authController.getMe
);

router.get(
  "/logout",
  authController.logout
);

router.post(
  "/logout",
  authController.logout
);

router.post(
    "/refresh",
    authController.refreshAccessToken
)

router.patch(
  "/change-password",
  protect,
  validate(changePasswordSchema),
  authController.changePassword
);

module.exports = router;