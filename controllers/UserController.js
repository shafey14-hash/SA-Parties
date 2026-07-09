const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerification } = require("./EmailController");

const JWT_SECRET = process.env.JWT_SECRET || "sa_parties_secret_key";

// ──────────────────────────────────────────
// SIGNUP — name, email, password, address
// ──────────────────────────────────────────
const registerUser = async (req, res) => {
  const { name, email, password, address } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password is essential." });
  }

  try {
    // Check if email already exists
    const [existing] = await db.query(
      "SELECT id, is_verified FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      if (existing[0].is_verified) {
        return res.status(400).json({ error: "This email has already been registered. Please use Login." });
      } else {
        // Email exists but not verified — resend code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await db.query(
          "UPDATE users SET verification_code = ?, verification_expires = ? WHERE email = ?",
          [code, expires, email]
        );
        await sendVerification(email, code);
        return res.status(200).json({ message: "Verification code sent again!" });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save new user (unverified)
    await db.query(
      "INSERT INTO users (name, email, password, address, verification_code, verification_expires, is_verified) VALUES (?, ?, ?, ?, ?, ?, 0)",
      [name, email, hashedPassword, address || "", code, expires]
    );

    await sendVerification(email, code);
    res.status(201).json({ message: "Signup successful! 6-digit code has been sent to your email." });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────
// VERIFY EMAIL CODE
// ──────────────────────────────────────────
const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "Email and verification code are compulsory." });
  }

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "This email has not been registered yet." });
    }

    const user = users[0];

    if (user.is_verified) {
      return res.status(200).json({ message: "Email already verified. Please use Login." });
    }

    if (user.verification_code !== String(code)) {
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    if (new Date() > new Date(user.verification_expires)) {
      return res.status(400).json({ error: "Code has expired. Please signup again." });
    }

    // Mark verified
    await db.query(
      "UPDATE users SET is_verified = 1, verification_code = NULL, verification_expires = NULL WHERE email = ?",
      [email]
    );

    res.status(200).json({ message: "Email verified successfully! You can now login." });

  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ──────────────────────────────────────────
// LOGIN — email + password
// ──────────────────────────────────────────
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are compulsory." });
  }

  try {
    const [users] = await db.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const user = users[0];

    if (!user.is_verified) {
      return res.status(403).json({ error: "Please verify your email first." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { registerUser, verifyCode, loginUser };