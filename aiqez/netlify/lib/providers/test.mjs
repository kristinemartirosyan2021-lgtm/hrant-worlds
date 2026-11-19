// Փորձնական «բանկ»։ Իրական գումար չի գանձվում, քարտի տվյալներ չեն ընդունվում։
// Աշխատում է նույն սխեմայով, ինչ իրական բանկը. սերվերը վճարման արդյունքը
// ստանում է միայն status() հարցմամբ, ոչ թե հաճախորդի բրաուզերից։
import crypto from "node:crypto";
import { store, TEST_BANK } from "../store.mjs";

export const name = "test";
export const isTest = true;

export function isConfigured() {
  return true;
}

export async function register({ bankOrderNumber, amount, returnUrl, failUrl, siteUrl, language }) {
  const providerPaymentId = "TEST-" + crypto.randomUUID();
  await store(TEST_BANK).setJSON(providerPaymentId, {
    bankOrderNumber, amount, currency: "051", state: "pending", returnUrl, failUrl,
    createdAt: new Date().toISOString(),
  });
  const q = new URLSearchParams({ pid: providerPaymentId, lang: language || "hy" });
  return { providerPaymentId, paymentUrl: `${siteUrl}/payment/test-bank.html?${q}` };
}

export async function status(providerPaymentId) {
  const rec = await store(TEST_BANK).get(providerPaymentId, { type: "json" });
  if (!rec) return { state: "unknown" };
  return { state: rec.state, amount: rec.amount, currency: rec.currency };
}

// Կանչվում է միայն փորձնական բանկի էջից (test-bank ֆունկցիայով)
export async function setOutcome(providerPaymentId, outcome) {
  const s = store(TEST_BANK);
  const rec = await s.get(providerPaymentId, { type: "json" });
  if (!rec) return null;
  if (rec.state !== "pending") return rec; // արդյունքը մեկ անգամ է որոշվում
  rec.state = { paid: "paid", declined: "declined", cancelled: "cancelled" }[outcome] || "pending";
  rec.updatedAt = new Date().toISOString();
  await s.setJSON(providerPaymentId, rec);
  return rec;
}

export async function peek(providerPaymentId) {
  return store(TEST_BANK).get(providerPaymentId, { type: "json" });
}
