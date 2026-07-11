const db = require("../config/db");
const {
  sendPaymentApproved,
  sendPaymentRejected,
  sendOrderCancellation,
  sendOrderConfirmation,
  sendOrderShipped,
  sendOrderDelivered,
} = require("./EmailController");

// ─────────────────────────────────────────────────────────────
// Place Order
// ─────────────────────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    items,
    total_amount,
    payment_method,
    transaction_id,
    sender_number,
    payment_screenshot,
    user_id,
  } = req.body;

  if (!name || !phone || !address || !items || items.length === 0) {
    return res.status(400).json({ error: "Complete the details." });
  }

  if (!payment_method) {
    return res.status(400).json({ error: "Please select a payment method." });
  }

  if (payment_method !== "cod") {
    if (!transaction_id || transaction_id.trim() === "") {
      return res
        .status(400)
        .json({ error: "Transaction ID is required for online payments." });
    }
    if (!sender_number || sender_number.trim() === "") {
      return res.status(400).json({
        error: "Sender mobile number is required for online payments.",
      });
    }
    if (!payment_screenshot || payment_screenshot.trim() === "") {
      return res
        .status(400)
        .json({ error: "Payment screenshot is required for online payments." });
    }
    const mobileRegex = /^03[0-9]{2}[-]?[0-9]{7}$/;
    if (!mobileRegex.test(sender_number.trim())) {
      return res.status(400).json({
        error: "Invalid mobile number format. Use format: 03XX-XXXXXXX",
      });
    }
    const txnRegex = /^[A-Za-z0-9\-_]{4,30}$/;
    if (!txnRegex.test(transaction_id.trim())) {
      return res.status(400).json({
        error:
          "Invalid transaction ID. Must be 4-30 characters (letters, numbers, dashes allowed).",
      });
    }
  }

  const connection = await db.connect();
  try {
    await connection.query("BEGIN");

    const customerResult = await connection.query(
      "INSERT INTO customers (name, email, phone, address) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, email, phone, address],
    );
    const customerId = customerResult.rows[0].id;

    // COD → directly Pending; Online → Payment Verification
    const orderStatus =
      payment_method === "cod" ? "Pending" : "Payment Verification";
    const paymentStatus = "Pending";

    // Generate unique order number: SAP-YYYYMMDD-XXXX
    const _now = new Date();
    const _date =
      _now.getFullYear().toString() +
      String(_now.getMonth() + 1).padStart(2, "0") +
      String(_now.getDate()).padStart(2, "0");
    const _rand = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = "SAP-" + _date + "-" + _rand;

    const orderResult = await connection.query(
      `INSERT INTO orders
        (order_number, customer_id, total_amount, status, payment_method,
         payment_status, transaction_id, sender_number, payment_screenshot, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        orderNumber,
        customerId,
        total_amount,
        orderStatus,
        payment_method,
        paymentStatus,
        transaction_id || null,
        sender_number || null,
        payment_screenshot || null,
        user_id || null,
      ],
    );
    const orderId = orderResult.rows[0].id;

    for (let item of items) {
      // ── Atomic stock check + decrement (prevents overselling) ──
      // SELECT ... FOR UPDATE locks the row so concurrent orders can't race
      const stockResult = await connection.query(
        "SELECT stock, name FROM products WHERE id = $1 FOR UPDATE",
        [item.product_id],
      );
      const stockRows = stockResult.rows;

      if (stockRows.length === 0) {
        await connection.query("ROLLBACK");
        return res
          .status(404)
          .json({ error: `Product #${item.product_id} not found.` });
      }

      const availableStock = Number(stockRows[0].stock);
      const productName = stockRows[0].name;

      if (availableStock <= 0) {
        await connection.query("ROLLBACK");
        return res.status(400).json({
          error: `"${productName}" is out of stock. Please remove it from your cart.`,
          outOfStock: true,
          productId: item.product_id,
        });
      }

      if (availableStock < item.quantity) {
        await connection.query("ROLLBACK");
        return res.status(400).json({
          error: `Only ${availableStock} unit(s) of "${productName}" available. Please reduce the quantity.`,
          insufficientStock: true,
          productId: item.product_id,
          availableStock,
        });
      }

      await connection.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price, color_id) VALUES ($1, $2, $3, $4, $5)",
        [
          orderId,
          item.product_id,
          item.quantity,
          item.price,
          item.color_id || null,
        ],
      );

      // Decrement stock atomically
      await connection.query(
        "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $3",
        [item.quantity, item.product_id, item.quantity],
      );
    }

    await connection.query("COMMIT");

    // ── Send email notifications ──
    if (email) {
      // Fetch actual product names/colors for proper email formatting
      const itemDetailResult = await db.query(
        `SELECT p.name AS pname, pc.color_name AS cname, oi.quantity, oi.price
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_colors pc ON oi.color_id = pc.id
         WHERE oi.order_id = $1`,
        [orderId],
      );
      const itemDetailRows = itemDetailResult.rows;
      const itemsText = itemDetailRows
        .map(
          (r) =>
            `${r.pname}${r.cname ? ` (${r.cname})` : ""} x${r.quantity} @ Rs.${r.price}`,
        )
        .join("||");

      if (payment_method === "cod") {
        // COD: immediate confirmation
        try {
          await sendOrderConfirmation(
            email,
            name,
            orderId,
            orderNumber,
            itemsText,
            total_amount,
            address,
            phone,
            payment_method,
          );
        } catch (emailErr) {
          console.error("COD confirmation email failed:", emailErr.message);
        }
      }
      // Online: no email until admin approves/rejects
    }

    const responseMessage =
      payment_method === "cod"
        ? "Order confirmed! Your order is now being processed."
        : "Order submitted! Your payment is being verified. You will receive an email once approved.";

    res.status(201).json({
      message: responseMessage,
      orderId,
      orderNumber,
      paymentStatus,
      orderStatus,
    });
  } catch (error) {
    await connection.query("ROLLBACK");
    res
      .status(500)
      .json({ error: "Order process failed.", details: error.message });
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────
// Get All Orders (Admin)
// ─────────────────────────────────────────────────────────────
const getAllOrders = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        o.id, o.order_number, o.total_amount, o.status, o.payment_method, o.payment_status,
        o.transaction_id, o.sender_number, o.payment_screenshot, o.verification_notes,
        o.rejection_reason, o.verified_by, o.verified_at,
        o.admin_edited_price, o.admin_notes, o.created_at,
        c.name AS customer_name, c.phone, c.address, c.email AS customer_email,
        STRING_AGG(
          agg.pname ||
          CASE WHEN agg.cname IS NOT NULL AND agg.cname != '' THEN ' (' || agg.cname || ')' ELSE '' END ||
          ' (x' || agg.qty || ')',
          '||' ORDER BY agg.pname, agg.cname
        ) AS items_list
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN (
        SELECT
          oi.order_id,
          p.name        AS pname,
          pc.color_name AS cname,
          SUM(oi.quantity) AS qty
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_colors pc ON oi.color_id = pc.id
        GROUP BY oi.order_id, oi.product_id, oi.color_id, p.name, pc.color_name
      ) agg ON agg.order_id = o.id
      GROUP BY o.id, o.order_number, o.total_amount, o.status, o.payment_method, o.payment_status,
        o.transaction_id, o.sender_number, o.payment_screenshot, o.verification_notes,
        o.rejection_reason, o.verified_by, o.verified_at,
        o.admin_edited_price, o.admin_notes, o.created_at,
        c.name, c.phone, c.address, c.email
      ORDER BY o.id DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: "There's an issue in fetching orders.",
      details: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Get Orders for Logged-in User (Order History)
// ─────────────────────────────────────────────────────────────
const getUserOrders = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required." });
  }

  try {
    const result = await db.query(
      `
      SELECT
        o.id, o.order_number, o.total_amount, o.status, o.payment_method,
        o.payment_status, o.created_at, o.rejection_reason,
        c.name AS customer_name, c.phone, c.address, c.email AS customer_email,
        STRING_AGG(
          p.name ||
          CASE WHEN pc.color_name IS NOT NULL AND pc.color_name != '' THEN ' (' || pc.color_name || ')' ELSE '' END ||
          ' x' || oi.quantity ||
          ' @ Rs.' || TO_CHAR(oi.price, 'FM999,999,999'),
          '||' ORDER BY p.name
        ) AS items_list
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN product_colors pc ON oi.color_id = pc.id
      WHERE o.user_id = $1
      GROUP BY o.id, o.order_number, o.total_amount, o.status, o.payment_method,
        o.payment_status, o.created_at, o.rejection_reason,
        c.name, c.phone, c.address, c.email
      ORDER BY o.created_at DESC
    `,
      [user_id],
    );

    res.status(200).json(result.rows);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch user orders.", details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Update Order Status
// ─────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  let { status } = req.body;

  if (!status || typeof status !== "string") {
    return res.status(400).json({ error: "Status is required." });
  }

  // Normalize to canonical case so 'shipped', 'Shipped', 'SHIPPED' all work
  const statusMap = {
    pending: "Pending",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    "payment verification": "Payment Verification",
    "payment rejected": "Payment Rejected",
  };
  const normalized = statusMap[status.trim().toLowerCase()];

  if (!normalized) {
    return res.status(400).json({
      error: `Invalid status value: "${status}". Must be one of: Pending, Shipped, Delivered, Cancelled, Payment Verification, Payment Rejected.`,
    });
  }
  status = normalized;

  try {
    const ordersResult = await db.query(
      `SELECT o.*, c.email AS customer_email, c.name AS customer_name, c.address
       FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
      [id],
    );
    const orders = ordersResult.rows;

    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orders[0];
    await db.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);

    // Send email on status change
    if (order.customer_email) {
      try {
        const itemsResult = await db.query(
          `SELECT p.name AS pname, pc.color_name AS cname, oi.quantity, oi.price
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           LEFT JOIN product_colors pc ON oi.color_id = pc.id
           WHERE oi.order_id = $1`,
          [id],
        );
        const itemsRows = itemsResult.rows;
        const itemsText = itemsRows
          .map(
            (r) =>
              `${r.pname}${r.cname ? ` (${r.cname})` : ""} x${r.quantity} @ Rs.${r.price}`,
          )
          .join("||");

        if (status === "Shipped") {
          await sendOrderShipped(
            order.customer_email,
            order.customer_name,
            id,
            order.order_number,
            itemsText,
            order.total_amount,
          );
        } else if (status === "Delivered") {
          await sendOrderDelivered(
            order.customer_email,
            order.customer_name,
            id,
            order.order_number,
            itemsText,
            order.total_amount,
          );
        } else if (status === "Cancelled") {
          await sendOrderCancellation(
            order.customer_email,
            order.customer_name,
            order.order_number || id,
            itemsText,
            order.total_amount,
            "Order cancelled by admin.",
          );
        }
      } catch (emailErr) {
        console.error("Status change email failed:", emailErr.message);
      }
    }

    res.status(200).json({ message: `Order status updated to ${status}` });
  } catch (error) {
    res.status(500).json({
      error: "Failed to update order status.",
      details: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────
// Delete Order
// ─────────────────────────────────────────────────────────────
const deleteOrder = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM order_items WHERE order_id = $1", [id]);
    const result = await db.query("DELETE FROM orders WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(200).json({ message: "Order and items deleted" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Database error", details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Verify Payment (Approve / Reject)
// ─────────────────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;
  const adminId = req.admin?.id || 1;

  if (!action || (action !== "approve" && action !== "reject")) {
    return res
      .status(400)
      .json({ error: "Invalid action. Must be 'approve' or 'reject'." });
  }

  try {
    const ordersResult = await db.query(
      `SELECT o.*, c.email AS customer_email, c.name AS customer_name, c.address
       FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
      [id],
    );
    const orders = ordersResult.rows;
    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orders[0];

    // Fetch order items for email
    const itemsResult = await db.query(
      `SELECT p.name AS pname, pc.color_name AS cname, oi.quantity, oi.price
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_colors pc ON oi.color_id = pc.id
       WHERE oi.order_id = $1`,
      [id],
    );
    const itemsRows = itemsResult.rows;
    const itemsText = itemsRows
      .map(
        (r) =>
          `${r.pname}${r.cname ? ` (${r.cname})` : ""} x${r.quantity} @ Rs.${r.price}`,
      )
      .join("||");

    if (action === "approve") {
      // Move to Pending Orders
      await db.query(
        `UPDATE orders
         SET payment_status = 'Paid',
             status = 'Pending',
             verification_notes = $1,
             verified_by = $2,
             verified_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [notes || "Payment approved by admin", adminId, id],
      );

      // Send approval email
      if (order.customer_email) {
        try {
          await sendPaymentApproved(
            order.customer_email,
            order.customer_name,
            id,
            order.order_number,
            itemsText,
            order.total_amount,
          );
        } catch (emailErr) {
          console.error("Payment approved email failed:", emailErr.message);
        }
      }

      res
        .status(200)
        .json({ message: "Payment approved. Order moved to Pending Orders." });
    } else {
      // Move to Cancelled with rejection reason
      const rejectionReason = notes || "Payment could not be verified.";
      await db.query(
        `UPDATE orders
         SET payment_status = 'Rejected',
             status = 'Payment Rejected',
             rejection_reason = $1,
             verification_notes = $2,
             verified_by = $3,
             verified_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [rejectionReason, rejectionReason, adminId, id],
      );

      // Send rejection email
      if (order.customer_email) {
        try {
          await sendPaymentRejected(
            order.customer_email,
            order.customer_name,
            id,
            order.order_number,
            itemsText,
            order.total_amount,
            rejectionReason,
          );
        } catch (emailErr) {
          console.error("Payment rejected email failed:", emailErr.message);
        }
      }

      res
        .status(200)
        .json({ message: "Payment rejected. Order moved to Cancelled." });
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: "Verification failed", details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Get Order Payment Details
// ─────────────────────────────────────────────────────────────
const getOrderPaymentDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
       FROM orders o JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to fetch order details", details: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Update Order Price (with Audit Log)
// ─────────────────────────────────────────────────────────────
const updateOrderPrice = async (req, res) => {
  const { id } = req.params;
  const { total_amount, admin_notes } = req.body;

  if (!total_amount || isNaN(total_amount) || total_amount <= 0) {
    return res.status(400).json({ error: "Invalid price amount." });
  }

  const connection = await db.connect();
  try {
    await connection.query("BEGIN");

    // Get current price for audit log
    const orderResult = await connection.query(
      "SELECT total_amount FROM orders WHERE id = $1",
      [id],
    );
    const orderRows = orderResult.rows;
    if (orderRows.length === 0) {
      await connection.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found." });
    }
    const oldPrice = orderRows[0].total_amount;

    // Update price
    await connection.query(
      "UPDATE orders SET total_amount = $1, admin_edited_price = true, admin_notes = $2 WHERE id = $3",
      [total_amount, admin_notes || "", id],
    );

    // Insert audit log
    await connection.query(
      `INSERT INTO order_price_logs (order_id, old_price, new_price, changed_by, change_reason)
       VALUES ($1, $2, $3, 'admin', $4)`,
      [id, oldPrice, total_amount, admin_notes || "Price updated by admin"],
    );

    await connection.query("COMMIT");
    res.status(200).json({ message: "Order price updated successfully!" });
  } catch (error) {
    await connection.query("ROLLBACK");
    res
      .status(500)
      .json({ error: "Failed to update order price", details: error.message });
  } finally {
    connection.release();
  }
};

// ─────────────────────────────────────────────────────────────
// Update Product Stock (Admin)
// ─────────────────────────────────────────────────────────────
const updateProductStock = async (req, res) => {
  const { id } = req.params; // product id
  const { stock } = req.body;

  if (
    stock === undefined ||
    stock === null ||
    isNaN(stock) ||
    Number(stock) < 0
  ) {
    return res
      .status(400)
      .json({ error: "Invalid stock value. Must be 0 or greater." });
  }

  try {
    const result = await db.query(
      "UPDATE products SET stock = $1 WHERE id = $2",
      [Math.floor(Number(stock)), id],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    const newStock = Math.floor(Number(stock));
    res.status(200).json({
      message: `Stock updated to ${newStock}.`,
      stock: newStock,
      inStock: newStock > 0,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to update stock.", details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Get Single Product Stock (for real-time check)
// ─────────────────────────────────────────────────────────────
const getProductStock = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      "SELECT id, name, stock FROM products WHERE id = $1",
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Product not found." });
    const { stock, name } = result.rows[0];
    res
      .status(200)
      .json({ id: result.rows[0].id, name, stock, inStock: stock > 0 });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to fetch stock.", details: err.message });
  }
};

module.exports = {
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
};
