import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
async function setup(opts, clear = true) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  if (clear) { await f.evaluate(() => localStorage.removeItem("unifi_dynamic_panel_prefs")); await p.reload(); }
  const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  return { ctx, p, f: f2 };
}
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));
const state = (f) => ev(f, `const n=(k)=>r.querySelector('[data-count="'+k+'"]').textContent;
  return {rows:r.querySelectorAll("tbody tr[data-key]").length, stats:n("all")+"/"+n("online")+"/"+n("offline"),
  chips:[...r.querySelectorAll(".chip")].map(c=>c.textContent.replace("✕","").trim()), fb:r.querySelector(".filter-btn .count-badge").hidden?0:+r.querySelector(".filter-btn .count-badge").textContent,
  rb:r.querySelector(".reset-btn .count-badge").hidden?0:+r.querySelector(".reset-btn .count-badge").textContent, foot:r.querySelector(".foot-count").textContent}`);
{
  const { ctx, p, f } = await setup({ viewport: { width: 1440, height: 900 } });
  let st = await state(f);
  check("Start: alle 40, keine Chips", st.rows === 40 && st.stats === "40/34/6" && st.chips.length === 0 && st.rb === 0, JSON.stringify(st));
  check("Fusszeile", /^40 von 40 Clients angezeigt · Stand \d/.test(st.foot), st.foot);
  // IP-Filter per echter Tastatur
  await ev(f, `r.querySelector('tr.filter-row [data-col="ip"]').focus()`);
  await p.keyboard.type("192.0.2.11");
  st = await state(f);
  check("IP-Filter: 10 Zeilen (110-119), Zähler folgen", st.rows === 10 && st.stats.startsWith("10/"), JSON.stringify(st));
  check("Chip + Badge", st.chips[0] === "IP:192.0.2.11" && st.rb === 1, JSON.stringify(st.chips));
  check("Feld markiert + Fokus bleibt", await ev(f, `const el=r.querySelector('tr.filter-row [data-col="ip"]');return el.classList.contains("on") && r.activeElement===el`));
  await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
  check("Polling: Fokus + Wert bleiben", await ev(f, `const el=r.querySelector('tr.filter-row [data-col="ip"]');return r.activeElement===el && el.value==="192.0.2.11" && el.selectionStart===10`));
  // kombinieren: AP
  await ev(f, `const el=r.querySelector('tr.filter-row [data-col="ap_name"]'); el.value="büro"; el.dispatchEvent(new Event("input",{bubbles:true}))`);
  st = await state(f);
  const aps = await ev(f, `return [...r.querySelectorAll("tbody tr[data-key] td:nth-child(6)")].map(t=>t.textContent.trim())`);
  check("Kombiniert IP + AP (gross/klein egal)", st.rows > 0 && st.rows < 10 && aps.every((a) => a === "Büro") && st.chips.length === 2, JSON.stringify([st, aps]));
  // Status-Auswahl <-> Statusleiste
  await ev(f, `r.querySelector('.stat[data-filter="offline"]').click()`);
  check("Statusleiste setzt Status-Auswahl", await ev(f, `return r.querySelector('.filter-status').value==="offline" && r.querySelector('.filter-status').classList.contains("on")`));
  await ev(f, `const s=r.querySelector('.filter-status'); s.value="all"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
  check("Status-Auswahl setzt Statusleiste", await ev(f, `return r.querySelector('.stat.active').dataset.filter==="all"`));
  // Chip entfernen
  await ev(f, `r.querySelector('.chip[data-chip="ip"]').click()`);
  st = await state(f);
  check("Chip ✕ entfernt Filter + leert Feld", st.chips.length === 1 && await ev(f, `return r.querySelector('tr.filter-row [data-col="ip"]').value===""`), JSON.stringify(st));
  // MAC ohne Trenner
  await ev(f, `r.querySelector('.chips-clear').click()`);
  await ev(f, `const el=r.querySelector('tr.filter-row [data-col="mac"]'); el.value="EE07"; el.dispatchEvent(new Event("input",{bubbles:true}))`);
  st = await state(f);
  check("Alle entfernen + MAC ohne Doppelpunkte", st.rows === 1 && (await ev(f, `return r.querySelector("tbody tr[data-key]").dataset.mac`)) === "aa:bb:cc:dd:ee:07", JSON.stringify(st));
  // Verbindung + Zuletzt gesehen
  await ev(f, `const el=r.querySelector('tr.filter-row [data-col="mac"]'); el.value=""; el.dispatchEvent(new Event("input",{bubbles:true}))`);
  await ev(f, `const s=r.querySelector('.filter-conn'); s.value="wired"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
  st = await state(f);
  check("Verbindung Kabel", st.stats === "6/5/1" && st.chips[0] === "Verbindung:Kabel", JSON.stringify(st));
  await ev(f, `const s=r.querySelector('.filter-conn'); s.value="all"; s.dispatchEvent(new Event("change",{bubbles:true})); const t=r.querySelector('.filter-seen'); t.value="1h"; t.dispatchEvent(new Event("change",{bubbles:true}))`);
  st = await state(f);
  check("Zuletzt gesehen < 1 Std. (sim: i*60 s -> alle 40)", st.rows === 40 && st.chips[0].startsWith("Zuletzt gesehen:"), JSON.stringify(st));
  await ev(f, `const t=r.querySelector('.filter-seen'); t.value="7d"; t.dispatchEvent(new Event("change",{bubbles:true}))`);
  st = await state(f);
  check("> 7 Tage: keine", st.rows === 0 && st.stats === "0/0/0", JSON.stringify(st));
  // Sortieren behält Filterfeld-Fokus
  await ev(f, `const t=r.querySelector('.filter-seen'); t.value="all"; t.dispatchEvent(new Event("change",{bubbles:true}))`);
  await ev(f, `r.querySelector('tr.filter-row [data-col="name"]').focus()`);
  await p.keyboard.type("e");
  await ev(f, `r.querySelector('th[data-sort-key="ip"]').click()`);
  check("Sortieren: Filterzeile bleibt (Wert erhalten)", await ev(f, `return r.querySelector('tr.filter-row [data-col="name"]').value==="e" && r.querySelector('th[data-sort-key="ip"] .sort-arrow').textContent==="▲"`));
  // Sticky Kopf + Filterzeile
  await ev(f, `r.querySelector(".content").scrollTop=600`);
  await p.waitForTimeout(100);
  const geo = await ev(f, `const c=r.querySelector(".content").getBoundingClientRect();const h=r.querySelector("tr.head-row th").getBoundingClientRect();const fr=r.querySelector("tr.filter-row th").getBoundingClientRect();return {c:c.top,h:h.top,fr:fr.top,hh:h.height,st:r.querySelector(".content").scrollTop}`);
  check("Sticky: Titel- und Filterzeile bleiben oben", geo.st > 100 && Math.abs(geo.h - geo.c) < 1 && Math.abs(geo.fr - (geo.c + 38)) < 1, JSON.stringify(geo));
  // Persistenz
  await p.reload();
  const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  st = await state(f2);
  check("Nach Neuladen: Textfilter bewusst nicht gespeichert, Sortierung schon", st.chips.length === 0 && (await ev(f2, `return r.querySelector('tr.filter-row [data-col="name"]').value===""  && r.querySelector('th[data-sort-key="ip"] .sort-arrow').textContent==="▲"`)), JSON.stringify(st));
  // Zurücksetzen
  await ev(f2, `r.querySelector(".reset-btn").click()`);
  st = await state(f2);
  check("Zurücksetzen: alles leer", st.rows === 40 && st.chips.length === 0 && st.rb === 0 && (await ev(f2, `return [...r.querySelectorAll("tr.filter-row .col-filter")].every(e=>e.value===""||e.value==="all")`)), JSON.stringify(st));
  await p.screenshot({ path: `${outDir}/filters-desk.png` });
  await ctx.close();
}
{
  const { ctx, p, f } = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  check("Handy: Filterzeile aus, Filter-Button an, Reset aus", await ev(f, `return getComputedStyle(r.querySelector("tr.filter-row")).display==="none" && getComputedStyle(r.querySelector(".filter-btn")).display!=="none" && getComputedStyle(r.querySelector(".reset-btn")).display==="none"`));
  const off = await (await p.$("#panel-frame")).boundingBox();
  const pos = await ev(f, `const b=r.querySelector(".filter-btn").getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`);
  await p.touchscreen.tap(off.x + pos.x, off.y + pos.y);
  await p.waitForTimeout(200);
  check("Filter-Blatt offen", await ev(f, `return r.querySelector("dialog.filters").open`));
  await ev(f, `r.querySelector('dialog.filters [data-fcol="ap_name"]').focus()`);
  await p.keyboard.type("Keller");
  let st = await state(f);
  const applyTxt = await ev(f, `return r.querySelector("[data-fapply]").textContent`);
  check("Blatt: Tippen filtert, Badge + Button-Text", st.fb === 1 && applyTxt === `${st.rows} von 40 Clients anzeigen` && st.rows > 0, JSON.stringify([st, applyTxt]));
  check("Blatt: Fokus bleibt beim Tippen", await ev(f, `return r.activeElement?.dataset.fcol==="ap_name" && r.activeElement.value==="Keller"`));
  await ev(f, `r.querySelector('dialog.filters [data-fseg="conn"][data-value="wireless"]').click()`);
  st = await state(f);
  check("Blatt: Segment Verbindung", st.fb === 2 && await ev(f, `return r.querySelector('dialog.filters [data-fseg="conn"].active').dataset.value==="wireless"`), JSON.stringify(st));
  await p.screenshot({ path: `${outDir}/filters-sheet.png` });
  await ev(f, `r.querySelector("[data-fapply]").click()`);
  st = await state(f);
  check("Anzeigen schliesst, Chips sichtbar", !(await ev(f, `return r.querySelector("dialog.filters").open`)) && st.chips.length === 2, JSON.stringify(st));
  await p.screenshot({ path: `${outDir}/filters-mob.png` });
  await ev(f, `r.querySelector(".filter-btn").click()`);
  await ev(f, `r.querySelector("[data-fclear]").click()`);
  st = await state(f);
  check("Blatt: Alle entfernen", st.fb === 0 && st.rows === 40, JSON.stringify(st));
  await ev(f, `r.querySelector("[data-fapply]").click()`);
  // Sticky erste Spalte beim seitlichen Scrollen
  await ev(f, `r.querySelector(".content").scrollLeft=300`);
  await p.waitForTimeout(100);
  const g = await ev(f, `const c=r.querySelector(".content").getBoundingClientRect();const td=r.querySelector("tbody td").getBoundingClientRect();return {c:c.left,td:td.left,sl:r.querySelector(".content").scrollLeft}`);
  check("Handy: Alias-Spalte bleibt stehen", g.sl > 100 && Math.abs(g.td - g.c) < 2, JSON.stringify(g));
  await ctx.close();
}
await b.close(); process.exit(ok ? 0 : 1);
