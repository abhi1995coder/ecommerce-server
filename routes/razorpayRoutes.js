const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const router = express.Router();

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Route to create a Razorpay order
router.post("/create-razorpay-order", async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        error: "Amount and receipt are required"
      });
    }

    const options = {
      amount: amount, // amount in smallest currency unit (paise for INR)
      currency: currency || "INR",
      receipt: receipt,
      notes: notes,
      payment_capture: 1 // auto capture payment
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      order: order
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create payment order"
    });
  }
});

// Route to verify Razorpay payment
router.post("/verify-razorpay-payment", async (req, res) => {
  try {
    const { paymentId, orderId, signature } = req.body;

    if (!paymentId || !orderId || !signature) {
      return res.status(400).json({
        success: false,
        error: "Payment ID, Order ID and Signature are required"
      });
    }

    // Create the expected signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSignature === signature) {
      // Signature is valid, payment is successful
      return res.json({
        success: true,
        message: "Payment verified successfully"
      });
    } else {
      // Signature is invalid
      return res.status(400).json({
        success: false,
        error: "Invalid payment signature"
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment"
    });
  }
});
// Route to handle Razorpay Webhooks
router.post("/razorpay-webhook", async (req, res) => {
  try {
    const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET; // Set this in .env
    const razorpaySignature = req.headers["x-razorpay-signature"];
    const payload = JSON.stringify(req.body);

    // Verify the webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      console.error("Invalid webhook signature!");
      return res.status(403).json({ success: false, error: "Invalid signature" });
    }

    // Handle the event (e.g., payment success, failure, etc.)
    const event = req.body.event;
    const paymentData = req.body.payload?.payment?.entity;

    switch (event) {
      case "payment.captured":
        console.log("Payment successful:", paymentData);
        break;
      case "payment.failed":
        console.log("Payment failed:", paymentData);
        break;
      case "order.paid":
        console.log("Order paid:", paymentData);
        break;
      default:
        console.log("Unhandled event:", event);
    }

    res.status(200).json({ success: true }); // Always respond with 200 OK
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ success: false, error: "Webhook processing failed" });
  }
});
module.exports = router;
