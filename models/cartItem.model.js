const mongoose = require("mongoose");

var cartItemSchema = new mongoose.Schema(
  {
    cartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
      require: true,
    },
    dishId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dish",
      require: true,
    },
    dishName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    note: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CartItem", cartItemSchema);
