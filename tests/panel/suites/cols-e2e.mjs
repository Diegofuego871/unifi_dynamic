import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
async function frameOf(p) {
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  return f;
}
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));
const visibleHeads = (f) => ev(f, `return [...r.querySelectorAll("tr.head-row th")].filter(t=>getComputedStyle(t).display!=="none").map(t=>t.textContent.trim().replace(/[▲▼]/,""))`);
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  let f = await frameOf(p);
  await f.evaluate(() => localStorage.removeItem("unifi_dynamic_panel_prefs"));
  await p.reload(); f = await frameOf(p);
  check("Start: 10 Spalten sichtbar, kein Badge", (await visibleHeads(f)).length === 10 && await ev(f, `return r.querySelector(".cols-btn .count-badge").hidden`));
  const off = await (await p.$("#panel-frame")).boundingBox();
  const click = async (sel) => { const pt = await ev(f, `const b=r.querySelector('${sel}').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`); await p.mouse.click(off.x + pt.x, off.y + pt.y); await p.waitForTimeout(80); };
  await click(".cols-btn");
  check("Popover offen, unter dem Button", await ev(f, `const pp=r.querySelector(".cols-pop");const b=r.querySelector(".cols-btn").getBoundingClientRect();return !pp.hidden && pp.getBoundingClientRect().top>=b.bottom && pp.querySelectorAll("input.switch").length===8`));
  await p.screenshot({ path: `${outDir}/cols-pop.png` });
  await click('.cols-pop [data-colvis="mac"]');
  await click('.cols-pop [data-colvis="essid"]');
  let heads = await visibleHeads(f);
  check("MAC + SSID ausgeblendet (Titel)", heads.length === 8 && !heads.includes("MAC") && !heads.includes("SSID"), heads.join("|"));
  check("Auch Filterzeile + Zeilen", await ev(f, `const vis=(el)=>getComputedStyle(el).display!=="none";return !vis(r.querySelector("tr.filter-row th:nth-child(4)")) && !vis(r.querySelector("tbody tr[data-key] td:nth-child(4)")) && vis(r.querySelector("tbody tr[data-key] td:nth-child(3)"))`));
  check("Badge 2, Popover bleibt offen", await ev(f, `return r.querySelector(".cols-btn .count-badge").textContent==="2" && !r.querySelector(".cols-pop").hidden`));
  await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
  check("Polling: bleibt ausgeblendet", (await visibleHeads(f)).length === 8);
  await click(".toolbar-spacer");
  check("Klick ausserhalb schliesst (ohne Dialog zu öffnen)", await ev(f, `return r.querySelector(".cols-pop").hidden && !r.querySelector("dialog.device").open`));
  await click(".cols-btn");
  await click('tbody tr[data-key] td:nth-child(3)');
  check("Offen: Klick auf Zeile schliesst nur die Auswahl", await ev(f, `return r.querySelector(".cols-pop").hidden && !r.querySelector("dialog.device").open`));
  await click(".cols-btn");
  await p.keyboard.press("Escape");
  check("Esc schliesst, Fokus auf Button", await ev(f, `return r.querySelector(".cols-pop").hidden && r.activeElement===r.querySelector(".cols-btn")`));
  // Filter-Zurücksetzen lässt Spalten
  await ev(f, `r.querySelector(".reset-btn").click()`);
  check("Filter zurücksetzen lässt Spalten stehen", (await visibleHeads(f)).length === 8);
  await p.reload(); f = await frameOf(p);
  heads = await visibleHeads(f);
  check("Nach Neuladen weiterhin ausgeblendet", heads.length === 8 && !heads.includes("MAC"), heads.join("|"));
  check("Gespeichert in Einstellungen", JSON.stringify(await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")).hiddenColsWide)) === '["mac","essid"]');
  await p.screenshot({ path: `${outDir}/cols-hidden.png` });
  await ev(f, `r.querySelector(".cols-btn").click()`);
  await ev(f, `r.querySelector("[data-cols-all]").click()`);
  check("Alle einblenden", (await visibleHeads(f)).length === 10 && await ev(f, `return r.querySelector(".cols-btn .count-badge").hidden && [...r.querySelectorAll(".cols-pop input")].every(i=>i.checked)`));
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  const f = await frameOf(p);
  check("Handy: Spalten-Button ausgeblendet", await ev(f, `return getComputedStyle(r.querySelector(".cols-btn")).display==="none"`));
  await ev(f, `r.querySelector(".filter-btn").click()`);
  const off = await (await p.$("#panel-frame")).boundingBox();
  await ev(f, `r.querySelector('[data-fcolvis="linked"]').scrollIntoView({block:"center"})`);
  const pt = await ev(f, `const b=r.querySelector('[data-fcolvis="linked"]').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`);
  await p.touchscreen.tap(off.x + pt.x, off.y + pt.y);
  await p.waitForTimeout(100);
  const heads = await visibleHeads(f);
  check("Handy: HA-Gerät über Blatt ausgeblendet", !heads.includes("HA-Gerät") && heads.length === 9, heads.join("|"));
  await p.screenshot({ path: `${outDir}/cols-sheet.png` });
  await ctx.close();
}
await b.close(); process.exit(ok ? 0 : 1);
