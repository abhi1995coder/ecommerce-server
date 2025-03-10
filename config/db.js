const mysql = require("mysql2");


// Load environment variables


// Create a connection pool
const pool = mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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
