const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool
  .connect()

  .then((client) => {
    console.log("✅ PostgreSQL connected successfully!");

    client.release();
  })

  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
  });

module.exports = pool;
