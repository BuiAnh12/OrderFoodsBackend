const FoodType = require("../models/foodType.model");
const Store = require("../models/store.model");
const Cart = require("../models/cart.model");
const CartItem = require("../models/cartItem.model");
const CartItemTopping = require("../models/cartItemTopping.model");
const Dish = require("../models/dish.model");
const ToppingGroup = require("../models/toppingGroup.model");
const Topping = require("../models/topping.model");
const Rating = require("../models/rating.model");
const Notification = require("../models/notification.model");
const Order = require("../models/order.model");
const OrderItem = require("../models/orderItem.model");
const OrderItemTopping = require("../models/orderItemTopping.model");
const OrderShipInfo = require("../models/orderShipInfo.model");

const getUserCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    // Tạo bộ lọc tìm kiếm
    let filter = { user: userId };

    // Truy vấn danh sách món ăn
    let allCarts = await Cart.find(filter)
      .populate({
        path: "store",
      })
      .lean();

    if (!allCarts || allCarts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Carts not found",
      });
    }

    allCarts = allCarts.filter((cart) => cart.store.status === "APPROVED");

    const storeRatings = await Rating.aggregate([
      { $group: { _id: "$store", avgRating: { $avg: "$ratingValue" }, amountRating: { $sum: 1 } } },
    ]);

    const updatedCarts = allCarts.map((cart) => {
      const rating = storeRatings.find((r) => r._id.toString() === cart.store._id.toString());

      return {
        ...cart,
        store: {
          ...cart.store,
          avgRating: rating ? rating.avgRating : 0,
          amountRating: rating ? rating.amountRating : 0,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: updatedCarts,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDetailCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { cartId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (!cartId) {
      return res.status(400).json({ success: false, message: "Cart ID is required" });
    }

    // 1. Lấy thông tin cart
    const cart = await Cart.findById(cartId).populate({
      path: "store",
      populate: { path: "storeCategory" },
    });

    if (!cart || cart.user.toString() !== userId.toString()) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // 2. Lấy danh sách cart items
    const cartItems = await CartItem.find({ cartId: cart._id }).populate("dishId");

    // 3. Lấy toppings của từng cart item
    const cartItemIds = cartItems.map((item) => item._id);
    const allToppings = await CartItemTopping.find({ cartItemId: { $in: cartItemIds } }).populate("toppingId");

    // 4. Ghép toppings vào từng cart item
    const itemsWithToppings = cartItems.map((item) => {
      const toppings = allToppings
        .filter((t) => t.cartItemId.toString() === item._id.toString())
        .map((t) => ({
          toppingId: t.toppingId._id,
          toppingName: t.toppingName,
          price: t.price,
        }));

      return {
        _id: item._id,
        dishId: item.dishId._id,
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        toppings,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        cartId: cart._id,
        store: cart.store,
        items: itemsWithToppings,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { storeId, dishId, quantity, toppings = [] } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (!storeId || !dishId || quantity === undefined) {
      return res.status(400).json({ success: false, message: "Invalid request body" });
    }

    const dish = await Dish.findById(dishId);
    if (!dish || dish.storeId.toString() !== storeId.toString().trim()) {
      return res.status(400).json({ success: false, message: "Invalid dish or store mismatch" });
    }

    // Validate toppings
    let validToppingIds = new Set();
    if (toppings.length > 0) {
      const toppingGroups = await ToppingGroup.find({ store: storeId }).select("_id");
      const toppingGroupIds = toppingGroups.map((g) => g._id);

      const validToppings = await Topping.find({ toppingGroupId: { $in: toppingGroupIds } });
      const validToppingIds = new Set(validToppings.map((t) => t._id.toString()));

      const invalidToppings = toppings.filter((tid) => !validToppingIds.has(tid.toString()));

      if (invalidToppings.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some toppings are not valid for this store",
          invalidToppings,
        });
      }
    }

    // 1. Find or create Cart
    let cart = await Cart.findOne({ user: userId, store: storeId });
    if (!cart) {
      if (quantity === 0) {
        return res.status(400).json({ success: false, message: "Cannot add item with quantity 0" });
      }
      cart = await Cart.create({ user: userId, store: storeId });
    }

    // 2. Check if CartItem exists
    let cartItem = await CartItem.findOne({ cartId: cart._id, dishId: dishId });

    if (cartItem) {
      if (quantity === 0) {
        // Xóa CartItem + các CartItemTopping liên quan
        await CartItemTopping.deleteMany({ cartItemId: cartItem._id });
        await CartItem.deleteOne({ _id: cartItem._id });
      } else {
        // Cập nhật CartItem
        cartItem.quantity = quantity;
        await cartItem.save();

        // Xóa và tạo lại CartItemTopping
        await CartItemTopping.deleteMany({ cartItemId: cartItem._id });

        for (const toppingId of toppings) {
          const topping = await Topping.findById(toppingId);
          if (topping) {
            await CartItemTopping.create({
              cartItemId: cartItem._id,
              toppingId: topping._id,
              toppingName: topping.name,
              price: topping.price,
            });
          }
        }
      }
    } else {
      if (quantity > 0) {
        // Tạo CartItem mới
        cartItem = await CartItem.create({
          cartId: cart._id,
          dishId: dish._id,
          dishName: dish.name,
          quantity,
          price: dish.price,
        });

        for (const toppingId of toppings) {
          const topping = await Topping.findById(toppingId);
          if (topping) {
            await CartItemTopping.create({
              cartItemId: cartItem._id,
              toppingId: topping._id,
              toppingName: topping.name,
              price: topping.price,
            });
          }
        }
      }
    }

    // 3. Kiểm tra nếu cart không còn CartItem nào thì xóa Cart
    const remainingItems = await CartItem.find({ cartId: cart._id });
    if (remainingItems.length === 0) {
      await Cart.findByIdAndDelete(cart._id);
      return res.status(200).json({ success: true, message: "Cart deleted because it's empty" });
    }

    res.status(200).json({
      success: true,
      message: "Cart updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const clearCartItem = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const { storeId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (!storeId) {
      return res.status(400).json({ success: false, message: "Store ID is required" });
    }

    const cart = await Cart.findOne({ user: userId, store: storeId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    const cartItems = await CartItem.find({ cartId: cart._id });
    const cartItemIds = cartItems.map((item) => item._id);

    await CartItemTopping.deleteMany({ cartItemId: { $in: cartItemIds } });
    await CartItem.deleteMany({ cartId: cart._id });
    await Cart.deleteOne({ _id: cart._id });

    return res.status(200).json({ success: true, message: "Cart for store cleared successfully" });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req?.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const carts = await Cart.find({ user: userId });
    const cartIds = carts.map((cart) => cart._id);

    const cartItems = await CartItem.find({ cartId: { $in: cartIds } });
    const cartItemIds = cartItems.map((item) => item._id);

    await CartItemTopping.deleteMany({ cartItemId: { $in: cartItemIds } });
    await CartItem.deleteMany({ cartId: { $in: cartIds } });
    await Cart.deleteMany({ user: userId });

    res.status(200).json({ success: true, message: "All carts cleared successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const completeCart = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const {
      storeId,
      paymentMethod,
      customerName,
      customerPhonenumber,
      deliveryAddress,
      detailAddress,
      note,
      location = [],
      shippingFee = 0,
      totalDiscount = 0,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    if (!storeId || !paymentMethod || !deliveryAddress || !Array.isArray(location) || location.length !== 2) {
      return res.status(400).json({ success: false, message: "Invalid request body" });
    }

    const cart = await Cart.findOne({ user: userId, store: storeId });
    if (!cart) {
      return res.status(400).json({ success: false, message: "Cart not found" });
    }

    const cartItems = await CartItem.find({ cartId: cart._id });
    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    let subtotal = 0;

    const newOrder = await Order.create({
      user: userId,
      store: storeId,
      paymentMethod,
      status: "pending",
      subtotalPrice: 0, // Tạm thời 0, lát cập nhật lại
      totalDiscount: 0,
      shippingFee: 0,
      finalTotal: 0,
    });

    for (const item of cartItems) {
      const orderItem = await OrderItem.create({
        orderId: newOrder._id,
        dishId: item.dishId,
        dishName: item.dishName,
        quantity: item.quantity,
        price: item.price,
        note: item.note,
      });

      const toppings = await CartItemTopping.find({ cartItemId: item._id });

      let toppingTotal = 0;
      for (const topping of toppings) {
        toppingTotal += topping.price;
        await OrderItemTopping.create({
          orderItemId: orderItem._id,
          toppingId: topping.toppingId,
          toppingName: topping.toppingName,
          price: topping.price,
        });
      }

      // Tính tổng cho từng món (cả topping)
      subtotal += (item.price + toppingTotal) * item.quantity;
    }

    // Cập nhật lại order với tổng tiền
    const finalTotal = subtotal - totalDiscount + shippingFee;

    newOrder.subtotalPrice = subtotal;
    newOrder.totalDiscount = totalDiscount;
    newOrder.shippingFee = shippingFee;
    newOrder.finalTotal = finalTotal;
    await newOrder.save();

    await OrderShipInfo.create({
      orderId: newOrder._id,
      shipLocation: {
        type: "Point",
        coordinates: location,
      },
      address: deliveryAddress,
      detailAddress,
      contactName: customerName,
      contactPhonenumber: customerPhonenumber,
      note,
    });

    await CartItemTopping.deleteMany({ cartItemId: { $in: cartItems.map((i) => i._id) } });
    await CartItem.deleteMany({ cartId: cart._id });
    await Cart.findByIdAndDelete(cart._id);

    const store = await Store.findById(storeId);
    await Notification.create({
      userId: store.owner,
      orderId: newOrder._id,
      title: "New Order has been placed",
      message: "You have a new order!",
      type: "order",
      status: "unread",
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: newOrder,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserCart,
  getDetailCart,
  clearCartItem,
  clearCart,
  completeCart,
  updateCart,
};
