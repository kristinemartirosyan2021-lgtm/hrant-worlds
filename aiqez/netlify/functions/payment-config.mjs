// GET → { enabled, test, currency }. Կայքը սրանով է որոշում՝ ցույց տա՞լ քարտով վճարման կոճակը։
import { json, paymentConfig } from "../lib/payments.mjs";

export default async () => json(paymentConfig());
