const ShippingFee = require("../models/shippingFee.model");
const Store = require("../models/store.model");
const asyncHandler = require("express-async-handler");

// Lấy tất cả các bước phí ship theo storeId
const getShippingFeesByStore = asyncHandler(async (req, res) => {
  const { storeId } = req.params;

  const store = await Store.findById(storeId);
  if (!store) {
    return res
      .status(404)
      .json({ status: "error", message: "Không thấy cửa hàng" });
  }

  const steps = await ShippingFee.find({ store: storeId }).sort({
    fromDistance: 1,
  });

  res.status(200).json({
    status: "success",
    data: steps,
  });
});

// Tạo 1 mốc phí ship mới
const createShippingFee = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { fromDistance, feePerKm } = req.body;

  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      status: "error",
      message: "Không thấy cửa hàng",
    });
  }

  // ✅ Kiểm tra đã tồn tại fromDistance trong store chưa
  const exists = await ShippingFee.findOne({ store: storeId, fromDistance });
  if (exists) {
    return res.status(400).json({
      status: "error",
      message: `fromDistance = ${fromDistance} đã tồn tại cho store này.`,
    });
  }

  const newFee = await ShippingFee.create({
    store: storeId,
    fromDistance,
    feePerKm,
  });

  res.status(201).json({
    status: "success",
    message: "Tạo được mức shipping mới",
    data: newFee,
  });
});

// Cập nhật 1 bước phí ship
const updateShippingFee = asyncHandler(async (req, res) => {
  const { feeId } = req.params;
  const { fromDistance, feePerKm } = req.body;

  const existing = await ShippingFee.findById(feeId);
  if (!existing) {
    return res
      .status(404)
      .json({ status: "error", message: "Không thấy mức phí" });
  }

  // ✅ Nếu người dùng đổi fromDistance, cần check trùng
  if (fromDistance !== undefined && fromDistance !== existing.fromDistance) {
    const duplicate = await ShippingFee.findOne({
      store: existing.store,
      fromDistance,
      _id: { $ne: feeId }, // exclude chính nó
    });

    if (duplicate) {
      return res.status(400).json({
        status: "error",
        message: `fromDistance = ${fromDistance} đã tồn tại cho store này.`,
      });
    }
  }

  const updated = await ShippingFee.findByIdAndUpdate(
    feeId,
    { fromDistance, feePerKm },
    { new: true }
  );

  res.status(200).json({
    status: "success",
    message: "Cập nhật mức phí thành công",
    data: updated,
  });
});

// Xoá 1 bước phí ship
const deleteShippingFee = asyncHandler(async (req, res) => {
  const { feeId } = req.params;

  const deleted = await ShippingFee.findByIdAndDelete(feeId);
  if (!deleted) {
    return res
      .status(404)
      .json({ status: "error", message: "Không tìm thấy mức shipping" });
  }

  res.status(200).json({
    status: "success",
    message: "Shipping step deleted",
  });
});

// Tính phí ship dựa trên khoảng cách
const calculateShippingFee = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { distanceKm } = req.body;

  if (!distanceKm || isNaN(distanceKm)) {
    return res
      .status(400)
      .json({ status: "error", message: "Khoảng cách không hợp lệ" });
  }

  const steps = await ShippingFee.find({ store: storeId }).sort({
    fromDistance: 1,
  });

  if (!steps.length) {
    return res
      .status(404)
      .json({ status: "error", message: "Không có mức phí shipping" });
  }

  let totalFee = 0;
  const distance = parseFloat(distanceKm);

  for (let i = 0; i < steps.length; i++) {
    const current = steps[i];
    const next = steps[i + 1];

    const start = current.fromDistance;
    const end = next ? next.fromDistance : distance;

    if (distance > start) {
      const segmentDistance = Math.min(distance, end) - start;
      totalFee += segmentDistance * current.feePerKm;
    }
  }

  res.status(200).json({
    status: "success",
    fee: totalFee,
  });
});

module.exports = {
  getShippingFeesByStore,
  createShippingFee,
  updateShippingFee,
  deleteShippingFee,
  calculateShippingFee,
};
