const mongoose = require("mongoose");

var cartItemToppingSchema = new mongoose.Schema(
  {
    cartItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CartItem",
      require: true,
    },
    toppingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topping",
      require: true,
    },
    toppingName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CartItemTopping", cartItemToppingSchema);
