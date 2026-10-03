import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.HRANTSI_CHAT_MODEL || "claude-opus-5-5";

// Եթե Claude-ը մերժի հարցումը, API-ն ինքն է այն փորձում այլ մոդելով։
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function claude(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export const CHAT_SYSTEM = `Դու HrantSi-ն ես՝ ընկերական AI օգնական HrantSi կայքում։
Պատասխանիր այն լեզվով, որով գրում է օգտատերը (հիմնականում՝ հայերեն)։
Կարող ես օգնել ցանկացած հարցում՝ գրել, բացատրել, թարգմանել, ծրագրավորել, նկարներ վերլուծել։
Կայքում կան նաև «Նկար», «Խմբագրել», «Վիդեո» և «Գործիքներ» բաժինները։ Եթե օգտատերը ուզում է նկար կամ վիդեո ստեղծել,
օգնիր նրան գրել լավ, մանրամասն պրոմպտ և առաջարկիր օգտագործել համապատասխան բաժինը։`;

export const ENHANCE_SYSTEM = `You turn a user's idea (often written in Armenian) into one strong English prompt for an image or video generation model.
Rules:
- Output ONLY the prompt text, no quotes, no explanations.
- Keep every concrete detail the user gave (people, places, clothing, colors, mood, text).
- Default to photorealistic results: describe the subject, setting, lighting, camera/lens and composition naturally, like a professional photo description.
- For edits of an uploaded photo, write a clear instruction ("Place the person in ...", "Change the background to ..."), and say to keep the person's face, identity and pose unchanged.
- For video, describe the motion and camera movement as well.
- Keep it under 120 words.`;
