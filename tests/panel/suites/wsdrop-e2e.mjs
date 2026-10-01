import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;

async function setup(mobile, hubs) {
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html${hubs ? "?hubs=2" : ""}`);
  await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await p.reload();
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  const ev = (code) => f.evaluate(new Function(`const r=${R};` + code));
  const off = await (await p.$("#panel-frame")).boundingBox();
  const click = async (sel) => {
    const bb = await ev(`const e=r.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:"center"}); const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}`);
    if (!bb) throw new Error("not found " + sel);
    if (mobile) await p.touchscreen.tap(off.x + bb.x, off.y + bb.y); else await p.mouse.click(off.x + bb.x, off.y + bb.y);
    await p.waitForTimeout(120);
  };
  return { ctx, p, f, ev, click, errors };
}

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const t = await setup(mobile, false);
  const { p, ev, click } = t;
  const rows = () => ev(`return r.querySelectorAll("tbody tr[data-key]").length`);
  const banner = () => ev(`const e=r.querySelector(".error-banner"); return e && getComputedStyle(e).display!=="none" ? e.innerText : ""`);
  const n0 = await rows();
  // App im Hintergrund, Verbindung weg, beim Öffnen feuert der Abruf
  await p.evaluate(() => { window.__wsDown = 3; window.__listFails = 0; });
  await t.f.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(3500);
  const fails = await p.evaluate(() => window.__listFails);
  check(`[${tag}] Code 3: keine Meldung, Daten bleiben, Wiederholung läuft`, (await banner()) === "" && (await rows()) === n0 && fails >= 2, `fails=${fails} banner=${await banner()}`);
  // Verbindung zurück -> nächste Wiederholung lädt
  await p.evaluate(() => { window.__wsDown = null; });
  await p.waitForTimeout(5000);
  check(`[${tag}] nach Wiederverbindung geladen, keine Meldung`, (await banner()) === "" && (await rows()) === n0);
  // Dauerhaft weg -> nach 30 s verständliche Meldung statt "3"
  await p.evaluate(() => { window.__wsDown = 3; });
  await t.f.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(33000);
  const b1 = await banner();
  check(`[${tag}] nach 30 s Klartext-Meldung`, b1.includes("Keine Verbindung zu Home Assistant") && !/: 3\b/.test(b1), b1);
  await p.evaluate(() => { window.__wsDown = null; });
  await p.waitForTimeout(16000);
  check(`[${tag}] erholt sich selbst, Meldung weg`, (await banner()) === "");
  // Objekt-Formen des Verbindungsfehlers: still überbrückt, nie "[object Object]"
  for (const form of [{ type: "result", success: false, error: { code: 3, message: "Connection lost" } }, { code: 3, message: "Connection lost" }]) {
    await p.evaluate((f) => { window.__wsDown = f; window.__listFails = 0; }, form);
    await t.f.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await p.waitForTimeout(2500);
    const fl = await p.evaluate(() => window.__listFails);
    check(`[${tag}] Form ${JSON.stringify(form).slice(0, 30)}: still, Wiederholung`, (await banner()) === "" && fl >= 2, `fails=${fl} ${await banner()}`);
    await p.evaluate(() => { window.__wsDown = null; });
    await p.waitForTimeout(4500);
  }
  // Unbekanntes Objekt ohne message: lesbarer Text
  await p.evaluate(() => { window.__wsDown = { error: { code: "unknown_command" } }; });
  await t.f.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(800);
  { const bt = await banner(); check(`[${tag}] Objekt ohne message: Fehlercode statt [object Object]`, bt.includes("Fehlercode unknown_command") && !bt.includes("[object"), bt); }
  await p.evaluate(() => { window.__wsDown = null; });
  await t.f.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(800);
  // Echter Fehler weiterhin sofort sichtbar
  await p.evaluate(() => { window.__wsDown = new Error("boom"); });
  await click(".gear-btn").catch(() => {});
  await t.f.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await p.waitForTimeout(800);
  check(`[${tag}] echter Fehler sofort gemeldet`, (await banner()).includes("boom"));
  await p.evaluate(() => { window.__wsDown = null; });
  check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
  await t.ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
