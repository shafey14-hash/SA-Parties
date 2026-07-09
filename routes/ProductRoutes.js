const express = require("express");
const router = express.Router();
const productController = require("../controllers/ProductController");
const upload = require("../config/upload");

router.get("/", productController.getAllProducts);
router.get("/:slug", productController.getProductBySlug);
router.get("/product/:id", productController.getProductById);

router.post("/", upload.any(), productController.createProduct);
router.put("/:id", upload.any(), productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

module.exports = router;
