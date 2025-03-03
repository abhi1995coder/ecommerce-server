const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { jsPDF } = require('jspdf'); // For generating PDF invoices
const nodemailer = require('nodemailer'); // For sending emails
const dotenv = require("dotenv");
const { cleanEnv, str } = require("envalid");
dotenv.config({ path: "../details.env" });

// Validate environment variables
const env = cleanEnv(process.env, {

    EMAIL_USER: str(),
    EMAIL_PASS: str(),

});


router.post('/', async (req, res) => {


    const { order_id, id, total_amount, shipping_address, payment_method, items } = req.body;

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
            `INSERT INTO orders (order_id, id, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?)`,
            [order_id, id, total_amount, shipping_address, payment_method]
        );

        console.log("Order inserted successfully. Order ID:", order_id);

        // Insert into order_items table
        for (const item of items) {
            await connection.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`,
                [order_id, item.product_id, item.quantity, item.price]
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
        user: env.EMAIL_USER, // your GoDaddy email
        pass: env.EMAIL_PASS // your GoDaddy email password
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

module.exports = router;