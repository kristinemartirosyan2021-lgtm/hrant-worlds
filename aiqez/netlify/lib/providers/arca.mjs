// ArCa vPOS (BPC/RBS REST API)՝ Հայաստանի բանկերի մեծ մասի քարտային
// վճարման դարպասը։ Միացման տվյալները տալիս է բանկը, դրանք պահվում են
// ՄԻԱՅՆ Netlify-ի գաղտնի environment variables-ում։
//
//   ARCA_USERNAME  — API օգտանուն (բանկից)
//   ARCA_PASSWORD  — API գաղտնաբառ (բանկից)
//   ARCA_API_URL   — REST հասցե. փորձարկման՝ https://ipaytest.arca.am:8445/payment/rest
//                    (իրականի հասցեն տալիս է բանկը)
//
// Ուշադրություն. դաշտերի անուններն ու կարգավիճակի կոդերը ստուգիր քո բանկի
// տրամադրած փաստաթղթով՝ իրական միացումից առաջ։
export const name = "arca";
export const isTest = false;

const DEFAULT_TEST_URL = "https://ipaytest.arca.am:8445/payment/rest";

export function isConfigured() {
  return Boolean(process.env.ARCA_USERNAME && process.env.ARCA_PASSWORD);
}

function apiUrl() {
  return (process.env.ARCA_API_URL || DEFAULT_TEST_URL).replace(/\/$/, "");
}

async function call(method, params) {
  const body = new URLSearchParams({
    userName: process.env.ARCA_USERNAME,
    password: process.env.ARCA_PASSWORD,
    ...params,
  });
  const res = await fetch(`${apiUrl()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`ArCa ${method} HTTP ${res.status}`);
  return res.json();
}

const LANG = { hy: "hy", ru: "ru", en: "en" };

export async function register({ bankOrderNumber, amount, description, returnUrl, failUrl, language }) {
  const data = await call("register.do", {
    orderNumber: bankOrderNumber,
    amount: String(Math.round(amount * 100)), // լումաներով (AMD × 100)
    currency: "051",                         // AMD
    returnUrl,
    failUrl,
    description: (description || "").slice(0, 99),
    language: LANG[language] || "hy",
  });
  if (data.errorCode && String(data.errorCode) !== "0") {
    throw new Error(`ArCa register error ${data.errorCode}: ${data.errorMessage || ""}`);
  }
  if (!data.orderId || !/^https:\/\//.test(data.formUrl || "")) {
    throw new Error("ArCa register: unexpected response");
  }
  return { providerPaymentId: data.orderId, paymentUrl: data.formUrl };
}

// orderStatus: 0 գրանցված, 1 նախնական ավտորիզացիա, 2 վճարված, 3 չեղարկված,
// 4 վերադարձված, 5 3DS ընթացքում, 6 մերժված
export async function status(providerPaymentId) {
  const data = await call("getOrderStatusExtended.do", { orderId: providerPaymentId });
  if (data.errorCode && String(data.errorCode) !== "0") {
    return { state: "unknown", raw: data };
  }
  const map = { 0: "pending", 1: "pending", 2: "paid", 3: "cancelled", 4: "refunded", 5: "pending", 6: "declined" };
  return {
    state: map[Number(data.orderStatus)] || "unknown",
    amount: Number(data.amount) / 100,
    currency: String(data.currency || ""),
  };
}
