const Voucher = require("../models/voucher.model");
const createError = require("../utils/createError");
const asyncHandler = require("express-async-handler");

const getVouchersByStore = asyncHandler(async (req, res, next) => {
  const { storeId } = req.params;

  try {
    const vouchers = await Voucher.find({ storeId }).populate("storeId");

    res.json(vouchers);
  } catch (error) {
    next(error);
  }
});

const createVoucher = asyncHandler(async (req, res, next) => {
  const { storeId } = req.params;

  try {
    if (!storeId) {
      return next(createError(400, "Missing storeId in params"));
    }

    const voucherData = {
      ...req.body,
      storeId,
    };

    const newVoucher = new Voucher(voucherData);
    const saved = await newVoucher.save();

    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

const getVoucherById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const voucher = await Voucher.findById(id).populate("storeId");

    if (!voucher) {
      return next(createError(404, "Voucher not found"));
    }

    res.json(voucher);
  } catch (error) {
    next(error);
  }
});

const updateVoucher = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const updated = await Voucher.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createError(404, "Voucher not found"));
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

const deleteVoucher = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  try {
    const deleted = await Voucher.findByIdAndDelete(id);

    if (!deleted) {
      return next(createError(404, "Voucher not found"));
    }

    res.json({ message: "Voucher deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  getVouchersByStore,
  createVoucher,
  getVoucherById,
  updateVoucher,
  deleteVoucher
};
