import { NextResponse } from "next/server";
import { addCredits, currentUser, findUser, isAdmin, recentUsers } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function admin() {
  const user = await currentUser();
  return user && isAdmin(user.email) ? user : null;
}

// GET ?email=...  — օգտատիրոջ տվյալները, կամ վերջին գրանցվածները
export async function GET(req: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Մուտքը արգելված է։" }, { status: 403 });
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase();
  if (email) {
    const user = await findUser(email);
    return user ? NextResponse.json({ user }) : NextResponse.json({ error: "Այդպիսի օգտատեր չկա։" }, { status: 404 });
  }
  return NextResponse.json({ users: await recentUsers() });
}

// POST {email, amount, note} — կրեդիտ ավելացնել (կամ հանել՝ բացասական թվով)
export async function POST(req: Request) {
  const me = await admin();
  if (!me) return NextResponse.json({ error: "Մուտքը արգելված է։" }, { status: 403 });
  const { email, amount, note } = (await req.json()) as { email?: string; amount?: number; note?: string };
  const target = email?.trim().toLowerCase();
  const delta = Math.trunc(Number(amount));
  if (!target || !delta || Math.abs(delta) > 100000) {
    return NextResponse.json({ error: "Լրացրու email-ը և կրեդիտների քանակը։" }, { status: 400 });
  }
  const reason = `Ադմին (${me.email})${note ? `՝ ${note}` : ""}`.slice(0, 200);
  const credits = await addCredits(target, delta, reason);
  if (credits === null) {
    return NextResponse.json(
      { error: "Չստացվեց․ օգտատերը պետք է գոնե մեկ անգամ մուտք գործած լինի, և հաշվեկշիռը չի կարող բացասական լինել։" },
      { status: 400 },
    );
  }
  return NextResponse.json({ credits });
}
