// Օգտատերեր և կրեդիտներ (Postgres, օր․՝ Neon)։
// Աղյուսակները ստեղծվում են ավտոմատ՝ առաջին հարցման ժամանակ։

import { neon } from "@neondatabase/serverless";
import { auth } from "@/auth";
import { UserError, type Task } from "./replicate";

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

// Քանի կրեդիտ արժե յուրաքանչյուր գործողությունը։
export const COSTS: Record<Task, number> = {
  image: num(process.env.HRANTSI_COST_IMAGE, 1),
  edit: num(process.env.HRANTSI_COST_EDIT, 1),
  video: num(process.env.HRANTSI_COST_VIDEO, 10),
  upscale: num(process.env.HRANTSI_COST_UPSCALE, 1),
  "remove-bg": num(process.env.HRANTSI_COST_REMOVE_BG, 1),
};

export const FREE_CREDITS = num(process.env.HRANTSI_FREE_CREDITS, 5);
export const CHAT_DAILY_LIMIT = num(process.env.HRANTSI_CHAT_DAILY_LIMIT, 30);

export type Pack = { credits: number; price: number };
export function packs(): Pack[] {
  try {
    if (process.env.HRANTSI_PACKS) return JSON.parse(process.env.HRANTSI_PACKS) as Pack[];
  } catch {
    /* սխալ JSON — օգտագործում ենք լռելյայնը */
  }
  return [
    { credits: 20, price: 1500 },
    { credits: 60, price: 4000 },
    { credits: 150, price: 9000 },
  ];
}

export function isAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

type Sql = ReturnType<typeof neon>;
let client: Sql | null = null;
let schema: Promise<void> | null = null;

async function db(): Promise<Sql> {
  if (!process.env.DATABASE_URL) {
    throw new UserError("DATABASE_URL-ը կարգավորված չէ։ Տես README-ի «Տվյալների բազա» բաժինը։");
  }
  client ??= neon(process.env.DATABASE_URL);
  const sql = client;
  schema ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users (
      email text PRIMARY KEY,
      name text,
      credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS ledger (
      id bigserial PRIMARY KEY,
      email text NOT NULL,
      delta integer NOT NULL,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS generations (
      prediction_id text PRIMARY KEY,
      email text NOT NULL,
      cost integer NOT NULL,
      refunded boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS chat_usage (
      email text NOT NULL,
      day date NOT NULL,
      count integer NOT NULL DEFAULT 0,
      PRIMARY KEY (email, day)
    )`;
  })().catch((err) => {
    schema = null;
    throw err;
  });
  await schema;
  return sql;
}

type Row = Record<string, unknown>;

export type CurrentUser = { email: string; name: string; image: string | null };

// Վերադարձնում է մուտք գործած օգտատիրոջը (և ստեղծում նրան բազայում առաջին անգամ)։
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const name = session?.user?.name ?? "";
  const sql = await db();
  const created = (await sql`
    INSERT INTO users (email, name, credits) VALUES (${email}, ${name}, ${FREE_CREDITS})
    ON CONFLICT (email) DO NOTHING RETURNING email`) as Row[];
  if (created.length > 0 && FREE_CREDITS > 0) {
    await sql`INSERT INTO ledger (email, delta, reason) VALUES (${email}, ${FREE_CREDITS}, 'Բարի գալուստ նվեր')`;
  }
  return { email, name, image: session?.user?.image ?? null };
}

export async function getCredits(email: string): Promise<number> {
  const sql = await db();
  const rows = (await sql`SELECT credits FROM users WHERE email = ${email}`) as Row[];
  return rows.length ? Number(rows[0].credits) : 0;
}

// Հանում է կրեդիտ։ Վերադարձնում է false, եթե բավարար չէ։
export async function spend(email: string, cost: number, reason: string): Promise<boolean> {
  if (cost <= 0) return true;
  const sql = await db();
  const rows = (await sql`
    UPDATE users SET credits = credits - ${cost}
    WHERE email = ${email} AND credits >= ${cost} RETURNING credits`) as Row[];
  if (!rows.length) return false;
  await sql`INSERT INTO ledger (email, delta, reason) VALUES (${email}, ${-cost}, ${reason})`;
  return true;
}

export async function addCredits(email: string, delta: number, reason: string): Promise<number | null> {
  const sql = await db();
  const rows = (await sql`
    UPDATE users SET credits = credits + ${delta}
    WHERE email = ${email} AND credits + ${delta} >= 0 RETURNING credits`) as Row[];
  if (!rows.length) return null;
  await sql`INSERT INTO ledger (email, delta, reason) VALUES (${email}, ${delta}, ${reason})`;
  return Number(rows[0].credits);
}

export async function recordGeneration(predictionId: string, email: string, cost: number) {
  const sql = await db();
  await sql`INSERT INTO generations (prediction_id, email, cost) VALUES (${predictionId}, ${email}, ${cost})
    ON CONFLICT (prediction_id) DO NOTHING`;
}

export async function generationOwner(predictionId: string): Promise<string | null> {
  const sql = await db();
  const rows = (await sql`SELECT email FROM generations WHERE prediction_id = ${predictionId}`) as Row[];
  return rows.length ? String(rows[0].email) : null;
}

// Ձախողված գեներացիայի կրեդիտը վերադարձնում է մեկ անգամ։
export async function refundGeneration(predictionId: string) {
  const sql = await db();
  const rows = (await sql`
    UPDATE generations SET refunded = true
    WHERE prediction_id = ${predictionId} AND refunded = false RETURNING email, cost`) as Row[];
  if (rows.length) {
    await addCredits(String(rows[0].email), Number(rows[0].cost), "Վերադարձ՝ ձախողված գեներացիա");
  }
}

// Զրույցը անվճար է, բայց ունի օրական սահմանաչափ։
export async function countChatMessage(email: string): Promise<boolean> {
  if (CHAT_DAILY_LIMIT <= 0) return true;
  const sql = await db();
  const rows = (await sql`
    INSERT INTO chat_usage (email, day, count) VALUES (${email}, CURRENT_DATE, 1)
    ON CONFLICT (email, day) DO UPDATE SET count = chat_usage.count + 1
    RETURNING count`) as Row[];
  return Number(rows[0].count) <= CHAT_DAILY_LIMIT;
}

export async function findUser(email: string) {
  const sql = await db();
  const users = (await sql`SELECT email, name, credits, created_at FROM users WHERE email = ${email}`) as Row[];
  if (!users.length) return null;
  const history = (await sql`
    SELECT delta, reason, created_at FROM ledger WHERE email = ${email}
    ORDER BY id DESC LIMIT 20`) as Row[];
  return { ...users[0], history };
}

export async function recentUsers() {
  const sql = await db();
  return (await sql`SELECT email, name, credits, created_at FROM users ORDER BY created_at DESC LIMIT 30`) as Row[];
}
