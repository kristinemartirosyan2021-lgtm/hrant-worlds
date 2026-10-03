"use client";

import type { Task } from "./replicate";

export type Me = {
  signedIn: boolean;
  email?: string;
  name?: string;
  image?: string | null;
  credits?: number;
  isAdmin?: boolean;
  setupError?: string;
  costs: Record<Task, number>;
  packs: { credits: number; price: number }[];
  freeCredits: number;
  chatDailyLimit: number;
  payInfo: string;
  contact: string;
};

export async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch("/api/me", { cache: "no-store" });
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

// Կանչիր կրեդիտը փոխելուց հետո, որ վերևի հաշվեկշիռը թարմանա։
export function creditsChanged() {
  window.dispatchEvent(new Event("hrantsi-credits"));
}

export const amd = (n: number) => `${n.toLocaleString("hy-AM")} ֏`;
