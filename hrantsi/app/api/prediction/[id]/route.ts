import { NextResponse } from "next/server";
import { getPrediction, toClient, UserError } from "@/lib/replicate";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(toClient(await getPrediction(id)));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Սերվերի սխալ։" }, { status: 500 });
  }
}
