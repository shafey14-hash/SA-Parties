// ============================================================
// admin-orders.js — Orders module (code-split)
//
// This file is loaded on demand (dynamic import) the first time the
// admin opens the "Orders" section — see loadOrdersModule() in
// admin.js. It is NOT loaded on login, so a session that only manages
// products never downloads this code at all.
//
// Because this file is loaded as an ES module, its top-level functions
// are NOT automatically placed on `window` the way a classic <script>
// would. Several of them are invoked from onclick="..." attributes
// baked into HTML strings this file itself renders (e.g. inside
// fetchAdminOrders / fetchPaymentVerifications), so we explicitly
// attach them to window at the bottom of this file.
// ============================================================

async function editOrderPrice(orderId, currentPrice) {
  const newPrice = prompt("Enter new price for this order:", currentPrice);
  if (newPrice === null) return; // User cancelled

  const parsedPrice = parseFloat(newPrice);
  if (isNaN(parsedPrice) || parsedPrice <= 0) {
    showToast("error", "Invalid Price", "Please enter a valid price.");
    return;
  }

  const notes = prompt("Reason for price change (optional):", "") || "";

  try {
    const response = await fetch(`/api/orders/${orderId}/price`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        total_amount: parsedPrice,
        admin_notes: notes,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      showToast(
        "success",
        "Price Updated",
        `Order price changed to Rs. ${parsedPrice.toLocaleString("en-PK")}`,
      );
      // Update the displayed price
      const priceElement = document.getElementById(`order-price-${orderId}`);
      if (priceElement) {
        priceElement.textContent = `Rs. ${parsedPrice.toLocaleString("en-PK")}`;
      }
      // Refresh orders to ensure consistency
      fetchAdminOrders();
    } else {
      showToast(
        "error",
        "Update Failed",
        data.error || "Could not update price.",
      );
    }
  } catch (err) {
    showToast("error", "Network Error", "Failed to connect to server.");
  }
}

// ----------------------------------------------------------
// Order Summary Toggle (arrow button)
// ----------------------------------------------------------
function toggleOrderSummary(orderId) {
  const panel = document.getElementById(`summary-panel-${orderId}`);
  const icon = document.getElementById(`summary-icon-${orderId}`);
  if (!panel) return;
  const isOpen = panel.style.display === "block";
  panel.style.display = isOpen ? "none" : "block";
  if (icon) {
    icon.className = isOpen
      ? "bi bi-chevron-down me-1"
      : "bi bi-chevron-up me-1";
  }
}

// ----------------------------------------------------------
// 3. Fetch & Update Orders Tracking Flow
// ----------------------------------------------------------
async function fetchAdminOrders() {
  const pendingContainer = document.getElementById("pending-orders-box");
  const shippedContainer = document.getElementById("shipped-orders-box");
  const deliveredContainer = document.getElementById("delivered-orders-box");

  try {
    const res = await fetch("/api/orders");
    const orders = await res.json();

    let pendingHtml = "",
      shippedHtml = "",
      deliveredHtml = "",
      cancelledHtml = "";
    let pendingCount = 0,
      shippedCount = 0,
      paymentCount = 0;

    if (Array.isArray(orders) && orders.length > 0) {
      orders.forEach((o) => {
        const orderStatus = o.status ? o.status.toLowerCase() : "pending";

        const markup = `
  <div class="order-box fade-in" data-search="${(o.order_number || "") + " " + (o.customer_name || o.name || "")}">
    <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
      <div>
        <h6 class="m-0 fw-bold text-dark">${escapeHtml(o.customer_name || o.name)}</h6>
        <small class="text-muted"><i class="bi bi-telephone"></i> ${escapeHtml(o.phone)}</small>
        ${o.order_number ? `<div style="margin-top:2px;"><span style="background:var(--pink-light);border:1.5px solid var(--pink-soft);border-radius:8px;padding:2px 10px;font-size:0.78rem;font-weight:800;color:var(--pink-primary);font-family:'Courier New',monospace;letter-spacing:0.05em;">${escapeHtml(o.order_number)}</span></div>` : ""}
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-light border fw-bold" style="color:var(--pink-primary);font-size:0.85rem;" id="order-price-${o.id}">Rs. ${Number(o.total_amount).toLocaleString("en-PK")}</span>
      </div>
    </div>

    <div class="mb-2">
      <strong class="small text-muted">Items:</strong>
      <div class="d-flex flex-wrap gap-1 mt-1 align-items-center">
        ${(() => {
          const rawItems = (o.items_list || "")
            .split("||")
            .map((s) => s.trim())
            .filter(Boolean);
          let totalQty = 0;
          const badges = rawItems.map((item) => {
            const fm = item.match(/^(.+?)\s*\(([^)]+)\)\s*\(x(\d+)\)$/i);
            const sm = item.match(/^(.+?)\s*\(x(\d+)\)$/i);
            if (fm) {
              totalQty += Number(fm[3]);
              return `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--pink-light);border:1px solid var(--pink-soft);border-radius:50px;padding:0.2rem 0.7rem;font-size:0.78rem;font-weight:600;color:var(--ink);">${escapeHtml(fm[1])}<span style="background:#7c3aed;color:#fff;border-radius:50px;padding:0.05rem 0.5rem;font-size:0.7rem;font-weight:700;">🎨 ${escapeHtml(fm[2])}</span><span style="background:var(--pink-primary);color:#fff;border-radius:50px;padding:0.05rem 0.45rem;font-size:0.72rem;font-weight:700;">x${fm[3]}</span></span>`;
            } else if (sm) {
              totalQty += Number(sm[2]);
              return `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--pink-light);border:1px solid var(--pink-soft);border-radius:50px;padding:0.2rem 0.7rem;font-size:0.78rem;font-weight:600;color:var(--ink);">${escapeHtml(sm[1])}<span style="background:var(--pink-primary);color:#fff;border-radius:50px;padding:0.05rem 0.45rem;font-size:0.72rem;font-weight:700;">x${sm[2]}</span></span>`;
            }
            return `<span style="background:var(--pink-light);border:1px solid var(--pink-soft);border-radius:50px;padding:0.2rem 0.7rem;font-size:0.78rem;font-weight:600;color:var(--ink);">${escapeHtml(item)}</span>`;
          });
          return (
            badges.join("") +
            (totalQty > 0
              ? `<span style="margin-left:4px;font-weight:800;font-size:0.82rem;color:var(--ink);">= <strong>${totalQty}</strong> items</span>`
              : "")
          );
        })()}
      </div>
    </div>

    <p class="small text-secondary mb-2"><i class="bi bi-geo-alt-fill"></i> ${escapeHtml(o.address)}</p>

    <div class="d-flex justify-content-between align-items-center mt-2">
      <button class="btn btn-sm rounded-pill fw-bold px-3"
        style="background:var(--pink-light);border:1.5px solid var(--pink-soft);color:var(--pink-primary);font-size:0.8rem;"
        onclick="toggleOrderSummary(${o.id})">
        <i class="bi bi-chevron-down me-1" id="summary-icon-${o.id}"></i> Summary
      </button>
      <div>${renderWorkflowButton(o.id, orderStatus, o.customer_name || o.name, o.total_amount)}</div>
    </div>

    <!-- Collapsible Summary Panel -->
    <div id="summary-panel-${o.id}" style="display:none;margin-top:12px;background:#fff1f8;border:1.5px dashed #fbdcee;border-radius:12px;padding:14px 16px;">
      <h6 style="color:#e0218a;font-size:0.85rem;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.08em;">📋 Order Summary</h6>
      ${o.order_number ? `<div style="background:#fff3e0;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:0.78rem;color:#e65100;font-weight:600;"><i class="bi bi-bookmark-fill me-1"></i> Order No: <strong style="font-family:'Courier New',monospace;letter-spacing:0.06em;">${escapeHtml(o.order_number)}</strong> — Please note this for reference.</div>` : ""}
      <table style="width:100%;font-size:0.83rem;border-collapse:collapse;">
        <tr><td style="color:#8c7a92;padding:4px 0;width:38%;">Order No.</td><td style="font-weight:700;color:#e0218a;font-family:'Courier New',monospace;">${escapeHtml(o.order_number || "—")}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Customer</td><td style="font-weight:600;color:#2a1b2e;">${escapeHtml(o.customer_name || o.name)}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Phone</td><td style="color:#2a1b2e;">${escapeHtml(o.phone)}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Address</td><td style="color:#2a1b2e;">${escapeHtml(o.address)}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Date</td><td style="color:#2a1b2e;">${o.created_at ? new Date(o.created_at).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" }) : "—"}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Payment</td><td style="color:#2a1b2e;">${escapeHtml(o.payment_method === "cod" ? "Cash on Delivery" : o.payment_method || "—")}</td></tr>
        <tr><td style="color:#8c7a92;padding:4px 0;">Status</td><td><span style="background:#e0218a;color:#fff;border-radius:50px;padding:1px 10px;font-size:0.75rem;font-weight:700;">${escapeHtml(o.status)}</span></td></tr>
      </table>
      <div style="margin-top:10px;border-top:1px dashed #fbdcee;padding-top:10px;">
        <div style="font-size:0.8rem;color:#8c7a92;font-weight:600;margin-bottom:6px;">ITEMS</div>
        ${(() => {
          const rawItems = (o.items_list || "")
            .split("||")
            .map((s) => s.trim())
            .filter(Boolean);
          let totalQty = 0;
          const rows = rawItems.map((item) => {
            const fm = item.match(/^(.+?)\s*\(([^)]+)\)\s*\(x(\d+)\)$/i);
            const sm = item.match(/^(.+?)\s*\(x(\d+)\)$/i);
            if (fm) {
              totalQty += Number(fm[3]);
              return `<div style="padding:6px 0;font-size:0.83rem;color:#2a1b2e;border-bottom:1px solid #fbdcee;display:flex;justify-content:space-between;align-items:center;">
                <span style="display:inline-flex;align-items:center;gap:6px;">${escapeHtml(fm[1])} <span style="background:#7c3aed;color:#fff;border-radius:50px;padding:1px 8px;font-size:0.7rem;font-weight:700;">🎨 ${escapeHtml(fm[2])}</span></span>
                <span style="font-weight:700;color:var(--pink-primary);">x${fm[3]}</span>
              </div>`;
            } else if (sm) {
              totalQty += Number(sm[2]);
              return `<div style="padding:6px 0;font-size:0.83rem;color:#2a1b2e;border-bottom:1px solid #fbdcee;display:flex;justify-content:space-between;align-items:center;">
                <span>${escapeHtml(sm[1])}</span>
                <span style="font-weight:700;color:var(--pink-primary);">x${sm[2]}</span>
              </div>`;
            }
            return `<div style="padding:6px 0;font-size:0.83rem;color:#2a1b2e;border-bottom:1px solid #fbdcee;">${escapeHtml(item)}</div>`;
          });
          return (
            rows.join("") +
            (totalQty > 0
              ? `<div style="padding:6px 0;font-size:0.83rem;font-weight:800;color:#2a1b2e;display:flex;justify-content:space-between;border-bottom:1px solid #fbdcee;"><span>Total Items</span><span style="color:var(--pink-primary);">${totalQty} pcs</span></div>`
              : "")
          );
        })()}
        <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;font-weight:800;font-size:0.9rem;">
          <span style="color:#2a1b2e;">Total</span>
          <span style="color:#e0218a;">Rs. ${Number(o.total_amount).toLocaleString("en-PK")}</span>
        </div>
        <button onclick="adminDownloadOrderPDF(${o.id})" style="margin-top:12px;width:100%;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;color:#fff;font-weight:700;font-size:0.85rem;border-radius:10px;padding:0.6rem;cursor:pointer;font-family:'Poppins',sans-serif;">
          <i class="bi bi-file-earmark-pdf-fill me-2"></i>Download PDF Receipt
        </button>
      </div>
    </div>
  </div>
`;

        if (
          orderStatus === "pending" ||
          orderStatus === "pending payment verification" ||
          orderStatus === "processing"
        ) {
          pendingHtml += markup;
          pendingCount++;
        } else if (orderStatus === "shipped") {
          shippedHtml += markup;
          shippedCount++;
        } else if (orderStatus === "delivered") {
          deliveredHtml += markup;
        } else if (
          orderStatus === "cancelled" ||
          orderStatus === "payment rejected"
        ) {
          cancelledHtml += markup;
        }
      });
    }

    document.getElementById("badge-pending-count").innerText = pendingCount;
    const shippedBadge = document.getElementById("badge-shipped-count");
    if (shippedBadge) {
      shippedBadge.textContent = shippedCount;
      shippedBadge.style.display = shippedCount > 0 ? "inline" : "none";
    }

    pendingContainer.innerHTML =
      pendingHtml ||
      `<div class="empty-state"><div class="icon"><i class="bi bi-emoji-smile"></i></div><p class="text-muted">No pending orders.</p></div>`;
    shippedContainer.innerHTML =
      shippedHtml ||
      `<div class="empty-state"><div class="icon"><i class="bi bi-box"></i></div><p class="text-muted">No shipped orders.</p></div>`;
    deliveredContainer.innerHTML =
      deliveredHtml ||
      `<div class="empty-state"><div class="icon"><i class="bi bi-folder-check"></i></div><p class="text-muted">No delivered orders yet.</p></div>`;

    // Cancelled orders container
    const cancelledContainer = document.getElementById("cancelled-orders-box");
    if (cancelledContainer) {
      cancelledContainer.innerHTML =
        cancelledHtml ||
        `<div class="empty-state"><div class="icon"><i class="bi bi-slash-circle"></i></div><p class="text-muted">No cancelled orders.</p></div>`;
    }
  } catch (err) {
    console.error("Order synchronization module collapsed:", err);
  }
}

// Fetch payment verification requests
async function fetchPaymentVerifications() {
  const paymentContainer = document.getElementById("payment-verification-box");

  try {
    const res = await fetch("/api/orders");
    const orders = await res.json();

    // Filter orders that need payment verification (online payments with pending status)
    const paymentOrders = orders.filter(
      (o) =>
        o.payment_method &&
        o.payment_method !== "cod" &&
        o.payment_status &&
        o.payment_status === "Pending",
    );

    let paymentHtml = "";
    let paymentCount = paymentOrders.length;

    if (paymentOrders.length > 0) {
      paymentOrders.forEach((o) => {
        const paymentMethodIcon =
          o.payment_method === "easypaisa" ? "bi-phone-fill" : "bi-wallet2";
        const paymentMethodColor =
          o.payment_method === "easypaisa" ? "#00a651" : "#c41e3a";

        paymentHtml += `
  <div class="order-box fade-in" data-search="${(o.order_number || "") + " " + (o.customer_name || o.name || "")}">
    <div class="d-flex justify-content-between align-items-start border-bottom pb-2 mb-2">
      <div>
        <h6 class="m-0 fw-bold text-dark">${escapeHtml(o.customer_name || o.name)}</h6>
        <small class="text-muted"><i class="bi bi-telephone"></i> ${escapeHtml(o.phone)}</small>
      </div>
      <div class="text-end">
        <span class="badge bg-light border fw-bold" style="color: ${paymentMethodColor}">
          <i class="bi ${paymentMethodIcon}"></i> ${escapeHtml(o.payment_method || "Online").toUpperCase()}
        </span>
        <div class="small fw-bold text-muted mt-1">Rs. ${Number(o.total_amount).toLocaleString("en-PK")}</div>
      </div>
    </div>
    
    <div class="row g-2 mb-3">
      <div class="col-6">
        <div class="small text-muted">Transaction ID</div>
        <div class="fw-bold" style="font-size: 0.9rem;">${escapeHtml(o.transaction_id || "N/A")}</div>
      </div>
      <div class="col-6">
        <div class="small text-muted">Sender Number</div>
        <div class="fw-bold" style="font-size: 0.9rem;">${escapeHtml(o.sender_number || "N/A")}</div>
      </div>
    </div>
    
    ${
      o.payment_screenshot
        ? `
    <div class="mb-3">
      <div class="small text-muted mb-1">Payment Screenshot</div>
      <img src="${escapeHtml(o.payment_screenshot)}" alt="Payment Screenshot" 
           style="max-width: 200px; max-height: 150px; border-radius: 12px; border: 2px solid var(--pink-200); cursor: pointer;"
           onclick="window.open('${escapeHtml(o.payment_screenshot)}', '_blank')">
    </div>
    `
        : ""
    }
    
    <div class="mb-3">
      <textarea class="form-control" id="verification-notes-${o.id}" placeholder="Add verification notes (optional)" 
                style="font-size: 0.85rem; border-radius: 12px; min-height: 60px;"></textarea>
    </div>
    
    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-danger rounded-pill fw-bold px-3 shadow-sm" onclick="verifyPayment(${o.id}, 'reject')">
        <i class="bi bi-x-circle me-1"></i> Reject
      </button>
      <button class="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-sm" onclick="verifyPayment(${o.id}, 'approve')">
        <i class="bi bi-check-circle me-1"></i> Approve
      </button>
    </div>
  </div>
`;
      });
    }

    document.getElementById("badge-payment-count").innerText = paymentCount;

    paymentContainer.innerHTML =
      paymentHtml ||
      `<div class="empty-state"><div class="icon"><i class="bi bi-shield-check"></i></div><p class="text-muted">No pending payment verifications.</p></div>`;
  } catch (err) {
    console.error("Payment verification fetch failed:", err);
  }
}

function renderWorkflowButton(orderId, status, customerName, currentPrice) {
  const editPriceBtn = `<button class="btn btn-sm btn-outline-primary rounded-pill fw-bold px-3 shadow-sm" onclick="editOrderPrice(${orderId}, ${Number(currentPrice) || 0})">
    <i class="bi bi-pencil-square me-1"></i> Edit Price
  </button>`;

  const cancelBtn = `<button class="btn btn-sm btn-outline-danger rounded-pill fw-bold px-3 shadow-sm" onclick="cancelOrder(${orderId}, '${(customerName || "").replace(/'/g, "\\'")}')">
    <i class="bi bi-x-circle me-1"></i> Cancel
  </button>`;

  if (status === "delivered") {
    return `<div class="d-flex gap-2 flex-wrap justify-content-end">
      ${editPriceBtn}
      <button class="btn btn-sm btn-danger rounded-pill px-3 shadow-sm" onclick="deleteOrder(${orderId})">
        <i class="bi bi-trash me-1"></i> Delete
      </button>
    </div>`;
  }

  if (status === "cancelled") {
    return `<span class="text-danger small fw-bold d-flex align-items-center gap-1"><i class="bi bi-x-circle-fill fs-6"></i> Cancelled</span>`;
  }

  if (status === "pending") {
    return `<div class="d-flex gap-2 flex-wrap justify-content-end">
      ${editPriceBtn}
      <button class="btn btn-sm btn-warning rounded-pill fw-bold px-3 shadow-sm" onclick="setOrderStatus(${orderId}, 'shipped')">
        <i class="bi bi-truck me-1"></i> Ship Order
      </button>
      ${cancelBtn}
    </div>`;
  } else if (status === "shipped") {
    return `<div class="d-flex gap-2 flex-wrap justify-content-end">
      ${editPriceBtn}
      <button class="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-sm" onclick="setOrderStatus(${orderId}, 'delivered')">
        <i class="bi bi-check-all me-1"></i> Mark Delivered
      </button>
      ${cancelBtn}
    </div>`;
  }
  return `<div class="d-flex gap-2 flex-wrap justify-content-end">
    ${editPriceBtn}
    <span class="text-success small fw-bold d-flex align-items-center gap-1"><i class="bi bi-shield-fill-check fs-6"></i> Fulfilled</span>
  </div>`;
}

// Admin PDF Download
function adminDownloadOrderPDF(orderId) {
  // Find order data from rendered DOM
  const panel = document.getElementById(`summary-panel-${orderId}`);
  if (!panel) return;
  const rows = panel.querySelectorAll("table tr");
  const get = (label) => {
    for (const r of rows) {
      if (
        r.cells[0] &&
        r.cells[0].textContent
          .trim()
          .toLowerCase()
          .includes(label.toLowerCase())
      )
        return r.cells[1] ? r.cells[1].textContent.trim() : "—";
    }
    return "—";
  };
  const orderNo = get("Order No");
  const customer = get("Customer");
  const phone = get("Phone");
  const address = get("Address");
  const date = get("Date");
  const payment = get("Payment");
  const status = get("Status");

  // Get items HTML from panel
  const itemsContainer = panel.querySelector(
    '[style*="border-top"]',
  )?.previousElementSibling;
  const itemsText = itemsContainer ? itemsContainer.innerHTML : "";

  // Get total
  const totalEl = panel.querySelector('[style*="font-weight:800"]');
  const total = totalEl
    ? totalEl.querySelector("span:last-child")?.textContent || "—"
    : "—";

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Order ${orderNo} - SA Parties Admin</title>
    <style>
      body{font-family:Arial,sans-serif;color:#2a1b2e;margin:0;padding:24px;}
      .hdr{background:linear-gradient(135deg,#e0218a,#ad0a69);color:#fff;padding:20px;border-radius:12px;text-align:center;margin-bottom:18px;}
      .hdr h1{margin:0;font-size:1.4rem;} .hdr p{margin:4px 0 0;opacity:.85;}
      .row2{display:flex;justify-content:space-between;background:#fff1f8;border:1px solid #fbdcee;border-radius:10px;padding:10px 16px;margin-bottom:14px;flex-wrap:wrap;gap:8px;}
      .lbl{font-size:.7rem;font-weight:700;text-transform:uppercase;color:#8c7a92;}
      .val{font-size:.95rem;font-weight:800;color:#e0218a;font-family:monospace;}
      .sec{background:#f9f4fb;border-radius:10px;padding:12px 16px;margin-bottom:12px;}
      .stitle{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#8c7a92;margin-bottom:8px;}
      table{width:100%;border-collapse:collapse;} th,td{padding:7px 6px;font-size:.84rem;border-bottom:1px solid #fbdcee;}
      .info-table td:first-child{color:#8c7a92;width:35%;}
      .info-table td:last-child{font-weight:600;}
      .total-row{display:flex;justify-content:space-between;font-size:1rem;font-weight:800;padding-top:8px;border-top:2px solid #e0218a;margin-top:6px;}
      .foot{text-align:center;margin-top:20px;font-size:.76rem;color:#8c7a92;}
    </style></head><body>
    <div class="hdr"><h1>📋 Admin Order Receipt</h1><p>SA Parties — Order Management</p></div>
    <div class="row2">
      <div><div class="lbl">Order Number</div><div class="val">${orderNo}</div></div>
      <div><div class="lbl">Date</div><div style="font-size:.85rem;font-weight:700;">${date}</div></div>
      <div><div class="lbl">Status</div><div style="font-size:.85rem;font-weight:700;color:#e0218a;">${status}</div></div>
    </div>
    <div class="sec">
      <div class="stitle">Customer Details</div>
      <table class="info-table">
        <tr><td>Customer</td><td>${customer}</td></tr>
        <tr><td>Phone</td><td>${phone}</td></tr>
        <tr><td>Address</td><td>${address}</td></tr>
        <tr><td>Payment</td><td>${payment}</td></tr>
      </table>
    </div>
    <div class="sec">
      <div class="stitle">Items & Total</div>
      ${itemsText}
      <div class="total-row"><span>Total</span><span style="color:#e0218a;">${total}</span></div>
    </div>
    <div class="foot">SA Parties Admin &bull; Generated on ${new Date().toLocaleString("en-PK")}</div>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// Cancel Order function
async function cancelOrder(id, customerName) {
  if (
    !confirm(
      `Cancel order for "${customerName}"? This will move it to Cancelled Orders.`,
    )
  )
    return;

  try {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Cancelled" }),
    });
    if (res.ok) {
      showToast(
        "success",
        "Order Cancelled",
        `Order for ${customerName} has been cancelled.`,
      );
      fetchAdminOrders();
    } else {
      showToast("error", "Error", "Failed to cancel order.");
    }
  } catch (err) {
    showToast(
      "error",
      "Connection Failed",
      "Server refused the cancel request.",
    );
  }
}

// Naya deleteOrder function
async function deleteOrder(id) {
  if (
    !confirm(
      "Are you sure? This will permanently delete the order and its items.",
    )
  )
    return;

  try {
    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      showToast("success", "Deleted", "Order and items successfully removed.");
      fetchAdminOrders();
    } else {
      showToast("error", "Error", "Failed to delete order.");
    }
  } catch (err) {
    showToast(
      "error",
      "Connection failed",
      "Server refused the deletion request.",
    );
  }
}

async function setOrderStatus(id, nextStatus) {
  try {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (res.ok) {
      showToast(
        "success",
        "Status Tracked",
        `Order has been marked as ${nextStatus}.`,
      );
      fetchAdminOrders();
    } else {
      showToast(
        "error",
        "Error",
        "Failed to update target row data status code.",
      );
    }
  } catch (err) {
    showToast(
      "error",
      "Transmission failure",
      "Server refused mapping transaction updates.",
    );
  }
}

// Verify payment (approve or reject)
async function verifyPayment(orderId, action) {
  const notes =
    document.getElementById(`verification-notes-${orderId}`)?.value || "";

  if (!confirm(`Are you sure you want to ${action} this payment?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/orders/${orderId}/verify-payment`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });

    const data = await res.json();

    if (res.ok) {
      showToast(
        "success",
        action === "approve" ? "Payment Approved" : "Payment Rejected",
        data.message || `Payment has been ${action}ed.`,
      );
      fetchPaymentVerifications();
      fetchAdminOrders();
    } else {
      showToast("error", "Error", data.error || "Failed to verify payment.");
    }
  } catch (err) {
    showToast(
      "error",
      "Connection Error",
      "Server refused the verification request.",
    );
  }
}
// ----------------------------------------------------------
// 4. Update/Add Product Logic
// ----------------------------------------------------------
document
  .getElementById("admin-product-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const editId = document.getElementById("edit-product-id").value;
    const btn = document.getElementById("upload-btn");

    const formData = new FormData();
    formData.append("name", document.getElementById("prod-name").value);
    formData.append("description", document.getElementById("prod-desc").value);
    formData.append("price", document.getElementById("prod-price").value);
    formData.append("in_stock", document.getElementById("prod-in-stock").value);
    formData.append(
      "category_id",
      document.getElementById("prod-category").value,
    );
    formData.append("keywords", document.getElementById("prod-keywords").value);

    // Volumetric weight / shipping dimensions
    const pL = parseFloat(document.getElementById("prod-length")?.value) || 0;
    const pW = parseFloat(document.getElementById("prod-width")?.value) || 0;
    const pH = parseFloat(document.getElementById("prod-height")?.value) || 0;
    formData.append("length", pL);
    formData.append("width", pW);
    formData.append("height", pH);
    if (pL > 0 && pW > 0 && pH > 0) {
      formData.append("weight", ((pL * pW * pH) / 5000).toFixed(3));
    }

    // Main product images from slots
    const mainSlots = document.querySelectorAll(
      "#main-images-list .pf-img-slot input[type=file]",
    );
    mainSlots.forEach((inp) => {
      if (inp.files[0]) formData.append("images", inp.files[0]);
    });

    // Variants data + one photo per variant
    const colors = getColorsData();
    formData.append("colors", JSON.stringify(colors));
    const variantImageFiles = getVariantImageFiles();
    variantImageFiles.forEach(({ client_key, file }) => {
      formData.append(`variantImage_${client_key}`, file);
    });

    // Images the user removed from existing previews during this edit —
    // backend needs this to drop them from the stored images array.
    formData.append("deletedImages", JSON.stringify(deletedImageUrls));

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const endpoint = editId ? `/api/products/${editId}` : "/api/products";
    const httpMethod = editId ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method: httpMethod,
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        showToast("success", "Success!", "Product successfully saved.");
        deletedImageUrls = [];
        clearEditState();
        await fetchAdminProducts();
        const invLink = document.getElementById("nav-inventory");
        if (invLink) switchQuickManagePane("inventory-pane", invLink);
      } else {
        showToast("error", "Error", data.error || "Action failed.");
      }
    } catch (err) {
      showToast("error", "Network Error", "Transmission pipeline failed.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = editId
        ? `<i class="bi bi-save-fill me-2"></i>Save Modifications`
        : `<i class="bi bi-rocket-takeoff-fill me-2"></i>Upload & Go Live`;
    }
  });
// ============================================================
// Order Search / Filter — data-search attribute based
// ============================================================
function filterOrders(containerId, query) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const q = (query || "").trim().toLowerCase();
  const cards = container.querySelectorAll(".order-box");
  let visibleCount = 0;

  cards.forEach((card) => {
    // Use data-search attribute — fast and reliable
    const searchText = (
      card.dataset.search ||
      card.textContent ||
      ""
    ).toLowerCase();
    const matches = !q || searchText.includes(q);
    card.style.display = matches ? "" : "none";
    if (matches) visibleCount++;
  });

  // No-results message
  let noResult = container.querySelector(".search-no-result");
  if (visibleCount === 0 && q) {
    if (!noResult) {
      noResult = document.createElement("div");
      noResult.className = "search-no-result text-center py-4";
      noResult.innerHTML = `
        <i class="bi bi-search" style="font-size:2.5rem;color:var(--pink-soft);display:block;margin-bottom:0.6rem;"></i>
        <p class="text-muted mb-0">No orders found for <strong>"${escapeHtml(query)}"</strong></p>
        <p class="text-muted" style="font-size:0.82rem;">Try searching by Order No. (e.g. SAP-2025...) or customer name</p>`;
      container.appendChild(noResult);
    } else {
      noResult.style.display = "";
    }
  } else if (noResult) {
    noResult.style.display = "none";
  }
}

// ── Expose to window: these are called from dynamically-rendered
// onclick="..." HTML, which resolves against the global scope ──
window.editOrderPrice = editOrderPrice;
window.toggleOrderSummary = toggleOrderSummary;
window.fetchAdminOrders = fetchAdminOrders;
window.fetchPaymentVerifications = fetchPaymentVerifications;
window.adminDownloadOrderPDF = adminDownloadOrderPDF;
window.cancelOrder = cancelOrder;
window.deleteOrder = deleteOrder;
window.setOrderStatus = setOrderStatus;
window.verifyPayment = verifyPayment;
window.filterOrders = filterOrders;
