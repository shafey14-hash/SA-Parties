// ============================================================
// SA Parties - Admin Frontend Logic
// ============================================================

const toastStack = document.getElementById("toast-stack");

// ----------------------------------------------------------
// Toast notifications (same system as app.js)
// ----------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

function generatePlaceholder(text) {
  return `https://via.placeholder.com/150/fbdcee/2a1b2e?text=${encodeURIComponent(text)}`;
}

function showToast(type, title, message) {
  const toast = document.createElement("div");
  toast.className = `toast-card${type === "error" ? " error" : ""}`;
  const icon =
    type === "error" ? "bi-exclamation-circle-fill" : "bi-check-circle-fill";

  toast.innerHTML = `
    <i class="bi ${icon} toast-icon"></i>
    <div>
      <div class="toast-title">${escapeHtml(title)}</div>
      <div class="toast-msg">${escapeHtml(message)}</div>
    </div>
  `;

  toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ----------------------------------------------------------
// On page load: check status and initialize events
// ----------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("adminToken");
  if (token) {
    showDashboard();
  }
});

// ----------------------------------------------------------
// Navigation Control
// ----------------------------------------------------------
// ── Quick Manage main toggle ──
function toggleQuickManageMenu(e) {
  e.preventDefault();
  const subNav = document.getElementById("quick-manage-sub-nav");
  const chevron = document.getElementById("quick-manage-chevron");
  const isOpen = subNav.style.display === "block";
  subNav.style.display = isOpen ? "none" : "block";
  chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";

  // Close Orders sub-nav whenever Quick Manage is toggled open
  const ordersSubNav = document.getElementById("orders-sub-nav");
  const ordersChevron = document.getElementById("orders-chevron");
  if (ordersSubNav) ordersSubNav.style.display = "none";
  if (ordersChevron) ordersChevron.style.transform = "rotate(0deg)";

  if (!isOpen) {
    // Auto-open whichever Quick Manage sub-pane was last active, defaulting to Inventory
    const firstSubLink =
      document.querySelector("#quick-manage-sub-nav .nav-link-pink.active") ||
      document.querySelector("#quick-manage-sub-nav .nav-link-pink");
    if (firstSubLink) {
      const targetId = firstSubLink.id;
      const paneMap = {
        "nav-inventory": "inventory-pane",
        "nav-add-product": "add-product-pane",
        "nav-edit-category": "edit-category-pane",
      };
      switchQuickManagePane(
        paneMap[targetId] || "inventory-pane",
        firstSubLink,
      );
    }
    document
      .querySelectorAll(".nav-link-pink")
      .forEach((l) => l.classList.remove("active"));
    document.getElementById("nav-quick-manage-toggle").classList.add("active");
    if (firstSubLink) firstSubLink.classList.add("active");
  }
}

// ── Sub-pane switcher (inside Quick Manage) ──
function switchQuickManagePane(paneId, element) {
  document
    .querySelectorAll(".section-pane")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll("#quick-manage-sub-nav .nav-link-pink")
    .forEach((l) => l.classList.remove("active"));
  document.getElementById(paneId).classList.add("active");
  element.classList.add("active");
  document.getElementById("nav-quick-manage-toggle").classList.add("active");

  // Keep the Quick Manage dropdown open and its chevron pointed up
  const subNav = document.getElementById("quick-manage-sub-nav");
  const chevron = document.getElementById("quick-manage-chevron");
  if (subNav) subNav.style.display = "block";
  if (chevron) chevron.style.transform = "rotate(180deg)";
}

// ── Orders main toggle ──
// ── Orders module — code-split, loaded on demand ──
// Orders (payment verification, pending/shipped/delivered/cancelled) is a
// big chunk of code that most admin sessions never touch if they're just
// managing products. Instead of shipping it in the initial admin.js, it
// lives in admin-orders.js and is fetched only the first time the admin
// actually opens the Orders section — so the default screen (Quick
// Manage) loads faster.
let ordersModuleLoadPromise = null;
function loadOrdersModule() {
  if (!ordersModuleLoadPromise) {
    ordersModuleLoadPromise = import("./admin-orders.js?v=20260725-3").then(
      () => {
        // The module attaches its functions to window on load; once that's
        // done, do the first data fetch.
        fetchAdminOrders();
        fetchPaymentVerifications();
      },
    );
  }
  return ordersModuleLoadPromise;
}

function toggleOrdersMenu(e) {
  e.preventDefault();
  const subNav = document.getElementById("orders-sub-nav");
  const chevron = document.getElementById("orders-chevron");
  const isOpen = subNav.style.display === "block";
  subNav.style.display = isOpen ? "none" : "block";
  chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";

  // Close Quick Manage sub-nav whenever Orders is toggled open
  const qmSubNav = document.getElementById("quick-manage-sub-nav");
  const qmChevron = document.getElementById("quick-manage-chevron");
  if (qmSubNav) qmSubNav.style.display = "none";
  if (qmChevron) qmChevron.style.transform = "rotate(0deg)";

  if (!isOpen) {
    loadOrdersModule();

    // Auto-open Payment Verification sub-pane
    const firstSubLink = document.querySelector(
      "#orders-sub-nav .nav-link-pink",
    );
    if (firstSubLink)
      switchOrderPane("payment-verification-pane", firstSubLink);
    document
      .querySelectorAll(".nav-link-pink")
      .forEach((l) => l.classList.remove("active"));
    document.getElementById("nav-orders-toggle").classList.add("active");
  }
}

// ── Sub-pane switcher (inside Orders) ──
function switchOrderPane(paneId, element) {
  document
    .querySelectorAll(".section-pane")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll("#orders-sub-nav .nav-link-pink")
    .forEach((l) => l.classList.remove("active"));
  document.getElementById(paneId).classList.add("active");
  element.classList.add("active");
  document.getElementById("nav-orders-toggle").classList.add("active");
}

// ----------------------------------------------------------
// Main Product Images — slot-based
// ----------------------------------------------------------
// Holds URLs of existing (already-saved) images the user removed during
// this edit session. Sent to the backend on submit so it can drop them
// from the product's stored images array instead of re-appending them.
let deletedImageUrls = [];

function addMainImageSlot(existingUrl) {
  const list = document.getElementById("main-images-list");
  if (!list) return;
  const slot = document.createElement("div");
  slot.className = "pf-img-slot" + (existingUrl ? " has-img" : "");
  // Remember the original URL on the slot itself so removeImgSlot() knows
  // whether this was a pre-existing image (needs to be marked "deleted")
  // or just an empty/new upload slot.
  if (existingUrl) slot.dataset.existingUrl = existingUrl;
  slot.innerHTML = `
    <input type="file" accept="image/*" onchange="handleMainImgChange(this)" />
    <img class="pf-img-preview" src="${existingUrl || ""}" />
    <div class="pf-img-placeholder">
      <i class="bi bi-plus-lg fs-5"></i>
      <span>Add Image</span>
    </div>
    <button type="button" class="pf-del-img" onclick="removeImgSlot(this)" title="Remove">
      <i class="bi bi-x"></i>
    </button>
  `;
  list.appendChild(slot);
}

function handleMainImgChange(input) {
  const slot = input.closest(".pf-img-slot");
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      slot.querySelector(".pf-img-preview").src = e.target.result;
      slot.classList.add("has-img");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeImgSlot(btn) {
  const slot = btn.closest(".pf-img-slot, .pf-color-img-slot");
  if (!slot) return;

  // Only main product-image slots (.pf-img-slot) carry an existingUrl —
  // if it's a previously-saved image, record it as deleted so the
  // backend removes it from the product's stored images array.
  if (slot.classList.contains("pf-img-slot") && slot.dataset.existingUrl) {
    deletedImageUrls.push(slot.dataset.existingUrl);
  }

  slot.remove();
}

// ----------------------------------------------------------
// Color Variant Management — Daraz Style
// ----------------------------------------------------------
let colorIndex = 0;

// ── Product-level Stock Status toggle (In Stock / Not in Stock) ──
function setProductStockToggle(isInStock) {
  document.getElementById("prod-in-stock").value = isInStock ? "true" : "false";
  const inBtn = document.getElementById("prod-stock-in-btn");
  const outBtn = document.getElementById("prod-stock-out-btn");
  if (!inBtn || !outBtn) return;
  if (isInStock) {
    inBtn.className = "btn btn-sm";
    inBtn.style.cssText =
      "background:#2e7d32;color:#fff;border:1.5px solid #2e7d32;";
    outBtn.className = "btn btn-sm btn-outline-secondary";
    outBtn.style.cssText = "";
  } else {
    outBtn.className = "btn btn-sm";
    outBtn.style.cssText =
      "background:#c0392b;color:#fff;border:1.5px solid #c0392b;";
    inBtn.className = "btn btn-sm btn-outline-secondary";
    inBtn.style.cssText = "";
  }
}

// ── Per-color Stock Status toggle (In Stock / Not in Stock) ──
function setColorStockToggle(ci, isInStock) {
  const card = document.querySelector(`.pf-color-card[data-color-idx="${ci}"]`);
  if (!card) return;
  const hiddenInput = card.querySelector(".color-in-stock");
  const inBtn = card.querySelector(".color-stock-in-btn");
  const outBtn = card.querySelector(".color-stock-out-btn");
  if (hiddenInput) hiddenInput.value = isInStock ? "true" : "false";
  if (!inBtn || !outBtn) return;
  if (isInStock) {
    inBtn.className = "btn btn-sm w-100 color-stock-in-btn";
    inBtn.style.cssText =
      "background:#2e7d32;color:#fff;border:1.5px solid #2e7d32;font-size:0.72rem;padding:0.35rem 0.3rem;";
    outBtn.className =
      "btn btn-sm w-100 btn-outline-secondary color-stock-out-btn mt-1";
    outBtn.style.cssText = "font-size:0.72rem;padding:0.35rem 0.3rem;";
  } else {
    outBtn.className = "btn btn-sm w-100 color-stock-out-btn mt-1";
    outBtn.style.cssText =
      "background:#c0392b;color:#fff;border:1.5px solid #c0392b;font-size:0.72rem;padding:0.35rem 0.3rem;";
    inBtn.className = "btn btn-sm w-100 color-stock-in-btn";
    inBtn.style.cssText = "font-size:0.72rem;padding:0.35rem 0.3rem;";
  }
}

function addColorRow() {
  const container = document.getElementById("colors-container");
  const ci = colorIndex++;
  const card = document.createElement("div");
  card.className = "pf-color-card";
  card.dataset.colorIdx = ci;
  card.innerHTML = `
    <div class="pf-color-header">
      <span class="pf-color-title"><i class="bi bi-tag-fill me-1" style="font-size:0.65rem;"></i> Variant</span>
      <button type="button" class="btn btn-sm btn-outline-danger px-2 py-1" style="font-size:0.75rem;" onclick="this.closest('.pf-color-card').remove()">
        <i class="bi bi-trash"></i> Remove
      </button>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-7">
        <label class="form-label mb-1" style="font-size:0.75rem;font-weight:700;">Variant Name</label>
        <input type="text" class="form-control form-control-sm color-name" placeholder="e.g. Large, Style A, Set of 2" />
      </div>
      <div class="col-5">
        <label class="form-label mb-1" style="font-size:0.75rem;font-weight:700;">Stock</label>
        <input type="hidden" class="color-in-stock" value="true" />
        <div class="d-flex gap-1">
          <button type="button" class="btn btn-sm flex-fill color-stock-in-btn" style="background:#2e7d32;color:#fff;border:1.5px solid #2e7d32;font-size:0.72rem;padding:0.35rem 0.3rem;" onclick="setColorStockToggle(${ci}, true)">
            <i class="bi bi-check-circle-fill"></i> In Stock
          </button>
          <button type="button" class="btn btn-sm flex-fill btn-outline-secondary color-stock-out-btn" style="font-size:0.72rem;padding:0.35rem 0.3rem;" onclick="setColorStockToggle(${ci}, false)">
            <i class="bi bi-x-circle"></i> Not in Stock
          </button>
        </div>
      </div>
    </div>
    <div style="font-size:0.75rem;font-weight:700;color:var(--ink-soft);margin-bottom:6px;">
      <i class="bi bi-image me-1" style="color:var(--pink-primary)"></i> Variant Photo
      <span style="font-weight:400;color:var(--ink-soft);">— shown to customers when they pick this variant</span>
    </div>
    <div class="pf-color-images" id="color-imgs-${ci}"></div>
  `;
  container.appendChild(card);
  addVariantImageSlot(ci); // exactly one photo slot per variant
}

function addVariantImageSlot(ci, existingUrl) {
  const imgList = document.getElementById(`color-imgs-${ci}`);
  if (!imgList) return;
  imgList.innerHTML = ""; // only one slot per variant
  const slot = document.createElement("div");
  slot.className = "pf-color-img-slot" + (existingUrl ? " has-img" : "");
  if (existingUrl) slot.dataset.existingUrl = existingUrl;
  slot.innerHTML = `
    <input type="file" accept="image/*" onchange="handleColorImgChange(this)" />
    <img class="pf-img-preview" src="${existingUrl || ""}" />
    <div class="pf-img-placeholder">
      <i class="bi bi-plus fs-6"></i>
      <span>Photo</span>
    </div>
  `;
  imgList.appendChild(slot);
}

function handleColorImgChange(input) {
  const slot = input.closest(".pf-color-img-slot");
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      slot.querySelector(".pf-img-preview").src = e.target.result;
      slot.classList.add("has-img");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function getColorsData() {
  const cards = document.querySelectorAll(".pf-color-card");
  const colors = [];
  cards.forEach((card) => {
    const name = card.querySelector(".color-name")?.value.trim() || "";
    const in_stock = card.querySelector(".color-in-stock")?.value !== "false";
    const client_key = card.dataset.colorIdx;
    const imgSlot = card.querySelector(".pf-color-img-slot");
    const existing_image_url = imgSlot?.dataset.existingUrl || null;
    if (name) {
      colors.push({ name, in_stock, client_key, existing_image_url });
    }
  });
  return colors;
}

function getVariantImageFiles() {
  // Returns array of {client_key, file} — one photo per variant card, only
  // included when the admin actually picked a new file for that slot.
  const cards = document.querySelectorAll(".pf-color-card");
  const result = [];
  cards.forEach((card) => {
    const ci = card.dataset.colorIdx;
    const input = card.querySelector(".pf-color-img-slot input[type=file]");
    if (input && input.files[0]) {
      result.push({ client_key: ci, file: input.files[0] });
    }
  });
  return result;
}

// ----------------------------------------------------------
// Edit Order Price Function
// ----------------------------------------------------------

// ----------------------------------------------------------
// 1. Login Handling
// ----------------------------------------------------------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("login-user").value;
  const password = document.getElementById("login-pass").value;
  const btn = e.target.querySelector("button[type=submit]");

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Verifying...`;

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("adminToken", data.token);
      showToast(
        "success",
        "Welcome back!",
        "You are now logged in to the admin portal.",
      );
      setTimeout(() => showDashboard(), 600);
    } else {
      showToast(
        "error",
        "Login Failed",
        data.error || "Invalid credentials. Please try again.",
      );
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>Access Admin Portal`;
    }
  } catch (err) {
    showToast(
      "error",
      "Connection Error",
      "Could not reach the server. Please check your network.",
    );
    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>Access Admin Portal`;
  }
});

function logoutAdmin() {
  localStorage.removeItem("adminToken");
  location.reload();
}

// ----------------------------------------------------------
// Show Dashboard after login
// ----------------------------------------------------------
function showDashboard() {
  document.getElementById("login-box").style.display = "none";
  document.getElementById("admin-dashboard").style.display = "block";
  fetchAdminProducts();
  // Orders data/module now loads lazily — see loadOrdersModule(), triggered
  // by toggleOrdersMenu() the first time the admin opens Orders.
}

// ----------------------------------------------------------
// 2. Fetch Inventory for Admin View
// ----------------------------------------------------------
// Filter admin products (with search query & debouncing)
let adminSearchTimeout;
function filterAdminProducts() {
  clearTimeout(adminSearchTimeout);
  // Read from whichever search input has a value (both panes are synced)
  const q1 = document.getElementById("admin-search-input");
  const q2 = document.getElementById("inv-search-input");
  const query = (q1 && q1.value) || (q2 && q2.value) || "";
  adminSearchTimeout = setTimeout(() => {
    fetchAdminProducts(query);
  }, 250);
}

async function fetchAdminProducts(searchQuery = "") {
  const containers = [
    document.getElementById("admin-products-preview"),
    document.getElementById("inv-products-preview"),
  ].filter(Boolean);

  const skeletonHTML = `
    <div class="skeleton-item"><div class="skel-img"></div><div class="skel-grow"><div class="skel-line w-60"></div><div class="skel-line w-40"></div></div></div>
    <div class="skeleton-item"><div class="skel-img"></div><div class="skel-grow"><div class="skel-line w-60"></div><div class="skel-line w-40"></div></div></div>
  `;
  containers.forEach((c) => (c.innerHTML = skeletonHTML));

  try {
    const url = searchQuery
      ? `/api/products?search=${encodeURIComponent(searchQuery)}`
      : "/api/products";
    const response = await fetch(url);
    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      const emptyHTML = searchQuery
        ? `<div class="empty-state"><div class="icon"><i class="bi bi-search"></i></div><h6>No products match your search.</h6><p>Try checking the spelling or use different keywords.</p></div>`
        : `<div class="empty-state"><div class="icon"><i class="bi bi-box-seam"></i></div><h6>There are no products to display.</h6><p>Add your first product using the form on the left.</p></div>`;
      containers.forEach((c) => (c.innerHTML = emptyHTML));
      return;
    }

    const items = products.map((prod, i) => {
      const imgPath = prod.image_url
        ? prod.image_url
        : generatePlaceholder(prod.name);
      const isInStock = prod.in_stock !== false;
      const stockLabel = isInStock ? "In Stock" : "Out of Stock";
      const stockColor = isInStock ? "#2e7d32" : "#b3261e";

      const item = document.createElement("div");
      item.className = "inventory-item fade-in";
      item.style.animationDelay = `${Math.min(i * 0.07, 0.35)}s`;
      item.innerHTML = `
        <img src="${escapeHtml(imgPath)}" class="inventory-img" onerror="this.src='${generatePlaceholder(prod.name)}'" alt="${escapeHtml(prod.name)}" />
        <div style="flex:1; min-width:0;">
          <p class="inventory-name">${escapeHtml(prod.name)}</p>
          <div class="inventory-meta">
            <span class="price">Rs. ${Number(prod.price).toLocaleString("en-PK")}</span>
            &nbsp;&bull;&nbsp;
            <span style="color:${stockColor}">${stockLabel}</span>
          </div>
        </div>
        <div class="d-flex gap-1">
          <button type="button" class="btn btn-sm btn-outline-secondary border-0 text-warning" onclick="triggerEditState(${prod.id})">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary border-0 text-danger" onclick="deleteProductItem(${prod.id})">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      `;
      return item;
    });

    containers.forEach((c) => {
      c.innerHTML = "";
      items.forEach((item) => c.appendChild(item.cloneNode(true)));
    });
  } catch (err) {
    console.error("Admin inventory load failed:", err);
    containers.forEach(
      (c) =>
        (c.innerHTML = `<div class="empty-state"><div class="icon"><i class="bi bi-wifi-off"></i></div><h6>Load nahi ho saka</h6></div>`),
    );
  }
}
// Helper to build recursive category tree hierarchy
function buildCategoryTree(categories, parentId = null, depth = 0) {
  let result = [];
  categories
    .filter((cat) => cat.parent_id === parentId)
    .forEach((cat) => {
      result.push({
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        depth: depth,
      });
      const children = buildCategoryTree(categories, cat.id, depth + 1);
      result = result.concat(children);
    });
  return result;
}

async function loadCategories() {
  try {
    const res = await fetch("/api/categories");
    const categories = await res.json();

    // Build recursive tree structure starting with top-level categories (parent_id = null)
    const tree = buildCategoryTree(categories, null, 0);

    // 1. Populate Product Category dropdown
    const prodSelect = document.getElementById("prod-category");
    if (prodSelect) {
      prodSelect.innerHTML = '<option value="">Select Category</option>';
      tree.forEach((cat) => {
        const prefix = "— ".repeat(cat.depth);
        prodSelect.innerHTML += `<option value="${cat.id}">${prefix}${escapeHtml(cat.name)}</option>`;
      });
    }

    // 2. Populate Parent Category dropdown
    const catParentSelect = document.getElementById("cat-parent");
    if (catParentSelect) {
      catParentSelect.innerHTML =
        '<option value="">None (Top-Level Category)</option>';
      tree.forEach((cat) => {
        const prefix = "— ".repeat(cat.depth);
        catParentSelect.innerHTML += `<option value="${cat.id}">${prefix}${escapeHtml(cat.name)}</option>`;
      });
    }

    // 3. Populate Delete Category dropdown
    const deleteCatSelect = document.getElementById("delete-cat-select");
    if (deleteCatSelect) {
      deleteCatSelect.innerHTML =
        '<option value="">-- Select Category --</option>';
      tree.forEach((cat) => {
        const prefix = "— ".repeat(cat.depth);
        deleteCatSelect.innerHTML += `<option value="${cat.id}">${prefix}${escapeHtml(cat.name)}</option>`;
      });
    }

    // 4. Populate Edit/Rename Category dropdown
    const editCatSelect = document.getElementById("edit-cat-select");
    if (editCatSelect) {
      editCatSelect.innerHTML =
        '<option value="">-- Select Category --</option>';
      tree.forEach((cat) => {
        const prefix = "— ".repeat(cat.depth);
        editCatSelect.innerHTML += `<option value="${cat.id}">${prefix}${escapeHtml(cat.name)}</option>`;
      });
    }
  } catch (err) {
    console.error("Failed to load categories:", err);
  }
}

loadCategories();

// Add Category Form Handler
const categoryForm = document.getElementById("admin-category-form");
if (categoryForm) {
  categoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("cat-name").value;
    const parent_id = document.getElementById("cat-parent").value;
    const submitBtn = e.target.querySelector("button[type='submit']");

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          parent_id: parent_id ? Number(parent_id) : null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        showToast("success", "Success!", "Category added successfully!");
        categoryForm.reset();
        await loadCategories(); // Refresh both dropdowns
      } else {
        showToast("error", "Error", data.error || "Failed to save category.");
      }
    } catch (err) {
      showToast("error", "Connection failed", "Server refused transaction.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i class="bi bi-plus-circle-fill me-2"></i>Add Category`;
    }
  });
}

// ── Rename/Edit Category ──
async function renameCategory() {
  const select = document.getElementById("edit-cat-select");
  const nameInput = document.getElementById("edit-cat-name");
  const catId = select ? select.value : "";
  const newName = nameInput ? nameInput.value.trim() : "";

  if (!catId) {
    showToast("error", "No Selection", "Please select a category to rename.");
    return;
  }
  if (!newName) {
    showToast("error", "Empty Name", "Please enter a new name.");
    return;
  }

  const btn = document.querySelector('[onclick="renameCategory()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;
  }

  try {
    const res = await fetch(`/api/categories/${catId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("success", "Renamed!", data.message);
      if (nameInput) nameInput.value = "";
      await loadCategories();
    } else {
      showToast("error", "Failed", data.error || "Could not rename category.");
    }
  } catch (err) {
    showToast("error", "Connection Error", "Server refused the request.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-pencil-fill me-2"></i>Rename Category`;
    }
  }
}

async function deleteCategory() {
  const select = document.getElementById("delete-cat-select");
  const catId = select ? select.value : "";
  const catName = select ? select.options[select.selectedIndex]?.text : "";

  if (!catId) {
    showToast("error", "No Selection", "Please select a category to delete.");
    return;
  }

  const confirmed = confirm(
    `Are you sure you want to delete "${catName}"?\nAll sub-categories will also be removed. This cannot be undone.`,
  );
  if (!confirmed) return;

  const btn = document.querySelector('[onclick="deleteCategory()"]');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Deleting...`;
  }

  try {
    const response = await fetch(`/api/categories/${catId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (response.ok) {
      showToast("success", "Deleted!", `"${catName}" has been removed.`);
      await loadCategories();
    } else {
      showToast("error", "Failed", data.error || "Could not delete category.");
    }
  } catch (err) {
    showToast("error", "Connection Error", "Server refused the request.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="bi bi-trash3-fill me-2"></i>Delete Category`;
    }
  }
}

async function triggerEditState(productId) {
  showToast("info", "Loading...", "Fetching product details.");

  try {
    // Fetch full product details including colors and images
    const [prodRes, allRes] = await Promise.all([
      fetch(`/api/products/product/${productId}`),
      fetch(`/api/products`),
    ]);
    const prod = await prodRes.json();
    const allProds = await allRes.json();
    const fullProd =
      allProds.find((p) => String(p.id) === String(productId)) || prod;

    // Basic fields
    // Fresh edit session — clear any deletions tracked from a previous edit
    deletedImageUrls = [];

    document.getElementById("edit-product-id").value = productId;
    document.getElementById("prod-name").value = prod.name || "";
    document.getElementById("prod-desc").value = prod.description || "";
    document.getElementById("prod-price").value = prod.price || "";
    setProductStockToggle(prod.in_stock !== false);
    document.getElementById("prod-keywords").value = prod.keywords || "";

    // Dimensions
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };
    setVal("prod-length", prod.length);
    setVal("prod-width", prod.width);
    setVal("prod-height", prod.height);
    setVal("prod-weight", prod.weight);

    // Category
    const catSel = document.getElementById("prod-category");
    if (catSel && prod.category_id) catSel.value = prod.category_id;

    // Existing images — show as previews in slots
    const mainList = document.getElementById("main-images-list");
    if (mainList) {
      mainList.innerHTML = "";
      const imgs = fullProd.images || (prod.image_url ? [prod.image_url] : []);
      imgs.forEach((url) => addMainImageSlot(url));
    }

    // Existing colors — populate color cards
    const colorContainer = document.getElementById("colors-container");
    if (colorContainer) {
      colorContainer.innerHTML = "";
      colorIndex = 0;
      (fullProd.colors || []).forEach((color) => {
        addColorRow();
        const lastCard = colorContainer.lastElementChild;
        if (!lastCard) return;
        const nameInput = lastCard.querySelector(".color-name");
        const ci = lastCard.dataset.colorIdx;
        if (nameInput) nameInput.value = color.color_name || "";
        setColorStockToggle(ci, color.in_stock !== false);
        if (color.image_url) addVariantImageSlot(ci, color.image_url);
      });
    }

    // UI update
    document.getElementById("form-panel-title").innerText = "Modify Product";
    document.getElementById("form-title-text").innerText =
      "Edit Current Product";
    document.getElementById("upload-btn").innerHTML =
      `<i class="bi bi-save-fill me-2"></i>Save Modifications`;
    document.getElementById("cancel-edit-btn").style.display = "block";
    document.getElementById("form-header-bg").style.background =
      "linear-gradient(135deg, #ffd93d, #ad0a69)";

    // Jump to the Add/Edit Product pane so the admin actually sees the
    // filled-in form (Inventory and the form now live in separate panes).
    const addProductLink = document.getElementById("nav-add-product");
    if (addProductLink)
      switchQuickManagePane("add-product-pane", addProductLink);

    window.scrollTo({ top: 0, behavior: "smooth" });
    showToast("success", "Ready to Edit", `"${prod.name}" details loaded.`);
  } catch (err) {
    console.error("Edit load error:", err);
    showToast("error", "Failed", "Could not load product details.");
  }
}

function clearEditState() {
  document.getElementById("admin-product-form").reset();
  document.getElementById("edit-product-id").value = "";

  // Reset tracked image deletions
  deletedImageUrls = [];

  // Reset stock status toggle to default (In Stock)
  setProductStockToggle(true);

  // Reset main images
  const mainList = document.getElementById("main-images-list");
  if (mainList) mainList.innerHTML = "";

  // Reset colors
  const container = document.getElementById("colors-container");
  if (container) container.innerHTML = "";
  colorIndex = 0;

  const searchInput = document.getElementById("admin-search-input");
  if (searchInput) searchInput.value = "";
  const invSearchInput = document.getElementById("inv-search-input");
  if (invSearchInput) invSearchInput.value = "";

  document.getElementById("form-panel-title")?.innerText &&
    (document.getElementById("form-panel-title").innerText = "Add Product");
  document.getElementById("form-title-text").innerText = "New Product";
  document.getElementById("upload-btn").innerHTML =
    `<i class="bi bi-rocket-takeoff-fill me-2"></i>Upload & Go Live`;
  document.getElementById("cancel-edit-btn").style.display = "none";
  document.getElementById("form-header-bg").style.background = "";
}

async function deleteProductItem(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (data.archived) {
        showToast(
          "success",
          "Archived",
          data.message ||
            "Product has order history, so it was hidden instead of deleted.",
        );
      } else {
        showToast("success", "Removed", "Item purged from database catalog.");
      }
      fetchAdminProducts();
    } else {
      showToast(
        "error",
        "Error",
        data.details || data.error || "Could not remove selected item.",
      );
    }
  } catch (err) {
    showToast("error", "Connection failed", "Cannot execute delete target.");
  }
}
