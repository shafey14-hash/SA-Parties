const db = require("../config/db");
const bcrypt = require("bcryptjs");

// Admin Login

const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM admins WHERE username = $1", [
      username,
    ]);

    const admins = result.rows;

    if (admins.length === 0) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const admin = admins[0];
    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    return res.status(200).json({
      message: "Login successful",
      token: "mock-admin-jwt-token",
      adminId: admin.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  adminLogin,
};
