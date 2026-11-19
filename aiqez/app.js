(function () {
  "use strict";

  var cfg = window.AIQEZ_CONFIG;
  var $ = function (id) { return document.getElementById(id); };

  var ICONS = {
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    portrait: '<circle cx="12" cy="9" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5"/>'
  };

  var MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];

  var state = { language: "", packageId: "", photos: [], payments: { enabled: false, test: false } }; // photos: [{ file, url }]

  /* ---------- Օգնական ֆունկցիաներ ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  var P = window.AIQEZ_PRICING;

  function priceText(service) {
    return P.serviceFromLabel(service, new Date(), cfg.currency);
  }

  function pkgPriceText(pkg) {
    return P.priceLabel(pkg, new Date(), cfg.currency);
  }

  function promoActive(pkg) {
    return Boolean(pkg.promoNote && P.activePrice(pkg, new Date()) !== null);
  }

  function findPkg(service, id) {
    return P.findPackage(service, id);
  }

  function findService(id) {
    return cfg.services.filter(function (s) { return s.id === id; })[0] || null;
  }

  function localISO(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function minDate() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (cfg.minLeadDays || 0));
    return d;
  }

  function formatDate(iso) {
    var p = iso.split("-");
    return Number(p[2]) + " " + MONTHS[Number(p[1]) - 1] + ", " + p[0] + "թ.";
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? Math.max(1, Math.round(bytes / 1024)) + " ԿԲ"
      : (bytes / 1024 / 1024).toFixed(1) + " ՄԲ";
  }

  /* ---------- Ծառայությունների քարտեր ---------- */

  function renderServices() {
    var list = $("service-list");
    cfg.services.forEach(function (s) {
      var icon = el("span", { class: "card-icon", "aria-hidden": "true",
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[s.icon] || "") + "</svg>" });
      var btn = el("a", { class: "btn btn-primary", href: "#order", "data-service": s.id, text: "Պատվիրել" });
      list.appendChild(el("article", { class: "card" }, [
        icon,
        el("h3", { text: s.title }),
        el("p", { text: s.description }),
        el("ul", { class: "pkg-list" }, (s.packages || []).map(function (p) {
          return el("li", {}, [
            el("span", { text: p.title + (promoActive(p) ? " · " + p.promoNote : "") }),
            el("b", { text: pkgPriceText(p) })
          ]);
        })),
        el("div", { class: "card-foot" }, [
          el("span", { class: "price", text: priceText(s) }),
          btn
        ])
      ]));
    });
  }

  /* ---------- Ձևի լրացում ---------- */

  function renderFormOptions() {
    var select = $("f-service");
    select.appendChild(el("option", { value: "", text: "Ընտրիր ծառայությունը" }));
    cfg.services.forEach(function (s) {
      select.appendChild(el("option", { value: s.id, text: s.title }));
    });

    var chips = $("lang-chips");
    cfg.languages.forEach(function (l) {
      var input = el("input", { type: "radio", name: "language", value: l.id, id: "lang-" + l.id });
      input.addEventListener("change", function () {
        state.language = l.id;
        clearError("language");
      });
      chips.appendChild(el("label", { class: "chip", for: "lang-" + l.id }, [input, el("span", { text: l.label })]));
    });

    $("f-date").min = localISO(minDate());
    updateServiceInfo();
  }

  function updateServiceInfo() {
    var s = findService($("f-service").value);
    renderPackages(s);
    $("f-details").placeholder = s ? s.detailsHint : "Նկարագրիր գաղափարդ՝ ում համար է, ինչ առիթով, ինչ ոճով…";
    var hint = "Մինչև " + cfg.maxPhotos + " նկար։ Մեծ նկարները ավտոմատ կփոքրացվեն, բոլորը միասին՝ մինչև " + cfg.maxUploadMB + " ՄԲ։";
    var label = "Լուսանկարներ";
    if (s && s.photosRequired) {
      label = 'Լուսանկարներ <span class="req">*</span>';
      hint = "Այս ծառայության համար անհրաժեշտ է առնվազն 1 լուսանկար։ " + hint;
    } else if (s && s.photosRecommended) {
      hint = "Խորհուրդ ենք տալիս կցել լուսանկար։ " + hint;
    } else {
      hint = "Ըստ ցանկության։ " + hint;
    }
    $("photos-label").innerHTML = label;
    $("photos-hint").textContent = hint;
  }

  function renderPackages(service) {
    var box = $("package-chips");
    box.innerHTML = "";
    $("package-field").hidden = !service;
    if (!service) { state.packageId = ""; updatePackagePrice(); return; }
    if (!findPkg(service, state.packageId)) state.packageId = "";
    if (!state.packageId && service.packages.length === 1) state.packageId = service.packages[0].id;
    service.packages.forEach(function (p) {
      var id = "pkg-" + p.id;
      var input = el("input", { type: "radio", name: "pkg", value: p.id, id: id });
      if (p.id === state.packageId) input.checked = true;
      input.addEventListener("change", function () {
        state.packageId = p.id;
        clearError("package");
        updatePackagePrice();
      });
      box.appendChild(el("label", { class: "pkg-option", for: id }, [
        input,
        el("span", { class: "pkg-body" }, [
          el("span", { class: "pkg-title", text: p.title }),
          promoActive(p) ? el("span", { class: "pkg-promo", text: p.promoNote }) : null,
          el("span", { class: "pkg-price", text: pkgPriceText(p) })
        ])
      ]));
    });
    updatePackagePrice();
  }

  function updatePackagePrice() {
    var service = findService($("f-service").value);
    var pkg = findPkg(service, state.packageId);
    var hint = $("service-price");
    if (!pkg) { hint.textContent = ""; return; }
    var amount = P.activePrice(pkg, new Date());
    hint.textContent = amount !== null
      ? "Արժեքը՝ " + pkgPriceText(pkg)
      : pkgPriceText(pkg) + " — արժեքը կճշտենք քեզ հետ, քարտից գումար չի գանձվի։";
  }

  function selectService(id) {
    if ($("f-service").value !== id) state.packageId = "";
    $("f-service").value = id;
    updateServiceInfo();
    clearError("service");
  }

  /* ---------- Լուսանկարներ ---------- */

  // Նկարը փոքրացնում է մինչև photoMaxSide պիքսել և վերածում JPEG-ի։
  // Եթե բրաուզերը չի կարողանում բացել ֆայլը (օր.՝ HEIC), թողնում է բնօրինակը։
  function compressImage(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, cfg.photoMaxSide / Math.max(w, h));
        if (scale === 1 && file.type === "image/jpeg" && file.size <= 1.5 * 1024 * 1024) {
          URL.revokeObjectURL(url); resolve(file); return;
        }
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          var base = file.name.replace(/\.[^.]+$/, "") || "photo";
          resolve(new File([blob], base + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", cfg.photoQuality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function totalPhotoBytes() {
    return state.photos.reduce(function (sum, p) { return sum + p.file.size; }, 0);
  }

  async function addPhotos(fileList) {
    var problems = [];
    var files = Array.prototype.slice.call(fileList);
    state.processing = true;
    $("photos-busy").hidden = false;
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      if (!/^image\//.test(file.type)) {
        problems.push("«" + file.name + "» ֆայլը նկար չէ։ Ընտրիր միայն լուսանկարներ (JPG, PNG, HEIC…)։");
        continue;
      }
      if (file.size > cfg.maxPhotoSizeMB * 1024 * 1024) {
        problems.push("«" + file.name + "» նկարը շատ մեծ է (" + formatSize(file.size) + ")։ Առավելագույնը՝ " + cfg.maxPhotoSizeMB + " ՄԲ։");
        continue;
      }
      if (state.photos.length >= cfg.maxPhotos) {
        problems.push("Կարելի է կցել առավելագույնը " + cfg.maxPhotos + " լուսանկար։ «" + file.name + "»-ը չավելացվեց։");
        continue;
      }
      if (state.photos.some(function (p) { return p.origName === file.name && p.origSize === file.size; })) {
        continue; // կրկնվող նկարը լուռ բաց ենք թողնում
      }
      var ready = await compressImage(file);
      if (totalPhotoBytes() + ready.size > cfg.maxUploadMB * 1024 * 1024) {
        problems.push("«" + file.name + "»-ը չավելացվեց. բոլոր նկարները միասին պետք է լինեն մինչև " + cfg.maxUploadMB + " ՄԲ։ Հեռացրու մեկ նկար կամ ընտրիր ավելի փոքրը։");
        continue;
      }
      state.photos.push({ file: ready, origName: file.name, origSize: file.size, url: URL.createObjectURL(ready) });
    }
    state.processing = false;
    $("photos-busy").hidden = true;
    renderPreviews();
    if (problems.length) showError("photos", problems.join(" "));
    else clearError("photos");
  }

  function removePhoto(index) {
    URL.revokeObjectURL(state.photos[index].url);
    state.photos.splice(index, 1);
    renderPreviews();
    clearError("photos");
  }

  function renderPreviews() {
    var box = $("previews");
    box.innerHTML = "";
    state.photos.forEach(function (p, i) {
      var rm = el("button", { type: "button", class: "preview-rm", "aria-label": "Հեռացնել " + p.file.name, text: "×" });
      rm.addEventListener("click", function () { removePhoto(i); });
      box.appendChild(el("figure", { class: "preview" }, [
        el("img", { src: p.url, alt: p.file.name }),
        rm
      ]));
    });
    if (state.photos.length) {
      box.appendChild(el("p", { class: "hint previews-count", text: "Ընտրված է " + state.photos.length + " / " + cfg.maxPhotos + " · " + formatSize(totalPhotoBytes()) + " / " + cfg.maxUploadMB + " ՄԲ" }));
    }
  }

  /* ---------- Ստուգում ---------- */

  var FIELD_INPUT = { name: "f-name", contact: "f-contact", service: "f-service", package: "package-chips", date: "f-date", details: "f-details", language: "lang-hy", photos: "f-photos" };

  function showError(key, msg) {
    var e = $("e-" + key);
    e.textContent = msg;
    var input = $(FIELD_INPUT[key]);
    if (input && key !== "language" && key !== "photos" && key !== "package") {
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", "e-" + key);
    }
    e.closest(".field").classList.add("has-error");
  }

  function clearError(key) {
    var e = $("e-" + key);
    e.textContent = "";
    var input = $(FIELD_INPUT[key]);
    if (input) input.removeAttribute("aria-invalid");
    e.closest(".field").classList.remove("has-error");
  }

  function validateContact(v) {
    if (!v) return "Գրիր հեռախոսահամարդ կամ Telegram օգտանունդ, որպեսզի կարողանանք կապվել քեզ հետ։";
    var looksTelegram = v.charAt(0) === "@" || /[A-Za-z_]/.test(v);
    if (looksTelegram) {
      if (!/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v)) {
        return "Telegram օգտանունը սխալ է։ Այն պետք է լինի 5–32 լատինատառ նիշ, թվեր կամ «_», սկսվի տառով (օր.՝ @aiqez_studio)։";
      }
      return "";
    }
    if (/[^0-9+\s\-()]/.test(v)) return "Հեռախոսահամարը կարող է պարունակել միայն թվեր, «+», բացատ, «-» կամ փակագծեր։";
    var digits = v.replace(/\D/g, "");
    if (digits.length < 8) return "Հեռախոսահամարը շատ կարճ է։ Գրիր ամբողջական համարը՝ օր.՝ +374 99 123456։";
    if (digits.length > 15) return "Հեռախոսահամարը շատ երկար է։ Ստուգիր թվերը։";
    return "";
  }

  function validate() {
    var errors = {};
    var name = $("f-name").value.trim();
    var contact = $("f-contact").value.trim();
    var serviceId = $("f-service").value;
    var date = $("f-date").value;
    var details = $("f-details").value.trim();
    var service = findService(serviceId);

    if (!name) errors.name = "Գրիր քո անունը։";
    else if (name.length < 2) errors.name = "Անունը պետք է ունենա առնվազն 2 տառ։";

    var c = validateContact(contact);
    if (c) errors.contact = c;

    if (!service) errors.service = "Ընտրիր, թե որ ծառայությունն ես ուզում պատվիրել։";

    var pkg = findPkg(service, state.packageId);
    if (service && !pkg) errors.package = "Ընտրիր փաթեթը (տևողությունը կամ տարբերակը)։";

    if (!state.language) errors.language = "Ընտրիր լեզուն, որով պետք է պատրաստվի աշխատանքը։";

    if (!date) {
      errors.date = "Ընտրիր, թե երբ ես ցանկանում ստանալ պատրաստի աշխատանքը։";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.date = "Ամսաթիվը սխալ է։ Ընտրիր այն օրացույցից։";
    } else if (date < localISO(minDate())) {
      errors.date = "Ամսաթիվը չի կարող լինել անցյալում կամ այսօր։ Ամենամոտ հնարավոր օրը՝ " + formatDate(localISO(minDate())) + "։";
    }

    if (!details) errors.details = "Նկարագրիր պատվերը՝ ում համար է, ինչ առիթով, ինչ ես ուզում ստանալ։";
    else if (details.length < 10) errors.details = "Նկարագրությունը շատ կարճ է։ Գրիր մի քիչ ավելի մանրամասն (առնվազն 10 նիշ)։";

    if (service && service.photosRequired && state.photos.length === 0) {
      errors.photos = "«" + service.title + "» ծառայության համար կցիր առնվազն 1 լուսանկար։";
    }

    Object.keys(FIELD_INPUT).forEach(function (k) {
      if (errors[k]) showError(k, errors[k]); else clearError(k);
    });

    var summary = $("error-summary");
    var keys = Object.keys(errors);
    if (keys.length) {
      summary.innerHTML = "";
      summary.appendChild(el("b", { text: keys.length === 1 ? "Ուղղիր 1 սխալ՝" : "Ուղղիր " + keys.length + " սխալ՝" }));
      var ul = el("ul");
      keys.forEach(function (k) {
        var a = el("a", { href: "#" + FIELD_INPUT[k], text: errors[k] });
        a.addEventListener("click", function (ev) { ev.preventDefault(); focusField(k); });
        ul.appendChild(el("li", {}, [a]));
      });
      summary.appendChild(ul);
      summary.hidden = false;
      summary.focus();
      summary.scrollIntoView({ behavior: "smooth", block: "start" });
      return null;
    }
    summary.hidden = true;

    return {
      name: name,
      contact: contact,
      serviceId: service.id,
      serviceTitle: service.title,
      packageId: pkg.id,
      packageTitle: pkg.title,
      amount: P.activePrice(pkg, new Date()),
      price: pkgPriceText(pkg),
      language: state.language,
      languageLabel: cfg.languages.filter(function (l) { return l.id === state.language; })[0].label,
      date: date,
      dateLabel: formatDate(date),
      details: details,
      photoCount: state.photos.length,
      createdAt: new Date().toISOString()
    };
  }

  function focusField(k) {
    var input = $(FIELD_INPUT[k]);
    if (k === "photos") input = document.querySelector(".upload");
    var field = $("e-" + k).closest(".field");
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    if (input && input.focus) input.focus({ preventScroll: true });
  }

  /* ---------- Ամփոփում ---------- */

  var currentOrder = null;
  var lastFocus = null;

  function openSummary(order) {
    currentOrder = order;
    var body = $("summary-body");
    body.innerHTML = "";
    var dl = el("dl", { class: "summary-list" });
    [
      ["Անուն", order.name],
      ["Կապ", order.contact],
      ["Ծառայություն", order.serviceTitle],
      ["Փաթեթ", order.packageTitle],
      ["Արժեք", order.amount !== null ? order.price : order.price + " — կկապվենք քեզ հետ"],
      ["Լեզու", order.languageLabel],
      ["Պատրաստ լինելու ամսաթիվ", formatDate(order.date)],
      ["Մանրամասներ", order.details],
      ["Լուսանկարներ", order.photoCount ? order.photoCount + " հատ" : "Չկան"]
    ].forEach(function (row) {
      dl.appendChild(el("dt", { text: row[0] }));
      dl.appendChild(el("dd", { text: row[1] }));
    });
    body.appendChild(dl);

    if (state.photos.length) {
      var thumbs = el("div", { class: "summary-thumbs" });
      state.photos.forEach(function (p) { thumbs.appendChild(el("img", { src: p.url, alt: p.file.name })); });
      body.appendChild(thumbs);
    }

    if (cfg.demoMode) {
      body.appendChild(el("p", { class: "demo-note small", html: "<b>Փորձնական ռեժիմ։</b> «Ուղարկել» սեղմելուց հետո պատվերը <b>չի</b> ուղարկվի և <b>չի</b> պահպանվի։" }));
    }

    var canPay = payable(order);
    if (order.amount === null) {
      body.appendChild(el("p", { class: "demo-note small", text: "Այս տարբերակի արժեքը ճշտվում է անհատապես։ Ուղարկիր հայտը, մենք կկապվենք քեզ հետ և կհաստատենք գինը։ Քարտից գումար չի գանձվի։" }));
    }
    if (canPay) {
      var payBox = el("div", { class: "pay-box" }, [
        el("p", { class: "muted", text: "Վճարման ենթակա գումար" }),
        el("p", { class: "pay-amount", text: order.price }),
        el("p", { class: "hint", text: "Վճարումը կատարվում է բանկի ապահով էջում։ Քարտի տվյալները մեր կայքը չի տեսնում։" })
      ]);
      if (state.payments.test) {
        payBox.appendChild(el("p", { class: "demo-note small", html: "<b>Վճարումը փորձնական ռեժիմում է։</b> Իրական գումար չի գանձվի, բանկի փոխարեն կբացվի փորձնական էջ։" }));
      }
      body.appendChild(payBox);
    }

    $("summary-result").innerHTML = "";
    $("summary-actions").hidden = false;
    $("confirm-pay").hidden = !canPay;
    $("confirm-pay").disabled = false;
    $("confirm-pay").textContent = "Պատվիրել և վճարել քարտով";
    $("confirm-send").disabled = false;
    $("confirm-send").textContent = canPay ? "Ուղարկել առանց վճարման" : (order.amount === null ? "Ուղարկել հայտը" : "Ուղարկել պատվերը");
    $("confirm-send").className = "btn btn-wide " + (canPay ? "btn-ghost" : "btn-primary");

    lastFocus = document.activeElement;
    $("summary").hidden = false;
    document.body.classList.add("no-scroll");
    $("summary").querySelector(".sheet").scrollTop = 0;
    $("summary").querySelector("[data-close]").focus();
  }

  function closeSummary() {
    $("summary").hidden = true;
    document.body.classList.remove("no-scroll");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function showResult(kind, title, text, extra) {
    var box = el("div", { class: "result result-" + kind, role: "alert" }, [
      el("h3", { text: title }),
      el("p", { text: text })
    ]);
    if (extra) box.appendChild(extra);
    var close = el("button", { type: "button", class: "btn btn-ghost btn-wide", text: kind === "error" ? "Վերադառնալ" : "Փակել" });
    close.addEventListener("click", closeSummary);
    box.appendChild(close);
    $("summary-result").innerHTML = "";
    $("summary-result").appendChild(box);
    $("summary-actions").hidden = true;
    box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function makeOrderNumber() {
    var d = new Date();
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return "AQ-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + rnd;
  }

  function resetForm() {
    $("order-form").reset();
    state.language = "";
    state.packageId = "";
    state.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    state.photos = [];
    renderPreviews();
    $("details-count").textContent = "0";
    updateServiceInfo();
  }

  var sending = false;

  // Քարտով վճարում՝ միայն գործող գնով փաթեթի համար (սերվերը նորից է ստուգում)
  function payable(order) {
    return Boolean(order && !cfg.demoMode && state.payments.enabled && typeof order.amount === "number" && order.amount > 0);
  }

  function loadPaymentConfig() {
    if (!/^https?:$/.test(location.protocol)) return;
    fetch("/.netlify/functions/payment-config", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && typeof d.enabled === "boolean") state.payments = d; })
      .catch(function () { /* վճարումը մնում է անջատված */ });
  }

  async function payAndOrder() {
    if (sending) return;
    sending = true;
    var btn = $("confirm-pay");
    btn.disabled = true;
    $("confirm-send").disabled = true;
    btn.textContent = "Բացվում է վճարման էջը…";
    var fail = function (msg) {
      sending = false;
      btn.disabled = false;
      $("confirm-send").disabled = false;
      btn.textContent = "Պատվիրել և վճարել քարտով";
      showResult("error", "Վճարումը չսկսվեց", msg);
    };

    var d = null;
    try {
      var r = await fetch("/.netlify/functions/create-payment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: currentOrder.serviceId,
          packageId: currentOrder.packageId,
          expectedAmount: currentOrder.amount,
          language: currentOrder.language,
          name: currentOrder.name,
          contact: currentOrder.contact
        })
      });
      d = await r.json();
    } catch (e) { d = null; }
    if (!d || !d.paymentUrl) {
      fail((d && d.message) || "Չհաջողվեց կապ հաստատել վճարման համակարգի հետ։ Ստուգիր ինտերնետը և փորձիր նորից։");
      return;
    }

    // Պատվերը (նկարներով) պահվում է Netlify Forms-ում սերվերի տված համարով,
    // հետո հաճախորդը անցնում է բանկի էջ։
    currentOrder.orderNumber = d.order;
    currentOrder.price = d.priceLabel;
    currentOrder.payment = "Քարտով՝ " + d.priceLabel + " — սպասում է բանկի հաստատմանը" + (d.test ? " (ՓՈՐՁՆԱԿԱՆ)" : "");
    var res = await window.AIQEZ_submitOrder(currentOrder, state.photos.map(function (p) { return p.file; }));
    if (res.status !== "ok") {
      fail("Պատվերը չհաջողվեց պահպանել, ուստի վճարումը չսկսվեց։ Ստուգիր ինտերնետը և փորձիր նորից։");
      return;
    }
    btn.textContent = "Անցում բանկի էջ…";
    location.assign(d.paymentUrl);
  }

  async function send() {
    if (sending) return;
    sending = true;
    var btn = $("confirm-send");
    btn.disabled = true;
    btn.textContent = "Ուղարկվում է…";
    if (!currentOrder.orderNumber) currentOrder.orderNumber = makeOrderNumber();
    currentOrder.payment = currentOrder.amount === null ? "Արժեքը ճշտել — հայտ առանց քարտային գանձման" : "Առանց առցանց վճարման";
    var res = await window.AIQEZ_submitOrder(currentOrder, state.photos.map(function (p) { return p.file; }));
    sending = false;

    if (res.status === "demo") {
      showResult("demo", "Պատվերը չի ուղարկվել",
        "Կայքը փորձնական ռեժիմում է. տվյալների պահպանման կապը դեռ միացված չէ, ուստի պատվերը ոչ մի տեղ չի ուղարկվել և չի պահպանվել։ Լրացրած տվյալները մնում են ձևում։");
    } else if (res.status === "ok") {
      var extra = null;
      if (res.paymentUrl && /^https:\/\//.test(res.paymentUrl)) {
        extra = el("a", { class: "btn btn-primary btn-wide", href: res.paymentUrl, rel: "noopener", text: "Անցնել անվտանգ վճարման" });
      }
      showResult("ok", "Պատվերն ընդունված է",
        "Պատվերի համարը՝ " + res.orderId + "։ Շուտով կկապվենք քեզ հետ՝ " + currentOrder.contact + " կոնտակտով, մանրամասները և արժեքը ճշտելու համար։", extra);
      resetForm();
      currentOrder = null;
    } else {
      btn.disabled = false;
      btn.textContent = "Ուղարկել պատվերը";
      var why = res.code === 413
        ? "Նկարները միասին շատ մեծ են։ Վերադարձիր, հեռացրու մեկ-երկու նկար և փորձիր նորից։"
        : "Ինչ-որ բան սխալ գնաց։ Ստուգիր ինտերնետ կապը և փորձիր նորից։ Տվյալները մնում են ձևում։";
      showResult("error", "Չհաջողվեց ուղարկել", why);
    }
  }

  /* ---------- Իրադարձություններ ---------- */

  function bind() {
    document.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-service]");
      if (t) selectService(t.getAttribute("data-service"));
      if (ev.target.closest("[data-close]")) closeSummary();
    });

    $("summary").addEventListener("click", function (ev) { if (ev.target === $("summary")) closeSummary(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !$("summary").hidden) closeSummary(); });

    $("f-service").addEventListener("change", function () { updateServiceInfo(); clearError("service"); });
    ["name", "contact", "date", "details"].forEach(function (k) {
      $(FIELD_INPUT[k]).addEventListener("input", function () { clearError(k); });
    });
    $("f-details").addEventListener("input", function () { $("details-count").textContent = this.value.length; });

    $("f-photos").addEventListener("change", function () {
      addPhotos(this.files);
      this.value = "";
    });

    $("order-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (state.processing) {
        showError("photos", "Սպասիր մի պահ, նկարները դեռ մշակվում են։");
        return;
      }
      var order = validate();
      if (order) openSummary(order);
    });

    $("confirm-send").addEventListener("click", send);
    $("confirm-pay").addEventListener("click", payAndOrder);
  }

  if (!cfg.demoMode) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-demo-only]"), function (n) { n.hidden = true; });
  }
  loadPaymentConfig();
  renderServices();
  renderFormOptions();
  bind();
  $("year").textContent = new Date().getFullYear();
})();
