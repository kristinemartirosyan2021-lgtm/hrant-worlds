import { NextResponse } from "next/server";
import { COSTS, currentUser, recordGeneration, refundGeneration, spend, addCredits } from "@/lib/billing";
import { startPrediction, toClient, UserError, type GenerateRequest, type Task } from "@/lib/replicate";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASKS: Task[] = ["image", "edit", "video", "upscale", "remove-bg"];
const LABELS: Record<Task, string> = {
  image: "Նկար",
  edit: "Խմբագրում",
  video: "Վիդեո",
  upscale: "Որակի բարձրացում",
  "remove-bg": "Ֆոնի հեռացում",
};

export async function POST(req: Request) {
  let charged: { email: string; cost: number } | null = null;
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Մուտք գործիր՝ շարունակելու համար։" }, { status: 401 });

    const body = (await req.json()) as GenerateRequest;
    if (!TASKS.includes(body.task)) {
      return NextResponse.json({ error: "Անհայտ գործողություն։" }, { status: 400 });
    }

    const cost = COSTS[body.task];
    if (!(await spend(user.email, cost, LABELS[body.task]))) {
      return NextResponse.json(
        { error: `Բավարար կրեդիտ չկա (պետք է ${cost})։ Լիցքավորիր «Կրեդիտներ» բաժնում։`, code: "no_credits" },
        { status: 402 },
      );
    }
    charged = { email: user.email, cost };

    const prediction = await startPrediction(body);
    await recordGeneration(prediction.id, user.email, cost);
    charged = null; // այսուհետ վերադարձը կատարվում է generations աղյուսակով
    if (prediction.status === "failed" || prediction.status === "canceled") {
      await refundGeneration(prediction.id);
    }
    return NextResponse.json(toClient(prediction));
  } catch (err) {
    if (charged) await addCredits(charged.email, charged.cost, "Վերադարձ՝ սխալ").catch(console.error);
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Սերվերի սխալ։ Փորձիր նորից։" }, { status: 500 });
  }
}
