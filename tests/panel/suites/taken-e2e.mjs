import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;
const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
// Zusätzlich: ha-thermo (MAC-Vorschlag für 01) bei Client 03 verknüpfen
await p.evaluate(() => { window.__links["aa:bb:cc:dd:ee:03"] = "ha-thermo"; window.__links["aa:bb:cc:dd:ee:04"] = "ha-5"; try { localStorage.removeItem("unifi_dynamic_panel_prefs"); } catch {} });
const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
const ev = (code) => f.evaluate(new Function(`const r=${R};` + code));
const openPicker = async (mac) => {
  await ev(`r.querySelector('tr[data-mac="${mac}"] .menu-btn').click(); r.querySelector('.menu [data-action="details"]').click(); r.querySelector('[data-dlg="link-open"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
};
const picks = () => ev(`return [...r.querySelectorAll(".pick")].map(b=>({id:b.dataset.deviceId,taken:b.classList.contains("taken"),cur:b.classList.contains("current"),note:b.querySelector(".pick-taken")?.textContent||""}))`);
await openPicker("aa:bb:cc:dd:ee:01");
let ps = await picks();
check("Schalter standardmässig aus", await ev(`return r.querySelector('[data-dlg="picker-hide-linked"]').checked === false`));
check("MAC-Vorschlag bleibt oben, mit Hinweis", ps[0].id === "ha-thermo" && ps[0].taken && ps[0].note === "Bereits verknüpft mit: Storen Wohnen 3", JSON.stringify(ps[0]));
await ev(`const s=r.querySelector('[data-dlg="picker-search"]'); s.value="Gerät 05"; s.dispatchEvent(new Event("input",{bubbles:true}))`);
const h5 = (await picks()).find((x) => x.id === "ha-5");
check("ha-5 markiert mit beiden Clients", h5 && h5.note === "Bereits verknüpft mit: Werkbank Garage 2, Waschmaschine 4", JSON.stringify(h5));
await ev(`const s=r.querySelector('[data-dlg="picker-search"]'); s.value="Gerät 0"; s.dispatchEvent(new Event("input",{bubbles:true}))`);
ps = await picks();
const idx5 = ps.findIndex((x) => x.id === "ha-5");
check("Verknüpfte ans Ende sortiert", idx5 === ps.length - 1 && ps.slice(0, -1).every((x) => !x.taken), `idx=${idx5}/${ps.length}`);
await ev(`const s=r.querySelector('[data-dlg="picker-search"]'); s.value="Waschmasch"; s.dispatchEvent(new Event("input",{bubbles:true}))`);
ps = await picks();
check("Suche findet über Client-Namen", ps.length === 1 && ps[0].id === "ha-5", JSON.stringify(ps.map((x) => x.id)));
await ev(`const s=r.querySelector('[data-dlg="picker-search"]'); s.value=""; s.dispatchEvent(new Event("input",{bubbles:true}))`);
await p.screenshot({ path: `${OUT}/taken-marked.png` });
// Schalter per echtem Klick auf Label-Text
const lab = await ev(`const l=r.querySelector('.picker-toggle').getBoundingClientRect();return {x:l.left+l.width/2,y:l.top+l.height/2}`);
const off = await (await p.$("#panel-frame")).boundingBox();
await p.mouse.click(off.x + lab.x, off.y + lab.y);
await p.waitForTimeout(100);
ps = await picks();
check("Schalter an: Häkchen gesetzt", await ev(`return r.querySelector('[data-dlg="picker-hide-linked"]').checked`));
check("Schalter an: verknüpfte ausgeblendet (auch Vorschlag)", !ps.some((x) => x.taken) && !ps.some((x) => x.id === "ha-5" || x.id === "ha-thermo"));
check("Hinweis Anzahl ausgeblendet", (await ev(`return r.querySelector("dialog.device").innerText`)).includes("2 bereits verknüpfte Geräte ausgeblendet."));
check("Einstellung gespeichert", await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")).hideLinked === true));
await p.screenshot({ path: `${OUT}/taken-hidden.png` });
// Polling behält Zustand
await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
check("Polling: Schalter bleibt an", await ev(`return r.querySelector('[data-dlg="picker-hide-linked"]').checked`));
// Eigenes verknüpftes Gerät bleibt sichtbar bei Schalter an: Client 02 (ha-5, auch bei 04)
await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
await openPicker("aa:bb:cc:dd:ee:02");
ps = await picks();
const own = ps.find((x) => x.id === "ha-5");
check("Eigenes Gerät bleibt sichtbar trotz Schalter", own && own.cur, JSON.stringify(own));
// Tastatur: Leertaste auf Checkbox
await ev(`r.querySelector('[data-dlg="picker-hide-linked"]').focus()`);
await p.keyboard.press("Space");
await p.waitForTimeout(100);

check("Leertaste schaltet aus, Fokus bleibt", await ev(`return !r.querySelector('[data-dlg="picker-hide-linked"]').checked && r.activeElement?.dataset.dlg === "picker-hide-linked"`));
await ev(`const s=r.querySelector('[data-dlg="picker-search"]'); s.value="Bodenheizung"; s.dispatchEvent(new Event("input",{bubbles:true}))`);

check("Aus: markierte wieder da", (await picks()).some((x) => x.taken && x.id === "ha-thermo"));
// Neuladen: Einstellung wiederhergestellt
await ev(`r.querySelector('[data-dlg="picker-hide-linked"]').click()`);
await p.reload();
const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
check("Nach Neuladen wieder an", await f2.evaluate(() => document.querySelector("unifi-dynamic-panel")._hideLinked === true));
await b.close(); process.exit(ok ? 0 : 1);
