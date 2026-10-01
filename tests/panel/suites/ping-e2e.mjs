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
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html?ping=1${hubs ? "&hubs=2" : ""}`);
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
const panel = `document.querySelector("unifi-dynamic-panel")`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const t = await setup(mobile, false);
  const { p, f, ev, click } = t;
  await p.evaluate(() => { window.__toasts = []; document.querySelector("home-assistant").addEventListener("hass-notification", (e) => window.__toasts.push(e.detail.message)); });
  // --- Tabelle
  const info = await ev(`const p=${panel}; const cs=p._clients.filter(c=>c.ping); return {n: cs.length, ok: cs.find(c=>c.online&&c.ping.status==="ok"&&c.ping.loss===0)?.mac, lossy: cs.find(c=>c.online&&c.ping.loss>0&&c.ping.status==="ok")?.mac, silent: cs.find(c=>c.online&&c.ping.status==="no_reply")?.mac, off: cs.find(c=>!c.online)?.mac}`);
  check(`[${tag}] Clients mit Ping-Daten`, info.n > 0 && info.ok && info.lossy && info.silent, JSON.stringify(info));
  const cellOf = async (mac) => ev(`const tr=[...r.querySelectorAll("tbody tr[data-mac]")].find(x=>x.dataset.mac==="${"MACX"}"); return tr ? tr.querySelector(".c-ping").innerText.replace(/\\s+/g," ").trim() : null`.replace("MACX", mac));
  if (!mobile) {
    check(`[${tag}] Spalte Ping sichtbar`, await ev(`const th=r.querySelector("thead th.c-ping"); return th && getComputedStyle(th).display!=="none" && th.textContent.startsWith("Ping")`));
    const vOk = await cellOf(info.ok), vLoss = await cellOf(info.lossy), vSil = await cellOf(info.silent);
    check(`[${tag}] Zelle: Wert in ms`, /^\d+([.,]\d)? ms$/.test(vOk || ""), vOk);
    check(`[${tag}] Zelle: Verlust markiert`, /ms 6[.,]5 % Verlust$/.test(vLoss || ""), vLoss);
    check(`[${tag}] Zelle: keine Antwort neutral`, vSil === "keine Antwort", vSil);
    if (info.off) check(`[${tag}] Offline: Strich`, (await cellOf(info.off)) === "–");
    const tiers = await ev(`return [...r.querySelectorAll("tbody tr[data-mac]")].map(tr=>{const c=${panel}._clients.find(x=>x.mac===tr.dataset.mac); const b=tr.querySelector(".c-ping .pbars"); return c.ping&&c.online&&c.ping.median!=null ? [c.ping.median, b ? +b.className.match(/t(\\d)/)[1] : null] : null}).filter(Boolean)`);
    const exp = (v) => (v < 5 ? 5 : v < 15 ? 4 : v < 40 ? 3 : v < 100 ? 2 : 1);
    check(`[${tag}] Stufen: 5 Balken, Farbe nach Grenzen 5/15/40/100`, tiers.length > 5 && tiers.every(([v, tt]) => tt === exp(v)) && new Set(tiers.map((x) => x[1])).size >= 3, JSON.stringify(tiers.slice(0, 6)));
    check(`[${tag}] Verlust-Hinweis rot`, await ev(`const e=r.querySelector(".c-ping .ping-loss"); return !!e && getComputedStyle(e).color==="rgb(229, 98, 95)"`));
    await click('thead th.c-ping');
    const sorted = await ev(`return [...r.querySelectorAll("tbody tr[data-mac]")].map(tr=>${panel}._clients.find(c=>c.mac===tr.dataset.mac)).map(c=>c.ping&&c.ping.median!=null?c.ping.median:null)`);
    const vals = sorted.filter((v) => v != null);
    check(`[${tag}] Sortierung nach Ping, leere ans Ende`, vals.every((v, i) => !i || vals[i - 1] <= v) && sorted.indexOf(null) === -1 || sorted.slice(sorted.indexOf(null)).every((v) => v == null), JSON.stringify(sorted.slice(0, 8)));
    await p.screenshot({ path: `${OUT}/ping-${tag}-table.png` });
  }
  // --- Geräteansicht
  const openDlg = async (mac) => {
    await ev(`const p=${panel}; p._pingHist=null; p._openDialog([...p._clients].find(c=>c.mac==="${mac}").entry_id+"|${mac}"); r.querySelector('dialog.device [data-dlg="stat"][data-kind="ping"]').click()`);
    await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg section.ping .ping-stats, dialog.stat-dlg section.ping .dlg-note:not(:empty)")`), null, { timeout: 5000 });
    await p.waitForTimeout(300);
  };
  await openDlg(info.lossy);
  const stats = await ev(`return [...r.querySelectorAll("dialog.stat-dlg .ping-stat")].map(s=>s.innerText.replace(/\\s+/g," "))`);
  check(`[${tag}] 3 Kennzahlen, Verlust gewarnt`, stats.length === 3 && stats[0].startsWith("Median") && stats[2].startsWith("Paketverlust 6") && await ev(`return r.querySelector("dialog.stat-dlg .ping-stat.warn")!==null`), JSON.stringify(stats));
  const bars = await ev(`return {n: r.querySelectorAll("dialog.stat-dlg .ping-chart .pb").length, lossy: r.querySelectorAll("dialog.stat-dlg .ping-chart .pb.lossy").length}`);
  check(`[${tag}] Diagramm: Säulen nach Stufe gefärbt, Legende 5 Stufen + Verlust`, await ev(`const pb=[...r.querySelectorAll("dialog.stat-dlg .ping-chart .pb:not(.none)")]; return pb.length>0 && pb.every(x=>/\\bt[1-5]\\b/.test(x.className)) && r.querySelectorAll("dialog.stat-dlg .ping-legend span").length===6`));
  check(`[${tag}] Diagramm: 288 Säulen, Verlust markiert`, bars.n >= 280 && bars.lossy > 10, JSON.stringify(bars));
  const over = await ev(`const d=r.querySelector("dialog.stat-dlg"); return d.scrollWidth-d.clientWidth`);
  check(`[${tag}] kein horizontaler Überlauf`, over <= 1, String(over));
  check(`[${tag}] Zeitraum 24 Std. aktiv`, await ev(`return r.querySelector('dialog.stat-dlg [data-range="24h"]').classList.contains("active")`));
  // Zeitraum-Schalter gilt auch für Ping, mit Loader
  await p.evaluate(() => { window.__pingDelay = 2600; });
  await click('[data-dlg="avail-range"][data-range="7d"]');
  await p.waitForTimeout(1300);
  check(`[${tag}] 7 Tage: Loader im Ping-Abschnitt, Zähler läuft`, await ev(`const l=r.querySelector("dialog.stat-dlg section.ping .avail-loading"); return !!l && l.querySelector(".avail-sec").textContent==="1"`));
  await p.screenshot({ path: `${OUT}/ping-${tag}-loader.png` });
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg section.ping .ping-chart")`), null, { timeout: 6000 });
  const r7 = await ev(`const s=r.querySelector("dialog.stat-dlg section.ping"); return {h: s.querySelector('[data-range="7d"]').classList.contains("active") ? "Letzte 7 Tage" : "", n: s.querySelectorAll(".pb").length, ax: s.querySelector(".ping-axis span").textContent, loader: !!s.querySelector(".avail-loading")}`);
  const c7 = await p.evaluate(() => window.__pingCalls.filter((m) => m.type === "unifi_dynamic/ping_history").at(-1));
  check(`[${tag}] 7 Tage: Stunden-Säulen, Achse, Anfrage mit range`, r7.h === "Letzte 7 Tage" && r7.n >= 160 && r7.n <= 170 && r7.ax === "vor 7 Tagen" && !r7.loader && c7.range === "7d", JSON.stringify([r7, c7]));
  await p.evaluate(() => { window.__pingDelay = 0; });
  await click('[data-dlg="avail-range"][data-range="30d"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.stat-dlg [data-range="30d"]').classList.contains("active") && ${R}.querySelector("dialog.stat-dlg .ping-axis span")?.textContent==="vor 30 Tagen" && ${R}.querySelector("dialog.stat-dlg section.ping .ping-chart")`), null, { timeout: 6000 });
  const r30 = await ev(`const s=r.querySelector("dialog.stat-dlg section.ping"); return {n: s.querySelectorAll(".pb").length, ax: s.querySelector(".ping-axis span").textContent, med: s.querySelector(".ping-stat b").textContent}`);
  check(`[${tag}] 30 Tage: 720 Säulen, Achse, eigene Kennzahlen`, r30.n >= 700 && r30.ax === "vor 30 Tagen" && r30.med.includes("8.3"), JSON.stringify(r30));
  const over30 = await ev(`const d=r.querySelector("dialog.stat-dlg"); return d.scrollWidth-d.clientWidth`);
  check(`[${tag}] 30 Tage: kein Überlauf`, over30 <= 1, String(over30));
  await click('[data-dlg="avail-range"][data-range="24h"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.stat-dlg [data-range="24h"]').classList.contains("active") && ${R}.querySelector("dialog.stat-dlg .ping-axis span")?.textContent==="vor 24 Std." && ${R}.querySelector("dialog.stat-dlg section.ping .ping-chart")`), null, { timeout: 6000 });
  check(`[${tag}] kein Entitäts-Schalter, Hinweis auf Sensoren`, await ev(`return !r.querySelector('[data-dlg="ping-entity"]') && (r.querySelector("dialog.stat-dlg .ping-entity-note")?.textContent || "").includes("Packet loss")`));
  await ev(`r.querySelector("dialog.stat-dlg section.ping").scrollIntoView({block:"center"})`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/ping-${tag}-dialog.png` });
  await ev(`${panel}._closeDialog()`);
  await openDlg(info.silent);
  check(`[${tag}] Stummer Client: neutraler Hinweis, kein Diagramm`, (await ev(`return r.querySelector("dialog.stat-dlg section.ping").innerText`)).includes("Antwortet nicht auf Ping") && await ev(`return !r.querySelector("dialog.stat-dlg .ping-chart")`));
  await ev(`${panel}._closeDialog()`);
  // --- Einstellungen
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-id="ping"]')`));
  check(`[${tag}] Abschnitt Ping mit Zusammenfassung`, (await ev(`return r.querySelector('[data-id="ping"] .set-sec-sum').textContent`)).startsWith("Alle 60 s"));
  await click('[data-set="section"][data-id="ping"]');
  check(`[${tag}] Schalter an, Intervall sichtbar`, await ev(`return r.querySelector('input[data-opt="ping_enabled"]').checked && !!r.querySelector('input[data-opt="ping_interval"]')`));
  await click('input[data-opt="ping_enabled"]');
  check(`[${tag}] aus: Intervall weg, Neuladen-Hinweis, Speichern frei`, await ev(`return !r.querySelector('input[data-opt="ping_interval"]') && !!r.querySelector(".set-note") && !r.querySelector('[data-set="save"]').disabled`));
  await click('[data-set="save"]');
  await p.waitForTimeout(400);
  const saved = await p.evaluate(() => window.__setCalls.at(-1));
  check(`[${tag}] gespeichert: ping_enabled false`, saved && saved.values.ping_enabled === false, JSON.stringify(saved && saved.values));
  // --- Ohne Rechte: Hinweis, Spalte weg
  await p.evaluate(() => { window.__pingStatus.entry1 = "permission"; window.__opts.entry1.ping_enabled = true; });
  await ev(`${panel}._fetchClients()`);
  await p.waitForTimeout(400);
  check(`[${tag}] ohne Rechte: Spalte ausgeblendet`, await ev(`const th=r.querySelector("thead th.c-ping"); return !th || getComputedStyle(th).display==="none"`));
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-id="ping"]')`));
  await click('[data-set="section"][data-id="ping"]');
  check(`[${tag}] ohne Rechte: Zusammenfassung ehrlich`, (await ev(`return r.querySelector('[data-id="ping"] .set-sec-sum').textContent`)) === "Eingeschaltet, aber Ping ist nicht erlaubt");
  check(`[${tag}] ohne Rechte: Hinweis in den Einstellungen`, (await ev(`return r.querySelector(".ping-note")?.textContent || ""`)).includes("ICMP"));
  await ev(`r.querySelector('[data-id="ping"]').scrollIntoView({block:"start"})`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/ping-${tag}-settings.png` });
  check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
  await t.ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
