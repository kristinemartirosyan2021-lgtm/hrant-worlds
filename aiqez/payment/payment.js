// Վճարման էջերի տրամաբանություն։ Կարգավիճակը միշտ վերցվում է սերվերից
// (payment-status), այլ ոչ թե URL-ի պարամետրերից։
(function () {
  "use strict";

  var page = document.body.getAttribute("data-page");
  var params = new URLSearchParams(location.search);
  var order = params.get("order") || "";
  var $ = function (id) { return document.getElementById(id); };
  var FN = "/.netlify/functions/";

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function details(rows) {
    var dl = $("pay-details");
    if (!dl) return;
    dl.innerHTML = "";
    rows.forEach(function (r) {
      if (!r[1]) return;
      dl.appendChild(el("dt", {}, r[0]));
      dl.appendChild(el("dd", {}, r[1]));
    });
    dl.hidden = false;
  }

  function setState(icon, cls, title, text) {
    var i = document.querySelector(".pay-icon");
    if (i) { i.textContent = icon; i.className = "pay-icon " + cls; }
    $("pay-title").textContent = title;
    $("pay-text").textContent = text;
  }

  function actions(list) {
    var box = $("pay-actions");
    box.innerHTML = "";
    list.forEach(function (a) { box.appendChild(a); });
  }

  function homeLink(primary) {
    return el("a", { class: "btn " + (primary ? "btn-primary" : "btn-ghost") + " btn-wide", href: "../" }, "Վերադառնալ կայք");
  }

  function retryButton() {
    var b = el("button", { class: "btn btn-primary btn-wide", type: "button" }, "Կրկին փորձել վճարել");
    b.addEventListener("click", function () {
      b.disabled = true;
      b.textContent = "Բացվում է վճարման էջը…";
      fetch(FN + "create-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retryOrder: order })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d.paymentUrl) { location.assign(d.paymentUrl); return; }
        b.disabled = false;
        b.textContent = "Կրկին փորձել վճարել";
        $("pay-text").textContent = d.message || "Չհաջողվեց բացել վճարման էջը։ Փորձիր մի փոքր ուշ։";
      }).catch(function () {
        b.disabled = false;
        b.textContent = "Կրկին փորձել վճարել";
        $("pay-text").textContent = "Կապի խնդիր։ Ստուգիր ինտերնետը և փորձիր նորից։";
      });
    });
    return b;
  }

  function testNote(d) {
    if (!d.test) return;
    var card = $("pay-card");
    if (card && !card.querySelector(".test-note")) {
      card.insertBefore(el("p", { class: "demo-note small test-note" }, "Փորձնական վճարում. իրական գումար չի գանձվել։"), card.firstChild);
    }
  }

  function loadStatus() {
    return fetch(FN + "payment-status?order=" + encodeURIComponent(order), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function showDetails(d) {
    details([["Պատվերի համար", d.order], ["Ծառայություն", d.service], ["Գումար", d.priceLabel]]);
  }

  /* ---------- Վերադարձի էջեր ---------- */

  var tries = 0;
  function successPage() {
    loadStatus().then(function (d) {
      if (!d) {
        setState("?", "pay-warn", "Պատվերը չի գտնվել", "Եթե վճարել ես, կապվիր մեզ հետ և նշիր պատվերի համարը" + (order ? "՝ " + order : "") + "։");
        actions([homeLink(true)]);
        return;
      }
      showDetails(d);
      testNote(d);
      if (d.status === "paid") {
        setState("✓", "pay-ok", "Վճարումը հաստատված է", "Շնորհակալություն։ Բանկը հաստատեց վճարումը, և պատվերդ ընդունված է։ Շուտով կկապվենք քեզ հետ։");
        actions([homeLink(true)]);
      } else if (d.status === "pending" && tries < 6) {
        tries++;
        setState("…", "pay-wait", "Ստուգում ենք վճարումը…", "Սպասում ենք բանկի հաստատմանը։ Մի փակիր էջը։");
        setTimeout(successPage, 3000);
      } else if (d.status === "pending") {
        setState("…", "pay-wait", "Վճարումը դեռ հաստատված չէ",
          "Բանկը դեռ չի հաստատել վճարումը։ Եթե գումարը գանձվել է, մի անհանգստացիր. մենք կստուգենք և կկապվենք քեզ հետ։ Պատվերի համարը՝ " + d.order + "։");
        actions([retryButton(), homeLink(false)]);
      } else if (d.status === "cancelled") {
        location.replace("cancelled.html?order=" + encodeURIComponent(d.order));
      } else {
        location.replace("failed.html?order=" + encodeURIComponent(d.order));
      }
    });
  }

  function notPaidPage() {
    if (!order) { actions([homeLink(true)]); return; }
    loadStatus().then(function (d) {
      if (!d) { actions([homeLink(true)]); return; }
      showDetails(d);
      testNote(d);
      if (d.status === "paid") { location.replace("success.html?order=" + encodeURIComponent(d.order)); return; }
      if (d.status === "amount_mismatch") {
        $("pay-text").textContent = "Վճարման տվյալները չեն համընկնում պատվերի հետ։ Մենք կստուգենք բանկի հետ և կկապվենք քեզ հետ։";
        actions([homeLink(true)]);
        return;
      }
      actions([retryButton(), homeLink(false)]);
    });
  }

  /* ---------- Փորձնական բանկ ---------- */

  function testBankPage() {
    var pid = params.get("pid") || "";
    var buttons = document.querySelectorAll("[data-outcome]");
    fetch(FN + "test-bank?pid=" + encodeURIComponent(pid), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) {
          $("pay-error").textContent = "Փորձնական վճարումը չի գտնվել կամ փորձնական ռեժիմն անջատված է։";
          Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
          return;
        }
        var amount = String(d.amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ֏";
        details([["Պատվեր", d.order], ["Գումար", amount]]);
      });

    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(buttons, function (x) { x.disabled = true; });
        fetch(FN + "test-bank", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pid: pid, outcome: b.getAttribute("data-outcome") })
        }).then(function (r) { return r.json(); }).then(function (d) {
          if (d.next) location.assign(d.next);
          else $("pay-error").textContent = "Չհաջողվեց։ Փորձիր նորից։";
        }).catch(function () {
          $("pay-error").textContent = "Կապի խնդիր։ Փորձիր նորից։";
          Array.prototype.forEach.call(buttons, function (x) { x.disabled = false; });
        });
      });
    });
  }

  if (page === "success") successPage();
  else if (page === "cancelled" || page === "failed") notPaidPage();
  else if (page === "test-bank") testBankPage();
})();
