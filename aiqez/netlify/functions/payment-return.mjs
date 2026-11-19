// Բանկը հաճախորդին վերադարձնում է այստեղ։ URL-ի պարամետրերին չենք վստահում.
// կարգավիճակը ստուգվում է բանկին սերվերային հարցմամբ, հետո՝ համապատասխան էջ։
import { loadPayment, verifyPayment, siteUrl, redirect } from "../lib/payments.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const order = url.searchParams.get("order") || "";
  const site = siteUrl(req);
  const rec = await loadPayment(order);
  if (!rec) return redirect(`${site}/payment/failed.html?reason=unknown`);

  const v = await verifyPayment(rec, req);
  const q = "?order=" + encodeURIComponent(v.orderNumber);
  if (v.status === "paid") return redirect(`${site}/payment/success.html${q}`);
  if (v.status === "declined" || v.status === "amount_mismatch") return redirect(`${site}/payment/failed.html${q}`);
  if (v.status === "cancelled") return redirect(`${site}/payment/cancelled.html${q}`);
  // Դեռ հաստատված չէ. եթե բանկը վերադարձրել է «fail» հասցեով, համարում ենք չեղարկում,
  // այլապես success էջը ցույց կտա «ստուգում ենք» և նորից կհարցնի սերվերին։
  if (url.searchParams.get("r") === "fail") return redirect(`${site}/payment/cancelled.html${q}`);
  return redirect(`${site}/payment/success.html${q}`);
};
