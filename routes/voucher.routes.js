const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const {
  createVoucher,
  getVouchersByStore,
  updateVoucher,
  getVoucherById,
  deleteVoucher,
} = require("../controllers/voucher.controller");

const router = express.Router();

router.get("/stores/:storeId/vouchers", getVouchersByStore);

router.post("/stores/:storeId/vouchers", createVoucher);

router.put("/stores/:storeId/vouchers/:id", updateVoucher);
router.get("/stores/:storeId/vouchers/:id", getVoucherById);
router.delete("/stores/:storeId/vouchers/:id", deleteVoucher);

module.exports = router;
