import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const P = `document.querySelector("unifi-dynamic-panel")`;
const p = await (await b.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
const ev = (code) => f.evaluate(new Function(`const r=${R}; const P=${P};` + code));
for (const scen of ["aktuell", "update"]) {
  await p.evaluate((s) => { window.__version = s === "update" ? { installed: "2.9.1", latest: "2.10.0" } : { installed: "2.9.1", latest: "2.9.1" }; }, scen);
  await ev(`r.querySelector(".gear-btn").click()`);
  await p.waitForTimeout(800);
  const same = await ev(`const before=r.querySelector('dialog.settings .ver-slot button'); for(let i=0;i<20;i++){ P.hass={...P.hass}; } return before && before===r.querySelector('dialog.settings .ver-slot button')`);
  check(`Versionsbereich (${scen}): Knopf bleibt bei 20 HA-Updates derselbe`, same);
  await ev(`P._closeSettings()`); await p.waitForTimeout(300);
}
// Filter-Chips und Hub-Auswahl: kein Neuaufbau bei unverändertem Inhalt
const chipSame = await ev(`const c=r.querySelector(".chips"); const n=c.firstElementChild; P._renderRows(); P._renderRows(); return c.firstElementChild===n`);
check("Chips: kein Neuaufbau ohne Änderung", chipSame);
// Abruf: nie zwei gleichzeitig, wartende Aufrufer bekommen frische Daten
const n0 = await p.evaluate(() => { window.__listDelay = 400; return window.__wsCalls.filter((m) => m.type === "unifi_dynamic/list_clients").length; });
const res = await ev(`const a=P._fetchClients(); const b=P._fetchClients(); const c=P._fetchClients(); return Promise.all([a,b,c]).then(()=>true)`);
const n1 = await p.evaluate(() => { window.__listDelay = 0; return window.__wsCalls.filter((m) => m.type === "unifi_dynamic/list_clients").length; });
check("Abruf: 3 gleichzeitige Aufrufe -> genau 2 Abfragen (laufende + eine Folge)", res === true && n1 - n0 === 2, String(n1 - n0));
// Im Hintergrund kein Poll
const before = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "unifi_dynamic/list_clients").length);
await f.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); });
await p.waitForTimeout(11000);
const after = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "unifi_dynamic/list_clients").length);
check("Hintergrund: kein Poll", after === before, `${before} -> ${after}`);
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
