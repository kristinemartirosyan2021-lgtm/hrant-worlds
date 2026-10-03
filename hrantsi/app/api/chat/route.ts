import Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM, claude, FALLBACK_BETA, hasClaudeKey, MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 300;

type ChatMessage = { role: "user" | "assistant"; text: string; images?: string[] };

const DATA_URI = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/;

function toParam(m: ChatMessage): Anthropic.Beta.BetaMessageParam {
  if (m.role === "assistant" || !m.images?.length) {
    return { role: m.role, content: m.text || "…" };
  }
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of m.images) {
    const match = DATA_URI.exec(img);
    if (!match) continue;
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: match[2],
      },
    });
  }
  content.push({ type: "text", text: m.text || "Ի՞նչ կա այս նկարում։" });
  return { role: "user", content };
}

export async function POST(req: Request) {
  if (!hasClaudeKey()) {
    return new Response(
      "⚠️ ANTHROPIC_API_KEY-ը կարգավորված չէ։ Ավելացրու այն .env.local ֆայլում (տես README), և զրույցը կաշխատի։",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  const history = messages.slice(-40).map(toParam);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = claude().beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system: CHAT_SYSTEM,
          messages: history,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\n⚠️ Կներես, այս հարցին չեմ կարող պատասխանել։"));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n…(պատասխանը կտրվեց, գրիր «շարունակիր»)"));
        }
      } catch (err) {
        let msg = "Սխալ տեղի ունեցավ։ Փորձիր նորից։";
        if (err instanceof Anthropic.AuthenticationError) msg = "Claude-ի API բանալին սխալ է։";
        else if (err instanceof Anthropic.RateLimitError) msg = "Շատ հարցումներ են․ մի քիչ սպասիր և փորձիր նորից։";
        else if (err instanceof Anthropic.BadRequestError) msg = `Հարցումը սխալ է՝ ${err.message}`;
        else console.error(err);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
