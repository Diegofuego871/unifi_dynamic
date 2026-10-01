import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const URL = "http://127.0.0.1:8950/ha-sim-dialog.html";
async function frameOf(p) {
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  await p.waitForTimeout(200);
  return f;
}
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));
// Reihenfolge aus Titel-, Filter- und erster Datenzeile (Klassen c-*)
const layout = (f) => ev(f, `const k=(el)=>[...el.children].filter(c=>getComputedStyle(c).display!=="none").map(c=>[...c.classList].find(x=>x.startsWith("c-"))?.slice(2));
  return {head:k(r.querySelector("tr.head-row")), filt:k(r.querySelector("tr.filter-row")), row:k(r.querySelector("tbody tr[data-key]")), list:[...(r.querySelector(".cols-pop:not([hidden])")||r.querySelector("dialog.filters")).querySelectorAll(".col-row")].map(x=>x.dataset.colkey)}`);
const ud = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem("ud_unifi_dynamic_panel") || "null"));
const DEF = ["linked","ip","mac","essid","ap_name","conn","ping","seen_at","status"];
// Sichtbar (Ping-Spalte nur, solange ein Hub misst; im Simulator standardmässig aus)
const DEFV = DEF.filter((k) => k !== "ping");

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
await p.goto(URL);
let f = await frameOf(p);
await f.evaluate(() => localStorage.clear()); await p.evaluate(() => sessionStorage.clear());
await p.reload(); f = await frameOf(p);
const off = await (await p.$("#panel-frame")).boundingBox();
const center = async (sel) => { const b = await ev(f, `const b=r.querySelector('${sel}').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`); return { x: off.x + b.x, y: off.y + b.y }; };
await p.mouse.click(...Object.values(await center(".cols-btn")));
await p.waitForTimeout(100);
let L = await layout(f);
check("Griffe in der Liste, Standardreihenfolge", JSON.stringify(L.list) === JSON.stringify(DEFV) && await ev(f, `return r.querySelectorAll(".cols-pop .col-handle").length===8`));
await p.screenshot({ path: `${outDir}/order-pop.png` });
// Maus: Status (letzte) an 2. Stelle ziehen (auf IP)
const s0 = await center('.cols-pop [data-colmove="status"]');
const t0 = await center('.cols-pop [data-colmove="ip"]');
await p.mouse.move(s0.x, s0.y); await p.mouse.down();
for (let i = 1; i <= 12; i++) { await p.mouse.move(s0.x, s0.y + (t0.y - 8 - s0.y) * i / 12); await p.waitForTimeout(16); }
await p.mouse.up(); await p.waitForTimeout(150);
L = await layout(f);
const exp1 = ["name","linked","status","ip","mac","essid","ap_name","conn","seen_at","actions"];
check("Maus-Ziehen: Titel, Filter, Zeilen in neuer Reihenfolge", JSON.stringify(L.head) === JSON.stringify(exp1) && JSON.stringify(L.filt) === JSON.stringify(exp1) && JSON.stringify(L.row) === JSON.stringify(exp1), JSON.stringify(L));
check("Liste folgt, Popover bleibt offen", JSON.stringify(L.list) === JSON.stringify(exp1.slice(1, -1)) && await ev(f, `return !r.querySelector(".cols-pop").hidden`));
// Tastatur: MAC eine Stelle hoch
await ev(f, `r.querySelector('.cols-pop [data-colmove="mac"]').focus()`);
await p.keyboard.press("ArrowUp");
L = await layout(f);
check("Pfeil hoch: MAC vor IP, Fokus bleibt auf Griff", L.list.indexOf("mac") === L.list.indexOf("ip") - 1 && await ev(f, `return r.activeElement?.dataset.colmove==="mac"`), JSON.stringify(L.list));
// Filter funktioniert in verschobener Spalte, Status-Auswahl synchron
await ev(f, `const el=r.querySelector('tr.filter-row [data-col="ip"]'); el.value="192.0.2.11"; el.dispatchEvent(new Event("input",{bubbles:true}))`);
check("Filter in verschobener Spalte wirkt", (await ev(f, `return r.querySelectorAll("tbody tr[data-key]").length`)) === 10);
// Ausblenden + Reihenfolge kombiniert
await ev(f, `const i=r.querySelector('.cols-pop [data-colvis="status"]'); i.checked=false; i.dispatchEvent(new Event("change",{bubbles:true}))`);
L = await layout(f);
check("Ausgeblendete verschobene Spalte weg", !L.head.includes("status") && !L.row.includes("status"));
await p.waitForTimeout(600);
let d = await ud(p);
check("HA-Speicher: Reihenfolge breit, schmal unverändert", JSON.stringify(d.colOrderWide) === JSON.stringify(["linked","status","mac","ip","essid","ap_name","ping","conn","seen_at"]) && JSON.stringify(d.colOrderNarrow) === JSON.stringify(DEF), JSON.stringify(d));
// Neuladen ohne lokale Kopie (anderes Gerät)
await f.evaluate(() => localStorage.clear());
await p.reload(); f = await frameOf(p);
L = await layout(f);
check("Anderes Gerät: Reihenfolge von HA", JSON.stringify(L.head) === JSON.stringify(["name","linked","mac","ip","essid","ap_name","conn","seen_at","actions"]), JSON.stringify(L.head));
check("Sortierpfeil nach Umbau", (await ev(f, `r.querySelector('th[data-sort-key="mac"]').click(); return r.querySelector('th[data-sort-key="mac"] .sort-arrow').textContent`)) === "▲");
// Standard
await ev(f, `r.querySelector(".cols-btn").click()`);
await ev(f, `r.querySelector("[data-cols-default]").click()`);
L = await layout(f);
check("Standard: Reihenfolge + alle sichtbar", JSON.stringify(L.head) === JSON.stringify(["name", ...DEFV, "actions"]) && JSON.stringify(L.list) === JSON.stringify(DEFV), JSON.stringify(L));
await ctx.close();

// Handy: Ziehen mit dem Finger im Filter-Blatt
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await m.newPage();
mp.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
await mp.goto(URL);
let mf = await frameOf(mp);
const cdp = await m.newCDPSession(mp);
await ev(mf, `r.querySelector(".filter-btn").click()`);
await ev(mf, `r.querySelector('.sheet-cols [data-colmove="ip"]').scrollIntoView({block:"center"})`);
await mp.waitForTimeout(200);
const moff = await (await mp.$("#panel-frame")).boundingBox();
const pos = async (sel) => { const b = await ev(mf, `const b=r.querySelector('${sel}').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`); return { x: moff.x + b.x, y: moff.y + b.y }; };
const a = await pos('.sheet-cols [data-colmove="ip"]');
const z = await pos('.sheet-cols [data-colmove="linked"]');
const sheetTop0 = await ev(mf, `return r.querySelector("dialog.filters").scrollTop`);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
for (let i = 1; i <= 12; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y + (z.y - a.y - 8) * i / 12 }] }); await mp.waitForTimeout(16); }
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await mp.waitForTimeout(200);
L = await layout(mf);
check("Finger: IP vor HA-Gerät (Blatt scrollt nicht mit)", L.list[0] === "ip" && L.list[1] === "linked" && (await ev(mf, `return r.querySelector("dialog.filters").scrollTop`)) === sheetTop0, JSON.stringify(L.list));
await mp.screenshot({ path: `${outDir}/order-sheet.png` });
await mp.waitForTimeout(600);
d = await ud(mp);
check("Handy: nur schmale Reihenfolge geändert", d.colOrderNarrow[0] === "ip" && JSON.stringify(d.colOrderWide) === JSON.stringify(DEF), JSON.stringify(d));
await ev(mf, `r.querySelector("[data-fapply]").click()`);
L = await layout(mf);
check("Handy-Tabelle: Alias bleibt erste (fixierte) Spalte, dann IP", L.head[0] === "name" && L.head[1] === "ip", JSON.stringify(L.head));
await b.close(); process.exit(ok ? 0 : 1);
