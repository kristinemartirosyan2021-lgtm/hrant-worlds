import { NextResponse } from "next/server";
import { CHAT_DAILY_LIMIT, COSTS, currentUser, FREE_CREDITS, getCredits, isAdmin, packs } from "@/lib/billing";
import { UserError } from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const shop = {
    costs: COSTS,
    packs: packs(),
    freeCredits: FREE_CREDITS,
    chatDailyLimit: CHAT_DAILY_LIMIT,
    payInfo: process.env.HRANTSI_PAY_INFO ?? "",
    contact: process.env.HRANTSI_CONTACT ?? "",
  };
  const missing = ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "DATABASE_URL"].filter((k) => !process.env[k]);
  if (missing.length) {
    return NextResponse.json({
      signedIn: false,
      setupError: `Կայքը դեռ կարգավորված չէ։ Պակասում է՝ ${missing.join(", ")} (տես README)։`,
      ...shop,
    });
  }
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ signedIn: false, ...shop });
    return NextResponse.json({
      signedIn: true,
      ...user,
      credits: await getCredits(user.email),
      isAdmin: isAdmin(user.email),
      ...shop,
    });
  } catch (err) {
    const setupError = err instanceof UserError ? err.message : "Սերվերի սխալ։";
    if (!(err instanceof UserError)) console.error(err);
    return NextResponse.json({ signedIn: false, setupError, ...shop });
  }
}
