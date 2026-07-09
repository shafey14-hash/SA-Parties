const nodemailer = require("nodemailer");

// ─────────────────────────────────────────────────────────────
// Transporter
// ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

transporter.verify((error) => {
  if (error) {
    console.error("❌ EMAIL CONFIG ERROR:", error.message);
    console.error(
      "   → Check .env: EMAIL and EMAIL_PASS (use Gmail App Password)",
    );
  } else {
    console.log("✅ Email transporter ready. Account:", process.env.EMAIL);
  }
});

// ─────────────────────────────────────────────────────────────
// Brand Config — change once, reflects everywhere
// ─────────────────────────────────────────────────────────────
const BRAND = {
  name: "SA Parties",
  tagline: "Making every celebration special",
  phone: "+92 336 4500870",
  website: process.env.SITE_URL || "https://saparties.pk",
  logoUrl:
    process.env.LOGO_URL || `${process.env.SITE_URL || ""}/assets/logo.jpg`,
  colorPrimary: "#e0218a",
  colorDark: "#ad0a69",
  colorLight: "#fff1f8",
  colorSoft: "#fbdcee",
  year: new Date().getFullYear(),
};

// ─────────────────────────────────────────────────────────────
// Master Email Layout — used by ALL email types
// ─────────────────────────────────────────────────────────────
function masterLayout({
  previewText = "",
  headerEmoji = "🎈",
  bannerBg = "#fff3e0",
  bannerBorderColor = "#ff9800",
  bannerTextColor = "#e65100",
  bannerLabel = "",
  bodyHTML = "",
}) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <!--[if !mso]><!-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <!--<![endif]-->
  <title>${BRAND.name}</title>
  <style type="text/css">
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; }
      .email-body-pad { padding: 24px 20px !important; }
      .email-header { padding: 28px 20px !important; }
      .info-box { padding: 16px 14px !important; }
      .order-num-text { font-size: 1.1rem !important; }
      .total-amount { font-size: 1.15rem !important; }
      .item-row td { font-size: 0.82rem !important; }
      .footer-pad { padding: 16px 20px !important; }
      .support-row { display: block !important; text-align: center !important; }
      .support-row td { display: block !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5eef9;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- Preview text (hidden) -->
  <div style="display:none;font-size:1px;color:#f5eef9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${previewText}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f5eef9;">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">

        <!-- Email Card -->
        <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0"
               style="max-width:580px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;
                      box-shadow:0 8px 40px rgba(173,10,105,0.14);">

          <!-- ══ HEADER ══ -->
          <tr>
            <td class="email-header" align="center"
                style="background:linear-gradient(135deg,${BRAND.colorPrimary} 0%,#c01d78 55%,${BRAND.colorDark} 100%);
                       padding:36px 40px 32px;">
              <!-- Logo -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:14px;">
                    <img src="${BRAND.logoUrl}"
                         alt="${BRAND.name} Logo"
                         width="64" height="64"
                         style="width:64px;height:64px;object-fit:cover;border-radius:16px;
                                box-shadow:0 4px 16px rgba(0,0,0,0.25);display:block;"
                         onerror="this.style.display='none'"/>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <div style="font-size:2rem;line-height:1;margin-bottom:6px;">${headerEmoji}</div>
                    <h1 style="margin:0;color:#ffffff;font-size:1.75rem;font-weight:800;
                               letter-spacing:-0.01em;line-height:1.1;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                      ${BRAND.name}
                    </h1>
                    <p style="margin:5px 0 0;color:rgba(255,255,255,0.78);font-size:0.72rem;
                              letter-spacing:0.2em;text-transform:uppercase;font-weight:600;">
                      Online Shop
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══ STATUS BANNER ══ -->
          <tr>
            <td style="background:${bannerBg};border-left:5px solid ${bannerBorderColor};
                       padding:13px 32px;">
              <p style="margin:0;font-size:0.9rem;font-weight:700;color:${bannerTextColor};
                         font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                ${bannerLabel}
              </p>
            </td>
          </tr>

          <!-- ══ BODY ══ -->
          <tr>
            <td class="email-body-pad" style="padding:32px 36px 28px;">
              ${bodyHTML}
            </td>
          </tr>

          <!-- ══ SUPPORT FOOTER ══ -->
          <tr>
            <td style="background:#fff1f8;border-top:1px solid #fbdcee;padding:18px 36px;">
              <table class="support-row" role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size:0.8rem;color:#8c7a92;line-height:1.6;vertical-align:middle;">
                    <strong style="color:#2a1b2e;">Need help?</strong><br/>
                    📞 ${BRAND.phone}
                  </td>
                  <td align="right" style="font-size:0.8rem;color:#8c7a92;vertical-align:middle;">
                    <a href="${BRAND.website}" style="color:${BRAND.colorPrimary};text-decoration:none;font-weight:700;">
                      Visit Website →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══ BOTTOM FOOTER ══ -->
          <tr>
            <td class="footer-pad" align="center"
                style="background:#fdf3f9;border-top:1px dashed #fbdcee;padding:18px 36px;">
              <p style="margin:0;font-size:0.75rem;color:#8c7a92;line-height:1.7;
                         font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                © ${BRAND.year} <strong style="color:#2a1b2e;">${BRAND.name}</strong>
                &nbsp;—&nbsp; ${BRAND.tagline}<br/>
                <span style="font-size:0.7rem;">This is an automated email, please do not reply directly.</span>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────
// Reusable Components
// ─────────────────────────────────────────────────────────────

// Greeting + intro paragraph
function greeting(name, intro) {
  return `
  <h2 style="margin:0 0 8px;color:#2a1b2e;font-size:1.18rem;font-weight:800;
             font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    Hi ${esc(name) || "Valued Customer"}, 👋
  </h2>
  <p style="margin:0 0 24px;color:#8c7a92;font-size:0.92rem;line-height:1.7;">
    ${intro}
  </p>`;
}

// Order info box
function orderInfoBox({
  orderNumber,
  orderId,
  items,
  totalAmount,
  extraRows = "",
}) {
  const itemRows = (items || [])
    .map(
      (item) => `
      <tr class="item-row">
        <td style="padding:8px 0;border-bottom:1px solid #fbdcee;font-size:0.85rem;
                   color:#2a1b2e;font-weight:600;vertical-align:top;">
          ${esc(item.name)}${item.color ? ` <span style="color:#8c7a92;font-weight:400;">(${esc(item.color)})</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #fbdcee;font-size:0.85rem;
                   color:#8c7a92;text-align:center;white-space:nowrap;vertical-align:top;">
          ×${item.qty || item.quantity || 1}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #fbdcee;font-size:0.85rem;
                   color:${BRAND.colorPrimary};font-weight:700;text-align:right;white-space:nowrap;vertical-align:top;">
          Rs.&nbsp;${Number(item.price || 0).toLocaleString("en-PK")}
        </td>
      </tr>`,
    )
    .join("");

  const itemsSection =
    items && items.length > 0
      ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
             style="margin-bottom:0;">
         <thead>
           <tr>
             <th style="padding:0 0 8px;font-size:0.72rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.1em;color:#8c7a92;text-align:left;border-bottom:2px solid #fbdcee;">
               Item
             </th>
             <th style="padding:0 0 8px;font-size:0.72rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.1em;color:#8c7a92;text-align:center;border-bottom:2px solid #fbdcee;">
               Qty
             </th>
             <th style="padding:0 0 8px;font-size:0.72rem;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.1em;color:#8c7a92;text-align:right;border-bottom:2px solid #fbdcee;">
               Price
             </th>
           </tr>
         </thead>
         <tbody>${itemRows}</tbody>
       </table>`
      : `<p style="margin:0;font-size:0.85rem;color:#8c7a92;">Items listed in order confirmation.</p>`;

  return `
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
         class="info-box"
         style="background:#fff8fd;border:1.5px solid ${BRAND.colorSoft};border-radius:16px;
                overflow:hidden;margin-bottom:22px;">
    <!-- Order number row -->
    <tr>
      <td style="padding:14px 20px;background:#fff1f8;border-bottom:1px solid ${BRAND.colorSoft};">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size:0.72rem;font-weight:700;text-transform:uppercase;
                       letter-spacing:0.1em;color:#8c7a92;">Order Number</td>
            <td align="right">
              <span class="order-num-text"
                    style="font-size:1rem;font-weight:900;color:${BRAND.colorPrimary};
                           font-family:'Courier New',Courier,monospace;letter-spacing:0.06em;">
                ${esc(orderNumber || "#" + orderId)}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Items section -->
    <tr>
      <td style="padding:14px 20px;">
        <p style="margin:0 0 10px;font-size:0.72rem;font-weight:700;text-transform:uppercase;
                  letter-spacing:0.1em;color:#8c7a92;">Items Ordered</p>
        ${itemsSection}
      </td>
    </tr>

    ${extraRows}

    <!-- Total row -->
    <tr>
      <td style="padding:14px 20px;background:#fff1f8;border-top:1px solid ${BRAND.colorSoft};">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="font-size:0.82rem;font-weight:700;color:#8c7a92;text-transform:uppercase;
                       letter-spacing:0.06em;">Total Amount</td>
            <td align="right">
              <span class="total-amount"
                    style="font-size:1.25rem;font-weight:900;color:${BRAND.colorPrimary};">
                Rs.&nbsp;${Number(totalAmount || 0).toLocaleString("en-PK")}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// Info row inside order box
function infoRow(label, value) {
  return `
  <tr>
    <td style="padding:10px 20px;border-top:1px solid ${BRAND.colorSoft};">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:0.72rem;font-weight:700;text-transform:uppercase;
                     letter-spacing:0.08em;color:#8c7a92;width:38%;vertical-align:top;
                     padding-top:2px;">${label}</td>
          <td style="font-size:0.85rem;color:#2a1b2e;font-weight:600;text-align:right;">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// Colored alert box
function alertBox(bg, borderColor, textColor, content) {
  return `
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
         style="background:${bg};border-left:4px solid ${borderColor};border-radius:10px;
                margin-bottom:22px;overflow:hidden;">
    <tr>
      <td style="padding:14px 18px;font-size:0.85rem;color:${textColor};line-height:1.6;">
        ${content}
      </td>
    </tr>
  </table>`;
}

// HTML escape
function esc(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Parse items string "Product (Color) x2 @ Rs.500||..." into array
function parseItemsStr(itemsStr) {
  if (!itemsStr) return [];
  return itemsStr
    .split("||")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Format: "Product Name (Color) x2 @ Rs.500"
      const m = s.match(/^(.+?)\s+x(\d+)\s+@\s+Rs\.(.+)$/i);
      if (m)
        return {
          name: m[1].trim(),
          qty: Number(m[2]),
          price: Number(m[3].replace(/,/g, "")),
        };
      // Format: "Product (Color) (x2)" — admin format
      const m2 = s.match(/^(.+?)\s*\(x(\d+)\)$/i);
      if (m2) return { name: m2[1].trim(), qty: Number(m2[2]), price: 0 };
      return { name: s, qty: 1, price: 0 };
    });
}

// Helper: send mail wrapper
async function sendMail({ to, subject, previewText, html, text }) {
  if (!to || !to.includes("@")) {
    console.warn("⚠️  sendMail skipped: invalid email →", to);
    return;
  }
  const info = await transporter.sendMail({
    from: `"${BRAND.name}" <${process.env.EMAIL}>`,
    to,
    subject,
    text,
    html,
  });
  console.log("✅ Email sent:", subject, "→", to, "| MsgID:", info.messageId);
}

// ═══════════════════════════════════════════════════════════════
// EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// 1. Email Verification
// ─────────────────────────────────────────────────────────────
const sendVerification = async (email, code) => {
  const body = `
    ${greeting("there", "Your account on <strong>SA Parties</strong> has been registered. Please verify your email using the code below.")}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
           style="background:#fff1f8;border:2px dashed #fbdcee;border-radius:18px;
                  margin-bottom:24px;text-align:center;">
      <tr>
        <td style="padding:28px 20px;">
          <p style="margin:0 0 12px;font-size:0.72rem;font-weight:700;letter-spacing:0.15em;
                    text-transform:uppercase;color:#8c7a92;">Your Verification Code</p>
          <div style="font-size:2.8rem;font-weight:800;letter-spacing:0.35em;
                      color:${BRAND.colorPrimary};font-family:'Courier New',Courier,monospace;">
            ${code}
          </div>
          <p style="margin:14px 0 0;font-size:0.8rem;color:#8c7a92;">
            This code expires in <strong>10 minutes</strong>.
          </p>
        </td>
      </tr>
    </table>

    ${alertBox(
      "#fbe7ea",
      BRAND.colorPrimary,
      "#7a1a2e",
      "<strong>Important:</strong> If you did not create this account, please ignore this email. Never share your verification code with anyone.",
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      Thank you for choosing ${BRAND.name}. We appreciate your trust and support!
    </p>`;

  await sendMail({
    to: email,
    subject: `Your Verification Code — ${BRAND.name}`,
    previewText: `Your verification code is: ${code}`,
    text: `Your ${BRAND.name} verification code is: ${code}\n\nExpires in 10 minutes.\n\nThank you!\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Your verification code: ${code}`,
      headerEmoji: "🔐",
      bannerBg: "#fff1f8",
      bannerBorderColor: BRAND.colorPrimary,
      bannerTextColor: "#7a1a2e",
      bannerLabel: "✉️ &nbsp; Email Verification Required",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 2. Order Confirmation (COD)
// ─────────────────────────────────────────────────────────────
const sendOrderConfirmation = async (
  email,
  customerName,
  orderId,
  orderNumber,
  itemsStr,
  totalAmount,
  address,
  phone,
  paymentMethod,
) => {
  const items = parseItemsStr(itemsStr);
  const isCOD = (paymentMethod || "").toLowerCase() === "cod";

  const body = `
    ${greeting(
      customerName,
      `Thank you for your order! Your <strong>${isCOD ? "Cash on Delivery" : paymentMethod}</strong> order has been received and is now being processed. 🎉`,
    )}

    ${orderInfoBox({
      orderNumber,
      orderId,
      items,
      totalAmount,
      extraRows: `
        ${infoRow("Payment Method", isCOD ? "💵 Cash on Delivery" : esc(paymentMethod))}
        ${infoRow("Shipping Address", esc(address || "—"))}
        ${infoRow("Contact", esc(phone || "—"))}
      `,
    })}

    ${alertBox(
      "#e8f5e9",
      "#43a047",
      "#1b5e20",
      `<strong>🚀 What's Next?</strong><br/>
       Our team will process your order shortly. ${isCOD ? "Please keep cash ready for the delivery." : ""}
       You will receive a shipping notification once your order is dispatched.`,
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      Thank you for shopping with ${BRAND.name}! 🎈
    </p>`;

  await sendMail({
    to: email,
    subject: `Order Confirmed — ${orderNumber || "#" + orderId} | ${BRAND.name}`,
    previewText: `Your order ${orderNumber} has been confirmed!`,
    text: `Hi ${customerName},\n\nYour order ${orderNumber} is confirmed!\n\nTotal: Rs. ${totalAmount}\nPayment: ${paymentMethod}\nShipping to: ${address}\n\nContact: ${BRAND.phone}\n\nThank you!\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Order ${orderNumber} confirmed!`,
      headerEmoji: "🎉",
      bannerBg: "#e8f5e9",
      bannerBorderColor: "#43a047",
      bannerTextColor: "#1b5e20",
      bannerLabel: "🎊 &nbsp; Your Order Has Been Confirmed!",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 3. Payment Approved
// ─────────────────────────────────────────────────────────────
const sendPaymentApproved = async (
  email,
  customerName,
  orderId,
  orderNumber,
  itemsStr,
  totalAmount,
) => {
  const items = parseItemsStr(itemsStr);

  const body = `
    ${greeting(
      customerName,
      `Great news! Your payment has been <strong style="color:#2e7d32;">verified and approved</strong>. Your order is now in our processing queue and will be dispatched soon.`,
    )}

    ${orderInfoBox({ orderNumber, orderId, items, totalAmount })}

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
           style="background:#e8f5e9;border-radius:12px;margin-bottom:22px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:0.72rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:0.1em;color:#2e7d32;">Order Status Timeline</p>
          <p style="margin:0;font-size:0.85rem;color:#1b5e20;font-weight:600;">
            ✅ Payment Verified &nbsp;→&nbsp; ✅ Pending Processing &nbsp;→&nbsp; ⏳ Dispatch Soon
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      Thank you for shopping with ${BRAND.name}! 🎈
    </p>`;

  await sendMail({
    to: email,
    subject: `Payment Approved — Order ${orderNumber || "#" + orderId} | ${BRAND.name}`,
    previewText: `Your payment for order ${orderNumber} has been approved!`,
    text: `Hi ${customerName},\n\nYour payment for Order ${orderNumber} has been verified and approved!\n\nTotal: Rs. ${totalAmount}\n\nYour order is now being processed.\n\nContact: ${BRAND.phone}\n\nThank you!\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Payment approved for order ${orderNumber}`,
      headerEmoji: "✅",
      bannerBg: "#e8f5e9",
      bannerBorderColor: "#43a047",
      bannerTextColor: "#1b5e20",
      bannerLabel: "🎉 &nbsp; Payment Verified & Approved!",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 4. Payment Rejected
// ─────────────────────────────────────────────────────────────
const sendPaymentRejected = async (
  email,
  customerName,
  orderId,
  orderNumber,
  itemsStr,
  totalAmount,
  reason,
) => {
  const items = parseItemsStr(itemsStr);

  const body = `
    ${greeting(
      customerName,
      `Unfortunately, we were unable to verify your payment. Your order has been <strong style="color:#c0392b;">cancelled</strong>.`,
    )}

    ${orderInfoBox({ orderNumber, orderId, items, totalAmount })}

    ${
      reason
        ? alertBox(
            "#fbe7ea",
            "#c0392b",
            "#7a1a2e",
            `<strong>Rejection Reason:</strong><br/>${esc(reason)}`,
          )
        : ""
    }

    ${alertBox(
      "#fff3e0",
      "#ff9800",
      "#e65100",
      `<strong>💡 What to do next?</strong><br/>
       Please contact our support team to resolve this issue. You're welcome to place a new order with correct payment details.`,
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      We apologize for the inconvenience. We look forward to serving you again! 🎈
    </p>`;

  await sendMail({
    to: email,
    subject: `Payment Rejected — Order ${orderNumber || "#" + orderId} | ${BRAND.name}`,
    previewText: `Payment could not be verified for order ${orderNumber}`,
    text: `Hi ${customerName},\n\nWe could not verify your payment for Order ${orderNumber}. Your order has been cancelled.\n${reason ? `Reason: ${reason}\n` : ""}\nPlease contact us: ${BRAND.phone}\n\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Payment rejected for order ${orderNumber}`,
      headerEmoji: "❌",
      bannerBg: "#fbe7ea",
      bannerBorderColor: "#c0392b",
      bannerTextColor: "#7a1a2e",
      bannerLabel: "⚠️ &nbsp; Payment Could Not Be Verified",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 5. Order Cancellation (Admin cancelled)
// ─────────────────────────────────────────────────────────────
const sendOrderCancellation = async (
  email,
  customerName,
  orderId,
  itemsStr,
  totalAmount,
  reason,
) => {
  const items = parseItemsStr(itemsStr);

  const body = `
    ${greeting(
      customerName,
      `We're sorry to inform you that your order has been <strong style="color:#c0392b;">cancelled</strong> by our team.`,
    )}

    ${orderInfoBox({ orderNumber: null, orderId, items, totalAmount })}

    ${
      reason
        ? alertBox(
            "#fbe7ea",
            "#c0392b",
            "#7a1a2e",
            `<strong>Cancellation Reason:</strong><br/>${esc(reason)}`,
          )
        : ""
    }

    ${alertBox(
      "#e8f5e9",
      "#4caf50",
      "#1b5e20",
      `<strong>💚 No Payment Deducted.</strong><br/>
       For COD orders, no charges were made. For online payments, our team will contact you for a refund within 2–3 business days.`,
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      We apologize for any inconvenience. You're always welcome to place a new order! 🎉
    </p>`;

  await sendMail({
    to: email,
    subject: `Order #${orderId} Cancelled — ${BRAND.name}`,
    previewText: `Your order #${orderId} has been cancelled`,
    text: `Dear ${customerName},\n\nYour order #${orderId} has been cancelled.\n${reason ? `Reason: ${reason}\n` : ""}\nContact us: ${BRAND.phone}\n\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Order #${orderId} has been cancelled`,
      headerEmoji: "😔",
      bannerBg: "#fff3e0",
      bannerBorderColor: "#ff9800",
      bannerTextColor: "#e65100",
      bannerLabel: "⚠️ &nbsp; Order Cancellation Notice",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 6. Order Shipped
// ─────────────────────────────────────────────────────────────
const sendOrderShipped = async (
  email,
  customerName,
  orderId,
  orderNumber,
  itemsStr,
  totalAmount,
) => {
  const items = parseItemsStr(itemsStr);

  const body = `
    ${greeting(
      customerName,
      `Your order has been <strong style="color:#1565c0;">shipped</strong> and is on its way to you! 🚚`,
    )}

    ${orderInfoBox({ orderNumber, orderId, items, totalAmount })}

    ${alertBox(
      "#e3f2fd",
      "#1565c0",
      "#1565c0",
      `<strong>🚚 Your order is on the way!</strong><br/>
       Our courier partner will deliver your order within <strong>2–5 business days</strong>.
       Please keep your phone available for delivery confirmation.`,
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      Thank you for shopping with ${BRAND.name}! 🎈
    </p>`;

  await sendMail({
    to: email,
    subject: `Order Shipped — ${orderNumber || "#" + orderId} | ${BRAND.name}`,
    previewText: `Your order ${orderNumber} is on its way!`,
    text: `Hi ${customerName},\n\nYour order ${orderNumber} has been shipped!\n\nTotal: Rs. ${totalAmount}\n\nExpect delivery in 2–5 business days.\n\nContact: ${BRAND.phone}\n\nThank you!\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Order ${orderNumber} shipped!`,
      headerEmoji: "🚚",
      bannerBg: "#e3f2fd",
      bannerBorderColor: "#1565c0",
      bannerTextColor: "#1565c0",
      bannerLabel: "📦 &nbsp; Your Order Has Been Shipped!",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// 7. Order Delivered
// ─────────────────────────────────────────────────────────────
const sendOrderDelivered = async (
  email,
  customerName,
  orderId,
  orderNumber,
  itemsStr,
  totalAmount,
) => {
  const items = parseItemsStr(itemsStr);

  const body = `
    ${greeting(
      customerName,
      `Your order has been <strong style="color:#2e7d32;">successfully delivered</strong>! We hope you love your purchase. 🎉`,
    )}

    ${orderInfoBox({ orderNumber, orderId, items, totalAmount })}

    ${alertBox(
      "#e8f5e9",
      "#43a047",
      "#2e7d32",
      `<strong>🎊 Thank you for choosing ${BRAND.name}!</strong><br/>
       We hope to make your every celebration extra special. Visit us again for more party essentials!`,
    )}

    <p style="margin:0;color:#8c7a92;font-size:0.88rem;line-height:1.7;">
      Making every celebration special! 🎈
    </p>`;

  await sendMail({
    to: email,
    subject: `Order Delivered — ${orderNumber || "#" + orderId} | ${BRAND.name}`,
    previewText: `Your order ${orderNumber} has been delivered!`,
    text: `Hi ${customerName},\n\nYour order ${orderNumber} has been delivered!\n\nTotal: Rs. ${totalAmount}\n\nThank you for shopping with ${BRAND.name}!\n\nContact: ${BRAND.phone}\n\n${BRAND.name} Team`,
    html: masterLayout({
      previewText: `Order ${orderNumber} delivered!`,
      headerEmoji: "🎊",
      bannerBg: "#e8f5e9",
      bannerBorderColor: "#43a047",
      bannerTextColor: "#1b5e20",
      bannerLabel: "✅ &nbsp; Order Delivered Successfully!",
      bodyHTML: body,
    }),
  });
};

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────
module.exports = {
  sendVerification,
  sendOrderConfirmation,
  sendOrderCancellation,
  sendPaymentApproved,
  sendPaymentRejected,
  sendOrderShipped,
  sendOrderDelivered,
};
