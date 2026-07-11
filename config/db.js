const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  // Serverless (Vercel) ke liye zaroori: har function instance apna alag pool
  // banata hai, is liye per-instance connections kam rakhna zaroori hai
  // taake Supabase pooler ka connection limit exceed na ho.
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
