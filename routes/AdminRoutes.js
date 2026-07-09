const express = require("express");
const router = express.Router();
const { adminLogin } = require("../controllers/AdminController");
const {
  createCategory,
  getCategories,
} = require("../controllers/CategoryController");

router.post("/login", adminLogin);
router.post("/category", createCategory);
router.get("/categories", getCategories);

module.exports = router;
