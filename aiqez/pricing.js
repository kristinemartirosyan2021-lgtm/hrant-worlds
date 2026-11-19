/*
 * Գների կանոններ (կայքի էջի համար)։
 * Գներն իրենք config.js-ում են (services[].packages)։
 *
 *  price: 15000                → «15 000 ֏»
 *  price: null                 → «Արժեքը ճշտել» (ընդունվում է հայտ)
 *  validUntil: "…+04:00"       → գինը գործում է մինչև այդ պահը (Երևանի ժամով),
 *                                հետո ցույց է տրվում expiredLabel-ը
 */
(function () {
  "use strict";

  var NO_PRICE = "Արժեքը ճշտել";

  function formatAmount(amount, currency) {
    return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " " + (currency || "֏");
  }

  // Գործող գինը կամ null (գին չկա կամ ակցիան ավարտվել է)
  function activePrice(pkg, now) {
    if (!pkg || typeof pkg.price !== "number" || !isFinite(pkg.price) || pkg.price <= 0) return null;
    if (pkg.validUntil) {
      var until = Date.parse(pkg.validUntil);
      var t = (now || new Date()).getTime();
      if (!isFinite(until) || t > until) return null;
    }
    return pkg.price;
  }

  function isExpired(pkg, now) {
    return Boolean(pkg && pkg.validUntil && typeof pkg.price === "number" && activePrice(pkg, now) === null);
  }

  function priceLabel(pkg, now, currency) {
    var p = activePrice(pkg, now);
    if (p !== null) return formatAmount(p, currency);
    return isExpired(pkg, now) ? (pkg.expiredLabel || NO_PRICE) : NO_PRICE;
  }

  function findService(cfg, serviceId) {
    return (cfg.services || []).filter(function (s) { return s.id === serviceId; })[0] || null;
  }

  function findPackage(service, packageId) {
    if (!service) return null;
    return (service.packages || []).filter(function (p) { return p.id === packageId; })[0] || null;
  }

  // Քարտի համար՝ «սկսած 15 000 ֏», «10 000 ֏» կամ «Արժեքը ճշտել»
  function serviceFromLabel(service, now, currency) {
    var pkgs = (service && service.packages) || [];
    var prices = pkgs.map(function (p) { return activePrice(p, now); }).filter(function (p) { return p !== null; });
    if (!prices.length) {
      var expired = pkgs.filter(function (p) { return isExpired(p, now); })[0];
      return expired ? (expired.expiredLabel || NO_PRICE) : NO_PRICE;
    }
    var min = Math.min.apply(null, prices);
    return (pkgs.length > 1 ? "սկսած " : "") + formatAmount(min, currency);
  }

  var api = {
    NO_PRICE: NO_PRICE,
    formatAmount: formatAmount,
    activePrice: activePrice,
    isExpired: isExpired,
    priceLabel: priceLabel,
    findService: findService,
    findPackage: findPackage,
    serviceFromLabel: serviceFromLabel
  };

  if (typeof window !== "undefined") window.AIQEZ_PRICING = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
