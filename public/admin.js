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

function addColorRow() {
  const container = document.getElementById("colors-container");
  const ci = colorIndex++;
  const card = document.createElement("div");
  card.className = "pf-color-card";
  card.dataset.colorIdx = ci;
  card.innerHTML = `
    <div class="pf-color-header">
      <span class="pf-color-title"><i class="bi bi-circle-fill me-1" style="font-size:0.65rem;"></i> Color Variant</span>
      <button type="button" class="btn btn-sm btn-outline-danger px-2 py-1" style="font-size:0.75rem;" onclick="this.closest('.pf-color-card').remove()">
        <i class="bi bi-trash"></i> Remove
      </button>
    </div>
    <div class="row g-2 mb-3">
      <div class="col-5">
        <label class="form-label mb-1" style="font-size:0.75rem;font-weight:700;">Color Name</label>
        <input type="text" class="form-control form-control-sm color-name" placeholder="e.g. Red, Blue, Pink" />
      </div>
      <div class="col-3">
        <label class="form-label mb-1" style="font-size:0.75rem;font-weight:700;">Color</label>
        <input type="color" class="form-control form-control-sm color-code" value="#e0218a" style="height:38px;padding:3px;" />
      </div>
      <div class="col-4">
        <label class="form-label mb-1" style="font-size:0.75rem;font-weight:700;">Stock Qty</label>
        <input type="number" class="form-control form-control-sm color-stock" placeholder="0" min="0" />
      </div>
    </div>
    <div style="font-size:0.75rem;font-weight:700;color:var(--ink-soft);margin-bottom:6px;">
      <i class="bi bi-images me-1" style="color:var(--pink-primary)"></i> Images for this color
    </div>
    <div class="pf-color-images" id="color-imgs-${ci}"></div>
    <button type="button" class="pf-add-cimg-btn mt-2" onclick="addColorImageSlot(${ci})">
      <i class="bi bi-plus"></i> Add Image
    </button>
  `;
  container.appendChild(card);
  addColorImageSlot(ci); // auto-add first slot
}

function addColorImageSlot(ci, existingUrl) {
  const imgList = document.getElementById(`color-imgs-${ci}`);
  if (!imgList) return;
  const slot = document.createElement("div");
  slot.className = "pf-color-img-slot" + (existingUrl ? " has-img" : "");
  slot.innerHTML = `
    <input type="file" accept="image/*" onchange="handleColorImgChange(this)" />
    <img class="pf-img-preview" src="${existingUrl || ""}" />
    <div class="pf-img-placeholder">
      <i class="bi bi-plus fs-6"></i>
      <span>Image</span>
    </div>
    <button type="button" class="pf-del-img" onclick="removeImgSlot(this)" title="Remove">
      <i class="bi bi-x"></i>
    </button>
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
    const code = card.querySelector(".color-code")?.value || "#000000";
    const stock = parseInt(card.querySelector(".color-stock")?.value) || 0;
    if (name) {
      colors.push({ name, code, stock });
    }
  });
  return colors;
}

function getColorImagesData() {
  // Returns array of {colorIndex, files[]} for each color card
  const cards = document.querySelectorAll(".pf-color-card");
  const result = [];
  cards.forEach((card, i) => {
    const ci = card.dataset.colorIdx;
    const imgList = document.getElementById(`color-imgs-${ci}`);
    if (!imgList) return;
    const slots = imgList.querySelectorAll(
      ".pf-color-img-slot input[type=file]",
    );
    const files = [];
    slots.forEach((inp) => {
      if (inp.files[0]) files.push(inp.files[0]);
    });
    const name = card.querySelector(".color-name")?.value.trim() || "";
    if (name) result.push({ colorName: name, files });
  });
  return result;
}

// ----------------------------------------------------------
// Edit Order Price Function
// ----------------------------------------------------------
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
  fetchAdminOrders();
  fetchPaymentVerifications();
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
      const stockQty = Number(prod.stock) || 0;
      const stockLabel =
        stockQty <= 0
          ? "Out of Stock"
          : stockQty <= 5
            ? `Only ${stockQty} left`
            : `Stock: ${stockQty}`;
      const stockColor =
        stockQty <= 0
          ? "#b3261e"
          : stockQty <= 5
            ? "#946d00"
            : "var(--ink-soft)";

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
    document.getElementById("prod-stock").value = prod.stock || "";
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
        const codeInput = lastCard.querySelector(".color-code");
        const stockInput = lastCard.querySelector(".color-stock");
        if (nameInput) nameInput.value = color.color_name || "";
        if (codeInput) codeInput.value = color.color_code || "#e0218a";
        if (stockInput) stockInput.value = color.stock ?? 0;
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

// ... (up ka sara code same rahega)

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
    formData.append("stock", document.getElementById("prod-stock").value);
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

    // Colors data + per-color images
    const colors = getColorsData();
    formData.append("colors", JSON.stringify(colors));
    const colorImagesData = getColorImagesData();
    colorImagesData.forEach(({ colorName, files }) => {
      files.forEach((file) => {
        formData.append(`colorImages_${colorName}`, file);
      });
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
