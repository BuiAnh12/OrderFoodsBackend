const mongoose = require("mongoose");

var orderItemToppingSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrderItem",
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

orderItemToppingSchema.virtual("topping", {
  ref: "Topping",
  localField: "toppingId",
  foreignField: "_id",
  justOne: true,
});

module.exports = mongoose.model("OrderItemTopping", orderItemToppingSchema);
