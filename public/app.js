// ============================================================
// SA Parties - Shop Frontend Logic
// ============================================================

// ── Cart: localStorage — product.html aur index.html dono sync ──
const CART_KEY = "sa-cart";
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveCart(c) {
  localStorage.setItem(CART_KEY, JSON.stringify(c));
}
let cart = loadCart();

// ── Auth State ──
let currentUser = null; // { id, name, email } ya null
let pendingVerifyEmail = ""; // signup ke baad verify ke liye email store
let isGuestMode = false; // guest ne choose kiya

// ── Auth helpers ──
function getToken() {
  return localStorage.getItem("sa_token");
}
function setToken(t) {
  localStorage.setItem("sa_token", t);
}
function clearToken() {
  localStorage.removeItem("sa_token");
  localStorage.removeItem("sa_user");
}
function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("sa_user") || "null");
  } catch {
    return null;
  }
}
function saveUser(u) {
  localStorage.setItem("sa_user", JSON.stringify(u));
}

// ── On page load: restore auth state ──
function restoreAuthState() {
  const token = getToken();
  const user = getSavedUser();
  if (token && user) {
    currentUser = user;
    isGuestMode = false;
    updateNavbarAuthBtn();
  }
}

function updateNavbarAuthBtn() {
  const btn = document.getElementById("navbar-auth-btn");
  const label = document.getElementById("navbar-auth-label");
  if (!btn || !label) return;

  if (currentUser) {
    label.textContent = currentUser.name || currentUser.email;
    btn.classList.add("logged-in");
    btn.onclick = handleLogout;
    btn.title = "Click here to Logout";
  } else if (isGuestMode) {
    label.textContent = "Guest Mode";
    btn.classList.add("logged-in");
    btn.onclick = openAuthModal;
  } else {
    label.textContent = "Login / Signup";
    btn.classList.remove("logged-in");
    btn.onclick = openAuthModal;
  }
}

function handleLogout() {
  clearToken();
  currentUser = null;
  isGuestMode = false;
  updateNavbarAuthBtn();
  showToast("success", "Logout", "You had logout.");
}

// ── Cart functions ──
function addToCart(id, name, price, colorName = "", colorId = "") {
  cart = loadCart();
  // Check if same product with same color exists
  const existing = cart.find(
    (item) =>
      String(item.product_id) === String(id) && item.color_name === colorName,
  );
  if (existing) {
    existing.quantity += 1;
    const colorText = colorName ? ` (${colorName})` : "";
    showToast(
      "success",
      "Quantity Updated",
      `${name}${colorText} x${existing.quantity} in cart.`,
    );
  } else {
    cart.push({
      product_id: id,
      name,
      price: Number(price),
      quantity: 1,
      color_name: colorName,
      color_id: colorId,
    });
    const colorText = colorName ? ` (${colorName})` : "";
    showToast("success", "Added to Cart", `${name}${colorText} added to cart.`);
  }
  saveCart(cart);
  updateCartUI();
}

function removeFromCart(index) {
  cart = loadCart();
  if (cart[index]) {
    cart[index].quantity -= 1;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
  }
  saveCart(cart);
  updateCartUI();
}

function removeItemFully(index) {
  cart = loadCart();
  cart.splice(index, 1);
  saveCart(cart);
  updateCartUI();
}

// Shipping calculation
function calcShipping(cartItems) {
  let totalWeight = cartItems.reduce(
    (s, item) => s + (Number(item.weight) || 0) * item.quantity,
    0,
  );
  if (totalWeight <= 0) return 250;
  if (totalWeight <= 0.5) return 250;
  if (totalWeight <= 1) return 350;
  if (totalWeight <= 2) return 450;
  return 450 + Math.ceil((totalWeight - 2) / 0.5) * 50;
}

// Payment method UI toggle
function updatePaymentUI() {
  const paymentMethod =
    document.querySelector('input[name="payment-method"]:checked')?.value ||
    "cod";
  const epCard = document.getElementById("easypaisa-payment-card");
  const jcCard = document.getElementById("jazzcash-payment-card");
  const paymentDetailsForm = document.getElementById("payment-details-form");
  const btnText = document.getElementById("order-btn-text");
  const note = document.getElementById("payment-note");

  // Payment method cards styling
  const codCard = document
    .getElementById("pay-cod-label")
    ?.querySelector(".payment-method-card");
  const epCardLabel = document
    .getElementById("pay-easypaisa-label")
    ?.querySelector(".payment-method-card");
  const jcCardLabel = document
    .getElementById("pay-jazzcash-label")
    ?.querySelector(".payment-method-card");

  const codCheckIcon = document
    .getElementById("pay-cod-label")
    ?.querySelector(".payment-check-icon");
  const epCheckIcon = document
    .getElementById("pay-easypaisa-label")
    ?.querySelector(".payment-check-icon");
  const jcCheckIcon = document
    .getElementById("pay-jazzcash-label")
    ?.querySelector(".payment-check-icon");

  // Reset all cards
  [codCard, epCardLabel, jcCardLabel].forEach((card) => {
    if (card) {
      card.style.borderColor = "#ddd";
      card.style.background = "#f9f9f9";
      card.style.boxShadow = "none";
    }
  });

  // Reset all check icons
  [codCheckIcon, epCheckIcon, jcCheckIcon].forEach((icon) => {
    if (icon) {
      icon.style.background = "transparent";
      icon.style.border = "2px solid #ddd";
      icon.innerHTML = "";
    }
  });

  // Hide all payment-specific elements
  if (epCard) epCard.style.display = "none";
  if (jcCard) jcCard.style.display = "none";
  if (paymentDetailsForm) paymentDetailsForm.style.display = "none";

  // Update based on selected payment method
  if (paymentMethod === "cod") {
    if (btnText) btnText.textContent = "Confirm Order (COD)";
    if (note)
      note.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 600; color: var(--ink-soft);">
          <i class="bi bi-shield-check" style="color: var(--pink-500)"></i>
          Pay easily in cash when your order arrives at your door.
        </div>`;

    // Highlight COD card
    if (codCard) {
      codCard.style.borderColor = "var(--pink-500)";
      codCard.style.background =
        "linear-gradient(135deg, var(--pink-50) 0%, rgba(255,255,255,0.9) 100%)";
      codCard.style.boxShadow = "0 4px 12px rgba(224, 33, 138, 0.15)";
    }
    if (codCheckIcon) {
      codCheckIcon.style.background = "var(--pink-500)";
      codCheckIcon.style.border = "none";
      codCheckIcon.innerHTML =
        '<i class="bi bi-check-lg text-white" style="font-size: 0.8rem"></i>';
    }
  } else if (paymentMethod === "easypaisa") {
    if (epCard) epCard.style.display = "block";
    if (paymentDetailsForm) paymentDetailsForm.style.display = "block";
    if (btnText) btnText.textContent = "Submit Payment Details";
    if (note)
      note.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 600; color: var(--ink-soft);">
          <i class="bi bi-phone-fill" style="color: #00a651"></i>
          Send Easypaisa payment first, then submit payment details.
        </div>`;

    // Highlight Easypaisa card
    if (epCardLabel) {
      epCardLabel.style.borderColor = "#00a651";
      epCardLabel.style.background =
        "linear-gradient(135deg, #e8fff3 0%, rgba(255,255,255,0.9) 100%)";
      epCardLabel.style.boxShadow = "0 4px 12px rgba(0, 166, 81, 0.15)";
    }
    if (epCheckIcon) {
      epCheckIcon.style.background = "#00a651";
      epCheckIcon.style.border = "none";
      epCheckIcon.innerHTML =
        '<i class="bi bi-check-lg text-white" style="font-size: 0.8rem"></i>';
    }

    // Update Easypaisa amount
    updatePaymentCardAmount("easypaisa");
  } else if (paymentMethod === "jazzcash") {
    if (jcCard) jcCard.style.display = "block";
    if (paymentDetailsForm) paymentDetailsForm.style.display = "block";
    if (btnText) btnText.textContent = "Submit Payment Details";
    if (note)
      note.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; font-weight: 600; color: var(--ink-soft);">
          <i class="bi bi-wallet2" style="color: #c41e3a"></i>
          Send JazzCash payment first, then submit payment details.
        </div>`;

    // Highlight JazzCash card
    if (jcCardLabel) {
      jcCardLabel.style.borderColor = "#c41e3a";
      jcCardLabel.style.background =
        "linear-gradient(135deg, #ffe8ec 0%, rgba(255,255,255,0.9) 100%)";
      jcCardLabel.style.boxShadow = "0 4px 12px rgba(196, 30, 58, 0.15)";
    }
    if (jcCheckIcon) {
      jcCheckIcon.style.background = "#c41e3a";
      jcCheckIcon.style.border = "none";
      jcCheckIcon.innerHTML =
        '<i class="bi bi-check-lg text-white" style="font-size: 0.8rem"></i>';
    }

    // Update JazzCash amount
    updatePaymentCardAmount("jazzcash");
  }
}

// Update payment card amount based on cart total
function updatePaymentCardAmount(paymentMethod) {
  cart = loadCart();
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const shipping = calcShipping(cart);
  const total = subtotal + shipping;

  const amountElementId =
    paymentMethod === "easypaisa" ? "easypaisa-amount" : "jazzcash-amount";
  const amountElement = document.getElementById(amountElementId);
  if (amountElement) {
    amountElement.textContent = `Rs. ${formatPrice(total)}`;
  }
}

// Copy to clipboard function
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    const text = element.textContent.trim();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast("success", "Copied!", "Number copied to clipboard.");
      })
      .catch((err) => {
        showToast("error", "Copy Failed", "Could not copy to clipboard.");
      });
  }
}

// Handle screenshot upload
let uploadedScreenshotPath = null;

function handleScreenshotUpload(input) {
  const file = input.files[0];
  if (!file) return;

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast(
      "error",
      "File Too Large",
      "Please upload an image smaller than 5MB.",
    );
    input.value = "";
    return;
  }

  // Validate file type
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    showToast(
      "error",
      "Invalid File",
      "Please upload a valid image file (JPEG, PNG, GIF, WEBP).",
    );
    input.value = "";
    return;
  }

  // Show filename
  const filenameDisplay = document.getElementById("screenshot-filename");
  if (filenameDisplay) {
    filenameDisplay.textContent = file.name;
    filenameDisplay.style.color = "var(--pink-500)";
  }

  // Show preview
  const preview = document.getElementById("screenshot-preview");
  const previewImg = document.getElementById("screenshot-preview-img");
  if (preview && previewImg && file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      preview.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  // Upload to server
  const formData = new FormData();
  formData.append("screenshot", file);

  fetch("/api/upload-payment-screenshot", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.url) {
        uploadedScreenshotPath = data.url;
        showToast(
          "success",
          "Uploaded",
          "Payment screenshot uploaded successfully.",
        );
      } else {
        showToast("error", "Upload Failed", "Could not upload screenshot.");
      }
    })
    .catch((err) => {
      showToast("error", "Upload Error", "Server connection failed.");
    });
}

function updateCartUI() {
  cart = loadCart();
  const cartItemList = document.getElementById("cart-item-name");
  const cartItemPrice = document.getElementById("cart-item-price");
  const badge = document.getElementById("cart-count-badge");
  const drawerItems = document.getElementById("cart-drawer-items");
  const drawerTotal = document.getElementById("cart-drawer-total");

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) badge.textContent = String(itemCount);

  const subtotal = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0,
  );
  const shipping = calcShipping(cart);
  const grand = subtotal + shipping;

  if (drawerItems) {
    if (cart.length === 0) {
      drawerItems.innerHTML =
        '<div class="cart-drawer-empty">Your cart is empty</div>';
    } else {
      drawerItems.innerHTML = cart
        .map(
          (item, index) => `
        <div class="cart-drawer-item">
          <span class="cart-drawer-item-name">${escapeHtml(item.name)}${item.color_name ? ` <span style="font-size:0.75rem;color:var(--ink-soft);font-weight:500;">(${escapeHtml(item.color_name)})</span>` : ""}</span>
          <div class="d-flex align-items-center gap-1">
            <button type="button" class="btn btn-sm cart-qty-btn" data-cart-action="dec" data-cart-index="${index}">−</button>
            <span style="min-width:24px;text-align:center;font-weight:700;">x${item.quantity}</span>
            <button type="button" class="btn btn-sm cart-qty-btn" data-cart-action="inc" data-cart-index="${index}" data-product-id="${escapeHtml(String(item.product_id))}" data-product-name="${escapeHtml(item.name)}" data-product-price="${Number(item.price) || 0}" data-selected-color="${escapeHtml(item.color_name || "")}" data-selected-color-id="${escapeHtml(item.color_id || "")}">+</button>
            <button type="button" class="btn btn-sm btn-outline-danger cart-qty-btn" data-cart-action="remove" data-cart-index="${index}" style="width:26px;height:26px;padding:0;border-radius:6px;font-size:0.75rem;">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>`,
        )
        .join("");
    }
  }
  if (drawerTotal) drawerTotal.textContent = formatPrice(grand);

  if (!cartItemList || !cartItemPrice) return;

  if (cart.length > 0) {
    cartItemList.innerHTML = cart
      .map(
        (item, index) => `
      <div class="d-flex justify-content-between align-items-center mb-2 gap-2">
        <span style="flex:1;font-size:0.88rem;font-weight:600;">${escapeHtml(item.name)}${item.color_name ? ` <span style="font-size:0.75rem;color:var(--ink-soft);font-weight:500;">(${escapeHtml(item.color_name)})</span>` : ""}</span>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn btn-sm cart-qty-btn" data-cart-action="dec" data-cart-index="${index}"
            style="width:26px;height:26px;padding:0;border:1.5px solid var(--pink-soft);border-radius:6px;font-size:0.85rem;line-height:1;background:var(--pink-light);color:var(--pink-primary);">−</button>
          <span style="min-width:28px;text-align:center;font-weight:700;font-size:0.85rem;color:var(--pink-primary);">x${item.quantity}</span>
          <button type="button" class="btn btn-sm cart-qty-btn" data-cart-action="inc" data-cart-index="${index}" data-product-id="${escapeHtml(String(item.product_id))}" data-product-name="${escapeHtml(item.name)}" data-product-price="${Number(item.price) || 0}" data-selected-color="${escapeHtml(item.color_name || "")}" data-selected-color-id="${escapeHtml(item.color_id || "")}"
            style="width:26px;height:26px;padding:0;border:1.5px solid var(--pink-soft);border-radius:6px;font-size:0.85rem;line-height:1;background:var(--pink-light);color:var(--pink-primary);">+</button>
          <button type="button" class="btn btn-sm btn-outline-danger cart-qty-btn" data-cart-action="remove" data-cart-index="${index}"
            style="width:26px;height:26px;padding:0;border-radius:6px;font-size:0.75rem;line-height:1;">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `,
      )
      .join("");

    cartItemPrice.innerText = formatPrice(subtotal);

    const shipEl = document.getElementById("shipping-display");
    const grandEl = document.getElementById("cart-grand-total");
    if (shipEl) shipEl.innerText = formatPrice(shipping);
    if (grandEl) grandEl.innerText = formatPrice(grand);

    if (orderBtn) orderBtn.disabled = false;
  } else {
    cartItemList.innerText = "None selected yet";
    cartItemPrice.innerText = "0";
    const shipEl = document.getElementById("shipping-display");
    const grandEl = document.getElementById("cart-grand-total");
    if (shipEl) shipEl.innerText = "0";
    if (grandEl) grandEl.innerText = "0";
    if (orderBtn) orderBtn.disabled = true;
  }
}

function openCart() {
  document.getElementById("cart-drawer")?.classList.add("open");
  document.getElementById("cart-drawer-overlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCart() {
  document.getElementById("cart-drawer")?.classList.remove("open");
  document.getElementById("cart-drawer-overlay")?.classList.remove("open");
  document.body.style.overflow = "";
}

function toggleCart() {
  const drawer = document.getElementById("cart-drawer");
  if (drawer?.classList.contains("open")) closeCart();
  else openCart();
}

function handleCartAction(event) {
  const btn = event.target.closest("[data-cart-action]");
  if (!btn) return;
  const action = btn.dataset.cartAction;
  const index = Number(btn.dataset.cartIndex);
  if (action === "dec") removeFromCart(index);
  else if (action === "remove") removeItemFully(index);
  else if (action === "inc")
    addToCart(
      btn.dataset.productId,
      btn.dataset.productName,
      Number(btn.dataset.productPrice) || 0,
      btn.dataset.selectedColor || "",
      btn.dataset.selectedColorId || "",
    );
}

// ── DOM refs ──
const productsContainer = document.getElementById("shop-products-container");
const orderBtn = document.getElementById("order-btn");
const checkoutForm = document.getElementById("customer-checkout-form");
const toastStack = document.getElementById("toast-stack");

document.addEventListener("DOMContentLoaded", () => {
  restoreAuthState();
  updateCartUI();
  if (productsContainer) fetchShopProducts();

  document.addEventListener("click", handleCartAction);
  productsContainer?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add-cart]");
    if (!btn || btn.disabled) return;

    const hasColors = btn.dataset.hasColors === "yes";
    const selectedColor = btn.dataset.selectedColor || "";
    const selectedColorId = btn.dataset.selectedColorId || "";

    // If product has colors but none is selected — show popup
    if (hasColors && !selectedColor) {
      showChooseColorPopup(
        btn.dataset.productId,
        btn.dataset.productName,
        Number(btn.dataset.productPrice) || 0,
        btn,
      );
      return;
    }

    addToCart(
      btn.dataset.productId,
      btn.dataset.productName,
      Number(btn.dataset.productPrice) || 0,
      selectedColor,
      selectedColorId,
    );
  });

  if (
    !getToken() &&
    !isGuestMode &&
    document.getElementById("auth-modal-overlay")
  ) {
    setTimeout(() => openAuthModal(), 500);
  }
});

// ============================================================
// AUTH MODAL
// ============================================================

function openAuthModal() {
  const overlay = document.getElementById("auth-modal-overlay");
  if (!overlay) return;
  overlay.classList.add("active");
  switchAuthTab("login");
  clearAuthMessages();
}

function closeAuthModal() {
  document.getElementById("auth-modal-overlay").classList.remove("active");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAuthModal();
});

document
  .getElementById("auth-modal-overlay")
  ?.addEventListener("click", function (e) {
    if (e.target === this && (currentUser || isGuestMode)) closeAuthModal();
  });

function switchAuthTab(tab) {
  const loginSection = document.getElementById("login-form-section");
  const signupSection = document.getElementById("signup-form-section");
  const verifySection = document.getElementById("verify-section");
  const tabBtns = document.querySelectorAll(".auth-tab-btn");
  const tabBtnsWrap = document.getElementById("auth-tab-btns");
  const guestSection = document.getElementById("guest-section");

  clearAuthMessages();

  verifySection.style.display = "none";
  tabBtnsWrap.style.display = "flex";
  guestSection.style.display = "block";

  if (tab === "login") {
    loginSection.style.display = "block";
    signupSection.style.display = "none";
    tabBtns[0].classList.add("active");
    tabBtns[1].classList.remove("active");
  } else {
    loginSection.style.display = "none";
    signupSection.style.display = "block";
    tabBtns[0].classList.remove("active");
    tabBtns[1].classList.add("active");
  }
}

function showAuthError(msg) {
  const el = document.getElementById("auth-error-msg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("auth-success-msg").style.display = "none";
}

function showAuthSuccess(msg) {
  const el = document.getElementById("auth-success-msg");
  el.textContent = msg;
  el.style.display = "block";
  document.getElementById("auth-error-msg").style.display = "none";
}

function clearAuthMessages() {
  document.getElementById("auth-error-msg").style.display = "none";
  document.getElementById("auth-success-msg").style.display = "none";
}

// ── SIGNUP ──
async function handleSignup() {
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) {
    showAuthError("Don't let any field empty.");
    return;
  }
  if (password.length < 6) {
    showAuthError("Password should be 6 characters long.");
    return;
  }

  try {
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      pendingVerifyEmail = email;
      showVerifySection(email);
    } else {
      showAuthError(data.error || "Signup failed.");
    }
  } catch (err) {
    showAuthError("Connection failed.");
  }
}

// ── SHOW VERIFY SECTION ──
function showVerifySection(email) {
  document.getElementById("login-form-section").style.display = "none";
  document.getElementById("signup-form-section").style.display = "none";
  document.getElementById("auth-tab-btns").style.display = "none";
  document.getElementById("guest-section").style.display = "none";
  document.getElementById("verify-section").style.display = "block";
  document.getElementById("verify-code-input").value = "";
  showAuthSuccess(`Code has been sent: ${email} — expires in 10 minutes.`);

  // Modal title update
  document.getElementById("auth-modal-title").textContent =
    "📧 You've to verify your Email ";
  document.getElementById("auth-modal-subtitle").textContent =
    "Check your email and enter code";
}

// ── VERIFY CODE ──
async function handleVerify() {
  const code = document.getElementById("verify-code-input").value.trim();

  if (!code || code.length !== 6) {
    showAuthError("Enter 6-digit code.");
    return;
  }

  try {
    const res = await fetch("/api/users/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: pendingVerifyEmail, code }),
    });
    const data = await res.json();

    if (res.ok) {
      showAuthSuccess("Email had verified! Now use login");
      setTimeout(() => {
        document.getElementById("auth-modal-title").textContent =
          "🎈 Welcome to SA Parties!";
        document.getElementById("auth-modal-subtitle").textContent =
          "Login karein ya Guest ki tarah shop karein";
        switchAuthTab("login");
        document.getElementById("login-email").value = pendingVerifyEmail;
      }, 1500);
    } else {
      showAuthError(data.error || "Incorrect code.");
    }
  } catch (err) {
    showAuthError("Connection failed");
  }
}

// ── LOGIN ──
async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showAuthError("Email and password is compulsary");
    return;
  }

  try {
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok) {
      setToken(data.token);
      saveUser(data.user);
      currentUser = data.user;
      isGuestMode = false;

      updateNavbarAuthBtn();
      closeAuthModal();
      showToast(
        "success",
        "Login Successful!",
        `Welcome back, ${data.user.name}!`,
      );

      // Checkout form
      const custName = document.getElementById("cust-name");
      if (custName && data.user.name) custName.value = data.user.name;
    } else {
      showAuthError(data.error || "Incorrect email or password.");
    }
  } catch (err) {
    showAuthError("Connection error.");
  }
}

// ── GUEST ──
function continueAsGuest() {
  isGuestMode = true;
  currentUser = null;
  updateNavbarAuthBtn();
  closeAuthModal();
  showToast("success", "Guest Mode", "You're shopping as a guest.");
}

// ============================================================
// Helpers
// ============================================================

function formatPrice(value) {
  return (Number(value) || 0).toLocaleString("en-PK");
}

function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function placeholderImage(name) {
  const initial =
    String(name || "SA")
      .trim()
      .charAt(0)
      .toUpperCase() || "S";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="#E0218A"/><text x="50%" y="52%" font-family="Poppins, Arial, sans-serif" font-size="68" font-weight="800" fill="#FFD93D" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getStockInfo(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0)
    return { label: "Out of Stock", className: "out", available: false };
  if (qty <= 5)
    return { label: `Only ${qty} left`, className: "low", available: true };
  return { label: `Stock: ${qty}`, className: "", available: true };
}

function showToast(type, title, message) {
  const stack = document.getElementById("toast-stack");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast-card${type === "error" ? " error" : ""}`;
  const icon =
    type === "error" ? "bi-exclamation-circle-fill" : "bi-check-circle-fill";
  toast.innerHTML = `<i class="bi ${icon} toast-icon"></i><div><div class="toast-title">${escapeHtml(title)}</div><div class="toast-msg">${escapeHtml(message)}</div></div>`;
  stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ============================================================
// Products
// ============================================================

async function fetchShopProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error("Bad response");
    const products = await response.json();
    if (!Array.isArray(products) || products.length === 0) {
      renderEmptyState();
      return;
    }
    allProducts = products;
    renderProducts(products);
    fetchShopCategories();
  } catch (err) {
    console.error(err);
    renderLoadError();
  }
}

function renderProducts(products) {
  if (!productsContainer) return;
  productsContainer.innerHTML = "";
  products.forEach((prod) => {
    const imgSrc = prod.image_url
      ? prod.image_url
      : placeholderImage(prod.name);
    const stockInfo = getStockInfo(prod.stock);

    // Generate color options HTML
    let colorOptionsHtml = "";
    if (prod.colors && prod.colors.length > 0) {
      colorOptionsHtml = `
        <div class="color-selector mt-2 mb-2">
          <span style="font-size:0.75rem;font-weight:600;color:var(--ink-soft);">Color:</span>
          <div class="d-flex gap-1 mt-1">
            ${prod.colors
              .map(
                (color, idx) => `
              <button type="button" 
                class="color-option-btn ${idx === 0 ? "active" : ""}" 
                data-color-id="${color.id}"
                data-color-name="${escapeHtml(color.name)}"
                data-color-code="${escapeHtml(color.code)}"
                data-color-stock="${color.stock}"
                data-product-id="${prod.id}"
                data-product-name="${escapeHtml(prod.name)}"
                data-product-price="${Number(prod.price) || 0}"
                style="width:28px;height:28px;border-radius:50%;border:2px solid ${idx === 0 ? "var(--pink-500)" : "#ddd"};background:${escapeHtml(color.code)};cursor:pointer;transition:all 0.2s;"
                title="${escapeHtml(color.name)} (${color.stock} in stock)"
                onclick="selectColor(this)">
              </button>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    }

    const col = document.createElement("div");
    col.className = "product-card-modern h-100";
    col.innerHTML = `
        <div class="img-wrap">
          <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(prod.name)}">
        </div>
        <div class="card-body">
          <div class="product-name">${escapeHtml(prod.name)}</div>
          <div class="d-flex justify-content-between align-items-center mt-2 mb-3">
            <span class="price-modern">Rs. ${formatPrice(prod.price)}</span>
            <span class="stock-modern ${stockInfo.className}">${stockInfo.label}</span>
          </div>
          ${colorOptionsHtml}
          <div class="btn-actions">
            <button type="button" class="btn-add"
              data-add-cart
              data-product-id="${escapeHtml(String(prod.id))}"
              data-product-name="${escapeHtml(prod.name)}"
              data-product-price="${Number(prod.price) || 0}"
              data-has-colors="${prod.colors && prod.colors.length > 0 ? "yes" : "no"}"
              data-selected-color=""
              data-selected-color-id=""
              ${stockInfo.available ? "" : "disabled"}>
              <i class="bi bi-cart3 me-1"></i> ${stockInfo.available ? "Add to Cart" : "Out of Stock"}
            </button>
            <a href="product.html?id=${prod.id}" class="btn-view" title="View Details">
              <i class="bi bi-eye"></i>
            </a>
          </div>
        </div>
    `;
    productsContainer.appendChild(col);
  });
}

function selectColor(btn) {
  // Remove active class from all color buttons in the same container
  const container = btn.closest(".color-selector");
  container.querySelectorAll(".color-option-btn").forEach((b) => {
    b.style.borderColor = "#ddd";
    b.classList.remove("active");
  });

  // Add active class to selected button
  btn.style.borderColor = "var(--pink-500)";
  btn.classList.add("active");

  // Update the add to cart button with selected color info
  const card = btn.closest(".product-card-modern");
  const addToCartBtn = card.querySelector(".btn-add");
  addToCartBtn.dataset.selectedColor = btn.dataset.colorName;
  addToCartBtn.dataset.selectedColorId = btn.dataset.colorId;
}

// ── Color Picker Popup (shown when product has colors but none selected) ──
function showChooseColorPopup(productId, productName, productPrice, addBtn) {
  document.getElementById("choose-color-modal")?.remove();

  // Find colors from the product card in DOM
  const card = addBtn.closest(".product-card-modern");
  const colorBtns = card ? card.querySelectorAll(".color-option-btn") : [];

  if (colorBtns.length === 0) {
    // Fallback: just add without color
    addToCart(productId, productName, productPrice, "", "");
    return;
  }

  let selectedColorName = "";
  let selectedColorId = "";

  const colorsHtml = Array.from(colorBtns)
    .map(
      (cb, idx) => `
    <button type="button"
      class="color-pick-btn"
      data-color-id="${cb.dataset.colorId}"
      data-color-name="${escapeHtml(cb.dataset.colorName)}"
      data-color-code="${escapeHtml(cb.dataset.colorCode)}"
      style="
        display:inline-flex;align-items:center;gap:8px;
        background:#fff;border:2px solid #e8d5f0;border-radius:50px;
        padding:6px 14px 6px 8px;cursor:pointer;font-size:0.85rem;
        font-weight:600;color:#2a1b2e;transition:all 0.18s;
      "
      onclick="(function(btn){
        document.querySelectorAll('.color-pick-btn').forEach(b=>{
          b.style.borderColor='#e8d5f0';
          b.style.background='#fff';
          b.style.color='#2a1b2e';
        });
        btn.style.borderColor='#e0218a';
        btn.style.background='#fff1f8';
        btn.style.color='#e0218a';
        document.getElementById('color-popup-confirm').dataset.colorName=btn.dataset.colorName;
        document.getElementById('color-popup-confirm').dataset.colorId=btn.dataset.colorId;
        document.getElementById('color-popup-confirm').disabled=false;
        document.getElementById('color-popup-confirm').style.opacity='1';
      })(this)"
    >
      <span style="width:18px;height:18px;border-radius:50%;background:${escapeHtml(cb.dataset.colorCode)};border:1.5px solid rgba(0,0,0,0.12);flex-shrink:0;"></span>
      ${escapeHtml(cb.dataset.colorName)}
      ${cb.dataset.colorStock ? `<span style="font-size:0.7rem;color:#8c7a92;font-weight:500;">(${cb.dataset.colorStock} left)</span>` : ""}
    </button>
  `,
    )
    .join("");

  const modal = document.createElement("div");
  modal.id = "choose-color-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(42,27,46,0.5);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;`;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:22px;max-width:380px;width:100%;box-shadow:0 20px 50px -8px rgba(173,10,105,0.25);overflow:hidden;animation:popIn 0.35s cubic-bezier(0.34,1.56,0.64,1);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#e0218a,#ad0a69);padding:20px 22px 16px;position:relative;">
        <div style="font-size:1.8rem;margin-bottom:4px;">🎨</div>
        <h4 style="margin:0;color:#fff;font-family:'Poppins',sans-serif;font-size:1.1rem;font-weight:800;">Choose a Color</h4>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.82);font-size:0.82rem;">${escapeHtml(productName)}</p>
        <button onclick="document.getElementById('choose-color-modal').remove()"
          style="position:absolute;top:12px;right:14px;background:rgba(255,255,255,0.2);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Color options -->
      <div style="padding:18px 20px 8px;">
        <p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#8c7a92;margin-bottom:12px;">Select a variant to continue:</p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${colorsHtml}
        </div>
        <p style="font-size:0.75rem;color:#c0a0c8;font-weight:500;margin-bottom:0;">
          <i class="bi bi-info-circle me-1"></i>You must select a color before adding to cart.
        </p>
      </div>

      <!-- Footer -->
      <div style="padding:12px 20px 20px;display:flex;flex-direction:column;gap:8px;">
        <button id="color-popup-confirm"
          data-color-name=""
          data-color-id=""
          disabled
          style="opacity:0.45;width:100%;background:linear-gradient(135deg,#e0218a,#ad0a69);border:none;color:#fff;font-weight:700;font-size:0.92rem;border-radius:12px;padding:0.75rem;cursor:pointer;font-family:'Poppins',sans-serif;transition:opacity 0.2s;"
          onclick="(function(btn){
            const cName = btn.dataset.colorName;
            const cId = btn.dataset.colorId;
            if (!cName) return;
            document.getElementById('choose-color-modal').remove();
            addToCart('${escapeHtml(String(productId))}', '${escapeHtml(productName).replace(/'/g, "\'")}', ${Number(productPrice) || 0}, cName, cId);
            // Also update the card's add-to-cart button for future clicks
            const cardBtn = document.querySelector('[data-add-cart][data-product-id=\'${escapeHtml(String(productId))}\']');
            if (cardBtn) {
              cardBtn.dataset.selectedColor = cName;
              cardBtn.dataset.selectedColorId = cId;
            }
          })(this)">
          <i class="bi bi-cart3-fill me-2"></i>Add to Cart
        </button>
        <button onclick="window.location.href='product.html?id=${escapeHtml(String(productId))}'"
          style="width:100%;background:#f9f4fb;border:1.5px solid #e8d5f0;color:#e0218a;font-weight:700;font-size:0.85rem;border-radius:12px;padding:0.65rem;cursor:pointer;font-family:'Poppins',sans-serif;">
          <i class="bi bi-eye me-1"></i>View Full Product
        </button>
      </div>
    </div>
    <style>@keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}</style>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

function renderEmptyState() {
  if (!productsContainer) return;
  productsContainer.innerHTML = `
    <div class="col-12 text-center py-5">
      <i class="bi bi-box-seam" style="font-size:3rem;color:var(--pink-soft);"></i>
      <h5 class="mt-3">No Products Available</h5>
      <p class="text-muted">Check back soon!</p>
    </div>`;
}

function renderLoadError() {
  if (!productsContainer) return;
  productsContainer.innerHTML = `
    <div class="col-12">
      <div class="empty-state">
        <div class="icon"><i class="bi bi-wifi-off"></i></div>
        <h5>Could not load products</h5>
        <p>Please check your connection and try again.</p>
      </div>
    </div>`;
}

// ============================================================
// Checkout
// ============================================================
if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    cart = loadCart();
    if (cart.length === 0) {
      showToast("error", "Cart Empty", "Please add items first.");
      return;
    }

    const subtotal = cart.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );
    const shippingCost = calcShipping(cart);
    const paymentMethod =
      document.querySelector('input[name="payment-method"]:checked')?.value ||
      "cod";

    const orderData = {
      name: document.getElementById("cust-name").value,
      email:
        currentUser?.email ||
        document.getElementById("login-email")?.value ||
        "",
      phone: document.getElementById("cust-phone").value,
      address: document.getElementById("cust-address").value,
      payment_method: paymentMethod,
      shipping_cost: shippingCost,
      total_amount: subtotal + shippingCost,
      items: cart,
      items_list: cart
        .map(
          (item) =>
            `${item.name}${item.color_name ? ` (${item.color_name})` : ""} x${item.quantity}`,
        )
        .join(", "),
    };

    if (currentUser) {
      orderData.user_id = currentUser.id;
    }

    // For online payments, collect payment details
    if (paymentMethod !== "cod") {
      const transactionId =
        document.getElementById("payment-transaction-id")?.value?.trim() || "";
      const senderNumber =
        document.getElementById("payment-sender-number")?.value?.trim() || "";

      if (!transactionId) {
        showToast(
          "error",
          "Transaction ID Required",
          "Please enter your transaction ID.",
        );
        return;
      }
      if (!senderNumber) {
        showToast(
          "error",
          "Sender Number Required",
          "Please enter your sender mobile number.",
        );
        return;
      }
      if (!uploadedScreenshotPath) {
        showToast(
          "error",
          "Screenshot Required",
          "Please upload your payment screenshot.",
        );
        return;
      }

      orderData.transaction_id = transactionId;
      orderData.sender_number = senderNumber;
      orderData.payment_screenshot = uploadedScreenshotPath;
    }

    try {
      const headers = { "Content-Type": "application/json" };
      if (getToken()) headers["Authorization"] = `Bearer ${getToken()}`;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (response.ok) {
        // Show order summary popup
        const popupSubtotal = cart.reduce(
          (s, i) => s + Number(i.price) * i.quantity,
          0,
        );
        const popupShipping = calcShipping(cart);
        showOrderSummaryPopup({
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          customerName: orderData.name,
          phone: orderData.phone,
          address: orderData.address,
          paymentMethod: orderData.payment_method,
          items: cart,
          subtotal: popupSubtotal,
          shipping: popupShipping,
          total: orderData.total_amount,
          orderDate: new Date().toLocaleString("en-PK", {
            dateStyle: "medium",
            timeStyle: "short",
          }),
        });

        checkoutForm.reset();

        // Reset payment-specific fields
        uploadedScreenshotPath = null;
        const sfn = document.getElementById("screenshot-filename");
        if (sfn) {
          sfn.textContent = "Click to upload payment screenshot";
          sfn.style.color = "var(--ink-soft)";
        }
        const sp = document.getElementById("screenshot-preview");
        if (sp) sp.style.display = "none";
        const spi = document.getElementById("screenshot-preview-img");
        if (spi) spi.src = "";

        cart = [];
        saveCart(cart);
        updateCartUI();
        if (typeof updatePaymentUI === "function") updatePaymentUI();
      } else {
        showToast("error", "Failed", data.error || "Could not place order.");
      }
    } catch (err) {
      showToast("error", "Error", "Server connection issue.");
    }
  });
}

// ============================================================
// Search
// ============================================================
async function searchProducts() {
  const input = document.getElementById("search-input");
  if (!input) return;
  const query = input.value.trim();
  try {
    const res = await fetch(
      `/api/products?search=${encodeURIComponent(query)}`,
    );
    const products = await res.json();
    renderProducts(products);
  } catch (err) {
    console.error("Search failed:", err);
  }
}

let navbarSearchTimer = null;
function handleNavbarSearch(query) {
  // Show/hide clear button
  const clearBtn = document.getElementById("navbar-search-clear");
  if (clearBtn) clearBtn.style.display = query ? "flex" : "none";

  // Debounce
  clearTimeout(navbarSearchTimer);
  navbarSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `/api/products?search=${encodeURIComponent(query.trim())}`,
      );
      const products = await res.json();
      renderProducts(products);
      // Scroll to shop section
      if (query.trim()) {
        document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err) {
      console.error("Navbar search failed:", err);
    }
  }, 350);
}

function clearNavbarSearch() {
  const input = document.getElementById("navbar-search-input");
  const clearBtn = document.getElementById("navbar-search-clear");
  if (input) input.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  // Restore all products
  handleNavbarSearch("");
}

// ============================================================
// Sidebar
// ============================================================
function openSidebar() {
  document.getElementById("sidebar-drawer").style.left = "0";
  document.getElementById("sidebar-overlay").style.display = "block";
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  document.getElementById("sidebar-drawer").style.left = "-300px";
  document.getElementById("sidebar-overlay").style.display = "none";
  document.body.style.overflow = "";
}

// ============================================================
// Categories
// ============================================================
let allProducts = [];
let activeCategory = null;

async function fetchShopCategories() {
  try {
    const res = await fetch("/api/categories");
    if (!res.ok) return;
    const cats = await res.json();
    renderSidebarCategories(cats);
  } catch (err) {
    console.error("Categories fetch failed:", err);
  }
}

function renderSidebarCategories(categories) {
  const list = document.getElementById("sidebar-categories-list");
  if (!list) return;
  list.innerHTML = "";

  // Build a parent_id -> children tree so ANY depth of nesting works
  // (parent -> child -> grandchild -> ...), not just one level.
  const byId = {};
  categories.forEach((c) => {
    byId[String(c.id)] = { ...c, children: [] };
  });

  const roots = [];
  categories.forEach((c) => {
    const node = byId[String(c.id)];
    const pid = c.parent_id !== null && c.parent_id !== undefined ? String(c.parent_id) : null;
    if (pid && byId[pid]) {
      byId[pid].children.push(node);
    } else {
      roots.push(node);
    }
  });

  const icons = [
    "bi-balloon-fill",
    "bi-stars",
    "bi-gift-fill",
    "bi-cake2-fill",
    "bi-emoji-laughing-fill",
  ];

  function renderLevel(nodes, container, depth) {
    nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;

      const btn = document.createElement("button");
      btn.id = `cat-btn-${node.id}`;

      if (depth === 0) {
        const icon = icons[Math.floor(Math.random() * icons.length)];
        btn.className = "sidebar-cat-btn";
        btn.innerHTML = `<i class="bi ${icon} me-2" style="color:var(--pink-primary);"></i>${escapeHtml(node.name)}${hasChildren ? `<i class="bi bi-chevron-down ms-auto" style="font-size:0.75rem;color:var(--ink-soft);" id="chev-${node.id}"></i>` : ""}`;
      } else {
        // Nested levels — indent progressively so depth is visible
        btn.className = "sidebar-subcat-btn";
        btn.style.paddingLeft = `${1 + depth * 1}rem`;
        btn.innerHTML = `<i class="bi bi-dot me-1" style="font-size:1.2rem;"></i>${escapeHtml(node.name)}${hasChildren ? `<i class="bi bi-chevron-down ms-auto" style="font-size:0.7rem;color:var(--ink-soft);" id="chev-${node.id}"></i>` : ""}`;
      }

      btn.onclick = () => {
        if (hasChildren) {
          toggleSubcats(node.id);
        } else {
          filterByCategory(node.id, node.name);
        }
      };
      container.appendChild(btn);

      if (hasChildren) {
        const subWrap = document.createElement("div");
        subWrap.id = `subcats-${node.id}`;
        subWrap.style.display = "none";
        container.appendChild(subWrap);
        renderLevel(node.children, subWrap, depth + 1);
      }
    });
  }

  renderLevel(roots, list, 0);
}

function toggleSubcats(parentId) {
  const wrap = document.getElementById(`subcats-${parentId}`);
  const chev = document.getElementById(`chev-${parentId}`);
  if (!wrap) return;
  const open = wrap.style.display !== "none";
  wrap.style.display = open ? "none" : "block";
  if (chev) {
    chev.className = `bi ${open ? "bi-chevron-down" : "bi-chevron-up"} ms-auto`;
    chev.style.fontSize = "0.75rem";
    chev.style.color = "var(--ink-soft)";
  }
}

function filterByCategory(categoryId, categoryName) {
  activeCategory = categoryId;
  closeSidebar();
  document
    .querySelectorAll(".sidebar-cat-btn, .sidebar-subcat-btn")
    .forEach((b) => b.classList.remove("active"));
  const target = document.getElementById(
    categoryId ? `cat-btn-${categoryId}` : "cat-btn-all",
  );
  if (target) target.classList.add("active");

  const labelWrap = document.getElementById("active-category-label");
  const labelName = document.getElementById("active-category-name");
  if (labelWrap && labelName) {
    if (categoryId && categoryName) {
      labelWrap.style.display = "block";
      labelName.textContent = categoryName;
    } else {
      labelWrap.style.display = "none";
    }
  }

  document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });

  if (!categoryId) {
    renderProducts(allProducts);
    return;
  }

  const filtered = allProducts.filter(
    (p) =>
      String(p.category_id) === String(categoryId) ||
      String(p.category) === String(categoryId),
  );

  if (filtered.length === 0) {
    if (productsContainer)
      productsContainer.innerHTML = `
      <div class="col-12"><div class="empty-state">
        <div class="icon"><i class="bi bi-tag"></i></div>
        <h5>No Products in this Category</h5>
        <p>Try a different category or browse all products.</p>
      </div></div>`;
  } else {
    renderProducts(filtered);
  }
}

// ============================================================
// Product Detail Page (product.html)
// ============================================================
async function fetchProductDetails(id) {
  if (!id) return;
  try {
    const response = await fetch(`/api/products/product/${id}`);
    if (!response.ok) throw new Error("Product not found");
    const product = await response.json();

    document.getElementById("p-name").innerText = product.name;
    document.getElementById("p-price").innerText = formatPrice(product.price);
    document.getElementById("p-desc").innerText = product.description || "";
    document.getElementById("p-image").src = product.image_url || "";

    document.getElementById("add-to-cart-btn").onclick = () => {
      addToCart(product.id, product.name, product.price);
    };
  } catch (err) {
    console.error("Error:", err);
  }
}
// ============================================================
// Order Summary Popup Modal
// ============================================================
function showOrderSummaryPopup({
  orderNumber,
  orderId,
  customerName,
  phone,
  address,
  paymentMethod,
  items,
  subtotal,
  shipping,
  total,
  orderDate,
}) {
  document.getElementById("order-summary-modal")?.remove();

  const payLabel =
    paymentMethod === "cod"
      ? "Cash on Delivery"
      : paymentMethod?.toUpperCase() || "Online";
  const displayDate =
    orderDate ||
    new Date().toLocaleString("en-PK", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const displayOrderNum = escapeHtml(orderNumber || `#${orderId}`);

  const itemsHtml = (items || [])
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 4px;border-bottom:1px solid #fbdcee;font-weight:600;color:#2a1b2e;font-size:0.88rem;">
        ${escapeHtml(item.name)}${item.color_name ? ` <span style="color:#e0218a;font-size:0.78rem;">(${escapeHtml(item.color_name)})</span>` : ""}
      </td>
      <td style="padding:8px 4px;border-bottom:1px solid #fbdcee;text-align:center;color:#8c7a92;font-size:0.85rem;">x${item.quantity}</td>
      <td style="padding:8px 4px;border-bottom:1px solid #fbdcee;text-align:right;font-weight:700;color:#e0218a;font-size:0.88rem;">Rs. ${Number(item.price * item.quantity).toLocaleString("en-PK")}</td>
    </tr>
  `,
    )
    .join("");

  const pdfFnName = "dlPDF_" + (orderId || Date.now());
  window[pdfFnName] = function () {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Order ${displayOrderNum}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#2a1b2e;margin:0;padding:24px;}
        .hdr{background:linear-gradient(135deg,#e0218a,#ad0a69);color:#fff;padding:20px;border-radius:12px;text-align:center;margin-bottom:18px;}
        .hdr h1{margin:0;font-size:1.4rem;} .hdr p{margin:4px 0 0;opacity:.85;font-size:.88rem;}
        .row2{display:flex;justify-content:space-between;background:#fff1f8;border:1px solid #fbdcee;border-radius:10px;padding:10px 16px;margin-bottom:14px;}
        .lbl{font-size:.7rem;font-weight:700;text-transform:uppercase;color:#8c7a92;}
        .val{font-size:.95rem;font-weight:800;color:#e0218a;font-family:monospace;}
        .sec{background:#f9f4fb;border-radius:10px;padding:12px 16px;margin-bottom:12px;}
        .stitle{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#8c7a92;margin-bottom:8px;}
        table{width:100%;border-collapse:collapse;} th,td{padding:7px 5px;font-size:.84rem;}
        thead tr{border-bottom:2px solid #e0218a;} th{color:#8c7a92;font-weight:700;font-size:.72rem;text-transform:uppercase;}
        tbody tr{border-bottom:1px solid #fbdcee;}
        .pr{display:flex;justify-content:space-between;font-size:.84rem;padding:3px 0;}
        .tr{display:flex;justify-content:space-between;font-size:.98rem;font-weight:800;padding-top:8px;border-top:2px solid #e0218a;margin-top:5px;}
        .foot{text-align:center;margin-top:20px;font-size:.76rem;color:#8c7a92;}
      </style></head><body>
      <div class="hdr"><div style="font-size:1.8rem;margin-bottom:4px;">🎉</div><h1>Order Confirmed!</h1><p>SA Parties — Thank you for your order</p></div>
      <div class="row2">
        <div><div class="lbl">Order Number</div><div class="val">${displayOrderNum}</div></div>
        <div style="text-align:right"><div class="lbl">Order Date</div><div style="font-size:.85rem;font-weight:700;color:#2a1b2e;">${displayDate}</div></div>
      </div>
      <div class="sec">
        <div class="stitle">Customer Details</div>
        <div style="font-size:.87rem;line-height:1.8;">
          <strong>${escapeHtml(customerName || "—")}</strong><br>
          ${phone ? "📞 " + escapeHtml(phone) + "<br>" : ""}
          ${address ? "📍 " + escapeHtml(address) + "<br>" : ""}
          💳 ${escapeHtml(payLabel)}
        </div>
      </div>
      <div class="sec">
        <div class="stitle">Items Ordered</div>
        <table>
          <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th></tr></thead>
          <tbody>${(items || []).map((i) => `<tr><td>${escapeHtml(i.name)}${i.color_name ? " (" + escapeHtml(i.color_name) + ")" : ""}</td><td style="text-align:center">x${i.quantity}</td><td style="text-align:right;color:#e0218a;font-weight:700;">Rs. ${Number(i.price * i.quantity).toLocaleString("en-PK")}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="sec">
        <div class="stitle">Price Summary</div>
        <div class="pr"><span>Subtotal</span><span>Rs. ${Number(subtotal || total).toLocaleString("en-PK")}</span></div>
        <div class="pr"><span>Shipping</span><span>${(shipping || 0) > 0 ? "Rs. " + Number(shipping).toLocaleString("en-PK") : "Free"}</span></div>
        <div class="tr"><span>Total</span><span style="color:#e0218a;">Rs. ${Number(total).toLocaleString("en-PK")}</span></div>
      </div>
      <div class="foot">SA Parties &bull; Keep this receipt safe.</div>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const modal = document.createElement("div");
  modal.id = "order-summary-modal";
  modal.style.cssText = `position:fixed;inset:0;background:rgba(42,27,46,0.55);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;`;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:24px;max-width:480px;width:100%;box-shadow:0 24px 60px -10px rgba(173,10,105,0.28);overflow:hidden;animation:popIn 0.4s cubic-bezier(0.34,1.56,0.64,1);">
      <div style="background:linear-gradient(135deg,#e0218a,#ad0a69);padding:28px 28px 22px;text-align:center;position:relative;">
        <div style="font-size:2.8rem;margin-bottom:6px;">🎉</div>
        <h3 style="margin:0;color:#fff;font-family:'Poppins',sans-serif;font-size:1.35rem;font-weight:800;">Order Placed!</h3>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:0.88rem;">Thank you for shopping with SA Parties</p>
        <button onclick="document.getElementById('order-summary-modal').remove()" style="position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.2);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <div style="background:#fff1f8;border-bottom:2px solid #fbdcee;padding:12px 28px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
        <div>
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#8c7a92;">Order Number</div>
          <div style="font-family:'Courier New',monospace;font-weight:900;font-size:1.05rem;color:#e0218a;">${displayOrderNum}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#8c7a92;">Order Date</div>
          <div style="font-size:0.82rem;font-weight:700;color:#2a1b2e;">${displayDate}</div>
        </div>
      </div>
      <div style="padding:20px 28px 20px;max-height:50vh;overflow-y:auto;">
        <div style="background:#f9f4fb;border-radius:12px;padding:12px 16px;margin-bottom:14px;">
          <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#8c7a92;margin-bottom:8px;">Customer Details</div>
          <div style="font-size:0.88rem;color:#2a1b2e;line-height:1.7;">
            <div><strong>${escapeHtml(customerName || "—")}</strong></div>
            ${phone ? `<div style="color:#8c7a92;"><i class="bi bi-telephone me-1"></i>${escapeHtml(phone)}</div>` : ""}
            ${address ? `<div style="color:#8c7a92;"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(address)}</div>` : ""}
            <div style="margin-top:4px;"><span style="background:#e0218a;color:#fff;border-radius:50px;padding:2px 12px;font-size:0.75rem;font-weight:700;">${escapeHtml(payLabel)}</span></div>
          </div>
        </div>
        <div style="font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#8c7a92;margin-bottom:8px;">Items Ordered</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="font-size:0.72rem;color:#8c7a92;text-transform:uppercase;">
            <th style="padding:0 4px 8px;text-align:left;font-weight:700;">Product</th>
            <th style="padding:0 4px 8px;text-align:center;font-weight:700;">Qty</th>
            <th style="padding:0 4px 8px;text-align:right;font-weight:700;">Price</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="background:#f9f4fb;border-radius:12px;padding:12px 16px;margin-top:12px;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#8c7a92;margin-bottom:6px;">
            <span>Subtotal</span><span style="font-weight:600;color:#2a1b2e;">Rs. ${Number(subtotal || total).toLocaleString("en-PK")}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:#8c7a92;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #fbdcee;">
            <span><i class="bi bi-truck me-1"></i>Shipping</span>
            <span style="font-weight:600;color:${(shipping || 0) > 0 ? "#e0218a" : "#2e7d32"};">${(shipping || 0) > 0 ? "Rs. " + Number(shipping).toLocaleString("en-PK") : "Free"}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:800;font-size:1rem;color:#2a1b2e;">Total</span>
            <span style="font-weight:900;font-size:1.25rem;color:#e0218a;font-family:'Poppins',sans-serif;">Rs. ${Number(total).toLocaleString("en-PK")}</span>
          </div>
        </div>
        ${
          paymentMethod === "cod"
            ? `<div style="background:#e8f5e9;border-radius:10px;padding:10px 14px;margin-top:14px;font-size:0.82rem;color:#1b5e20;font-weight:600;"><i class="bi bi-cash-coin me-1"></i> Pay when your order arrives.</div>`
            : `<div style="background:#fff3e0;border-radius:10px;padding:10px 14px;margin-top:14px;font-size:0.82rem;color:#e65100;font-weight:600;"><i class="bi bi-clock-history me-1"></i> Payment is being verified. We'll confirm shortly.</div>`
        }
      </div>
      <div style="padding:0 28px 24px;display:flex;flex-direction:column;gap:10px;">
        <button onclick="window['${pdfFnName}']()" style="width:100%;background:linear-gradient(135deg,#7c3aed,#a78bfa);border:none;color:#fff;font-weight:700;font-size:0.9rem;border-radius:12px;padding:0.75rem;cursor:pointer;font-family:'Poppins',sans-serif;">
          <i class="bi bi-file-earmark-pdf-fill me-2"></i>Download PDF Receipt
        </button>
        <button onclick="document.getElementById('order-summary-modal').remove()" style="width:100%;background:linear-gradient(135deg,#e0218a,#ad0a69);border:none;color:#fff;font-weight:700;font-size:0.95rem;border-radius:12px;padding:0.85rem;cursor:pointer;font-family:'Poppins',sans-serif;">
          <i class="bi bi-check-circle-fill me-2"></i>Got it, Thanks!
        </button>
      </div>
    </div>
    <style>@keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}</style>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}