const express = require("express");
const router = express.Router();
const {
  placeOrder,
  getAllOrders,
  getUserOrders,
  updateOrderStatus,
  deleteOrder,
  verifyPayment,
  getOrderPaymentDetails,
  updateOrderPrice,
  updateProductStock,
  getProductStock,
} = require("../controllers/OrderController");

// ── Orders ──
router.post("/", placeOrder);
router.get("/", getAllOrders);
router.get("/user/:user_id", getUserOrders);
router.put("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);
router.put("/:id/verify-payment", verifyPayment);
router.get("/:id/payment-details", getOrderPaymentDetails);
router.put("/:id/price", updateOrderPrice);

// ── Stock Management (Admin) ──
// GET  /api/orders/stock/:id  → get current stock of a product
// PUT  /api/orders/stock/:id  → admin updates stock
router.get("/stock/:id", getProductStock);
router.put("/stock/:id", updateProductStock);

module.exports = router;
