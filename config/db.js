const mysql = require("mysql2");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: "./details.env" });

// Create a connection pool
const pool = mysql.createPool({
    host:'208.109.201.70',
    user:'AbhishekChaturvedi' ,
    password: 'up32dm2201up32ag5712',
    database: 'ecommerce',
    waitForConnections: true, // Wait for a connection if none are available
    connectionLimit: 10, // Maximum number of connections in the pool
    queueLimit: 0, // Unlimited queueing for connection requests
});

// Enable promise support for the pool
const db = pool.promise();

// Test the connection
db.getConnection()
    .then((connection) => {
        console.log("✅ Connected to MySQL Database!");
        connection.release(); // Release the connection back to the pool
    })
    .catch((err) => {
        console.error("Database connection failed:", err);
    });

// Export the pool with promise support
module.exports = db;
