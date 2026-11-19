/*
 * Պատվերի ուղարկման շերտ՝ Netlify Forms։
 *
 *  - demoMode: true  → ոչինչ չի ուղարկվում, վերադարձնում է { status: "demo" }։
 *  - demoMode: false → պատվերը multipart/form-data ձևով ուղարկվում է կայքի
 *    «order» ձևին (index.html-ում՝ data-netlify="true")։ Netlify-ը պահում է
 *    տվյալներն ու նկարները Forms բաժնում և ուղարկում ծանուցումները։
 *
 * Դաշտերի անունները պետք է համընկնեն index.html-ի «order» ձևի դաշտերին,
 * հակառակ դեպքում Netlify-ը դրանք չի պահի։
 *
 * Հետագայում վճարման համար սերվերը կարող է վերադարձնել paymentUrl,
 * որին app.js-ը կուղղորդի հաճախորդին։ Քարտի տվյալները կայքը չի տեսնում։
 */
window.AIQEZ_submitOrder = async function submitOrder(order, photos) {
  var cfg = window.AIQEZ_CONFIG;

  if (cfg.demoMode) {
    // Փորձնական ռեժիմ. ցանցային հարցում չի կատարվում։
    return { status: "demo" };
  }

  var body = new FormData();
  body.append("form-name", cfg.netlifyFormName);
  body.append("bot-field", "");
  body.append("order_number", order.orderNumber);
  body.append("name", order.name);
  body.append("contact", order.contact);
  body.append("service", order.serviceTitle);
  body.append("price", order.price);
  body.append("language", order.languageLabel);
  body.append("ready_date", order.dateLabel);
  body.append("details", order.details);
  body.append("photo_count", String(photos.length));
  photos.slice(0, cfg.maxPhotos).forEach(function (file, i) {
    body.append("photo" + (i + 1), file, file.name);
  });

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 60000) : null;

  try {
    var res = await fetch(cfg.orderEndpoint || "/", {
      method: "POST",
      body: body,
      signal: controller ? controller.signal : undefined
    });
    if (!res.ok) return { status: "error", code: res.status };
    return { status: "ok", orderId: order.orderNumber };
  } catch (e) {
    return { status: "error", code: 0 };
  } finally {
    if (timer) clearTimeout(timer);
  }
};
