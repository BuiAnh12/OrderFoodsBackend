const mongoose = require("mongoose");

var voucherSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },
    discountValue: {
      type: Boolean,
      required: true,
    },
    maxDiscount: {
      type: Number, // optional, chỉ dùng cho PERCENTAGE
    },
    minOrderAmount: {
      type: Number, // chỉ áp dụng khi đơn hàng đủ điều kiện
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number, // số lượt sử dụng tối đa
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    userLimit: {
      type: Number, // số lượt sử dụng tối đa
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isStackable: {
      type: Boolean,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Voucher", voucherSchema);
