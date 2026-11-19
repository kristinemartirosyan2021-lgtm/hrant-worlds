// Բանկի սերվերային ծանուցման (callback) հասցե։ Ծանուցման բովանդակությանը չենք
// վստահում. այն միայն առիթ է՝ բանկին նորից հարցնելու պատվերի կարգավիճակը։
// Բանկին տրամադրվող հասցեն՝ https://<կայք>/.netlify/functions/payment-callback
import { loadPayment, verifyPayment } from "../lib/payments.mjs";

export default async (req) => {
  const url = new URL(req.url);
  let params = url.searchParams;
  if (req.method === "POST") {
    const text = await req.text();
    try { params = new URLSearchParams(text); } catch { /* ignore */ }
  }
  // ArCa-ն ուղարկում է orderNumber (մեր համարը, կրկնակի փորձի դեպքում՝ «-2» վերջածանցով)
  const raw = (params.get("orderNumber") || params.get("order") || "").trim();
  const rec = (await loadPayment(raw)) || (await loadPayment(raw.replace(/-\d+$/, "")));
  if (rec) await verifyPayment(rec, req);
  return new Response("OK", { status: 200, headers: { "content-type": "text/plain" } });
};
