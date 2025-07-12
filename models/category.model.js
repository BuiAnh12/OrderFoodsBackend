const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true },
  // sortOrder thứ tự sắp xếp hiển thị trong cửa hàng
  sortOrder: {
    type: Number,
    required: false,
    default: 1,
  },
});

module.exports = mongoose.model("Category", categorySchema);
