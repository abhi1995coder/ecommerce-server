const express = require("express");
const db = require("../config/db"); // Updated db.js with connection pool

const router = express.Router();

// Get All Products
router.get("/", async (req, res) => {

  try {
    const category = req.query.category;
    let query = "SELECT * FROM products";
    let values = [];

    if (category) {
      query += " WHERE category = ?";
      values.push(category);
    }

    const [products] = await db.query(query, values);
    res.status(200).json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error!" });
  }
});

// Get "Coming Soon" Products
router.get("/comingsoon", async (req, res) => {
  try {
    const [products] = await db.query("SELECT * FROM comingsoon");
    res.status(200).json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error!" });
  }
});

// Get Bestsellers
router.get("/bestsellers", async (req, res) => {


  try {
    const [rows] = await db.query("SELECT * FROM products WHERE is_bestseller = TRUE");

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ message: "No best sellers found" });
    }

    res.json(rows);
  } catch (error) {
    console.error("Error fetching best sellers:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get Product by ID
router.get("/:id", async (req, res) => {

  const productId = req.params.id;
  try {
    const [product] = await db.query("SELECT * FROM products WHERE id = ?", [productId]);
    if (product.length === 0) return res.status(404).json({ message: "Product not found!" });
    res.status(200).json({ product: product[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error!" });
  }
});

// Get Related Products by Product ID
router.get("/related/:id", async (req, res) => {
  const productId = req.params.id;
  try {
    // Get the current product's category
    const [product] = await db.query("SELECT category FROM products WHERE id = ?", [productId]);

    if (product.length === 0) return res.status(404).json({ message: "Product not found!" });

    const category = product[0].category;

    // Get related books (excluding the current product)
    const [relatedProducts] = await db.query(
      "SELECT id, name, description, price, image_url, companyname FROM products WHERE category = ? AND id != ? LIMIT 6",
      [category, productId]
    );

    res.status(200).json({ related: relatedProducts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error!" });
  }
});




module.exports = router;