const Store = require("../models/store.model");
const Topping = require("../models/topping.model");
const Dish = require("../models/dish.model");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const OrderItemTopping = require("../models/orderItemTopping.model");
const OrderShipInfo = require("../models/orderShipInfo.model");
const OrderVoucher = require("../models/orderVoucher.model");
const SystemCategory = require("../models/systemCategory.model");
const Cart = require("../models/cart.model");
const CartItem = require("../models/cartItem.model");
const CartItemTopping = require("../models/cartItemTopping.model");
const ToppingGroup = require("../models/toppingGroup.model");
const Rating = require("../models/rating.model");
const Notification = require("../models/notification.model");
const createError = require("../utils/createError");
const asyncHandler = require("express-async-handler");
const { getPaginatedData } = require("../utils/paging");
const mongoose = require("mongoose");

const getUserOrder = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!userId) {
    return next(createError(400, "User not found"));
  }

  const orders = await Order.find({ userId })
    .populate({
      path: "store",
      select: "name avatar status",
    })
    .populate({
      path: "items",
      populate: [
        {
          path: "dish",
          select: "name price image",
        },
        {
          path: "toppings",
        },
      ],
    })
    .populate({
      path: "user",
      select: "name avatar",
    })
    .sort({ updatedAt: -1 })
    .lean();

  // Lọc các đơn có store hợp lệ
  const filteredOrders = orders.filter((order) => order.store?.status === "APPROVED");

  if (!filteredOrders.length) {
    return next(createError(404, "No orders found"));
  }

  // Lấy thông tin giao hàng
  const orderIds = filteredOrders.map((order) => order._id);
  const shipInfos = await OrderShipInfo.find({ orderId: { $in: orderIds } }).lean();
  const shipMap = Object.fromEntries(shipInfos.map((info) => [info.orderId.toString(), info]));

  // Trả về kết quả
  const result = filteredOrders.map((order) => ({
    ...order,
    shipInfo: shipMap[order._id.toString()] || null,
  }));

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getOrderDetail = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  if (!orderId) {
    return next(createError(400, "orderId not found"));
  }

  // Lấy Order + Store + Items + Dish + Toppings
  const order = await Order.findById(orderId)
    .populate({
      path: "store",
      select: "name avatar",
    })
    .populate({
      path: "items",
      populate: [
        {
          path: "dish",
          select: "name price image description",
        },
        {
          path: "toppings",
          select: "name price",
        },
      ],
    })
    .lean();

  if (!order) {
    return next(createError(404, "Order not found"));
  }

  // Lấy thông tin giao hàng
  const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();

  // Lấy danh sách voucher đã áp dụng
  const orderVouchers = await OrderVoucher.find({ orderId })
    .populate({
      path: "voucherId",
      select: "code description discountType discountValue maxDiscount",
    })
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      ...order,
      shipInfo: shipInfo || null,
      vouchers: orderVouchers || [],
    },
  });
});

const getOrderDetailForStore = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate({
        path: "store",
        select: "name avatar",
      })
      .populate({
        path: "user",
        select: "name avatar",
      })
      .populate({
        path: "items",
        populate: [
          {
            path: "dish",
            select: "name price image description",
          },
          {
            path: "toppings",
          },
        ],
      })
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const shipInfo = await OrderShipInfo.findOne({ orderId }).lean();

    return res.status(200).json({
      success: true,
      data: {
        ...order,
        shipInfo: shipInfo || null,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid order ID format" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getFinishedOrders = asyncHandler(async (req, res, next) => {
  try {
    const finishedOrders = await Order.find({ status: "finished" })
      .populate({ path: "store", select: "name avatar" })
      .populate({ path: "user", select: "name avatar" })
      .populate({
        path: "items",
        populate: [
          {
            path: "dish",
            select: "name image price",
          },
          {
            path: "toppings",
          },
        ],
      })
      .sort({ updatedAt: -1 })
      .lean();

    if (!finishedOrders || finishedOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có đơn hàng nào đã hoàn tất.",
        count: 0,
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đơn hàng đã hoàn tất thành công.",
      count: finishedOrders.length,
      data: finishedOrders,
    });
  } catch (err) {
    return next(
      createError(500, {
        success: false,
        message: "Đã xảy ra lỗi khi lấy đơn hàng.",
        error: err.message,
      })
    );
  }
});

const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const order = await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" });

  if (!order) {
    return next(createError(404, "Order not found"));
  }

  const currentStatus = order.status;

  const validTransitions = {
    taken: ["delivering", "finished"],
    delivering: ["delivered"],
    taken: ["done"],
  };

  if (status === currentStatus) {
    return next(createError(400, `Order is already in '${status}' status.`));
  }

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
    return next(createError(400, `Cannot change status from '${currentStatus}' to '${status}'.`));
  }

  order.status = status;
  await order.save();

  const populatedOrder = await Order.findById(orderId)
    .populate({ path: "store", select: "name avatar" })
    .populate({ path: "user", select: "name avatar" })
    .populate({
      path: "items",
      populate: {
        path: "toppings",
        select: "toppingName price",
      },
    })
    .lean();

  const items = (populatedOrder.items || []).map((item) => ({
    dishName: item.dishName,
    quantity: item.quantity,
    price: item.price,
    note: item.note,
    toppings: item.toppings || [],
  }));

  res.status(200).json({
    success: true,
    message: `Order status updated to '${status}' successfully`,
    data: {
      ...populatedOrder,
      items,
    },
  });
});

const cancelOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await Order.findById(orderId);
  if (!order) {
    return next(createError(404, "Order not found"));
  }

  if (order.userId.toString() !== userId.toString()) {
    return next(createError(403, "You are not authorized to cancel this order"));
  }

  const cancellableStatuses = ["preorder", "pending"];

  if (cancellableStatuses.includes(order.status)) {
    await Order.findByIdAndDelete(orderId);

    res.status(200).json({
      success: true,
      message: "Order has been cancelled and deleted successfully",
    });
  } else {
    res.status(409).json({
      success: false,
      message: `Cannot cancel an order with status '${order.status}'. Only pending orders can be cancelled.`,
    });
  }
});

const getOrderStats = asyncHandler(async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();

    // Lấy thời gian đầu và cuối của tháng hiện tại
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    const ordersThisMonth = await Order.countDocuments({
      createdAt: {
        $gte: startOfMonth,
        $lt: endOfMonth,
      },
    });

    res.status(200).json({
      code: 200,
      message: "Lấy thống kê đơn hàng thành công",
      data: {
        totalOrders,
        ordersThisMonth,
      },
    });
  } catch (error) {
    next(error);
  }
});

const getMonthlyOrderStats = asyncHandler(async (req, res, next) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          month: "$_id",
          total: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);

    // Chuyển thành array đủ 12 tháng
    const fullStats = Array.from({ length: 12 }, (_, i) => {
      const stat = stats.find((s) => s.month === i + 1);
      return {
        name: `Tháng ${i + 1}`,
        total: stat ? stat.total : 0,
      };
    });

    res.status(200).json({
      code: 200,
      message: "Lấy thống kê đơn hàng theo tháng thành công",
      data: fullStats,
    });
  } catch (error) {
    next(error);
  }
});

const getAllOrder = async (req, res) => {
  try {
    const { status, limit, page, name } = req.query;
    const { storeId } = req.params;

    let filterOptions = { storeId };

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(",");
      filterOptions.status = { $in: statusArray };
    }

    // Add search filter for customerName or customerPhonenumber
    if (name && name.trim() !== "") {
      const regex = new RegExp(name, "i");
      filterOptions.$or = [{ customerName: regex }, { customerPhonenumber: regex }];
    }

    const response = await getPaginatedData(
      Order,
      filterOptions,
      [
        { path: "store", select: "name avatar" },
        { path: "user", select: "name email avatar" },
        {
          path: "items",
          populate: [
            { path: "dish", select: "name price image description" },
            {
              path: "toppings",
            },
          ],
        },
      ],
      limit,
      page
    );

    // Filter in-memory again for user.name
    if (name && name.trim() !== "") {
      const regex = new RegExp(name, "i");
      response.data = response.data.filter(
        (order) =>
          order.user?.name?.match(regex) || order.customerName?.match(regex) || order.customerPhonenumber?.match(regex)
      );
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const updatedData = req.body;

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Filter out empty strings or undefined/null fields
    const filteredData = {};
    for (const key in updatedData) {
      const value = updatedData[key];
      if (value !== "" && value !== null && value !== undefined) {
        filteredData[key] = value;
      }
    }
    delete filteredData.shipper;

    Object.assign(order, filteredData);
    await order.save();

    return res.status(200).json({
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const reOrder = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid orderId" });
    }

    const order = await Order.findById(orderId)
      .populate("store")
      .populate({
        path: "items",
        populate: [{ path: "dish", select: "stockStatus" }, { path: "toppings" }],
      });

    if (!order || !order.store) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.store.status === "BLOCKED") {
      return res.status(403).json({ success: false, message: "Cannot reorder from a blocked store" });
    }

    // Kiểm tra món nào đã hết hàng
    const hasOutOfStock = order.items.some((item) => item.dish?.stockStatus === "OUT_OF_STOCK");

    if (hasOutOfStock) {
      return res.status(403).json({ success: false, message: "Some dishes are out of stock" });
    }

    // Xoá cart cũ nếu tồn tại
    const oldCart = await Cart.findOne({ userId, storeId: order.store._id });
    if (oldCart) {
      const oldCartItemIds = await CartItem.find({ cartId: oldCart._id }).distinct("_id");
      await CartItemTopping.deleteMany({ cartItemId: { $in: oldCartItemIds } });
      await CartItem.deleteMany({ cartId: oldCart._id });
      await Cart.deleteOne({ _id: oldCart._id });
    }

    // Tạo giỏ hàng mới
    const newCart = await Cart.create({ userId, storeId: order.store._id });

    // Lặp qua các món cũ và tạo mới trong giỏ hàng
    for (const item of order.items) {
      const cartItem = await CartItem.create({
        cartId: newCart._id,
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        note: item.note,
      });

      // Nếu có topping thì thêm vào
      if (item.toppings?.length) {
        const toppingDocs = item.toppings.map((t) => ({
          cartItemId: cartItem._id,
          toppingId: t.toppingId,
          toppingName: t.toppingName,
          price: t.price,
        }));
        await CartItemTopping.insertMany(toppingDocs);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Reorder successful",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserOrder,
  getOrderDetail,
  getFinishedOrders,
  updateOrderStatus,
  getOrderStats,
  getMonthlyOrderStats,
  cancelOrder,
  getAllOrder,
  updateOrder,
  getOrderDetailForStore,
  reOrder,
};
