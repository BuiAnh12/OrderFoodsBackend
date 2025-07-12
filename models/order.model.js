const mongoose = require("mongoose");

// Order Schema
var orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "finished", "taken", "delivering", "delivered", "done", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "credit_card"],
    },
    subtotalPrice: {
      type: Number,
      required: false,
    },
    totalDiscount: {
      type: Number,
      required: false,
    },
    shippingFee: {
      type: Number,
      required: false,
    },
    finalTotal: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
