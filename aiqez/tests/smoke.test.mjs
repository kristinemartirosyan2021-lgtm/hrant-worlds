// Կայքի ավտոմատ ստուգում հեռախոսի չափսով բրաուզերում։
// Գործարկել՝  NODE_PATH=$(npm root -g) node aiqez/tests/smoke.test.mjs   (պահանջում է Playwright)
//
// Կայքը բացվում է փոքր տեղական սերվերով, որը փոխարինում է Netlify-ին.
// ընդունում է POST / հարցումը և պահում այն ստուգման համար։
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotDir = process.env.SHOT_DIR;
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".css": "text/css" };

const posts = [];
const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      posts.push({ url: req.url, type: req.headers["content-type"] || "", body: Buffer.concat(chunks) });
      res.writeHead(200, { "content-type": "text/html" });
      res.end("ok");
    });
    return;
  }
  const rel = req.url === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0].slice(1));
  const file = path.join(dir, rel);
  if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

// 1×1 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch();
const step = async (name, fn) => { await fn(); console.log("✓", name); };

function futureISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ժամը ֆիքսված է, որպեսզի ակցիայի (մինչև նոյեմբերի 30) ստուգումները կախված չլինեն այսօրվա օրից։
const IN_PROMO = "2026-11-20T12:00:00+04:00";

async function openPage({ demo, now = IN_PROMO }) {
  const ctx = await browser.newContext({ ...devices["Galaxy S9+"] });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(now));
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  // Ռեժիմը ստուգման համար փոխում ենք config.js-ի պատասխանում, ֆայլը չի փոխվում։
  await page.route("**/config.js", async (route) => {
    const res = await route.fetch();
    const text = (await res.text()).replace(/^  demoMode: (true|false),/m, `  demoMode: ${demo},`);
    await route.fulfill({ response: res, body: text });
  });
  await page.goto(base);
  return { page, ctx, jsErrors };
}

async function fillValid(page, service = "portrait", pkg = "portrait-1") {
  await page.selectOption("#f-service", service);
  if (pkg) await page.locator(`label[for="pkg-${pkg}"]`).click();
  await page.fill("#f-name", "Անի");
  await page.fill("#f-contact", "@ani_test");
  await page.locator('label[for="lang-ru"]').click();
  await page.fill("#f-date", futureISO(7));
  await page.fill("#f-details", "Ընտանեկան ֆոտոշարք ամանորյա ոճով, 5 նկար։");
}

/* ---------------- Փորձնական ռեժիմ ---------------- */
{
  const { page, ctx, jsErrors } = await openPage({ demo: true });

  await step("Գլխավոր էջ և փորձնական ռեժիմի նշում", async () => {
    assert.match(await page.locator("h1").innerText(), /Քո գաղափարը՝ անհատական երգի, նկարի կամ վիդեոյի տեսքով/);
    assert.equal(await page.locator(".hero .btn-primary").innerText(), "Պատվիրել");
    assert.equal(await page.locator(".demo-bar").isVisible(), true);
    const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    assert.ok(noHScroll, "horizontal scroll");
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "1-home.png") });
  });

  await step("4 ծառայություն՝ փաթեթներով և գներով", async () => {
    assert.equal(await page.locator(".card").count(), 4);
    assert.deepEqual(await page.locator(".card .price").allInnerTexts(),
      ["սկսած 15 000 ֏", "սկսած 10 000 ֏", "սկսած 5 000 ֏", "10 000 ֏"]);
    const video = await page.locator(".card").nth(1).locator(".pkg-list").innerText();
    for (const s of ["Կարճ՝ 15 վայրկյան", "10 000 ֏", "3 րոպե", "35 000 ֏", "Ավելի երկար կամ հատուկ նախագիծ", "Արժեքը ճշտել"]) assert.ok(video.includes(s), s);
    assert.match(await page.locator(".card").nth(3).innerText(), /Ակցիա՝ մինչև նոյեմբերի 30-ը ներառյալ/);
    if (shotDir) { await page.locator("#services").scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, "2-services.png") }); }
  });

  await step("Ծառայությունից անցում ձևին՝ ընտրված ծառայությամբ", async () => {
    await page.locator('.card [data-service="santa"]').click();
    assert.equal(await page.locator("#f-service").inputValue(), "santa");
  });

  await step("Դատարկ ձև → հայերեն սխալներ", async () => {
    await page.locator("#f-service").selectOption("");
    await page.locator('#order-form button[type="submit"]').click();
    await page.waitForSelector("#error-summary:not([hidden])");
    const errs = await page.locator(".err:not(:empty)").allInnerTexts();
    assert.ok(errs.length >= 6, "errors: " + errs.length);
    assert.ok(errs.some((e) => e.includes("Գրիր քո անունը")));
    assert.equal(await page.locator("#summary").isHidden(), true);
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "3-errors.png") });
  });

  await step("Սխալ կոնտակտ և անցյալ ամսաթիվ", async () => {
    await page.fill("#f-contact", "12ab");
    await page.fill("#f-date", "2020-01-01");
    await page.locator('#order-form button[type="submit"]').click();
    assert.match(await page.locator("#e-contact").innerText(), /Telegram/);
    assert.match(await page.locator("#e-date").innerText(), /անցյալում/);
  });

  await step("Դիմանկարի համար լուսանկարը պարտադիր է", async () => {
    await page.selectOption("#f-service", "portrait");
    await page.locator('#order-form button[type="submit"]').click();
    assert.match(await page.locator("#e-photos").innerText(), /առնվազն 1 լուսանկար/);
  });

  await step("Լուսանկարների նախադիտում և հեռացում", async () => {
    await page.setInputFiles("#f-photos", [
      { name: "a.png", mimeType: "image/png", buffer: png },
      { name: "b.png", mimeType: "image/png", buffer: png },
      { name: "doc.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
    ]);
    await page.waitForSelector("#photos-busy[hidden]", { state: "attached" });
    assert.equal(await page.locator(".preview").count(), 2);
    assert.match(await page.locator("#e-photos").innerText(), /նկար չէ/);
    await page.locator(".preview-rm").first().click();
    assert.equal(await page.locator(".preview").count(), 1);
  });

  await step("Ճիշտ լրացում → ամփոփում", async () => {
    await fillValid(page);
    await page.locator('#order-form button[type="submit"]').click();
    await page.waitForSelector("#summary:not([hidden])");
    const text = await page.locator("#summary-body").innerText();
    for (const s of ["Անի", "@ani_test", "AI դիմանկար և ֆոտոշարք", "Մեկ նկար", "Ռուսերեն", "1 հատ", "5 000 ֏"]) assert.ok(text.includes(s), s);
    assert.equal(await page.locator(".summary-thumbs img").count(), 1);
  });

  await step("Փորձնական ռեժիմում ոչինչ չի ուղարկվում և հաջողություն չի ցույց տրվում", async () => {
    await page.click("#confirm-send");
    await page.waitForSelector(".result");
    assert.equal(await page.locator(".result-ok").count(), 0);
    assert.match(await page.locator(".result-demo h3").innerText(), /չի ուղարկվել/);
    assert.equal(posts.length, 0, "demo mode must not POST");
    await page.locator(".result .btn").click();
    assert.equal(await page.locator("#f-name").inputValue(), "Անի", "form keeps data");
  });

  assert.deepEqual(jsErrors, [], "no JS errors (demo)");
  await ctx.close();
}

/* ---------------- Իրական ուղարկում (Netlify Forms) ---------------- */
{
  const { page, ctx, jsErrors } = await openPage({ demo: false });

  await step("Իրական ռեժիմում փորձնական նշումները թաքնված են", async () => {
    assert.equal(await page.locator(".demo-bar").isHidden(), true);
    assert.equal(await page.locator(".order-section .demo-note").isHidden(), true);
  });

  await step("Netlify Forms-ի ձևը ունի բոլոր դաշտերը", async () => {
    const form = page.locator("#order-form");
    assert.equal(await form.getAttribute("name"), "order");
    assert.equal(await form.getAttribute("data-netlify"), "true");
    assert.equal(await form.getAttribute("enctype"), "multipart/form-data");
    for (const n of ["name", "contact", "service", "language", "date", "details", "price", "order_number", "photo_count", "bot-field", "photo1", "photo5"]) {
      assert.equal(await form.locator(`[name="${n}"]`).count() > 0, true, "field " + n);
    }
  });

  await step("Մեծ նկարը փոքրացվում է մինչև 2048 պիքսել JPEG", async () => {
    await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 4000; c.height = 3000;
      const g = c.getContext("2d");
      for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${i * 7},70%,50%)`; g.fillRect(Math.random() * 4000, Math.random() * 3000, 300, 300); }
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "big-photo.png", { type: "image/png" }));
      const input = document.getElementById("f-photos");
      input.files = dt.files;
      input.dispatchEvent(new Event("change"));
    });
    await page.waitForSelector(".preview");
    await page.waitForSelector("#photos-busy[hidden]", { state: "attached" });
    assert.match(await page.locator(".previews-count").innerText(), /1 \/ 5/);
  });

  await step("Ուղարկումը գնում է Netlify Forms՝ բոլոր տվյալներով և նկարով", async () => {
    await fillValid(page);
    await page.locator('#order-form button[type="submit"]').click();
    await page.waitForSelector("#summary:not([hidden])");
    await page.click("#confirm-send");
    await page.waitForSelector(".result-ok");
    assert.equal(posts.length, 1);
    const { url, type, body } = posts[0];
    assert.equal(url, "/");
    assert.match(type, /^multipart\/form-data/);
    const text = body.toString("utf8");
    const field = (n) => { const m = text.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)); return m && m[1]; };
    assert.equal(field("form-name"), "order");
    assert.equal(field("name"), "Անի");
    assert.equal(field("contact"), "@ani_test");
    assert.equal(field("service"), "AI դիմանկար և ֆոտոշարք");
    assert.equal(field("language"), "Ռուսերեն");
    assert.equal(field("price"), "5 000 ֏");
    assert.equal(field("package"), "Մեկ նկար");
    assert.equal(field("photo_count"), "1");
    assert.match(field("date"), /\d{4}թ\./);
    assert.match(field("order_number"), /^AQ-\d{6}-[A-Z0-9]{4}$/);
    assert.match(text, /name="photo1"; filename="big-photo\.jpg"\r\nContent-Type: image\/jpeg/);
    assert.ok(body.length < 3 * 1024 * 1024, "compressed upload: " + body.length);
    assert.match(await page.locator(".result-ok p").innerText(), new RegExp(field("order_number")));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "6-live-ok.png") });
  });

  await step("Հաջող ուղարկումից հետո ձևը մաքրվում է", async () => {
    await page.locator(".result .btn").click();
    assert.equal(await page.locator("#f-name").inputValue(), "");
    assert.equal(await page.locator(".preview").count(), 0);
  });

  assert.deepEqual(jsErrors, [], "no JS errors (live)");
  await ctx.close();
}

/* ---------------- Փաթեթներ և ակցիա ---------------- */
{
  const { page, ctx, jsErrors } = await openPage({ demo: false });

  await step("Առանց փաթեթի ընտրության պատվերը չի ընդունվում", async () => {
    await page.locator('.card [data-service="song"]').click();
    assert.equal(await page.locator("#package-field").isVisible(), true);
    assert.equal(await page.locator(".pkg-option").count(), 3);
    await page.locator('#order-form button[type="submit"]').click();
    assert.match(await page.locator("#e-package").innerText(), /Ընտրիր փաթեթը/);
  });

  await step("Ընտրված փաթեթի վերջնական գումարը ամփոփման մեջ", async () => {
    await fillValid(page, "song", "song-2m");
    assert.match(await page.locator("#service-price").innerText(), /25 000 ֏/);
    await page.locator('#order-form button[type="submit"]').click();
    await page.waitForSelector("#summary:not([hidden])");
    const text = await page.locator("#summary-body").innerText();
    assert.ok(text.includes("2 րոպե") && text.includes("25 000 ֏"));
    await page.locator("#summary [data-close]").first().click();
  });

  await step("«Արժեքը ճշտել» փաթեթ → հայտ առանց գանձման", async () => {
    const before = posts.length;
    await fillValid(page, "video", "video-custom");
    await page.locator('#order-form button[type="submit"]').click();
    await page.waitForSelector("#summary:not([hidden])");
    assert.match(await page.locator("#summary-body").innerText(), /Արժեքը ճշտել — կկապվենք/);
    assert.match(await page.locator("#summary-body").innerText(), /Քարտից գումար չի գանձվի/);
    assert.equal(await page.locator("#confirm-pay").isHidden(), true);
    assert.equal(await page.locator("#confirm-send").innerText(), "Ուղարկել հայտը");
    await page.click("#confirm-send");
    await page.waitForSelector(".result-ok");
    const text = posts[before].body.toString("utf8");
    assert.match(text, /name="package"\r\n\r\nԱվելի երկար կամ հատուկ նախագիծ/);
    assert.match(text, /name="price"\r\n\r\nԱրժեքը ճշտել/);
    assert.match(text, /name="payment"\r\n\r\nԱրժեքը ճշտել — հայտ առանց քարտային գանձման/);
  });

  assert.deepEqual(jsErrors, []);
  await ctx.close();
}

await step("Ձմեռ պապ. նոյեմբերի 30, 23:59 (Երևան)՝ 10 000 ֏", async () => {
  const { page, ctx } = await openPage({ demo: false, now: "2026-11-30T23:59:00+04:00" });
  assert.equal(await page.locator(".card .price").nth(3).innerText(), "10 000 ֏");
  await ctx.close();
});

await step("Ձմեռ պապ. դեկտեմբերի 1, 00:00 (Երևան)՝ «Ճշտել արժեքը», առանց վճարման", async () => {
  const { page, ctx, jsErrors } = await openPage({ demo: false, now: "2026-12-01T00:00:30+04:00" });
  assert.equal(await page.locator(".card .price").nth(3).innerText(), "Ճշտել արժեքը");
  assert.doesNotMatch(await page.locator(".card").nth(3).innerText(), /Ակցիա/);
  await page.locator('.card [data-service="santa"]').click();
  assert.match(await page.locator(".pkg-option").innerText(), /Ճշտել արժեքը/);
  await fillValid(page, "santa", null); // միակ փաթեթը ընտրվում է ինքնաբերաբար
  await page.fill("#f-date", "2026-12-20"); // էջի ժամը դեկտեմբերի 1 է
  await page.locator('#order-form button[type="submit"]').click();
  await page.waitForSelector("#summary:not([hidden])");
  assert.match(await page.locator("#summary-body").innerText(), /Ճշտել արժեքը — կկապվենք/);
  assert.equal(await page.locator("#confirm-send").innerText(), "Ուղարկել հայտը");
  assert.deepEqual(jsErrors, []);
  await ctx.close();
});

await browser.close();
server.close();
console.log("\nԲոլոր ստուգումներն անցան ✔");
