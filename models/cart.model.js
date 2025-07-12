const mongoose = require("mongoose");

// cart schema
var cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      require: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      require: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
