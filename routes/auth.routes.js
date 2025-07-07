const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  register,
  login,
  loginAdmin,
  logout,
  getRefreshToken,
  changePassword,
  resetPassword,
  forgotPassword,
  checkOTP,
  googleLoginWithToken,
  storeOwnByUser,
  registerStoreOwner,
  checkRegisterStoreOwner,
  forgotPasswordEmployee,
  checkOTPForEmployee,
  resetPasswordEmployee,
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/register/store-owner", registerStoreOwner);
router.get("/check-register-store-owner/:email", checkRegisterStoreOwner);
router.post("/login", login);
router.post("/store", authMiddleware, storeOwnByUser);
router.post("/login/admin", loginAdmin);
router.post("/login/google", googleLoginWithToken);
router.post("/forgot-password", forgotPassword);
router.post("/check-otp", checkOTP);
router.post("/forgot-password/employee", forgotPasswordEmployee);
router.get("/logout", logout);
router.post("/check-otp/employee", checkOTPForEmployee);
router.get("/refresh", getRefreshToken);
router.put("/change-password", authMiddleware, changePassword);
router.put("/reset-password", resetPassword);
router.put("/reset-password/employee", resetPasswordEmployee);

module.exports = router;
