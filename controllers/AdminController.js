const db = require("../config/db");

// Admin Login

const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      "SELECT * FROM admins WHERE username = $1 AND password = $2",

      [username, password],
    );

    const admins = result.rows;

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
    res.status(500).json({ error: error.message });
  }
};

// Place Order

const placeOrder = async (req, res) => {
  const { name, email, phone, address, items, total_amount } = req.body;

  try {
    const customerResult = await db.query(
      "INSERT INTO customers (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING id",

      [name, email, phone, address],
    );

    const customerId = customerResult.rows[0].id;

    const now = new Date();

    const date =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");

    const rand = Math.floor(1000 + Math.random() * 9000);

    const orderNumber = "SAP-" + date + "-" + rand;

    const orderResult = await db.query(
      "INSERT INTO orders (order_number, customer_id, total_amount, status, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING id",

      [orderNumber, customerId, total_amount, "Pending", "cod"],
    );

    const orderId = orderResult.rows[0].id;

    for (const item of items) {
      await db.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)",

        [orderId, item.product_id, item.quantity, item.price],
      );

      await db.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2",

        [item.quantity, item.product_id],
      );
    }

    res.status(201).json({ message: "Order confirmed", orderId, orderNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Orders

const getAllOrders = async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM orders ORDER BY id DESC");

    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Order Status

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;

  const { status } = req.body;

  try {
    await db.query(
      "UPDATE orders SET status = $1 WHERE id = $2",

      [status, id],
    );

    res.status(200).json({ message: "Status updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  adminLogin,
  placeOrder,
  getAllOrders,
  updateOrderStatus,
};
