// POST { serviceId, language, name, contact }       → նոր պատվեր և վճարման էջի հղում
// POST { retryOrder: "AQ-…" }                        → նոր փորձ նույն (չվճարված) պատվերի համար
// Գումարը որոշում է սերվերը config.js-ից. հաճախորդից գումար չի ընդունվում։
import {
  activeProvider, paymentConfig, priceFor, priceLabel, siteUrl, json,
  makeOrderNumber, loadPayment, savePayment, publicView,
} from "../lib/payments.mjs";

const clean = (v, max) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const cfg = paymentConfig();
  if (!cfg.enabled) {
    return json({ error: "payments_disabled", message: "Քարտով վճարումը այս պահին հասանելի չէ։ Կարող ես ուղարկել պատվերը առանց վճարման։" }, 503);
  }

  let input;
  try { input = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const provider = activeProvider();
  const site = siteUrl(req);
  let rec;

  if (input.retryOrder) {
    rec = await loadPayment(String(input.retryOrder));
    if (!rec) return json({ error: "not_found", message: "Պատվերը չի գտնվել։" }, 404);
    if (rec.status === "paid") return json({ error: "already_paid", message: "Այս պատվերն արդեն վճարված է։", ...publicView(rec) }, 409);
    // Գինը նորից ստուգվում է config.js-ով
    const price = priceFor(rec.serviceId);
    if (price.error || price.amount !== rec.amount) {
      return json({ error: "price_changed", message: "Ծառայության գինը փոխվել է։ Խնդրում ենք կապվել մեզ հետ։" }, 409);
    }
    rec.attempt = (rec.attempt || 1) + 1;
    rec.provider = provider.name;
    rec.test = provider.isTest;
  } else {
    const price = priceFor(clean(input.serviceId, 40));
    if (price.error === "unknown_service") return json({ error: "unknown_service", message: "Ծառայությունը չի գտնվել։" }, 400);
    if (price.error) {
      return json({ error: "no_fixed_price", message: "Այս ծառայության գինը դեռ հաստատված չէ, ուստի քարտով վճարումը հասանելի չէ։ Ուղարկիր պատվերը, և մենք կհաստատենք արժեքը։" }, 409);
    }
    const name = clean(input.name, 80);
    const contact = clean(input.contact, 40);
    if (name.length < 2 || contact.length < 5) return json({ error: "bad_input", message: "Լրացրու անունը և կոնտակտը։" }, 400);
    rec = {
      orderNumber: makeOrderNumber(),
      serviceId: price.service.id,
      serviceTitle: price.service.title,
      amount: price.amount,
      currency: "AMD",
      name,
      contact,
      language: ["hy", "ru", "en"].includes(input.language) ? input.language : "hy",
      provider: provider.name,
      test: provider.isTest,
      status: "pending",
      attempt: 1,
      createdAt: new Date().toISOString(),
    };
  }

  const back = `${site}/.netlify/functions/payment-return?order=${encodeURIComponent(rec.orderNumber)}`;
  try {
    const reg = await provider.register({
      bankOrderNumber: rec.attempt > 1 ? `${rec.orderNumber}-${rec.attempt}` : rec.orderNumber,
      amount: rec.amount,
      description: `AIQEZ ${rec.orderNumber}: ${rec.serviceTitle}`,
      returnUrl: back,
      failUrl: back + "&r=fail",
      siteUrl: site,
      language: rec.language,
    });
    rec.providerPaymentId = reg.providerPaymentId;
    rec.status = "pending";
    await savePayment(rec);
    return json({ ...publicView(rec), paymentUrl: reg.paymentUrl });
  } catch (e) {
    console.error("register failed", e.message);
    return json({ error: "bank_unavailable", message: "Բանկի վճարման էջը այս պահին հասանելի չէ։ Փորձիր մի փոքր ուշ կամ ուղարկիր պատվերը առանց վճարման։" }, 502);
  }
};
