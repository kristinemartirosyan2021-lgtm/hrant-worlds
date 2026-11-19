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

  var state = { language: "", photos: [] }; // photos: [{ file, url }]

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

  function priceText(service) {
    if (service.price === null || service.price === undefined || service.price === "") {
      return "Արժեքը՝ ըստ պատվերի";
    }
    var n = String(service.price).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return (service.priceFrom ? "սկսած " : "") + n + " " + cfg.currency;
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
    $("service-price").textContent = s ? priceText(s) : "";
    $("f-details").placeholder = s ? s.detailsHint : "Նկարագրիր գաղափարդ՝ ում համար է, ինչ առիթով, ինչ ոճով…";
    var hint = "Մինչև " + cfg.maxPhotos + " նկար, յուրաքանչյուրը մինչև " + cfg.maxPhotoSizeMB + " ՄԲ։";
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

  function selectService(id) {
    $("f-service").value = id;
    updateServiceInfo();
    clearError("service");
  }

  /* ---------- Լուսանկարներ ---------- */

  function addPhotos(fileList) {
    var problems = [];
    Array.prototype.forEach.call(fileList, function (file) {
      if (!/^image\//.test(file.type)) {
        problems.push("«" + file.name + "» ֆայլը նկար չէ։ Ընտրիր միայն լուսանկարներ (JPG, PNG, HEIC…)։");
      } else if (file.size > cfg.maxPhotoSizeMB * 1024 * 1024) {
        problems.push("«" + file.name + "» նկարը շատ մեծ է (" + formatSize(file.size) + ")։ Առավելագույնը՝ " + cfg.maxPhotoSizeMB + " ՄԲ։");
      } else if (state.photos.length >= cfg.maxPhotos) {
        problems.push("Կարելի է կցել առավելագույնը " + cfg.maxPhotos + " լուսանկար։ «" + file.name + "»-ը չավելացվեց։");
      } else if (state.photos.some(function (p) { return p.file.name === file.name && p.file.size === file.size; })) {
        // կրկնվող նկարը լուռ բաց ենք թողնում
      } else {
        state.photos.push({ file: file, url: URL.createObjectURL(file) });
      }
    });
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
      box.appendChild(el("p", { class: "hint previews-count", text: "Ընտրված է " + state.photos.length + " / " + cfg.maxPhotos }));
    }
  }

  /* ---------- Ստուգում ---------- */

  var FIELD_INPUT = { name: "f-name", contact: "f-contact", service: "f-service", date: "f-date", details: "f-details", language: "lang-hy", photos: "f-photos" };

  function showError(key, msg) {
    var e = $("e-" + key);
    e.textContent = msg;
    var input = $(FIELD_INPUT[key]);
    if (input && key !== "language" && key !== "photos") {
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
      price: priceText(service),
      language: state.language,
      languageLabel: cfg.languages.filter(function (l) { return l.id === state.language; })[0].label,
      date: date,
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
      ["Արժեք", order.price],
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

    if (cfg.demoMode || !cfg.orderEndpoint) {
      body.appendChild(el("p", { class: "demo-note small", html: "<b>Փորձնական ռեժիմ։</b> «Ուղարկել» սեղմելուց հետո պատվերը <b>չի</b> ուղարկվի և <b>չի</b> պահպանվի։" }));
    }

    $("summary-result").innerHTML = "";
    $("summary-actions").hidden = false;
    $("confirm-send").disabled = false;
    $("confirm-send").textContent = "Ուղարկել պատվերը";

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

  async function send() {
    var btn = $("confirm-send");
    btn.disabled = true;
    btn.textContent = "Ուղարկվում է…";
    var res = await window.AIQEZ_submitOrder(currentOrder, state.photos.map(function (p) { return p.file; }));

    if (res.status === "demo") {
      showResult("demo", "Պատվերը չի ուղարկվել",
        "Կայքը փորձնական ռեժիմում է. տվյալների պահպանման կապը դեռ միացված չէ, ուստի պատվերը ոչ մի տեղ չի ուղարկվել և չի պահպանվել։ Լրացրած տվյալները մնում են ձևում։");
    } else if (res.status === "ok") {
      var extra = null;
      if (res.paymentUrl && /^https:\/\//.test(res.paymentUrl)) {
        extra = el("a", { class: "btn btn-primary btn-wide", href: res.paymentUrl, rel: "noopener", text: "Անցնել անվտանգ վճարման" });
      }
      showResult("ok", "Պատվերն ընդունված է",
        "Պատվերի համարը՝ " + res.orderId + "։ Շուտով կկապվենք քեզ հետ։", extra);
    } else {
      btn.disabled = false;
      btn.textContent = "Ուղարկել պատվերը";
      showResult("error", "Չհաջողվեց ուղարկել",
        "Ինչ-որ բան սխալ գնաց։ Ստուգիր ինտերնետ կապը և փորձիր նորից։ Տվյալները մնում են ձևում։");
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
      var order = validate();
      if (order) openSummary(order);
    });

    $("confirm-send").addEventListener("click", send);
  }

  renderServices();
  renderFormOptions();
  bind();
  $("year").textContent = new Date().getFullYear();
})();
