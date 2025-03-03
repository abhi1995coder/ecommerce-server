const express = require("express");
const Razorpay = require("razorpay");
const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: "YOUR_RAZORPAY_KEY_ID", // Replace with your Razorpay Key ID
    key_secret: "YOUR_RAZORPAY_KEY_SECRET", // Replace with your Razorpay Key Secret
});

// Route to create a Razorpay order
router.post("/create-order", async (req, res) => {
    const { amount, currency, receipt } = req.body;

    try {
        const order = await razorpay.orders.create({
            amount: amount, // Amount in paise
            currency: currency || "INR",
            receipt: receipt,
        });

        res.json({ success: true, order });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, error: "Failed to create order" });
    }
});

// Route to handle payment success (optional)
router.post("/payment-success", (req, res) => {
    const { paymentId, orderId, signature } = req.body;

    // Verify the payment signature (for security)
    const crypto = require("crypto");
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    if (expectedSignature === signature) {
        // Payment is legitimate
        res.json({ success: true, message: "Payment verified successfully" });
    } else {
        // Payment is fraudulent
        res.status(400).json({ success: false, error: "Invalid payment signature" });
    }
});

module.exports = router;