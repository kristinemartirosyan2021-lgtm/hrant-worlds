import { NextResponse } from "next/server";
import { currentUser, generationOwner, refundGeneration } from "@/lib/billing";
import { getPrediction, toClient, UserError } from "@/lib/replicate";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Մուտք գործիր։" }, { status: 401 });
    const { id } = await params;
    if ((await generationOwner(id)) !== user.email) {
      return NextResponse.json({ error: "Չգտնվեց։" }, { status: 404 });
    }
    const prediction = await getPrediction(id);
    if (prediction.status === "failed" || prediction.status === "canceled") {
      await refundGeneration(id);
    }
    return NextResponse.json(toClient(prediction));
  } catch (err) {
    if (err instanceof UserError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Սերվերի սխալ։" }, { status: 500 });
  }
}
