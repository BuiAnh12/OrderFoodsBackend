const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const {
  register,
  login,
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
} = require("../controllers/auth.controller");

const router = express.Router();

router.post("/register", register);
router.post("/register/store-owner", registerStoreOwner);
router.get("/check-register-store-owner/:email", checkRegisterStoreOwner);
router.post("/login", login);
router.post("/store", authMiddleware, storeOwnByUser);
router.post("/login/google", googleLoginWithToken);
router.post("/forgot-password", forgotPassword);
router.post("/check-otp", checkOTP);

router.get("/logout", logout);
router.get("/refresh", getRefreshToken);

router.put("/change-password", authMiddleware, changePassword);
router.put("/reset-password", resetPassword);

module.exports = router;
