// Կայքի ավտոմատ ստուգում հեռախոսի չափսով բրաուզերում։
// Գործարկել՝  node aiqez/tests/smoke.test.mjs   (պահանջում է Playwright)
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(dir, "..", "index.html")).href;
const shotDir = process.env.SHOT_DIR;

// 1×1 PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==",
  "base64"
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
const jsErrors = [];
const requests = [];
page.on("pageerror", (e) => jsErrors.push(e.message));
page.on("request", (r) => { if (!/^(file|blob|data):/.test(r.url()) && !r.url().includes("fonts.")) requests.push(r.url()); });

await page.goto(url);
const step = async (name, fn) => { await fn(); console.log("✓", name); };

await step("Գլխավոր էջ և փորձնական ռեժիմի նշում", async () => {
  assert.match(await page.locator("h1").innerText(), /Քո գաղափարը՝ անհատական երգի, նկարի կամ վիդեոյի տեսքով/);
  assert.equal(await page.locator(".hero .btn-primary").innerText(), "Պատվիրել");
  assert.match(await page.locator(".demo-bar").innerText(), /Փորձնական ռեժիմ/);
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(noHScroll, "horizontal scroll");
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "1-home.png") });
});

await step("4 ծառայություն, գին՝ «Արժեքը՝ ըստ պատվերի»", async () => {
  assert.equal(await page.locator(".card").count(), 4);
  const prices = await page.locator(".card .price").allInnerTexts();
  assert.ok(prices.every((p) => p === "Արժեքը՝ ըստ պատվերի"));
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
  assert.equal(await page.locator(".preview").count(), 2);
  assert.match(await page.locator("#e-photos").innerText(), /նկար չէ/);
  await page.locator(".preview-rm").first().click();
  assert.equal(await page.locator(".preview").count(), 1);
});

await step("Ճիշտ լրացում → ամփոփում", async () => {
  await page.fill("#f-name", "Անի");
  await page.fill("#f-contact", "@ani_test");
  await page.locator('label[for="lang-ru"]').click();
  const d = new Date(); d.setDate(d.getDate() + 7);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.fill("#f-date", iso);
  await page.fill("#f-details", "Ընտանեկան ֆոտոշարք ամանորյա ոճով, 5 նկար։");
  await page.locator('#order-form button[type="submit"]').click();
  await page.waitForSelector("#summary:not([hidden])");
  const text = await page.locator("#summary-body").innerText();
  for (const s of ["Անի", "@ani_test", "AI դիմանկար և ֆոտոշարք", "Ռուսերեն", "1 հատ", "Արժեքը՝ ըստ պատվերի"]) assert.ok(text.includes(s), s);
  assert.equal(await page.locator(".summary-thumbs img").count(), 1);
  await page.waitForTimeout(400);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "4-summary.png") });
});

await step("Ուղարկում փորձնական ռեժիմում ՉԻ ներկայացվում որպես հաջող", async () => {
  await page.click("#confirm-send");
  await page.waitForSelector(".result");
  assert.equal(await page.locator(".result-ok").count(), 0);
  assert.match(await page.locator(".result-demo h3").innerText(), /չի ուղարկվել/);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, "5-demo-result.png") });
  await page.locator(".result .btn").click();
  assert.equal(await page.locator("#f-name").inputValue(), "Անի", "form keeps data");
});

assert.deepEqual(requests, [], "no network requests besides fonts");
assert.deepEqual(jsErrors, [], "no JS errors");
console.log("\nԲոլոր ստուգումներն անցան ✔");
await browser.close();
