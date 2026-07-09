const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategories,
  deleteCategory,
  updateCategory,
} = require("../controllers/CategoryController");

// Category routes
router.post("/", createCategory);
router.get("/", getCategories);
router.delete("/:id", deleteCategory);
router.put("/:id", updateCategory);

module.exports = router;
