const Order = require("../models/order.model");
const Store = require("../models/store.model");
const Voucher = require("../models/voucher.model");
const OrderItem = require("../models/orderItem.model");
const moment = require("moment-timezone");
const asyncHandler = require("express-async-handler");
const successResponse = require("../utils/successResponse");
const createError = require("http-errors");
const mongoose = require("mongoose");

const getStoreIdFromUser = async (userId) => {
    const store = await Store.findOne({
        $or: [{ owner: userId }, { staff: userId }],
    });
    if (!store) throw createError(404, "Store not found");
    return store._id;
};

const getRevenueSummary = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    //   console.log("🔍 Authenticated User ID:", userId);

    const store = await Store.findOne({
        $or: [{ owner: userId }, { staff: userId }],
    });

    if (!store) {
        console.error("❌ No store found for user:", userId);
        return next(createError(404, "Store not found"));
    }

    const storeId = store._id;
    //   console.log("✅ Found Store ID:", storeId);

    const now = moment().tz("Asia/Ho_Chi_Minh");

    const startOfToday = now.clone().startOf("day").utc().toDate();
    const startOfWeek = now.clone().startOf("isoWeek").utc().toDate();
    const startOfMonth = now.clone().startOf("month").utc().toDate();

    //   console.log("🕒 Time Ranges (UTC):", {
    //     now: now.toDate(),
    //     startOfToday,
    //     startOfWeek,
    //     startOfMonth,
    //   });

    const matchBase = {
        storeId,
        status: { $in: ["done", "delivered", "finished"] },
    };

    const allMatchingOrders = await Order.find({
        ...matchBase,
        createdAt: { $gte: startOfMonth },
    }).select("finalTotal status createdAt");

    //   console.log("📦 Matching Orders (from startOfMonth):", allMatchingOrders.length);
    if (allMatchingOrders.length > 0) {
        console.table(
            allMatchingOrders.map((o) => ({
                createdAt: o.createdAt,
                finalTotal: o.finalTotal,
                status: o.status,
            }))
        );
    } else {
        console.warn(
            "⚠️ No matching orders found for this store in the current month."
        );
    }

    const [today, week, month] = await Promise.all([
        Order.aggregate([
            { $match: { ...matchBase, createdAt: { $gte: startOfToday } } },
            { $group: { _id: null, total: { $sum: "$finalTotal" } } },
        ]),
        Order.aggregate([
            { $match: { ...matchBase, createdAt: { $gte: startOfWeek } } },
            { $group: { _id: null, total: { $sum: "$finalTotal" } } },
        ]),
        Order.aggregate([
            { $match: { ...matchBase, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$finalTotal" } } },
        ]),
    ]);

    //   console.log("💰 Revenue Results:", {
    //     today: today[0]?.total || 0,
    //     week: week[0]?.total || 0,
    //     month: month[0]?.total || 0,
    //   });

    return res.status(200).json(
        successResponse({
            today: today[0]?.total || 0,
            week: week[0]?.total || 0,
            month: month[0]?.total || 0,
        })
    );
});

const getStartDates = () => {
    const now = moment().tz("Asia/Ho_Chi_Minh");
    return {
        today: now.clone().startOf("day").utc().toDate(),
        week: now.clone().startOf("isoWeek").utc().toDate(),
        month: now.clone().startOf("month").utc().toDate(),
    };
};

const revenueByDay = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    // 1. Find the store
    const store = await Store.findOne({
        $or: [{ owner: userId }, { staff: userId }],
    });

    if (!store) {
        return res
            .status(404)
            .json({ success: false, message: "Store not found" });
    }

    const storeId = store._id;
    const now = moment().tz("Asia/Ho_Chi_Minh");

    const startOfMonth = now.clone().startOf("month").toDate();
    const endOfToday = now.clone().endOf("day").toDate();

    // 2. Aggregate by day
    const dailyRevenue = await Order.aggregate([
        {
            $match: {
                storeId,
                status: { $in: ["done", "delivered", "finished"] },
                createdAt: {
                    $gte: startOfMonth,
                    $lte: endOfToday,
                },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: "%Y-%m-%d",
                        date: "$createdAt",
                        timezone: "Asia/Ho_Chi_Minh",
                    },
                },
                revenue: { $sum: "$finalTotal" },
            },
        },
        {
            $sort: { _id: 1 }, // sort by date ascending
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                revenue: 1,
            },
        },
    ]);

    return res.status(200).json(successResponse(dailyRevenue));
});

const revenueByItem = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const limit = parseInt(req.query.limit) || 5;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "Missing user ID in token",
        });
    }

    const store = await Store.findOne({
        $or: [{ owner: userId }, { staff: userId }],
    });

    if (!store) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized or store not found",
        });
    }

    const storeId = new mongoose.Types.ObjectId(store._id);

    // Step 1: Get orderIds that match
    const orders = await Order.find({
        storeId,
        status: { $in: ["done", "delivered", "finished"] },
    }).select("_id");

    const orderIds = orders.map((order) => order._id);

    // Step 2: Aggregate revenue from OrderItem
    const result = await OrderItem.aggregate([
        {
            $match: {
                orderId: { $in: orderIds },
            },
        },
        {
            $group: {
                _id: "$dishName", // Use the stored dish name directly
                totalRevenue: {
                    $sum: {
                        $multiply: ["$price", "$quantity"],
                    },
                },
            },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                dishName: "$_id",
                totalRevenue: 1,
            },
        },
    ]);

    return res.status(200).json(successResponse(result));
});

const revenueByCategory = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "Missing user ID in token",
        });
    }

    // 1. Get storeId for owner or staff
    const storeId = await getStoreIdFromUser(userId);

    // 2. Find finished orders belonging to the store
    const orders = await Order.find({
        storeId,
        status: { $in: ["done", "delivered", "finished"] },
    }).select("_id");

    const orderIds = orders.map((order) => order._id);

    // 3. Aggregate revenue grouped by dish.categoryId
    const results = await OrderItem.aggregate([
        {
            $match: {
                orderId: { $in: orderIds },
            },
        },
        {
            $lookup: {
                from: "dishes",
                localField: "dishId",
                foreignField: "_id",
                as: "dishDetail",
            },
        },
        { $unwind: "$dishDetail" },
        {
            $group: {
                _id: "$dishDetail.category",
                totalRevenue: {
                    $sum: { $multiply: ["$price", "$quantity"] },
                },
            },
        },
        {
            $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "category",
            },
        },
        {
            $unwind: {
                path: "$category",
                preserveNullAndEmptyArrays: true, // Optional: keep entries even if category is missing
            },
        },
        {
            $project: {
                _id: 0,
                categoryId: "$category._id",
                name: "$category.name",
                totalRevenue: 1,
            },
        },
        {
            $sort: { totalRevenue: -1 },
        },
    ]);

    console.log("Revenue by Category Results:", results);

    return res.status(200).json(successResponse(results));
});

const orderSummaryStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: "Missing user ID in token",
        });
    }

    const storeId = await getStoreIdFromUser(userId);

    if (!storeId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: User is not linked to a store",
        });
    }

    const now = new Date();

    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const matchStatus = {
        status: { $in: ["done", "delivered", "finished"] },
        storeId,
    };

    const [todayCount, weekCount, monthCount] = await Promise.all([
        Order.countDocuments({
            ...matchStatus,
            createdAt: { $gte: startOfToday },
        }),
        Order.countDocuments({
            ...matchStatus,
            createdAt: { $gte: startOfWeek },
        }),
        Order.countDocuments({
            ...matchStatus,
            createdAt: { $gte: startOfMonth },
        }),
    ]);

    return res.status(200).json(
        successResponse({
            today: todayCount,
            thisWeek: weekCount,
            thisMonth: monthCount,
        })
    );
});

const orderStatusRate = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const completedStatuses = ["done", "delivered", "finished"];
    const cancelledStatuses = ["cancelled"];

    const [completedCount, cancelledCount] = await Promise.all([
        Order.countDocuments({ storeId, status: { $in: completedStatuses } }),
        Order.countDocuments({ storeId, status: { $in: cancelledStatuses } }),
    ]);

    res.status(200).json(
        successResponse({
            completed: completedCount,
            cancelled: cancelledCount,
        })
    );
});

const ordersOverTime = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const { from, to } = req.query;

    let startDate, endDate;
    const now = new Date();

    if (from && to) {
        startDate = new Date(from);
        endDate = new Date(to);
    } else {
        // Default: last 7 days
        endDate = new Date(now);
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
    }

    // Ensure endDate includes full day
    endDate.setHours(23, 59, 59, 999);

    const results = await Order.aggregate([
        {
            $match: {
                storeId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                orders: { $sum: 1 },
            },
        },
        {
            $sort: { _id: 1 },
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                orders: 1,
            },
        },
    ]);

    res.status(200).json(successResponse(results));
});

const orderStatusDistribution = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const { from, to } = req.query;
    let startDate, endDate;
    const now = new Date();

    if (from && to) {
        startDate = new Date(from);
        endDate = new Date(to);
    } else {
        endDate = new Date(now);
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6); // default to last 7 days
    }

    endDate.setHours(23, 59, 59, 999);

    const results = await Order.aggregate([
        {
            $match: {
                storeId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
        },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]);

    // Convert to object like { pending: 5, confirmed: 10, ... }
    const statusMap = {};
    const validStatuses = [
        "pending",
        "confirmed",
        "finished",
        "taken",
        "delivering",
        "delivered",
        "done",
        "cancelled",
    ];

    for (const status of validStatuses) {
        statusMap[status] = 0;
    }

    for (const item of results) {
        statusMap[item._id] = item.count;
    }

    res.status(200).json(successResponse(statusMap));
});

const topSellingItems = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const limit = parseInt(req.query.limit) || 5;

    const results = await OrderItem.aggregate([
        {
            $lookup: {
                from: "dishes",
                localField: "dishId",
                foreignField: "_id",
                as: "dish",
            },
        },
        { $unwind: "$dish" },
        {
            $match: {
                "dish.storeId": storeId,
            },
        },
        {
            $group: {
                _id: "$dishId",
                dishName: { $first: "$dishName" },
                sold: { $sum: "$quantity" },
            },
        },
        { $sort: { sold: -1 } },
        { $limit: limit },
        {
            $project: {
                _id: 0,
                dishName: 1,
                sold: 1,
            },
        },
    ]);

    return res.status(200).json(successResponse(results));
});

const revenueContributionByItem = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const rawData = await OrderItem.aggregate([
        {
            $lookup: {
                from: "dishes",
                localField: "dishId",
                foreignField: "_id",
                as: "dish",
            },
        },
        { $unwind: "$dish" },
        {
            $match: {
                "dish.storeId": storeId,
            },
        },
        {
            $group: {
                _id: "$dishName",
                revenue: {
                    $sum: { $multiply: ["$price", "$quantity"] },
                },
            },
        },
    ]);

    const totalRevenue = rawData.reduce((sum, item) => sum + item.revenue, 0);
    if (totalRevenue === 0) {
        return res.status(200).json(successResponse([]));
    }

    const contributionData = [];
    let othersRevenue = 0;

    rawData.forEach((item) => {
        const percent = (item.revenue / totalRevenue) * 100;
        if (percent < 5) {
            othersRevenue += item.revenue;
        } else {
            contributionData.push({
                dishName: item._id,
                contribution: Math.round(percent),
            });
        }
    });

    if (othersRevenue > 0) {
        contributionData.push({
            dishName: "Các món khác",
            contribution: Math.round((othersRevenue / totalRevenue) * 100),
        });
    }

    return res.status(200).json(successResponse(contributionData));
});

const ordersByTimeSlot = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    // Define time slots
    const timeSlots = [
        { label: "06:00-10:00", start: 6, end: 10 },
        { label: "10:00-14:00", start: 10, end: 14 },
        { label: "14:00-18:00", start: 14, end: 18 },
        { label: "18:00-22:00", start: 18, end: 22 },
    ];

    // Use aggregation to project hour from createdAt
    const results = await Order.aggregate([
        {
            $match: {
                storeId: storeId,
            },
        },
        {
            $project: {
                hour: {
                    $hour: { date: "$createdAt", timezone: "Asia/Ho_Chi_Minh" },
                },
            },
        },
        {
            $group: {
                _id: "$hour",
                orders: { $sum: 1 },
            },
        },
    ]);

    // Initialize output
    const timeSlotStats = {};
    timeSlots.forEach((slot) => {
        timeSlotStats[slot.label] = 0;
    });

    results.forEach((item) => {
        const hour = item._id;
        for (const slot of timeSlots) {
            if (hour >= slot.start && hour < slot.end) {
                timeSlotStats[slot.label] += item.orders;
                break;
            }
        }
    });

    return res.status(200).json(successResponse(timeSlotStats));
});

const newCustomers = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    // Get all first-time orders of each customer at this store
    const firstOrders = await Order.aggregate([
        {
            $match: { storeId: storeId },
        },
        {
            $sort: { createdAt: 1 }, // Ensure oldest orders come first
        },
        {
            $group: {
                _id: "$customerId",
                firstOrder: { $first: "$createdAt" },
            },
        },
    ]);

    const today = moment().startOf("day");
    const startOfWeek = moment().startOf("isoWeek");
    const startOfMonth = moment().startOf("month");

    let countToday = 0;
    let countWeek = 0;
    let countMonth = 0;

    firstOrders.forEach((order) => {
        const created = moment(order.firstOrder);
        if (created.isSameOrAfter(today)) countToday++;
        if (created.isSameOrAfter(startOfWeek)) countWeek++;
        if (created.isSameOrAfter(startOfMonth)) countMonth++;
    });

    return res.status(200).json(
        successResponse({
            today: countToday,
            thisWeek: countWeek,
            thisMonth: countMonth,
        })
    );
});

const returningCustomerRate = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    // Nhóm đơn hàng theo khách hàng tại cửa hàng này
    const customerOrders = await Order.aggregate([
        { $match: { storeId: storeId } },
        {
            $group: {
                _id: "$customerId",
                orderCount: { $sum: 1 },
            },
        },
    ]);

    const totalCustomers = customerOrders.length;
    const returningCustomers = customerOrders.filter(
        (c) => c.orderCount > 1
    ).length;

    const returningRate =
        totalCustomers > 0
            ? ((returningCustomers / totalCustomers) * 100).toFixed(1)
            : 0;

    return res.status(200).json(
        successResponse({
            returningRate: parseFloat(returningRate),
        })
    );
});

const averageSpendingPerOrder = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        return res
            .status(400)
            .json({ success: false, message: "Missing user ID" });
    }

    const storeId = await getStoreIdFromUser(userId);
    if (!storeId) {
        return res
            .status(401)
            .json({ success: false, message: "Unauthorized access" });
    }

    const result = await Order.aggregate([
        { $match: { storeId } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$finalTotal" },
                totalOrders: { $sum: 1 },
            },
        },
        {
            $project: {
                _id: 0,
                averageSpending: {
                    $cond: [
                        { $eq: ["$totalOrders", 0] },
                        0,
                        {
                            $round: [
                                { $divide: ["$totalRevenue", "$totalOrders"] },
                                0,
                            ],
                        },
                    ],
                },
            },
        },
    ]);

    return res
        .status(200)
        .json(successResponse(result[0] || { averageSpending: 0 }));
});

module.exports = {
    getRevenueSummary,
    getStartDates,
    revenueByDay,
    revenueByItem,
    revenueByCategory,
    orderSummaryStats,
    orderStatusRate,
    ordersOverTime,
    orderStatusDistribution,
    topSellingItems,
    revenueContributionByItem,
    ordersByTimeSlot,
    newCustomers,
    returningCustomerRate,
    averageSpendingPerOrder,
};
