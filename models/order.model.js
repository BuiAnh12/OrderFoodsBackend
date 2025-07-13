const mongoose = require("mongoose");

// Order Schema
const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storeId: {
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
    },
    totalDiscount: {
      type: Number,
    },
    shippingFee: {
      type: Number,
    },
    finalTotal: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

orderSchema.virtual("items", {
  ref: "OrderItem",
  localField: "_id",
  foreignField: "orderId",
});

orderSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true,
});

orderSchema.virtual("store", {
  ref: "Store",
  localField: "storeId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("Order", orderSchema);
