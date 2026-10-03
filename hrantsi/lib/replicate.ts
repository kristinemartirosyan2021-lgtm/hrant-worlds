// Replicate-ի հետ աշխատանք՝ նկար, խմբագրում, վիդեո և գործիքներ։
// Բոլոր մոդելները կարելի է փոխել .env-ով (տես .env.example)։

export type Task = "image" | "edit" | "video" | "upscale" | "remove-bg";

export type GenerateRequest = {
  task: Task;
  prompt?: string;
  image?: string; // data URI կամ https URL
  aspectRatio?: string;
};

const DEFAULT_MODELS: Record<Task, string> = {
  image: "black-forest-labs/flux-1.1-pro-ultra",
  edit: "black-forest-labs/flux-kontext-pro",
  video: "minimax/hailuo-02",
  upscale: "recraft-ai/recraft-crisp-upscale",
  "remove-bg": "bria/remove-background",
};

const ENV_KEYS: Record<Task, string> = {
  image: "HRANTSI_MODEL_IMAGE",
  edit: "HRANTSI_MODEL_EDIT",
  video: "HRANTSI_MODEL_VIDEO",
  upscale: "HRANTSI_MODEL_UPSCALE",
  "remove-bg": "HRANTSI_MODEL_REMOVE_BG",
};

const API = "https://api.replicate.com/v1";

export class UserError extends Error {}

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) {
    throw new UserError(
      "REPLICATE_API_TOKEN-ը կարգավորված չէ։ Ավելացրու այն .env.local ֆայլում (տես README)։",
    );
  }
  return t;
}

function modelFor(task: Task): string {
  return process.env[ENV_KEYS[task]] || DEFAULT_MODELS[task];
}

function buildInput(req: GenerateRequest): Record<string, unknown> {
  const prompt = req.prompt?.trim() ?? "";
  switch (req.task) {
    case "image":
      if (!prompt) throw new UserError("Գրիր, թե ինչ նկար ես ուզում։");
      return {
        prompt,
        aspect_ratio: req.aspectRatio || "1:1",
        raw: true, // ավելի բնական, ֆոտոռեալիստիկ տեսք
        output_format: "jpg",
        safety_tolerance: 2,
      };
    case "edit":
      if (!req.image) throw new UserError("Վերբեռնիր նկար, որը պետք է փոխել։");
      if (!prompt) throw new UserError("Գրիր, թե ինչպես փոխել նկարը։");
      return {
        prompt,
        input_image: req.image,
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        safety_tolerance: 2,
      };
    case "video":
      if (!prompt) throw new UserError("Գրիր, թե ինչ վիդեո ես ուզում։");
      return {
        prompt,
        duration: 6,
        resolution: "768p",
        prompt_optimizer: true,
        ...(req.image ? { first_frame_image: req.image } : {}),
      };
    case "upscale":
    case "remove-bg":
      if (!req.image) throw new UserError("Վերբեռնիր նկար։");
      return { image: req.image };
  }
}

export type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error: string | null;
};

async function replicateFetch(
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
): Promise<Prediction> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail ?? res.statusText;
    if (res.status === 401) throw new UserError("Replicate-ի token-ը սխալ է։");
    if (res.status === 402) throw new UserError("Replicate-ի հաշվում բավարար գումար չկա։");
    if (res.status === 422) throw new UserError(`Մոդելը չընդունեց տվյալները՝ ${detail}`);
    throw new Error(`Replicate ${res.status}: ${detail}`);
  }
  return data as Prediction;
}

// Սկսում է գեներացիան։ Նկարների դեպքում սպասում է մինչև 60 վրկ,
// վիդեոյի դեպքում անմիջապես վերադարձնում է id-ն, որ բրաուզերը հարցումներ անի։
export async function startPrediction(req: GenerateRequest): Promise<Prediction> {
  const input = buildInput(req);
  const model = modelFor(req.task);
  const wait: Record<string, string> = req.task === "video" ? {} : { Prefer: "wait=60" };

  const [ref, version] = model.split(":");
  if (version) {
    return replicateFetch("/predictions", {
      method: "POST",
      headers: wait,
      body: JSON.stringify({ version, input }),
    });
  }
  return replicateFetch(`/models/${ref}/predictions`, {
    method: "POST",
    headers: wait,
    body: JSON.stringify({ input }),
  });
}

export async function getPrediction(id: string): Promise<Prediction> {
  if (!/^[a-z0-9]+$/i.test(id)) throw new UserError("Սխալ id։");
  return replicateFetch(`/predictions/${id}`);
}

// Մոդելները վերադարձնում են կամ URL, կամ URL-ների զանգված։
export function outputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  if (output && typeof output === "object") {
    for (const v of Object.values(output)) {
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
  }
  return null;
}

export function toClient(p: Prediction) {
  return {
    id: p.id,
    status: p.status,
    url: p.status === "succeeded" ? outputUrl(p.output) : null,
    error: p.error,
  };
}
