const db = require("../config/db");

// ============================================================
// 1. Admin Login
// ============================================================
const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [admins] = await db.query(
      "SELECT * FROM admins WHERE username = ? AND password = ?",
      [username, password],
    );

    if (admins.length > 0) {
      return res.status(200).json({
        message: "Login successful",
        token: "mock-admin-jwt-token",
        adminId: admins[0].id,
      });
    } else {
      return res.status(401).json({ error: "Invalid username or password." });
    }
  } catch (error) {
    res
      .status(500)
      .json({
        error: "Server login endpoint crashed.",
        details: error.message,
      });
  }
};

// ============================================================
// 2. Place Order (Admin side — legacy, kept for backward compat)
// ============================================================
const placeOrder = async (req, res) => {
  const { name, email, phone, address, items, total_amount } = req.body;

  if (!name || !phone || !address || !items || items.length === 0) {
    return res
      .status(400)
      .json({
        error: "Enter all required details (Name, Phone, Address, Items)!",
      });
  }

  try {
    const [customerResult] = await db.query(
      "INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)",
      [name, email, phone, address],
    );
    const customerId = customerResult.insertId;

    const _now = new Date();
    const _date =
      _now.getFullYear().toString() +
      String(_now.getMonth() + 1).padStart(2, "0") +
      String(_now.getDate()).padStart(2, "0");
    const _rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = "SAP-" + _date + "-" + _rand;

    const [orderResult] = await db.query(
      "INSERT INTO orders (order_number, customer_id, total_amount, status, payment_method) VALUES (?, ?, ?, ?, ?)",
      [orderNumber, customerId, total_amount, "Pending", "cod"],
    );
    const orderId = orderResult.insertId;

    for (let item of items) {
      await db.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
        [orderId, item.product_id, item.quantity, item.price],
      );
      await db.query("UPDATE products SET stock = stock - ? WHERE id = ?", [
        item.quantity,
        item.product_id,
      ]);
    }

    res
      .status(201)
      .json({ message: "Order confirmed by SA Parties", orderId, orderNumber });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "There's an issue in placing order.",
        details: error.message,
      });
  }
};

// ============================================================
// 3. Fetch All Orders (Admin simplified — use OrderController for full data)
// ============================================================
const getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.id, o.order_number, o.total_amount, o.status, o.payment_method,
             o.payment_status, o.created_at,
             c.name AS customer_name, c.phone, c.address
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      ORDER BY o.id DESC
    `);
    res.status(200).json(orders);
  } catch (error) {
    res
      .status(500)
      .json({
        error: "There's an issue in fetching orders.",
        details: error.message,
      });
  }
};

// ============================================================
// 4. Update Order Status (Admin simplified)
// ============================================================
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    res.status(200).json({ message: `Order status updated to ${status}` });
  } catch (error) {
    res
      .status(500)
      .json({
        error: "There's an issue in updating order status.",
        details: error.message,
      });
  }
};

module.exports = {
  adminLogin,
  placeOrder,
  getAllOrders,
  updateOrderStatus,
};
