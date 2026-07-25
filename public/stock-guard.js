(function () {
  "use strict";

  // ── In-memory stock cache: productId -> stock qty ──
  const stockCache = new Map();

  // ── Fetch fresh stock for a product from backend ──
  // Accepts either the new { in_stock: boolean } shape or the old
  // { stock: number } shape, and normalizes to a boolean.
  async function fetchStock(productId) {
    try {
      const res = await fetch(`/api/orders/stock/${productId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const inStock =
        data.in_stock !== undefined
          ? data.in_stock !== false
          : Number(data.stock) > 0;
      stockCache.set(String(productId), inStock);
      return inStock;
    } catch (e) {
      return null;
    }
  }

  // ── Determine stock (boolean) from a product object of various shapes ──
  function getStockFromObj(obj) {
    if (!obj) return null;
    if (obj.in_stock !== undefined) return obj.in_stock !== false;
    if (obj.dataset && obj.dataset.inStock !== undefined)
      return obj.dataset.inStock !== "false";
    // Legacy numeric fallback, in case some card still carries it
    if (obj.stock !== undefined) return Number(obj.stock) > 0;
    if (obj.dataset && obj.dataset.stock !== undefined)
      return Number(obj.dataset.stock) > 0;
    return null;
  }

  // ── Apply Out-of-Stock visuals to a single product card ──
  function applyCardState(card) {
    const productId = card.dataset.productId || card.getAttribute("data-id");
    let inStock = null;
    if (card.dataset.inStock !== undefined) {
      inStock = card.dataset.inStock !== "false";
    } else if (card.dataset.stock !== undefined) {
      inStock = Number(card.dataset.stock) > 0; // legacy fallback
    } else {
      const stockEl = card.querySelector("[data-in-stock]");
      if (stockEl) inStock = stockEl.dataset.inStock !== "false";
    }

    if (inStock === null) return; // unknown — don't touch

    const imgWrap = card.querySelector(".img-wrap") || card;
    const addBtn = card.querySelector(
      ".btn-add, [data-action='add-to-cart'], [onclick*='addToCart']",
    );
    const buyBtn = card.querySelector(
      "[data-action='buy-now'], [onclick*='buyNow']",
    );

    // Remove any existing badge first (idempotent re-render safe)
    const existingBadge = card.querySelector(".soe-oos-badge");
    if (existingBadge) existingBadge.remove();
    card.classList.remove("soe-card-dimmed");
    [addBtn, buyBtn].forEach((btn) => {
      if (btn) {
        btn.classList.remove("soe-disabled-btn");
        btn.disabled = false;
      }
    });

    if (!inStock) {
      // Add Out of Stock badge
      const badge = document.createElement("span");
      badge.className = "soe-oos-badge";
      badge.textContent = "Out of Stock";
      if (imgWrap.style.position !== "relative")
        imgWrap.style.position = "relative";
      imgWrap.prepend(badge);
      card.classList.add("soe-card-dimmed");

      // Disable buttons
      [addBtn, buyBtn].forEach((btn) => {
        if (btn) {
          btn.classList.add("soe-disabled-btn");
          btn.disabled = true;
          btn.setAttribute("title", "This item is currently unavailable");
        }
      });
    }
  }

  // ── Scan and patch all visible product cards ──
  function scanProductCards() {
    const cards = document.querySelectorAll(
      "#shop-products-container .product-card-modern, .product-card-modern",
    );
    cards.forEach(applyCardState);
  }

  // ── Patch the product detail modal (color selection + add/buy) ──
  function patchDetailModal() {
    const modal = document.querySelector(
      "#product-detail-modal, .product-detail-modal, [id*='product-detail']",
    );
    if (!modal) return;

    const productId =
      modal.dataset.productId ||
      modal.querySelector("[data-product-id]")?.dataset.productId;
    if (!productId) return;

    const cachedStock = stockCache.get(String(productId));
    const applyDetailState = (inStock) => {
      const addBtn = modal.querySelector(
        ".btn-add, [data-action='add-to-cart'], [onclick*='addToCart']",
      );
      const buyBtn = modal.querySelector(
        "[data-action='buy-now'], [onclick*='buyNow']",
      );
      const colorSwatches = modal.querySelectorAll(
        ".color-swatch, [data-color-id], [class*='color-option']",
      );

      // Remove old banner
      const oldBanner = modal.querySelector(".soe-detail-oos-banner");
      if (oldBanner) oldBanner.remove();

      if (inStock === false) {
        // Insert banner above buttons
        const banner = document.createElement("div");
        banner.className = "soe-detail-oos-banner";
        banner.innerHTML =
          '<i class="bi bi-exclamation-circle-fill"></i> This item is currently unavailable. Please check back later.';
        const anchor =
          addBtn || buyBtn || modal.querySelector(".modal-body, .card-body");
        if (anchor && anchor.parentNode) {
          anchor.parentNode.insertBefore(banner, anchor);
        }

        [addBtn, buyBtn].forEach((btn) => {
          if (btn) {
            btn.classList.add("soe-disabled-btn");
            btn.disabled = true;
          }
        });
        colorSwatches.forEach((sw) => sw.classList.add("soe-color-disabled"));
      } else {
        [addBtn, buyBtn].forEach((btn) => {
          if (btn) {
            btn.classList.remove("soe-disabled-btn");
            btn.disabled = false;
          }
        });
        colorSwatches.forEach((sw) =>
          sw.classList.remove("soe-color-disabled"),
        );
      }
    };

    if (cachedStock !== undefined) {
      applyDetailState(cachedStock);
    } else {
      fetchStock(productId).then(applyDetailState);
    }
  }

  // ── Validate before allowing add-to-cart / buy-now (capture phase) ──
  document.addEventListener(
    "click",
    async function (e) {
      const target = e.target.closest(
        ".btn-add, [data-action='add-to-cart'], [data-action='buy-now'], [onclick*='addToCart'], [onclick*='buyNow']",
      );
      if (!target) return;
      if (target.disabled || target.classList.contains("soe-disabled-btn")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (typeof showToast === "function") {
          showToast(
            "error",
            "Unavailable",
            "This item is currently out of stock.",
          );
        } else {
          alert("This item is currently out of stock.");
        }
        return;
      }

      // Re-validate against server before allowing add (covers race conditions)
      const card = target.closest(
        "[data-product-id], .product-card-modern, #product-detail-modal, .product-detail-modal",
      );
      const productId =
        card?.dataset?.productId ||
        card?.querySelector("[data-product-id]")?.dataset.productId;
      if (productId) {
        const freshStock = await fetchStock(productId);
        if (freshStock === false) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          applyCardState(card);
          patchDetailModal();
          if (typeof showToast === "function") {
            showToast(
              "error",
              "Just Sold Out",
              "This item just went out of stock.",
            );
          } else {
            alert("This item just went out of stock.");
          }
        }
      }
    },
    true, // capture phase — runs before app.js's own click handler
  );

  // ── Handle backend rejection responses for stock errors ──
  const origFetch2 = window.fetch;
  window.fetch = function (url, opts) {
    const callPromise = origFetch2.apply(this, arguments);
    if (
      typeof url === "string" &&
      url.includes("/api/orders") &&
      opts &&
      opts.method === "POST"
    ) {
      return callPromise.then((res) => {
        const clone = res.clone();
        clone
          .json()
          .then((data) => {
            if (!res.ok && (data.outOfStock || data.insufficientStock)) {
              if (typeof showToast === "function") {
                showToast("error", "Stock Issue", data.error);
              } else {
                alert(data.error);
              }
              // Refresh cards to reflect real stock
              scanProductCards();
            }
          })
          .catch(() => {});
        return res;
      });
    }
    return callPromise;
  };

  // ── Observe DOM mutations: re-apply rules whenever app.js re-renders ──
  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    let shouldPatchModal = false;
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (
          node.classList?.contains("product-card-modern") ||
          node.querySelector?.(".product-card-modern")
        ) {
          shouldScan = true;
        }
        if (
          node.id?.includes("product-detail") ||
          node.querySelector?.("[id*='product-detail']")
        ) {
          shouldPatchModal = true;
        }
      });
    });
    if (shouldScan) scanProductCards();
    if (shouldPatchModal) patchDetailModal();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // ── Initial scan + periodic refresh (catches stock changes from admin) ──
  document.addEventListener("DOMContentLoaded", () => {
    scanProductCards();
    setInterval(scanProductCards, 15000); // refresh every 15s
  });
})();
