// Վճարումների պահոց՝ Netlify Blobs։
// Տեղական թեստերում (AIQEZ_STORE=memory) օգտագործվում է հիշողության պահոց։
import { getStore } from "@netlify/blobs";

const memory = new Map();

function memoryStore(name) {
  return {
    async get(key, opts = {}) {
      const v = memory.get(name + "/" + key);
      if (v == null) return null;
      return opts.type === "json" ? JSON.parse(v) : v;
    },
    async setJSON(key, value) {
      memory.set(name + "/" + key, JSON.stringify(value));
    },
  };
}

export function store(name) {
  if (process.env.AIQEZ_STORE === "memory") return memoryStore(name);
  return getStore({ name, consistency: "strong" });
}

export const PAYMENTS = "aiqez-payments";
export const TEST_BANK = "aiqez-test-bank";
