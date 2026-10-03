"use client";

import type { Task } from "./replicate";

// Փոքրացնում է նկարը մինչև maxSide պիքսել և վերադարձնում JPEG data URI։
// Այդպես վերբեռնումը արագ է և չի գերազանցում սերվերի սահմանափակումները։
export async function fileToDataUrl(file: File, maxSide = 1536): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-ը հասանելի չէ");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.9);
}

export type GalleryItem = {
  id: string;
  kind: "image" | "video";
  task: Task;
  url: string;
  prompt: string;
  createdAt: number;
};

const GALLERY_KEY = "hrantsi.gallery.v1";

export function loadGallery(): GalleryItem[] {
  try {
    return JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]") as GalleryItem[];
  } catch {
    return [];
  }
}

export function saveToGallery(item: GalleryItem) {
  try {
    const items = [item, ...loadGallery()].slice(0, 200);
    localStorage.setItem(GALLERY_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("hrantsi-gallery"));
  } catch {
    /* localStorage-ը կարող է անհասանելի լինել */
  }
}

export function removeFromGallery(id: string) {
  try {
    localStorage.setItem(GALLERY_KEY, JSON.stringify(loadGallery().filter((i) => i.id !== id)));
    window.dispatchEvent(new Event("hrantsi-gallery"));
  } catch {
    /* ignore */
  }
}

type PredictionResponse = {
  id?: string;
  status?: string;
  url?: string | null;
  error?: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Սկսում է գեներացիան և սպասում արդյունքին (վիդեոն կարող է տևել մի քանի րոպե)։
export async function runGeneration(
  payload: { task: Task; prompt?: string; image?: string; aspectRatio?: string },
  onStatus?: (status: string) => void,
): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = (await res.json()) as PredictionResponse;
  if (!res.ok || data.error) throw new Error(data.error || "Սխալ");

  const started = Date.now();
  while (data.status !== "succeeded") {
    if (data.status === "failed" || data.status === "canceled") {
      throw new Error(data.error || "Գեներացիան ձախողվեց։");
    }
    if (Date.now() - started > 15 * 60_000) throw new Error("Շատ երկար տևեց։ Փորձիր նորից։");
    onStatus?.(data.status ?? "processing");
    await sleep(payload.task === "video" ? 4000 : 1500);
    const poll = await fetch(`/api/prediction/${data.id}`);
    data = (await poll.json()) as PredictionResponse;
    if (!poll.ok) throw new Error(data.error || "Սխալ");
  }
  if (!data.url) throw new Error("Մոդելը արդյունք չվերադարձրեց։");
  return data.url;
}

export async function enhancePrompt(prompt: string, kind: "image" | "edit" | "video"): Promise<string> {
  try {
    const res = await fetch("/api/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, kind }),
    });
    const data = (await res.json()) as { prompt?: string };
    return data.prompt || prompt;
  } catch {
    return prompt;
  }
}
