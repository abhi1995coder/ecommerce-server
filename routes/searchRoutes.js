const express = require("express");
const db = require("../config/db"); // Updated db.js with connection pool

const router = express.Router();

router.get("/find", async (req, res) => {
    const productName = req.query.name;

    // Input validation
    if (!productName || productName.trim() === '') {
        console.log("Invalid product name provided"); // Debugging log
        return res.status(400).json({ error: "Invalid product name" });
    }

    const sql = 'SELECT * FROM products WHERE LOWER(name) LIKE LOWER(?)';
    const searchTerm = `%${productName}%`;

    try {
        // Execute the query using promises
        const [results] = await db.query(sql, [searchTerm]);


        if (results.length > 0) {
            res.json({ products: results[0] });
        } else {
            res.status(404).json({ error: "No products found" });
        }
    } catch (err) {
        console.error("Database error:", err); // Debugging log
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;