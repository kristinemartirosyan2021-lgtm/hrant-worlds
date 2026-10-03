import { NextResponse } from "next/server";
import { startPrediction, toClient, UserError, type GenerateRequest, type Task } from "@/lib/replicate";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASKS: Task[] = ["image", "edit", "video", "upscale", "remove-bg"];

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest;
    if (!TASKS.includes(body.task)) {
      return NextResponse.json({ error: "Անհայտ գործողություն։" }, { status: 400 });
    }
    const prediction = await startPrediction(body);
    return NextResponse.json(toClient(prediction));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Սերվերի սխալ։ Փորձիր նորից։" }, { status: 500 });
  }
}
