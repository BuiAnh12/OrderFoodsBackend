const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");

const {
  getQRCode,
  handleVnpReturn,
  handleVnpIpn,
} = require("../controllers/payment.controller");

const router = express.Router();

// Generate QR code (payment URL)
router.get("/vnpay/qrcode/:orderId", getQRCode);

// Return URL handler (VNPay will redirect user here)
router.get("/vnpay/return", handleVnpReturn);

// IPN handler (VNPay sends payment result via server-to-server)
router.get("/vnpay/ipn", handleVnpIpn);

module.exports = router;
