# TODO - SA Parties UI/UX redesign

- [ ] Backup current `public/index.html` (copy to `public/index.backup.html`)
- [ ] Rewrite `public/index.html` with a modern premium layout:
  - [ ] Hero section (pink professional gradients, balloons/confetti visuals, animations)
  - [ ] Header/nav links + cart icon with count
  - [ ] Product cards modern grid (kept compatible with existing JS IDs)
  - [ ] Homepage sections: Featured, Best Sellers, Birthday Decorations, Balloons Collection, New Arrivals, Customer Reviews, FAQ
  - [ ] Checkout section (sticky card, trust badges, secure indicators) preserving required IDs used by `public/app.js`
  - [ ] Trust bar (COD / Fast Delivery / Secure Payments / Satisfaction)
  - [ ] Confetti burst on logo click
  - [ ] Reveal-on-scroll and smooth hover effects + respect `prefers-reduced-motion`
  - [ ] Remove/hide admin panel entry points from customer UI (keep `public/admin.html` separate)
  - [ ] Mobile-first responsive spacing
- [ ] Update `public/app.js` only if required to match new DOM IDs (otherwise keep it untouched)
- [ ] Run quick sanity check in browser: cart badge updates, checkout submits, products load
