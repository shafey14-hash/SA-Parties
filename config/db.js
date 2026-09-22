const { Pool } = require("pg");

require("dotenv").config();

const pool = new Pool({
  // IMPORTANT: this must be Supabase's "Transaction" pooler connection
  // string (port 6543, host ends in .pooler.supabase.com), NOT the direct
  // connection (port 5432). Vercel serverless functions can spin up many
  // instances at once, and the direct connection has a low connection
  // limit — under any real traffic those connections get exhausted and
  // new requests sit in a queue (up to connectionTimeoutMillis) waiting
  // for one to free up, which is exactly the "slow" symptom.
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  // Serverless: each function instance should hold few connections since
  // many instances can run concurrently. Keep this low; the pooler on
  // Supabase's side is what actually handles scale, not this local pool.
  max: 1,
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