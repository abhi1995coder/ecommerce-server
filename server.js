const express = require("express");
const cors = require("cors");
const helmet = require("helmet"); // For setting secure HTTP headers
const rateLimit = require("express-rate-limit"); // For rate limiting
const morgan = require("morgan"); // For request logging
const dotenv = require("dotenv");


const fs = require("fs");
const path = require("path");
const app = express();

// Create a write stream for logging HTTP requests
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" } // Append to the file
);

// Log HTTP requests to a file
app.use(morgan("combined", { stream: accessLogStream }));

// Load environment variables
dotenv.config();


const PORT = process.env.PORT || 3306; // Use environment variable for port

// ================== Middleware ==================
// Enable CORS for specific origins
const allowedOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "https://ecommerce-server-8uzk.onrender.com",
  "https://indiangoods.co.in",
  // Add other allowed origins here
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow cookies and credentials
  })
);

// Set secure HTTP headers
app.use(helmet());

// Rate limiting to prevent brute-force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// Log HTTP requests
app.use(morgan("dev"));

// Parse JSON bodies
app.use(express.json());

// ================== Routes ==================
// Import Routes
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const razorpayRoutes = require("./routes/razorpayRoutes");
const orderRoutes=require("./routes/orderRoutes");
const searchRoutes = require("./routes/searchRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", razorpayRoutes);
app.use("/api/order",orderRoutes);
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
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
