const Store = require("../models/store.model");
const Topping = require("../models/topping.model");
const Dish = require("../models/dish.model");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const OrderItemTopping = require("../models/orderItemTopping.model");
const OrderShipInfo = require("../models/orderShipInfo.model");
const FoodType = require("../models/foodType.model");
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
    const error = new Error("User not found");
    error.status = 400;
    return next(error);
  }

  // Lấy danh sách đơn hàng
  let orders = await Order.find({ user: userId })
    .populate({
      path: "store",
      select: "name avatar",
    })
    .sort({ updatedAt: -1 });

  // Lọc các đơn có store hợp lệ
  orders = orders.filter((order) => order.store?.status === "APPROVED");
  if (!orders.length) {
    const error = new Error("Order not found");
    error.status = 404;
    return next(error);
  }

  const orderIds = orders.map((o) => o._id);

  // Lấy item & topping
  const orderItems = await OrderItem.find({ orderId: { $in: orderIds } });
  const orderItemIds = orderItems.map((item) => item._id);
  const orderToppings = await OrderItemTopping.find({ orderItemId: { $in: orderItemIds } });

  // Lấy ship info
  const shipInfos = await OrderShipInfo.find({ orderId: { $in: orderIds } });
  const orderIdToShip = {};
  shipInfos.forEach((info) => {
    orderIdToShip[info.orderId.toString()] = {
      address: info.address,
      detailAddress: info.detailAddress,
      contactName: info.contactName,
      contactPhonenumber: info.contactPhonenumber,
      note: info.note,
      shipLocation: info.shipLocation,
    };
  });

  // Gộp topping vào item
  const itemIdToToppings = {};
  orderToppings.forEach((t) => {
    const key = t.orderItemId.toString();
    if (!itemIdToToppings[key]) itemIdToToppings[key] = [];
    itemIdToToppings[key].push({
      toppingName: t.toppingName,
      price: t.price,
    });
  });

  // Gộp item vào order
  const orderIdToItems = {};
  orderItems.forEach((item) => {
    const key = item.orderId.toString();
    if (!orderIdToItems[key]) orderIdToItems[key] = [];
    orderIdToItems[key].push({
      dishName: item.dishName,
      quantity: item.quantity,
      price: item.price,
      note: item.note,
      toppings: itemIdToToppings[item._id.toString()] || [],
    });
  });

  // Trả về kết quả đầy đủ
  const result = orders.map((order) => ({
    _id: order._id,
    store: order.store,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotalPrice: order.subtotalPrice,
    totalDiscount: order.totalDiscount,
    shippingFee: order.shippingFee,
    finalTotal: order.finalTotal,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    shipInfo: orderIdToShip[order._id.toString()] || null,
    items: orderIdToItems[order._id.toString()] || [],
  }));

  return res.status(200).json({
    success: true,
    data: result,
  });
});

const getOrderDetail = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  if (!orderId) {
    return next(createError(400, "orderId not found"));
  }

  const order = await Order.findById(orderId).populate({
    path: "store",
    select: "name avatar",
  });
  if (!order) {
    return next(createError(404, "Order not found"));
  }

  const items = await OrderItem.find({ orderId: order._id });
  const itemIds = items.map((i) => i._id);
  const toppings = await OrderItemTopping.find({ orderItemId: { $in: itemIds } });
  const shipInfo = await OrderShipInfo.findOne({ orderId: order._id });

  const toppingMap = {};
  toppings.forEach((t) => {
    const key = t.orderItemId.toString();
    if (!toppingMap[key]) toppingMap[key] = [];
    toppingMap[key].push({ toppingName: t.toppingName, price: t.price });
  });

  const itemsWithToppings = items.map((item) => ({
    dishName: item.dishName,
    quantity: item.quantity,
    price: item.price,
    note: item.note,
    toppings: toppingMap[item._id.toString()] || [],
  }));

  return res.status(200).json({
    success: true,
    data: {
      ...order.toObject(),
      items: itemsWithToppings,
      shipInfo,
    },
  });
});

const getOrderDetailForStore = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate({ path: "store", select: "name avatar", select: "name" })
      .populate({ path: "user", select: "name email avatar", select: "name email avatar" });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const items = await OrderItem.find({ orderId: order._id });
    const itemIds = items.map((i) => i._id);
    const toppings = await OrderItemTopping.find({ orderItemId: { $in: itemIds } });
    const shipInfo = await OrderShipInfo.findOne({ orderId: order._id });

    const toppingMap = {};
    toppings.forEach((t) => {
      const key = t.orderItemId.toString();
      if (!toppingMap[key]) toppingMap[key] = [];
      toppingMap[key].push({ toppingName: t.toppingName, price: t.price });
    });

    const itemsWithToppings = items.map((item) => ({
      dishName: item.dishName,
      quantity: item.quantity,
      price: item.price,
      note: item.note,
      toppings: toppingMap[item._id.toString()] || [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        ...order.toObject(),
        items: itemsWithToppings,
        shipInfo,
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
      .populate({ path: "user", select: "name email avatar" })
      .sort({ updatedAt: -1 });

    if (!finishedOrders || finishedOrders.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có đơn hàng nào đã hoàn tất.",
        count: 0,
        data: [],
      });
    }

    const orderIds = finishedOrders.map((o) => o._id);

    const allOrderItems = await OrderItem.find({ orderId: { $in: orderIds } });
    const allOrderItemIds = allOrderItems.map((item) => item._id);
    const allToppings = await OrderItemTopping.find({
      orderItemId: { $in: allOrderItemIds },
    });

    const toppingMap = {};
    allToppings.forEach((topping) => {
      const key = topping.orderItemId.toString();
      if (!toppingMap[key]) toppingMap[key] = [];
      toppingMap[key].push({
        toppingName: topping.toppingName,
        price: topping.price,
      });
    });

    const itemMap = {};
    allOrderItems.forEach((item) => {
      const key = item.orderId.toString();
      if (!itemMap[key]) itemMap[key] = [];

      itemMap[key].push({
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        note: item.note,
        toppings: toppingMap[item._id.toString()] || [],
      });
    });

    const enrichedOrders = finishedOrders.map((order) => ({
      ...order.toObject(),
      items: itemMap[order._id.toString()] || [],
    }));

    res.status(200).json({
      success: true,
      message: "Lấy danh sách đơn hàng đã hoàn tất thành công.",
      count: enrichedOrders.length,
      data: enrichedOrders,
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
    .populate({ path: "user", select: "name email avatar" });

  if (!order) {
    return next(createError(404, "Order not found"));
  }

  const currentStatus = order.status;

  // Validate status transitions
  const validTransitions = {
    taken: ["delivering", "finished"],
    delivering: ["delivered"],
    delivered: ["done"],
  };

  if (status === currentStatus) {
    return next(createError(400, `Order is already in '${status}' status.`));
  }

  if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(status)) {
    return next(createError(400, `Cannot change status from '${currentStatus}' to '${status}'.`));
  }

  order.status = status;
  await order.save();

  // Truy vấn các món trong đơn
  const orderItems = await OrderItem.find({ orderId: order._id });
  const orderItemIds = orderItems.map((item) => item._id);
  const toppings = await OrderItemTopping.find({ orderItemId: { $in: orderItemIds } });

  // Gộp topping theo từng món
  const toppingMap = {};
  toppings.forEach((t) => {
    const key = t.orderItemId.toString();
    if (!toppingMap[key]) toppingMap[key] = [];
    toppingMap[key].push({
      toppingName: t.toppingName,
      price: t.price,
    });
  });

  const items = orderItems.map((item) => ({
    dishName: item.dishName,
    quantity: item.quantity,
    price: item.price,
    note: item.note,
    toppings: toppingMap[item._id.toString()] || [],
  }));

  res.status(200).json({
    success: true,
    message: `Order status updated to '${status}' successfully`,
    data: {
      ...order.toObject(),
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

  if (order.user.toString() !== userId.toString()) {
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
    const { status, limit = 10, page = 1, name } = req.query;
    const { store_id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(store_id)) {
      return res.status(400).json({ success: false, message: "Invalid store_id format" });
    }

    let filterOptions = { store: store_id };

    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(",");
      filterOptions.status = { $in: statusArray };
    }

    if (name && name.trim() !== "") {
      const regex = new RegExp(name, "i");
      filterOptions.$or = [{ customerName: regex }, { customerPhonenumber: regex }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Order.countDocuments(filterOptions);
    const orders = await Order.find(filterOptions)
      .populate({
        path: "store",
        select: "name avatar",
      })
      .populate("user", "name email avatar")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Lấy các OrderItem và Topping tương ứng
    const orderIds = orders.map((o) => o._id);
    const orderItems = await OrderItem.find({ orderId: { $in: orderIds } });
    const itemIds = orderItems.map((item) => item._id);
    const toppings = await OrderItemTopping.find({ orderItemId: { $in: itemIds } });

    // Gom topping theo orderItemId
    const toppingMap = {};
    for (const topping of toppings) {
      const key = topping.orderItemId.toString();
      if (!toppingMap[key]) toppingMap[key] = [];
      toppingMap[key] = [
        ...(toppingMap[key] || []),
        {
          toppingName: topping.toppingName,
          price: topping.price,
        },
      ];
    }

    // Gom orderItem theo orderId
    const itemMap = {};
    for (const item of orderItems) {
      const key = item.orderId.toString();
      if (!itemMap[key]) itemMap[key] = [];

      itemMap[key].push({
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        note: item.note,
        toppings: toppingMap[item._id.toString()] || [],
      });
    }

    // Gắn lại vào order
    const enrichedOrders = orders.map((order) => ({
      ...order.toObject(),
      items: itemMap[order._id.toString()] || [],
    }));

    // Lọc lại nếu cần tìm theo user.name
    let filtered = enrichedOrders;
    if (name && name.trim() !== "") {
      const regex = new RegExp(name, "i");
      filtered = enrichedOrders.filter(
        (order) =>
          order.user?.name?.match(regex) || order.customerName?.match(regex) || order.customerPhonenumber?.match(regex)
      );
    }

    res.status(200).json({
      success: true,
      total: total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: filtered,
    });
  } catch (error) {
    console.error(error);
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

    const order = await Order.findById(orderId);
    if (!order || !order.store) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const store = await Store.findById(order.store);
    if (!store || store.status === "BLOCKED") {
      return res.status(403).json({ success: false, message: "Cannot reorder from a blocked or missing store" });
    }

    // Lấy các món trong đơn
    const orderItems = await OrderItem.find({ orderId });
    const itemIds = orderItems.map((i) => i._id);
    const toppings = await OrderItemTopping.find({ orderItemId: { $in: itemIds } });

    // Kiểm tra món nào đã hết hàng
    const dishIds = orderItems.map((item) => item.dishId);
    const dishes = await Dish.find({ _id: { $in: dishIds } });
    const dishStatusMap = {};
    dishes.forEach((dish) => {
      dishStatusMap[dish._id.toString()] = dish.stockStatus;
    });

    const hasOutOfStock = orderItems.some((item) => {
      const status = dishStatusMap[item.dishId?.toString()];
      return status === "OUT_OF_STOCK";
    });

    if (hasOutOfStock) {
      return res.status(403).json({ success: false, message: "Some dishes are out of stock" });
    }

    // Clear cart cũ nếu có
    const existingCart = await Cart.findOne({ user: userId, store: store._id });
    if (existingCart) {
      await CartItemTopping.deleteMany({
        cartItemId: { $in: await CartItem.find({ cartId: existingCart._id }).distinct("_id") },
      });
      await CartItem.deleteMany({ cartId: existingCart._id });
      await Cart.deleteOne({ _id: existingCart._id });
    }

    // Tạo lại Cart mới
    const newCart = await Cart.create({
      user: userId,
      store: store._id,
    });

    // Thêm CartItem và CartItemTopping
    for (const orderItem of orderItems) {
      const cartItem = await CartItem.create({
        cartId: newCart._id,
        dishId: orderItem.dishId,
        dishName: orderItem.dishName,
        quantity: orderItem.quantity,
        price: orderItem.price,
        note: orderItem.note,
      });

      const itemToppings = toppings.filter((t) => t.orderItemId.toString() === orderItem._id.toString());

      for (const topping of itemToppings) {
        await CartItemTopping.create({
          cartItemId: cartItem._id,
          toppingId: topping.toppingId,
          toppingName: topping.toppingName,
          price: topping.price,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: "Reorder successful",
      cartId: newCart._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
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
