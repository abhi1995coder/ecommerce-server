const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../config/db");



const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET;

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Access denied. No token provided." });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token!" });

        req.user = user; // Stores { userId, email } from JWT payload
        next();
    });
}

// Get User Profile
router.get("/profile", authenticateToken, async (req, res) => {
    try {
        const [users] = await db.promise().query("SELECT id, name, email FROM users WHERE id = ?", [req.user.userId]);

        if (users.length === 0) return res.status(404).json({ message: "User not found!" });

        res.status(200).json({ user: users[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error!" });
    }
});

module.exports = router;
