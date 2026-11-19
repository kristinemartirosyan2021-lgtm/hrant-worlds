// POST { serviceId, packageId, expectedAmount, language, name, contact } → նոր պատվեր և վճարման էջի հղում
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
    const price = priceFor(rec.serviceId, rec.packageId);
    if (price.error || price.amount !== rec.amount) {
      return json({ error: "price_changed", message: "Ծառայության գինը փոխվել է։ Խնդրում ենք կապվել մեզ հետ։" }, 409);
    }
    rec.attempt = (rec.attempt || 1) + 1;
    rec.provider = provider.name;
    rec.test = provider.isTest;
  } else {
    const price = priceFor(clean(input.serviceId, 40), clean(input.packageId, 40));
    if (price.error === "unknown_service") return json({ error: "unknown_service", message: "Ծառայությունը չի գտնվել։" }, 400);
    if (price.error === "unknown_package") return json({ error: "unknown_package", message: "Ընտրիր փաթեթը։" }, 400);
    if (price.error === "price_expired") {
      return json({ error: "price_expired", message: "Այս փաթեթի ակցիոն գինն այլևս չի գործում, ուստի քարտով վճարումը հասանելի չէ։ Ուղարկիր հայտը, և մենք կճշտենք արժեքը։" }, 409);
    }
    if (price.error) {
      return json({ error: "no_fixed_price", message: "Այս փաթեթի արժեքը ճշտվում է անհատապես, ուստի քարտով վճարումը հասանելի չէ։ Ուղարկիր հայտը, և մենք կկապվենք քեզ հետ։" }, 409);
    }
    // Եթե էջում ցույց տրված գինը տարբերվում է սերվերի գնից (օր.՝ ակցիան հենց նոր ավարտվեց)
    if (input.expectedAmount != null && Number(input.expectedAmount) !== price.amount) {
      return json({ error: "price_changed", message: "Գինը թարմացվել է։ Թարմացրու էջը և ստուգիր նոր գինը։" }, 409);
    }
    const name = clean(input.name, 80);
    const contact = clean(input.contact, 40);
    if (name.length < 2 || contact.length < 5) return json({ error: "bad_input", message: "Լրացրու անունը և կոնտակտը։" }, 400);
    rec = {
      orderNumber: makeOrderNumber(),
      serviceId: price.service.id,
      serviceTitle: price.service.title,
      packageId: price.pkg.id,
      packageTitle: price.pkg.title,
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
      description: `AIQEZ ${rec.orderNumber}: ${rec.serviceTitle}, ${rec.packageTitle || ""}`,
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
