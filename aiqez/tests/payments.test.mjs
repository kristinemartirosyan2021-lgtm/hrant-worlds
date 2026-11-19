// Քարտով վճարման ընթացքի ստուգում (Netlify Functions + էջեր)։
// Գործարկել՝  cd aiqez && npm install && NODE_PATH=$(npm root -g) node tests/payments.test.mjs
//
// Ֆունկցիաները աշխատում են տեղական սերվերում, պահոցը՝ հիշողության մեջ,
// բանկը՝ փորձնական (PAYMENT_PROVIDER=test) կամ ArCa-ի կեղծ սերվեր։
// Թեստային գինը (10 000) դրվում է միայն այս թեստի ներսում, config.js-ը չի փոխվում։
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

process.env.AIQEZ_STORE = "memory";
process.env.PAYMENT_PROVIDER = "test";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = require(path.join(dir, "config.js"));
const TEST_PRICE = 10000;
config.services.find((s) => s.id === "song").price = TEST_PRICE; // միայն թեստի հիշողության մեջ

const fnDir = path.join(dir, "netlify", "functions");
const handlers = {};
for (const f of fs.readdirSync(fnDir)) {
  handlers[f.replace(/\.mjs$/, "")] = (await import(pathToFileURL(path.join(fnDir, f)).href)).default;
}
const payments = await import(pathToFileURL(path.join(dir, "netlify/lib/payments.mjs")).href);
const storeMod = await import(pathToFileURL(path.join(dir, "netlify/lib/store.mjs")).href);
const arca = await import(pathToFileURL(path.join(dir, "netlify/lib/providers/arca.mjs")).href);

const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css" };
const formPosts = [];

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, base);

  if (url.pathname.startsWith("/.netlify/functions/")) {
    const h = handlers[url.pathname.split("/").pop()];
    if (!h) { res.writeHead(404); res.end(); return; }
    const r = await h(new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }), {});
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  if (req.method === "POST") {
    formPosts.push({ type: req.headers["content-type"] || "", body: body.toString("utf8") });
    res.writeHead(200, { "content-type": "text/html" }); res.end("ok"); return;
  }
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const file = path.join(dir, rel);
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
process.env.URL = base;

const step = async (name, fn) => { await fn(); console.log("✓", name); };
const api = async (name, opts = {}) => {
  const r = await fetch(`${base}/.netlify/functions/${name}`, { redirect: "manual", ...opts });
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, data, location: r.headers.get("location") };
};
const post = (name, obj) => api(name, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const record = (order) => payments.loadPayment(order);
const paymentFormPosts = () => formPosts.filter((p) => p.body.includes("form-name=payment"));

/* ---------------- Սերվեր (API) ---------------- */

await step("payment-config. փորձնական ռեժիմ, միացված", async () => {
  const { data } = await api("payment-config");
  assert.deepEqual(data, { enabled: true, test: true, currency: "AMD" });
});

await step("Առանց հաստատված գնի ծառայության վճարումը մերժվում է", async () => {
  const { status, data } = await post("create-payment", { serviceId: "video", name: "Անի", contact: "@ani_test", language: "hy" });
  assert.equal(status, 409);
  assert.equal(data.error, "no_fixed_price");
  assert.match(data.message, /գինը դեռ հաստատված չէ/);
});

await step("Հաճախորդի ուղարկած գումարը անտեսվում է, գինը՝ config.js-ից", async () => {
  const { status, data } = await post("create-payment", { serviceId: "song", amount: 1, price: 1, name: "Անի", contact: "@ani_test", language: "hy" });
  assert.equal(status, 200);
  assert.equal(data.amount, TEST_PRICE);
  assert.equal(data.priceLabel, "10 000 ֏");
  assert.match(data.paymentUrl, /\/payment\/test-bank\.html\?pid=TEST-/);
  assert.equal((await record(data.order)).status, "pending");
});

await step("Վերադարձի URL-ի կեղծումը չի դարձնում պատվերը վճարված", async () => {
  const { data } = await post("create-payment", { serviceId: "song", name: "Անի", contact: "@ani_test" });
  const r1 = await api(`payment-return?order=${data.order}&status=paid&orderStatus=2`);
  assert.match(r1.location, /success\.html/); // success էջը ինքը ցույց կտա «ստուգում ենք»
  assert.equal((await record(data.order)).status, "pending");
  const s = await api(`payment-status?order=${data.order}`);
  assert.equal(s.data.status, "pending");
  const cb = await api(`payment-callback?orderNumber=${data.order}&status=1&operation=deposited`);
  assert.equal(cb.status, 200);
  assert.equal((await record(data.order)).status, "pending");
  assert.equal(paymentFormPosts().length, 0);
});

await step("Բանկի հաստատած գումարը չհամընկնելու դեպքում պատվերը վճարված չի նշվում", async () => {
  const { data } = await post("create-payment", { serviceId: "song", name: "Անի", contact: "@ani_test" });
  const rec = await record(data.order);
  const tb = storeMod.store(storeMod.TEST_BANK);
  const bank = await tb.get(rec.providerPaymentId, { type: "json" });
  await tb.setJSON(rec.providerPaymentId, { ...bank, amount: 1, state: "paid" });
  const s = await api(`payment-status?order=${data.order}`);
  assert.equal(s.data.status, "amount_mismatch");
  const r = await api(`payment-return?order=${data.order}`);
  assert.match(r.location, /failed\.html/);
  assert.equal(paymentFormPosts().length, 0);
});

await step("Անհայտ կամ սխալ պատվերի համարը", async () => {
  assert.equal((await api("payment-status?order=AQ-000000-ZZZZ")).status, 404);
  assert.equal((await api("payment-status?order=../../etc")).status, 404);
  assert.match((await api("payment-return?order=nope")).location, /failed\.html\?reason=unknown/);
});

/* ---------------- Բրաուզեր (հեռախոս) ---------------- */

const browser = await chromium.launch();
async function openSite() {
  const ctx = await browser.newContext({ ...devices["Galaxy S9+"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Թեստային գին նաև բրաուզերի config.js-ում (առաջին price: null-ը «song»-ինն է)
  await page.route("**/config.js", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace("price: null,", `price: ${TEST_PRICE},`) });
  });
  await page.goto(base + "/");
  await page.waitForFunction(() => document.readyState === "complete");
  return { ctx, page, errors };
}

function futureISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function orderToBank(page, name) {
  await page.locator('.card [data-service="song"]').click();
  await page.fill("#f-name", name);
  await page.fill("#f-contact", "+374 99 123456");
  await page.locator('label[for="lang-hy"]').click();
  await page.fill("#f-date", futureISO(5));
  await page.fill("#f-details", "Ծննդյան երգ մայրիկի համար, փոփ ոճով։");
  await page.locator('#order-form button[type="submit"]').click();
  await page.waitForSelector("#summary:not([hidden])");
  await page.waitForSelector("#confirm-pay:not([hidden])");
  await page.click("#confirm-pay");
  await page.waitForURL(/test-bank\.html/);
  await page.waitForSelector("#pay-details dd");
}

await step("Ծառայություն առանց գնի. քարտով վճարման կոճակ չկա", async () => {
  const { ctx, page } = await openSite();
  await page.locator('.card [data-service="video"]').click();
  await page.fill("#f-name", "Անի");
  await page.fill("#f-contact", "@ani_test");
  await page.locator('label[for="lang-hy"]').click();
  await page.fill("#f-date", futureISO(5));
  await page.fill("#f-details", "Կարճ տեսանյութ ծննդյան օրվա համար։");
  await page.locator('#order-form button[type="submit"]').click();
  await page.waitForSelector("#summary:not([hidden])");
  assert.equal(await page.locator("#confirm-pay").isHidden(), true);
  assert.equal(await page.locator("#confirm-send").innerText(), "Ուղարկել պատվերը");
  await ctx.close();
});

const shotDir = process.env.SHOT_DIR;

await step("Հաջող վճարում. պատվեր → գին → բանկ → վերադարձ → «վճարված» միայն սերվերի ստուգումից հետո", async () => {
  const { ctx, page, errors } = await openSite();
  const before = formPosts.length;
  await page.locator('.card [data-service="song"]').click();
  await page.fill("#f-name", "Անի");
  await page.fill("#f-contact", "+374 99 123456");
  await page.locator('label[for="lang-hy"]').click();
  await page.fill("#f-date", futureISO(5));
  await page.fill("#f-details", "Ծննդյան երգ մայրիկի համար, փոփ ոճով։");
  await page.locator('#order-form button[type="submit"]').click();
  await page.waitForSelector("#confirm-pay:not([hidden])");
  assert.match(await page.locator(".pay-amount").innerText(), /10 000 ֏/);
  assert.match(await page.locator(".pay-box").innerText(), /փորձնական ռեժիմում/);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "p1-summary.png") });
  await page.click("#confirm-pay");
  await page.waitForURL(/test-bank\.html/);
  await page.waitForSelector("#pay-details dd");
  assert.match(await page.locator(".test-bank-banner").innerText(), /ՓՈՐՁՆԱԿԱՆ ՎՃԱՐՈՒՄ/);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "p2-test-bank.png") });

  // Պատվերը պահվել է Netlify Forms-ում սերվերի տված համարով
  const orderPost = formPosts.slice(before).find((p) => p.body.includes('name="form-name"\r\n\r\norder'));
  assert.ok(orderPost, "order form posted");
  const orderNumber = orderPost.body.match(/name="order_number"\r\n\r\n(AQ-[^\r]+)/)[1];
  assert.match(orderPost.body, /name="payment"\r\n\r\nՔարտով՝ 10 000 ֏ — սպասում է բանկի հաստատմանը \(ՓՈՐՁՆԱԿԱՆ\)/);
  assert.equal((await record(orderNumber)).status, "pending");

  await page.click('[data-outcome="paid"]');
  await page.waitForURL(/success\.html/);
  await page.waitForSelector(".pay-icon.pay-ok");
  assert.equal(await page.locator("#pay-title").innerText(), "Վճարումը հաստատված է");
  assert.match(await page.locator("#pay-details").innerText(), new RegExp(orderNumber));
  assert.match(await page.locator(".test-note").innerText(), /իրական գումար չի գանձվել/);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "p3-success.png") });

  const rec = await record(orderNumber);
  assert.equal(rec.status, "paid");
  assert.ok(rec.paidAt);
  const pf = paymentFormPosts().filter((p) => p.body.includes(encodeURIComponent(orderNumber)));
  assert.equal(pf.length, 1, "payment recorded once");
  assert.match(decodeURIComponent(pf[0].body.replace(/\+/g, " ")), /status=Վճարված \(ՓՈՐՁՆԱԿԱՆ/);

  // Կրկնակի վերադարձը երկրորդ գրառում չի ստեղծում
  await api(`payment-return?order=${orderNumber}`);
  assert.equal(paymentFormPosts().filter((p) => p.body.includes(encodeURIComponent(orderNumber))).length, 1);
  // Վճարված պատվերը նորից վճարել հնարավոր չէ
  assert.equal((await post("create-payment", { retryOrder: orderNumber })).status, 409);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await step("Չեղարկված վճարում → չեղարկման էջ → կրկին փորձ → հաջողություն", async () => {
  const { ctx, page, errors } = await openSite();
  await orderToBank(page, "Արամ");
  await page.click('[data-outcome="cancelled"]');
  await page.waitForURL(/cancelled\.html/);
  await page.waitForSelector("#pay-actions button");
  assert.equal(await page.locator("#pay-title").innerText(), "Վճարումը չեղարկվեց");
  const orderNumber = new URL(page.url()).searchParams.get("order");
  assert.equal((await record(orderNumber)).status, "cancelled");
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "p4-cancelled.png") });
  await page.click("#pay-actions button");
  await page.waitForURL(/test-bank\.html/);
  await page.waitForSelector("#pay-details dd");
  await page.click('[data-outcome="paid"]');
  await page.waitForURL(/success\.html/);
  await page.waitForSelector(".pay-icon.pay-ok");
  const rec = await record(orderNumber);
  assert.equal(rec.status, "paid");
  assert.equal(rec.attempt, 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await step("Ձախողված վճարում → ձախողման էջ, պատվերը վճարված չէ", async () => {
  const { ctx, page, errors } = await openSite();
  await orderToBank(page, "Լիլիթ");
  await page.click('[data-outcome="declined"]');
  await page.waitForURL(/failed\.html/);
  await page.waitForSelector("#pay-actions button");
  assert.equal(await page.locator("#pay-title").innerText(), "Վճարումը չհաջողվեց");
  const orderNumber = new URL(page.url()).searchParams.get("order");
  assert.equal((await record(orderNumber)).status, "declined");
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "p5-failed.png") });
  assert.deepEqual(errors, []);
  await ctx.close();
});

await browser.close();

/* ---------------- ArCa ադապտեր (կեղծ բանկի սերվերով) ---------------- */

const arcaCalls = [];
let arcaNext = {};
const arcaServer = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const params = Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
  const method = req.url.split("/").pop();
  arcaCalls.push({ method, params });
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(arcaNext[method] || {}));
});
await new Promise((r) => arcaServer.listen(0, "127.0.0.1", r));

await step("ArCa. առանց միացման տվյալների վճարումն անջատված է, փորձնական բանկը՝ նույնպես", async () => {
  process.env.PAYMENT_PROVIDER = "arca";
  delete process.env.ARCA_USERNAME; delete process.env.ARCA_PASSWORD;
  assert.deepEqual((await api("payment-config")).data, { enabled: false, test: false, currency: "AMD" });
  assert.equal((await post("create-payment", { serviceId: "song", name: "Անի", contact: "@ani_test" })).status, 503);
  assert.equal((await api("test-bank?pid=x")).status, 404);
});

await step("ArCa. register.do և getOrderStatusExtended.do", async () => {
  process.env.ARCA_USERNAME = "test-user";
  process.env.ARCA_PASSWORD = "test-pass";
  process.env.ARCA_API_URL = `http://127.0.0.1:${arcaServer.address().port}/payment/rest`;
  assert.deepEqual((await api("payment-config")).data, { enabled: true, test: false, currency: "AMD" });

  arcaNext["register.do"] = { orderId: "bank-123", formUrl: "https://ipay.example/payment/merchants/pay.html?mdOrder=bank-123" };
  const { data } = await post("create-payment", { serviceId: "song", name: "Անի", contact: "@ani_test", language: "ru" });
  assert.equal(data.paymentUrl, "https://ipay.example/payment/merchants/pay.html?mdOrder=bank-123");
  const reg = arcaCalls.find((c) => c.method === "register.do").params;
  assert.equal(reg.amount, String(TEST_PRICE * 100));
  assert.equal(reg.currency, "051");
  assert.equal(reg.language, "ru");
  assert.equal(reg.orderNumber, data.order);
  assert.equal(reg.userName, "test-user");
  assert.match(reg.returnUrl, /payment-return\?order=AQ-/);
  assert.match(reg.failUrl, /&r=fail$/);

  arcaNext["getOrderStatusExtended.do"] = { errorCode: "0", orderStatus: 0, amount: TEST_PRICE * 100, currency: "051" };
  assert.equal((await api(`payment-status?order=${data.order}`)).data.status, "pending");

  arcaNext["getOrderStatusExtended.do"] = { errorCode: "0", orderStatus: 2, amount: TEST_PRICE * 100, currency: "051" };
  const cb = await api(`payment-callback?mdOrder=bank-123&orderNumber=${data.order}&operation=deposited&status=1`);
  assert.equal(cb.status, 200);
  const rec = await record(data.order);
  assert.equal(rec.status, "paid");
  assert.equal(rec.test, false);
  const st = arcaCalls.filter((c) => c.method === "getOrderStatusExtended.do").pop().params;
  assert.equal(st.orderId, "bank-123");

  arcaNext["register.do"] = { errorCode: "5", errorMessage: "Access denied" };
  const bad = await post("create-payment", { serviceId: "song", name: "Անի", contact: "@ani_test" });
  assert.equal(bad.status, 502);
  assert.match(bad.data.message, /Բանկի վճարման էջը այս պահին հասանելի չէ/);
  assert.equal(arca.isConfigured(), true);
});

arcaServer.close();
server.close();
console.log("\nՎճարման բոլոր ստուգումներն անցան ✔");
