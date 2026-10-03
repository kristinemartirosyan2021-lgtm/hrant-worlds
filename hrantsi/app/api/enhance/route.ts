import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { claude, ENHANCE_SYSTEM, FALLBACK_BETA, hasClaudeKey, MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { prompt?: string; kind?: "image" | "edit" | "video" };

export async function POST(req: Request) {
  const { prompt, kind = "image" } = (await req.json()) as Body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Պրոմպտը դատարկ է։" }, { status: 400 });
  }
  // Առանց Claude-ի բանալիի պարզապես վերադարձնում ենք նույն տեքստը։
  if (!hasClaudeKey()) return NextResponse.json({ prompt: prompt.trim(), enhanced: false });

  try {
    const response = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: ENHANCE_SYSTEM,
      messages: [{ role: "user", content: `Type: ${kind}\nUser idea: ${prompt}` }],
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "Այս հարցումը հնարավոր չէ կատարել։" }, { status: 400 });
    }
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return NextResponse.json({ prompt: text || prompt.trim(), enhanced: Boolean(text) });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Claude-ի API բանալին սխալ է։" }, { status: 500 });
    }
    console.error(err);
    // Բարելավումը պարտադիր չէ․ սխալի դեպքում օգտագործում ենք բնօրինակը։
    return NextResponse.json({ prompt: prompt.trim(), enhanced: false });
  }
}
