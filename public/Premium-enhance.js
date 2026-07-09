/* =========================================================================
   SA PARTIES — PREMIUM ENHANCEMENT LAYER (behavior)
   Purely additive: page loader, custom cursor, scroll reveal, scroll
   progress, magnetic/ripple buttons, hero line reveal, subtle particles.
   Never touches cart/checkout/auth logic or app.js internals.
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- 0. Page loader ---------- */
  function initLoader() {
    document.body.classList.add("sa-loading");
    const loader = document.createElement("div");
    loader.id = "sa-loader";
    const logoSrc =
      document.querySelector(".brand-logo-img")?.getAttribute("src") ||
      "assets/logo.jpg";
    loader.innerHTML = `
      <div class="sa-loader-inner">
        <div class="sa-loader-ring-wrap">
          <div class="sa-loader-ring"></div>
          <div class="sa-loader-ring sa-ring-2"></div>
          <div class="sa-loader-logo-clip"><img src="${logoSrc}" alt="" onerror="this.parentElement.style.display='none'"/></div>
        </div>
        <div class="sa-loader-word">SA Parties</div>
      </div>`;
    document.body.prepend(loader);

    const hide = () => {
      loader.classList.add("sa-loader-hidden");
      document.body.classList.remove("sa-loading");
      setTimeout(() => loader.remove(), 900);
    };
    const minTime = new Promise((r) => setTimeout(r, 650));
    const domReady = new Promise((r) => {
      if (document.readyState === "complete") r();
      else window.addEventListener("load", r, { once: true });
    });
    Promise.all([minTime, domReady]).then(hide);
    // Safety net in case load never fires
    setTimeout(hide, 3500);
  }

  /* ---------- 1. Scroll progress bar ---------- */
  function initScrollProgress() {
    const bar = document.createElement("div");
    bar.id = "sa-scroll-progress";
    document.body.appendChild(bar);
    const update = () => {
      const h = document.documentElement;
      const scrolled = h.scrollTop || document.body.scrollTop;
      const height =
        (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
      const pct = height > 0 ? (scrolled / height) * 100 : 0;
      bar.style.width = pct + "%";
    };
    document.addEventListener("scroll", update, { passive: true });
    update();
  }

  /* ---------- 2. Custom luxury cursor (desktop only) ---------- */
  function initCursor() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches)
      return;
    const dot = document.createElement("div");
    dot.id = "sa-cursor-dot";
    const ring = document.createElement("div");
    ring.id = "sa-cursor-ring";
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add("sa-cursor-ready");

    let rx = 0,
      ry = 0,
      tx = 0,
      ty = 0;
    window.addEventListener(
      "mousemove",
      (e) => {
        dot.style.left = e.clientX + "px";
        dot.style.top = e.clientY + "px";
        tx = e.clientX;
        ty = e.clientY;
      },
      { passive: true },
    );
    (function loop() {
      rx += (tx - rx) * 0.18;
      ry += (ty - ry) * 0.18;
      ring.style.left = rx + "px";
      ring.style.top = ry + "px";
      requestAnimationFrame(loop);
    })();

    const hoverSelector =
      "a, button, input, select, textarea, .product-card-modern, .category-card, [role='button']";
    document.addEventListener("mouseover", (e) => {
      if (e.target.closest(hoverSelector))
        document.body.classList.add("sa-cursor-hover");
    });
    document.addEventListener("mouseout", (e) => {
      if (e.target.closest(hoverSelector))
        document.body.classList.remove("sa-cursor-hover");
    });
  }

  /* ---------- 3. Scroll reveal (adds .sa-reveal treatment on top of any existing .reveal) ---------- */
  function initScrollReveal() {
    const targets = document.querySelectorAll(
      ".reveal, .sa-reveal, .product-card-modern, .category-card, .section-title, .section-subtitle",
    );
    targets.forEach((el, i) => {
      if (!el.classList.contains("sa-reveal")) el.classList.add("sa-reveal");
      if (!el.hasAttribute("data-sa-delay")) {
        el.setAttribute("data-sa-delay", String((i % 5) + 1));
      }
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sa-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll(".sa-reveal").forEach((el) => io.observe(el));
  }

  /* ---------- 4. Button ripple ---------- */
  function initRipple() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(
        ".btn-add, .btn-primary, .hero-cta-group a.btn, [class*='btn-buy'], .btn-checkout, .btn-place-order",
      );
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "sa-ripple";
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";
      const prevPos = getComputedStyle(btn).position;
      if (prevPos === "static") btn.style.position = "relative";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  }

  /* ---------- 5. Hero line-by-line reveal ---------- */
  function initHeroLines() {
    const title = document.querySelector(".hero-title");
    if (!title || title.dataset.saSplit) return;
    title.dataset.saSplit = "1";
    const lines = title.innerHTML.split(/<br\s*\/?>/i);
    if (lines.length < 2) return;
    title.innerHTML = lines
      .map(
        (line, i) =>
          `<span class="sa-hero-line"><span style="animation-delay:${0.15 + i * 0.14}s">${line}</span></span>`,
      )
      .join("");
  }

  /* ---------- 6. Subtle floating particles in hero ---------- */
  function initParticles() {
    const hero = document.querySelector(".hero-sa");
    if (!hero) return;
    const canvas = document.createElement("canvas");
    canvas.id = "sa-particles";
    hero.style.position = hero.style.position || "relative";
    hero.prepend(canvas);
    const ctx = canvas.getContext("2d");
    let w, h, particles;

    function resize() {
      w = canvas.width = hero.offsetWidth;
      h = canvas.height = hero.offsetHeight;
    }
    function makeParticles() {
      const count = Math.min(36, Math.floor((w * h) / 34000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.2,
        vy: 0.15 + Math.random() * 0.35,
        vx: (Math.random() - 0.5) * 0.2,
        o: 0.15 + Math.random() * 0.35,
        gold: Math.random() < 0.25,
      }));
    }
    function tick() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.y -= p.vy;
        p.x += p.vx;
        if (p.y < -10) p.y = h + 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold
          ? `rgba(212,164,55,${p.o})`
          : `rgba(255,255,255,${p.o})`;
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    resize();
    makeParticles();
    tick();
    window.addEventListener("resize", () => {
      resize();
      makeParticles();
    });
  }

  /* ---------- 7. Wave divider before footer ---------- */
  function initWaveDivider() {
    const footer = document.querySelector(".footer-sa, .footer-shop");
    if (!footer || footer.dataset.saWave) return;
    footer.dataset.saWave = "1";
    const wave = document.createElement("div");
    wave.innerHTML = `
      <svg class="sa-wave-divider" viewBox="0 0 1440 80" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,40 C240,90 480,0 720,30 C960,60 1200,10 1440,40 L1440,80 L0,80 Z"></path>
      </svg>`;
    footer.parentNode.insertBefore(wave.firstElementChild, footer);
  }

 function boot() {
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    initLoader();
    initScrollProgress();
    if (!isTouchDevice) {
      initCursor();      // custom cursor sirf desktop/mouse devices par
      initParticles();   // particles bhi mobile par flicker/glitch karte the, isliye skip
    }
    initRipple();
    initHeroLines();
    initWaveDivider();
    initScrollReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
