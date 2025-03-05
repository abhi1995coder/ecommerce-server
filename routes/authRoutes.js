const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../config/db"); // Updated db.js with connection pool
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { cleanEnv, str } = require("envalid");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const winston = require("winston");

const router = express.Router();

// Load environment variables
dotenv.config({ path: "../details.env" });

// Validate environment variables
const env = cleanEnv(process.env, {
    JWT_SECRET: str(),
    EMAIL_USER: str(),
    EMAIL_PASS: str(),
    TOKEN_EXPIRY: str({ default: "7d" }),
});

const SECRET_KEY = env.JWT_SECRET;
const TOKEN_EXPIRY = env.TOKEN_EXPIRY;

// Logger setup
const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "error.log", level: "error" }),
    ],
});

// Rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: "Too many requests, please try again later.",
});

// Async handler to avoid repetitive try-catch blocks
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Email template
const getVerificationEmailTemplate = (verificationLink) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body {
            font-family:'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background-color: #f9f9f9;
        }
        .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            background-color: #007BFF;
            color: #fff !important;
            text-decoration: none;
            border-radius: 5px;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Verify Your Email Address</h2>
        <p>Thank you for signing up with <strong>indiangoods.co.in</strong>! To complete your registration and verify your email address, please click the button below:</p>
        <a href="${verificationLink}" class="button">Verify Email</a>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p><a href="${verificationLink}">${verificationLink}</a></p>
        <p>If you did not create an account with us, please ignore this email or contact our support team for assistance.</p>
        <div class="footer">
            <p>Best regards,<br>Team indiangoods.co.in</p>
            <p>Contact us: <a href="mailto:support@indiangoods.co.in">support@indiangoods.co.in</a></p>
        </div>
    </div>
</body>
</html>
`;

// Function to send verification email
async function sendVerificationEmail(email, verificationLink) {
    try {
        let transporter = nodemailer.createTransport({
            host: "smtpout.secureserver.net",
            port: 465,
            secure: true,
            auth: {
                user: env.EMAIL_USER,
                pass: env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false, // GoDaddy requires this sometimes
            },
        });

        let info = await transporter.sendMail({
            from: `"indiangoods.co.in" <${env.EMAIL_USER}>`,
            to: email,
            subject: " Verify Your Email Address for indiangoods.co.in",
            html: getVerificationEmailTemplate(verificationLink),
        });

        logger.info(`✅ Verification email sent to ${email}: ${info.messageId}`);
        return true;
    } catch (error) {
        logger.error(`❌ Error sending email to ${email}:`, error);
        return false;
    }
}

// Apply security middleware
router.use(helmet());
router.use(cors({ origin: "https://indiangoods.co.in" })); // Allow requests from your frontend origin

// User Registration with Email Verification
router.post("/signup", limiter, asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // Validate password strength
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ message: "Password must be at least 8 characters long and include a number and a special character." });
    }

    try {
        // Check if the user already exists
        const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "User already exists!" });
        }

        const verificationToken = crypto.randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(password, 10);

        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24); // Token expires in 24 hours

        // Insert the new user into the database
        await db.query(
            "INSERT INTO users (name, email, password, verified, verification_token, verification_expires) VALUES (?, ?, ?, ?, ?, ?)",
            [name, email, hashedPassword, false, verificationToken, expirationTime]
        );

        const verificationLink = `http://localhost:3000/api/auth/verify-email?token=${verificationToken}`;
        await sendVerificationEmail(email, verificationLink);

        res.status(201).json({ message: "Verification email sent! Please verify your email." });
    } catch (err) {
        logger.error("Error during signup:", err);
        res.status(500).json({ message: "Server error!" });
    }
}));

// Email Verification with Expiry Check
router.get("/verify-email", asyncHandler(async (req, res) => {
    const { token } = req.query;

    try {
        const [user] = await db.query("SELECT * FROM users WHERE verification_token = ?", [token]);

        if (user.length === 0) {
            return res.redirect("http://localhost:3000/?token=invalid");
        }

        const userData = user[0];

        // Check if the token has expired
        if (new Date(userData.verification_expires) < new Date()) {
            return res.redirect("http://localhost:3000/?token=expired");
        }

        // Mark user as verified and remove verification token
        await db.query("UPDATE users SET verified = ?, verification_token = NULL, verification_expires = NULL WHERE email = ?", [true, userData.email]);

        res.redirect("https://indiangoods.co.in/?token=success");
    } catch (err) {
        logger.error("Error during email verification:", err);
        res.redirect("https://indiangoods.co.in/?token=error");
    }
}));

// User Login with JWT
router.post("/login", limiter, asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
        const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

        if (user.length === 0) {
            return res.status(400).json({ message: "Invalid email or password!" });
        }

        const userData = user[0];

        // Check if the account is verified
        if (!userData.verified) {
            return res.status(400).json({ message: "Please verify your email before logging in." });
        }

        const isMatch = await bcrypt.compare(password, userData.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password!" });
        }

        // Generate JWT Token
        const token = jwt.sign({ userId: userData.id, email: userData.email }, SECRET_KEY, { expiresIn: TOKEN_EXPIRY });

        res.json({
            message: "Login successful!",
            token,
            user: { id: userData.id, name: userData.name, email: userData.email },
        });
    } catch (err) {
        logger.error("Error during login:", err);
        res.status(500).json({ message: "Server error!" });
    }
}));

module.exports = router;
