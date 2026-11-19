// Միայն փորձնական ռեժիմի համար. փորձնական բանկի էջի կոճակները կանչում են սա։
// Իրական բանկի (PAYMENT_PROVIDER=arca) դեպքում այս ֆունկցիան անջատված է։
import { json, activeProvider } from "../lib/payments.mjs";
import * as testProvider from "../lib/providers/test.mjs";

export default async (req) => {
  const provider = activeProvider();
  if (!provider || !provider.isTest) return json({ error: "disabled" }, 404);
  const url = new URL(req.url);

  if (req.method === "GET") {
    const rec = await testProvider.peek(url.searchParams.get("pid") || "");
    if (!rec) return json({ error: "not_found" }, 404);
    return json({ amount: rec.amount, state: rec.state, order: rec.bankOrderNumber });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let input;
  try { input = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const rec = await testProvider.setOutcome(String(input.pid || ""), String(input.outcome || ""));
  if (!rec) return json({ error: "not_found" }, 404);
  return json({ state: rec.state, next: rec.state === "paid" ? rec.returnUrl : rec.failUrl });
};
