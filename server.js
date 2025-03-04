const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // For setting secure HTTP headers
const rateLimit = require("express-rate-limit"); // For rate limiting
const morgan = require("morgan"); // For request logging
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 3306; // Use environment variable for port
app.set("trust proxy", 1); // ✅ Trust the first proxy

// ================== Logging ==================
// Create a write stream for logging HTTP requests
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" } // Append to the file
);
app.use(morgan("combined", { stream: accessLogStream })); // Log to file
app.use(morgan("dev")); // Log to console

// ================== Security & Performance ==================
app.use(helmet()); // Set secure HTTP headers

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});
app.use(limiter); // Apply rate limiting

// ================== CORS Configuration ==================
const allowedOrigins = ["https://indiangoods.co.in", "https://www.indiangoods.co.in"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
console.log("CORS configured for origin: https://indiangoods.co.in");
app.get("/api/test-cors", (req, res) => {
  res.json({ message: "CORS is working!" });
});

// ================== Middleware ==================
app.use(express.json()); // Parse JSON bodies

// ================== Routes ==================
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const razorpayRoutes = require("./routes/razorpayRoutes");
const orderRoutes = require("./routes/orderRoutes");
const searchRoutes = require("./routes/searchRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", razorpayRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/search", searchRoutes);

// ================== Error Handling ==================
// 404 Route
app.use((req, res, next) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ================== Start Server ==================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
