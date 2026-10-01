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
  // --- ein Hub
  {
    const { ctx, p, f, ev, click, errors } = await setup(mobile, false);
    check(`[${tag}] 1 Hub: keine Auswahl, Zahnrad aktiv`, await ev(`return getComputedStyle(r.querySelector(".hub-select-wrap")).display==="none" && !r.querySelector(".gear-btn").disabled`));
    await click(".gear-btn");
    await p.waitForFunction(() => true);
    await (await p.$("#panel-frame")).contentFrame().then((f) => f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings .set-sec")`)));
    check(`[${tag}] Dialog offen, 7 Abschnitte (inkl. Ping, Loader), eingeklappt`, await ev(`const d=r.querySelector("dialog.settings"); return d.open && d.querySelectorAll(".set-sec:not(.conn-sec)").length===7 && !d.querySelector(".set-sec:not(.conn-sec) .set-sec-body")`));
    check(`[${tag}] Zusammenfassung Abfrage`, (await ev(`return r.querySelector(".set-sec-sum").textContent`)) === "Alle 30 s · ausgefallen nach 30 Abfragen");
    check(`[${tag}] Controller: Kachel Verfügbarkeit + Status`, (await ev(`return r.querySelector("dialog.settings .avail-slot").innerText`)).includes("Verfügbarkeit") && (await ev(`return r.querySelectorAll("dialog.settings .avail-slot .st-tile").length`)) === 2);
    check(`[${tag}] Controller-Kacheln zuoberst`, (await ev(`return r.querySelector("dialog.settings .dlg-body h3")?.textContent || ""`)).startsWith("Controller"));
    check(`[${tag}] Speichern gesperrt ohne Änderung`, await ev(`return r.querySelector('[data-set="save"]').disabled`));
    await click('[data-set="section"][data-id="polling"]');
    check(`[${tag}] Abschnitt aufgeklappt`, await ev(`return !!r.querySelector('input[data-opt="scan_interval"]')`));
    check(`[${tag}] Live-Text Reaktionszeit`, (await ev(`return r.querySelector('input[data-opt="offline_after_failures"]').closest(".opt").querySelector(".opt-short").textContent`)) === "Bei 30 s Intervall: nach 15 Min.");
    // Info aufklappen
    await click('[data-set="info"][data-key="scan_interval"]');
    check(`[${tag}] ⓘ klappt Text auf`, (await ev(`return r.querySelector(".opt-info")?.textContent || ""`)).startsWith("Kürzere Intervalle"));
    await click('[data-set="info"][data-key="scan_interval"]');
    check(`[${tag}] ⓘ klappt Text zu`, await ev(`return !r.querySelector(".opt-info")`));
    // Eingabe
    const inp = await ev(`const e=r.querySelector('input[data-opt="scan_interval"]'); const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}`);
    const off = await (await p.$("#panel-frame")).boundingBox();
    if (mobile) await p.touchscreen.tap(off.x + inp.x, off.y + inp.y); else await p.mouse.click(off.x + inp.x, off.y + inp.y);
    await p.keyboard.press("Control+A");
    await p.keyboard.type("5");
    check(`[${tag}] ungültig: Fehlertext, Speichern gesperrt`, await ev(`const o=r.querySelector('input[data-opt="scan_interval"]').closest(".opt"); return o.classList.contains("invalid") && o.querySelector(".opt-error")?.textContent==="Erlaubt: 10–3600" && r.querySelector('[data-set="save"]').disabled`));
    await p.keyboard.type("0");
    check(`[${tag}] Fokus bleibt beim Tippen`, await ev(`return r.activeElement?.dataset.opt==="scan_interval" && r.activeElement.value==="50"`));
    check(`[${tag}] gültig: markiert, Zähler, Hinweis, Live-Text`, await ev(`const o=r.querySelector('input[data-opt="scan_interval"]').closest(".opt"); return o.classList.contains("changed") && !o.classList.contains("invalid") && r.querySelector(".set-count").textContent==="1 Änderung" && !!r.querySelector(".set-note") && r.querySelector('input[data-opt="offline_after_failures"]').closest(".opt").querySelector(".opt-short").textContent==="Bei 50 s Intervall: nach 25 Min." && !r.querySelector('[data-set="save"]').disabled`));
    check(`[${tag}] Etikett "geändert" + Zusammenfassung live`, await ev(`const h=r.querySelector('[data-id="polling"]'); return !!h.querySelector(".set-badge") && h.querySelector(".set-sec-sum").textContent.startsWith("Alle 50 s")`));
    // Push-Abschnitt: Schalter
    await click('[data-set="section"][data-id="push"]');
    await click('input[data-opt="message_mac"]');
    check(`[${tag}] Schalter: 2 Änderungen, Fokus/Scroll ok`, (await ev(`return r.querySelector(".set-count").textContent`)) === "2 Änderungen");
    await click('[data-set="section"][data-id="updates"]');
    check(`[${tag}] Updates: Schalter an, Zusammenfassung`, await ev(`return r.querySelector('input[data-opt="update_check"]').checked && r.querySelector('[data-id="updates"] .set-sec-sum').textContent==="Tägliche Prüfung auf neue Versionen"`));
    await click('[data-set="section"][data-id="updates"]');
    await click('[data-set="section"][data-id="cleanup"]');
    const chipsBefore = await ev(`return r.querySelectorAll(".opt-chip").length`);
    await click('.opt-chip [data-set="unprotect"]');
    check(`[${tag}] Schutz-Chip entfernt`, (await ev(`return r.querySelectorAll(".opt-chip").length`)) === chipsBefore - 1 && chipsBefore > 0, String(chipsBefore));
    await p.screenshot({ path: `${OUT}/settings-${tag}.png` });
    // Speichern direkt aus einem fokussierten Feld heraus
    const inp2 = await ev(`const e=r.querySelector('input[data-opt="purge_days"]'); e.scrollIntoView({block:"center"}); const b=e.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}`);
    if (mobile) await p.touchscreen.tap(off.x + inp2.x, off.y + inp2.y); else await p.mouse.click(off.x + inp2.x, off.y + inp2.y);
    await p.keyboard.press("Control+A");
    await p.keyboard.type("45");
    await click('[data-set="save"]');
    await p.waitForTimeout(300);
    const calls = await p.evaluate(() => window.__setCalls);
    const v = calls.at(-1)?.values || {};
    check(`[${tag}] gespeichert: nur Änderungen`, calls.length === 1 && v.scan_interval === 50 && v.message_mac === true && v.purge_days === 45 && Array.isArray(v.purge_exclude) && Object.keys(v).length === 4, JSON.stringify(v));
    check(`[${tag}] Dialog nach Speichern zu`, await ev(`return !r.querySelector("dialog.settings").open`));
    // erneut öffnen: neuer Stand
    await click(".gear-btn");
    await p.waitForTimeout(200);
    check(`[${tag}] neuer Stand geladen`, (await ev(`return r.querySelector(".set-sec-sum").textContent`)) === "Alle 50 s · ausgefallen nach 30 Abfragen");
    // Controller mit Daten: 2 Ausfälle, Zeitraum geteilt mit Geräteansicht
    await click('[data-set="close"].dlg-close');
    await p.evaluate(() => { const H = 3600; window.__avail = { controller: { since: 40 * 86400, events: [[40 * 86400, 1], [20 * H, 0], [20 * H - 1800, 1], [2 * 86400, 0], [2 * 86400 - 3 * H, 1]] } }; });
    await ev(`const p=document.querySelector("unifi-dynamic-panel"); p._history=null;`);
    await click(".gear-btn");
    await p.waitForTimeout(300);
    // Ab 2.15.0: Controller-Verfügbarkeit im Unter-Fenster hinter der Kachel
    await click('dialog.settings [data-set="stat"][data-kind="ctl"]');
    await p.waitForTimeout(300);
    let at = await ev(`return r.querySelector("dialog.stat-dlg .avail").innerText`);
    check(`[${tag}] Controller 24h: 1 Unterbruch 30 Min.`, at.includes("1 Unterbruch") && at.includes("30 Min."), at);
    await click('dialog.stat-dlg [data-dlg="avail-range"][data-range="7d"]');
    await p.waitForTimeout(300);
    at = await ev(`return r.querySelector("dialog.stat-dlg .avail").innerText`);
    check(`[${tag}] Controller 7 Tage: 2 Unterbrüche, längster 3 Std.`, at.includes("2 Unterbrüche") && at.includes("längster 3 Std."), at);
    check(`[${tag}] Zeitraum geteilt gespeichert`, await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")).availRange === "7d"));
    const segC = await ev(`const s=r.querySelector("dialog.stat-dlg .avail-bar .seg.off"); s.scrollIntoView({block:"center"}); const b=s.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}`);
    const offC = await (await p.$("#panel-frame")).boundingBox();
    if (mobile) await p.touchscreen.tap(offC.x + segC.x, offC.y + segC.y); else await p.mouse.move(offC.x + segC.x, offC.y + segC.y);
    await p.waitForTimeout(150);
    check(`[${tag}] Controller-Tooltip`, (await ev(`const t=r.querySelector("dialog.stat-dlg .avail-tip"); return t && !t.hidden ? t.innerText : ""`)).startsWith("Offline"));
    await p.screenshot({ path: `${OUT}/settings-${tag}-controller.png` });
    await ev(`r.querySelector('dialog.stat-dlg [data-dlg="avail-range"][data-range="24h"]').click()`);
    await ev(`r.querySelector('dialog.stat-dlg [data-stat="close"]').click()`);
    await p.waitForTimeout(150);
    // Fehler beim Speichern
    await p.evaluate(() => { window.__setOptsFails = true; });
    await click('[data-set="section"][data-id="persistent"]');
    await click('input[data-opt="persistent_when_empty"]');
    await click('[data-set="save"]');
    await p.waitForTimeout(200);
    check(`[${tag}] Fehler angezeigt, Dialog bleibt`, await ev(`return r.querySelector("dialog.settings").open && r.querySelector("dialog.settings .dlg-error")?.textContent.includes("Ungültige Eingabe")`));
    // Abbrechen verwirft
    await click('[data-set="close"].dlg-btn');
    check(`[${tag}] Abbrechen schliesst`, await ev(`return !r.querySelector("dialog.settings").open`));
    check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
  // --- zwei Hubs
  {
    const { ctx, p, ev, click, errors } = await setup(mobile, true);
    check(`[${tag}] 2 Hubs: Auswahl sichtbar, Alle Hubs, Zahnrad gesperrt`, await ev(`const s=r.querySelector(".hub-select"); return getComputedStyle(r.querySelector(".hub-select-wrap")).display!=="none" && s.value==="all" && s.options.length===3 && r.querySelector(".gear-btn").disabled && r.querySelector(".gear-btn").title.startsWith("Einstellungen gelten pro Hub")`));
    check(`[${tag}] Alle Hubs: 40 Clients`, (await ev(`return r.querySelector('[data-count="all"]').textContent`)) === "40");
    await ev(`const s=r.querySelector(".hub-select"); s.value="entry2"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
    await p.waitForTimeout(100);
    check(`[${tag}] Hub Werkstatt: 10 Clients, Zahnrad aktiv`, (await ev(`return r.querySelector('[data-count="all"]').textContent`)) === "10" && !(await ev(`return r.querySelector(".gear-btn").disabled`)));
    await p.waitForTimeout(600);
    check(`[${tag}] Hub gespeichert (lokal + HA)`, await p.evaluate(() => JSON.parse(sessionStorage.getItem("ud_unifi_dynamic_panel") || "{}").hub === "entry2"));
    await click(".gear-btn");
    await p.waitForTimeout(200);
    check(`[${tag}] Dialog für Werkstatt`, (await ev(`return r.querySelector("dialog.settings .dlg-sub").textContent`)).includes("UniFi Werkstatt") && (await ev(`return r.querySelector(".set-sec-sum").textContent`)).startsWith("Alle 60 s"));
    await p.screenshot({ path: `${OUT}/settings-${tag}-hub2.png` });
    await click('[data-set="close"].dlg-close');
    // Neu laden: Hub bleibt
    await p.reload();
    const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
    await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
    await p.waitForTimeout(300);
    check(`[${tag}] nach Neuladen Hub gemerkt`, await f2.evaluate(new Function(`const r=${R}; return r.querySelector(".hub-select").value==="entry2" && r.querySelector('[data-count="all"]').textContent==="10"`)));
    check(`[${tag}] Werkzeugleiste ohne Überlauf`, await f2.evaluate(new Function(`const r=${R}; const t=r.querySelector(".toolbar"); return t.scrollWidth<=t.clientWidth+1`)));
    await p.screenshot({ path: `${OUT}/settings-${tag}-toolbar.png` });
    check(`[${tag}] keine JS-Fehler (2 Hubs)`, errors.length === 0, errors.join("; "));
    await ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
