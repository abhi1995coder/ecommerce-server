const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { jsPDF } = require('jspdf'); // For generating PDF invoices
const nodemailer = require('nodemailer'); // For sending emails





// Increase the payload size limit for JSON requests (e.g., 50MB)
router.use(express.json({ limit: '50mb' }));

// Increase the payload size limit for URL-encoded requests (e.g., 50MB)
router.use(express.urlencoded({ limit: '50mb', extended: true }));


router.post('/', async (req, res) => {


    const { order_id, id, total_amount, shipping_address, payment_method, items, phone } = req.body;

    // Get a connection from the pool
    const connection = await db.getConnection();

    try {
        // Start a transaction
        await connection.beginTransaction();

        // Check if order_id already exists in the orders table
        const [existingOrders] = await connection.query(
            `SELECT order_id FROM orders WHERE order_id = ?`,
            [order_id]
        );

        if (existingOrders.length > 0) {
            // order_id already exists
            await connection.rollback();
            return res.status(400).json({ success: false, error: "order_id already exists" });
        }

        // Insert into orders table
        await connection.query(
            `INSERT INTO orders (order_id, id, total_amount, shipping_address, payment_method, phone) VALUES (?, ?, ?, ?, ?, ?)`,
            [order_id, id, total_amount, shipping_address, payment_method, phone]
        );

        console.log("Order inserted successfully. Order ID:", order_id);

        // Insert into order_items table
        for (const item of items) {
            await connection.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price, product_name) VALUES (?, ?, ?, ?, ?)`,
                [order_id, item.product_id, item.quantity, item.price, item.product_name]
            );
        }

        // Commit the transaction
        await connection.commit();
        console.log("Transaction committed successfully.");
        res.json({ success: true, order_id });
    } catch (error) {
        // Rollback the transaction in case of error
        await connection.rollback();
        console.error("Error during transaction:", error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        // Release the connection back to the pool
        connection.release();
    }
});

// Email configuration (replace with your GoDaddy email settings)
const emailConfig = {

    host: 'smtpout.secureserver.net', // GoDaddy's SMTP server
    port: 465, // SSL port
    secure: true, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER, // your GoDaddy email
        pass: process.env.EMAIL_PASS // your GoDaddy email password
    }
};

// Create a Nodemailer transporter
const transporter = nodemailer.createTransport(emailConfig);

const emailtemplate=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Attached</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f9f9f9;
        }
        .header {
            font-size: 24px;
            font-weight: bold;
            color: #004a8e;
            margin-bottom: 20px;
        }
        .content {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .footer {
            font-size: 14px;
            color: #777;
            margin-top: 20px;
        }
        a {
            color: #004a8e;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            Invoice Attached
        </div>
        <div class="content">
            <p>Dear,</p>
            <p>I hope this email finds you well.</p>
            <p>Please find attached the invoice for your recent transaction with us. All the necessary details are included in the attached PDF for your reference.</p>
            <p>Should you have any questions or require further assistance, feel free to reach out. We’re here to help!</p>
            <p>Thank you for your continued trust in indiangoods.co.in. We look forward to serving you again in the future.</p>
        </div>
        <div class="footer">
            <p>Best regards,</p>
            <p>Reach us at: contact@indiangoods.co.in<p><br>
            <a href="indiangoods.co.in">[indiangoods.co.in]</a>
        </div>
    </div>
</body>
</html>`;

// New route for sending invoice via email
router.post('/send-invoice', async (req, res) => {

    const {orderId,email, pdf_attachment} = req.body;
    const pdfBuffer = Buffer.from(pdf_attachment, 'base64');

    try {


        // Send the invoice via email
        const mailOptions = {
            from: 'contact@indiangoods.co.in', // sender address
            to: email, // recipient email
            subject: 'Your Invoice', // Subject line
            html: emailtemplate, // plain text body
            attachments: [
                {
                    filename: `invoice_${orderId}.pdf`,
                    content: Buffer.from(pdfBuffer),
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);
        console.log('Invoice email sent successfully to:', email);

        res.json({ success: true, message: 'Invoice sent successfully' });
    } catch (error) {
        console.error('Error sending invoice email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get('/order-history/:id', async (req, res) => {
   
    const userId = req.params.id;

    try {
        // Query to get orders by user ID
        const [orders] = await db.query(
            'SELECT * FROM orders WHERE id = ?',
            [userId]
        );

        // If no orders found, return an empty array
        if (orders.length === 0) {
            return res.json([]);
        }

        // Array to store the final response
        const orderHistory = [];

        // Loop through each order to get related order items
        for (const order of orders) {
            const [orderItems] = await db.query(
                'SELECT * FROM order_items WHERE order_id = ?',
                [order.order_id]
            );

            // Add order and its items to the response
            orderHistory.push({
                order_id: order.order_id,
                order_date: order.order_date,
                total_amount: order.total_amount,
                shipping_address: order.shipping_address,
                payment_method: order.payment_method,
                order_status: order.order_status,
                phone: order.phone,
                items: orderItems
            });
        }

        // Send the response
        res.json(orderHistory);
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
router.put('/cancel-order/:orderId', async (req, res) => {
    const orderId = req.params.orderId;

    try {
        // Fetch the order from the database
        const [order] = await db.query(
            'SELECT * FROM orders WHERE order_id = ?',
            [orderId]
        );

        // Check if the order exists
        if (order.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const orderDate = new Date(order[0].order_date);
        const currentTime = new Date();
        const timeDifference = currentTime - orderDate;
        const hoursDifference = timeDifference / (1000 * 60 * 60);

        // Check if the order is within 24 hours
        if (hoursDifference >= 24) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled after 24 hours' });
        }

        // Check if the order is already cancelled
        if (order[0].order_status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }

        // Update the order status to "Cancelled"
        await db.query(
            'UPDATE orders SET order_status = ? WHERE order_id = ?',
            ['Cancelled', orderId]
        );

        // Send a success response
        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});


module.exports = router;
