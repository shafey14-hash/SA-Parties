const express = require("express");
const router = express.Router();
const { registerUser, verifyCode, loginUser } = require("../controllers/UserController");

router.post("/register", registerUser);   // Signup
router.post("/verify", verifyCode);       // Email verification
router.post("/login", loginUser);         // Login

module.exports = router;