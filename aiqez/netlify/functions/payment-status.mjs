// GET ?order=AQ-… → պատվերի վճարման կարգավիճակը (առանց անձնական տվյալների)։
import { loadPayment, verifyPayment, json, publicView } from "../lib/payments.mjs";

export default async (req) => {
  const order = new URL(req.url).searchParams.get("order") || "";
  const rec = await loadPayment(order);
  if (!rec) return json({ error: "not_found" }, 404);
  const v = rec.status === "paid" ? rec : await verifyPayment(rec, req);
  return json(publicView(v));
};
