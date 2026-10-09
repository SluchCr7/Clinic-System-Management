// const bcrypt = require("bcrypt");
// const mongoose = require("mongoose");
// const User = require("../modules/User/user.model");
// const { generateAccessToken, generateRefreshToken } = require("../middlewares/generateToken");

// const createTestUser = async ({
//   role = "admin",
//   email,
//   password = "Password123!",
//   firstName = "Test",
//   lastName = "User",
//   isActive = true,
// } = {}) => {
//   const userEmail = email || `test-${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}@clinic.com`;
//   const hashedPassword = await bcrypt.hash(password, 10);
//   const user = await User.create({
//     firstName,
//     lastName,
//     email: userEmail,
//     password: hashedPassword,
//     role,
//     isActive,
//   });

//   const accessToken = generateAccessToken(user);
//   const refreshToken = generateRefreshToken(user);

//   return {
//     user,
//     plainPassword: password,
//     accessToken,
//     refreshToken,
//     authHeader: `Bearer ${accessToken}`,
//     cookies: [`accessToken=${accessToken}`, `refreshToken=${refreshToken}`],
//   };
// };

// const cleanCollections = async (...models) => {
//   for (const model of models) {
//     if (model && model.deleteMany) {
//       await model.deleteMany({});
//     }
//   }
// };

// module.exports = {
//   createTestUser,
//   cleanCollections,
// };
