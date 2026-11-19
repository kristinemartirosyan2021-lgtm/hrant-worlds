// Վճարումների ընդհանուր տրամաբանություն (միայն սերվերում)։
import crypto from "node:crypto";
import config from "../../config.js";
import pricing from "../../pricing.js";
import { store, PAYMENTS } from "./store.mjs";
import * as testProvider from "./providers/test.mjs";
import * as arcaProvider from "./providers/arca.mjs";

const PROVIDERS = { test: testProvider, arca: arcaProvider };

// PAYMENT_PROVIDER-ը չնշելու դեպքում վճարումը փորձնական ռեժիմում է։
export function activeProvider() {
  const key = (process.env.PAYMENT_PROVIDER || "test").toLowerCase();
  return PROVIDERS[key] || null;
}

export function providerByName(name) {
  return PROVIDERS[name] || null;
}

export function paymentConfig() {
  const p = activeProvider();
  const enabled = Boolean(p && p.isConfigured());
  return { enabled, test: enabled ? p.isTest : false, currency: "AMD" };
}

// Գինը միշտ վերցվում է config.js-ից՝ սերվերի ժամով (ակցիայի ժամկետը ներառյալ)։
// Հաճախորդից եկած գումարը չի օգտագործվում։
export function priceFor(serviceId, packageId, now = new Date()) {
  const service = pricing.findService(config, serviceId);
  if (!service) return { error: "unknown_service" };
  const pkg = pricing.findPackage(service, packageId);
  if (!pkg) return { error: "unknown_package", service };
  const amount = pricing.activePrice(pkg, now);
  if (amount === null) return { error: pricing.isExpired(pkg, now) ? "price_expired" : "no_fixed_price", service, pkg };
  return { service, pkg, amount };
}

export function priceLabel(amount) {
  return pricing.formatAmount(amount, config.currency);
}

export function siteUrl(req) {
  return (process.env.URL || new URL(req.url).origin).replace(/\/$/, "");
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function redirect(location) {
  return new Response(null, { status: 303, headers: { location, "cache-control": "no-store" } });
}

export function makeOrderNumber() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const rnd = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  return `AQ-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rnd}`;
}

export const ORDER_RE = /^AQ-\d{6}-[A-Z0-9]{4,6}$/;

export async function loadPayment(orderNumber) {
  if (!ORDER_RE.test(orderNumber || "")) return null;
  return store(PAYMENTS).get(orderNumber, { type: "json" });
}

export async function savePayment(rec) {
  rec.updatedAt = new Date().toISOString();
  await store(PAYMENTS).setJSON(rec.orderNumber, rec);
  return rec;
}

// Հաճախորդին ցույց տրվող տվյալներ (առանց անձնական տվյալների)
export function publicView(rec) {
  return {
    order: rec.orderNumber,
    status: rec.status,
    amount: rec.amount,
    priceLabel: priceLabel(rec.amount),
    service: rec.serviceTitle + (rec.packageTitle ? " · " + rec.packageTitle : ""),
    test: Boolean(rec.test),
  };
}

const FINAL = new Set(["paid", "refunded"]);

// Վճարման կարգավիճակը ստուգվում է ՄԻԱՅՆ բանկին սերվերային հարցմամբ։
// «Վճարված» է նշվում միայն, երբ բանկը հաստատում է վճարումը, և գումարն ու
// արժույթը համընկնում են պատվերի հետ։
export async function verifyPayment(rec, req) {
  if (FINAL.has(rec.status)) return rec;
  const provider = providerByName(rec.provider);
  if (!provider) return rec;

  let st;
  try {
    st = await provider.status(rec.providerPaymentId);
  } catch (e) {
    console.error("payment status check failed", rec.orderNumber, e.message);
    return rec;
  }

  let next = rec.status;
  if (st.state === "paid") {
    const amountOk = Math.abs(Number(st.amount) - Number(rec.amount)) < 0.005;
    const currencyOk = String(st.currency) === "051";
    next = amountOk && currencyOk ? "paid" : "amount_mismatch";
  } else if (["declined", "cancelled", "refunded"].includes(st.state)) {
    next = st.state;
  } else if (st.state === "pending") {
    next = "pending";
  }

  if (next !== rec.status) {
    const wasPaid = rec.status === "paid";
    rec.status = next;
    if (next === "paid") rec.paidAt = new Date().toISOString();
    await savePayment(rec);
    if (next === "paid" && !wasPaid) await recordInForms(rec, req);
    if (next === "amount_mismatch") console.error("AMOUNT MISMATCH", rec.orderNumber, st);
  }
  return rec;
}

const STATUS_HY = {
  paid: "Վճարված",
  pending: "Սպասում է վճարման",
  declined: "Մերժված",
  cancelled: "Չեղարկված",
  refunded: "Վերադարձված",
  amount_mismatch: "ՍԽԱԼ ԳՈՒՄԱՐ — ստուգել բանկում",
};

export function statusLabel(s) {
  return STATUS_HY[s] || s;
}

// Վճարման հաստատումը գրանցվում է Netlify Forms-ի «payment» ձևում, որպեսզի
// տերը այն տեսնի Forms բաժնում և ստանա ծանուցում։
export async function recordInForms(rec, req) {
  const body = new URLSearchParams({
    "form-name": "payment",
    order_number: rec.orderNumber,
    status: statusLabel(rec.status) + (rec.test ? " (ՓՈՐՁՆԱԿԱՆ, գումար չի գանձվել)" : ""),
    amount: priceLabel(rec.amount),
    service: rec.serviceTitle + (rec.packageTitle ? " · " + rec.packageTitle : ""),
    name: rec.name,
    contact: rec.contact,
    provider: rec.provider,
    bank_payment_id: String(rec.providerPaymentId),
    paid_at: rec.paidAt || "",
  });
  try {
    const res = await fetch(siteUrl(req) + "/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) console.error("payment form record failed", res.status);
  } catch (e) {
    console.error("payment form record failed", e.message);
  }
}
