const createError = require("../utils/createError");
const asyncHandler = require("express-async-handler");
const Order = require("../models/order.model")
const mongoose = require("mongoose");
const {
    VNPay,
    ignoreLogger,
    ProductCode,
    VnpLocale,
    dateFormat,
    VerifyReturnUrl 
} = require("vnpay");

const getQRCode = asyncHandler(async (req, res, next) => {
    try {
        const { orderId } = req.params;
        console.log("[getQRCode] Requested orderId:", orderId);

        const order = await Order.findById(orderId);
        if (!order) {
            console.warn("[getQRCode] Order not found for ID:", orderId);
            return next(createError(404, "Order not found"));
        }

        console.log("[getQRCode] Found order:", {
            id: order._id,
            total: order.finalTotal,
        });

        const vnpay = new VNPay({
            tmnCode: process.env.VNPAY_TMN_CODE,
            secureSecret: process.env.VNPAY_SECRET_KEY,
            vnpayHost: process.env.VNPAY_PAYMENT_URL,
            testMode: true,
            hashAlgorithm: "SHA512",
            loggerFn: ignoreLogger,
        });

        console.log("[getQRCode] VNPay initialized with config:", {
            tmnCode: process.env.VNPAY_TMN_CODE,
            returnUrl: process.env.VNPAY_RETURN_CHECK_PAYMENT,
            host: process.env.VNPAY_PAYMENT_URL,
            secureSecret: process.env.VNPAY_SECRET_KEY,
        });

        const paymentParams = {
            vnp_Amount: order.finalTotal,
            vnp_IpAddr: "127.0.0.1",
            vnp_TxnRef: order._id.toString(),
            vnp_OrderInfo: `Payment for order ${order._id}`,
            vnp_ReturnUrl: process.env.VNPAY_RETURN_CHECK_PAYMENT,
            vnp_Locale: VnpLocale.VN,
            vnp_CreateDate: dateFormat(new Date()),
            vnp_ExpireDate: dateFormat(new Date(Date.now() + 15 * 60 * 1000)),
        };

        console.log("[getQRCode] Payment parameters:", paymentParams);

        const paymentUrl = await vnpay.buildPaymentUrl(paymentParams);
        console.log("[getQRCode] Generated payment URL:", paymentUrl);

        res.status(200).json({ paymentUrl });
    } catch (err) {
        console.error("[getQRCode] Error:", err);
        next(createError(500, "Failed to generate QR Code payment URL"));
    }
});

const handleVnpReturn = asyncHandler(async (req, res) => {
    console.log("[VNPay Return] Incoming query:", req.query);

    const vnpay = new VNPay({ secureSecret: process.env.VNPAY_SECRET_KEY });
    const isValid = await vnpay.verifyReturnUrl(req.query);

    console.log("[VNPay Return] Signature valid:", isValid);

    if (!isValid) {
        console.warn("[VNPay Return] Invalid signature for:", req.query);
        return res.status(400).json({ message: "Invalid signature" });
    }

    const { vnp_TxnRef, vnp_ResponseCode } = req.query;

    try {
        if (vnp_ResponseCode === "00") {
            const updated = await Order.findByIdAndUpdate(vnp_TxnRef, { paymentSatus: "paid" });
            console.log(`[VNPay Return] Order ${vnp_TxnRef} updated to Paid`);
        } else {
            console.log(`[VNPay Return] Payment failed or cancelled. Response code: ${vnp_ResponseCode}`);
        }

        res.redirect(`http://localhost:3000/orders/detail-order/${vnp_TxnRef}?payment=success`);
    } catch (err) {
        console.error("[VNPay Return] Error updating order:", err);
        res.redirect(`http://localhost:3000/orders/detail-order/${vnp_TxnRef}?payment=fail&statusCode=${vnp_ResponseCode}`);
    }
});

const handleVnpIpn = asyncHandler(async (req, res) => {
    const vnpay = new VNPay({ secureSecret: process.env.VNPAY_SECRET_KEY });
    const isValid = vnpay.validateIPNRequest(req.query);

    if (!isValid) {
        return res
            .status(400)
            .json({ RspCode: "97", Message: "Invalid signature" });
    }

    const { vnp_TxnRef, vnp_ResponseCode } = req.query;

    const order = await Order.findById(vnp_TxnRef);
    if (!order) {
        return res
            .status(404)
            .json({ RspCode: "01", Message: "Order not found" });
    }

    if (order.status === "Paid") {
        return res
            .status(200)
            .json({ RspCode: "02", Message: "Order already paid" });
    }

    if (vnp_ResponseCode === "00") {
        order.status = "Paid";
        await order.save();
    }

    res.status(200).json({ RspCode: "00", Message: "Confirm Success" });
});


module.exports = {getQRCode, handleVnpReturn, handleVnpIpn};