const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
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
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    ratingValue: {
      type: Number,
      required: true,
      min: 1,
      max: 5, // 1-5 star rating system
    },
    comment: {
      type: String,
      default: "", // Empty string if no comment
    },
    images: [
      {
        filePath: String,
        url: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rating", ratingSchema);
