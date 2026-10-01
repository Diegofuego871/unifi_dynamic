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
  await p.waitForTimeout(150);
  return f;
}
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));
const heads = (f) => ev(f, `return [...r.querySelectorAll("tr.head-row th")].filter(t=>getComputedStyle(t).display!=="none").map(t=>t.dataset.sortKey||"")`);
const ud = (p) => p.evaluate(() => JSON.parse(sessionStorage.getItem("ud_unifi_dynamic_panel") || "null"));
const panelState = (f) => f.evaluate(() => { const el = document.querySelector("unifi-dynamic-panel"); return { online: el._onlineFilter, conn: el._connFilter, sortKey: el._sortKey, sortDir: el._sortDir, search: el._search, col: JSON.stringify(el._colFilters), seen: el._seenFilter, hideLinked: el._hideLinked }; });

// 1. Desktop: einstellen, bei HA gespeichert
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
await p.goto(URL);
let f = await frameOf(p);
await f.evaluate(() => localStorage.clear());
await p.evaluate(() => sessionStorage.clear());
await p.reload(); f = await frameOf(p);
check("Leerer HA-Speicher: Standard wird angelegt", (({ updated, ...rest }) => JSON.stringify(rest))(await ud(p)) === JSON.stringify({ onlineFilter: "all", connFilter: "all", sortKey: null, sortDir: "asc", hiddenColsWide: [], hiddenColsNarrow: [], colOrderWide: ["linked","ip","mac","essid","ap_name","conn","ping","seen_at","status"], colOrderNarrow: ["linked","ip","mac","essid","ap_name","conn","ping","seen_at","status"], hideLinked: false, availRange: "24h", hub: "all", loader: "elephant" }), JSON.stringify(await ud(p)));
await ev(f, `r.querySelector('.stat[data-filter="offline"]').click()`);
await ev(f, `const s=r.querySelector('.filter-conn'); s.value="wireless"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
await ev(f, `r.querySelector('th[data-sort-key="ip"]').click()`);
await ev(f, `r.querySelector('th[data-sort-key="ip"]').click()`);
await ev(f, `r.querySelector(".cols-btn").click(); const i=r.querySelector('.cols-pop [data-colvis="mac"]'); i.checked=false; i.dispatchEvent(new Event("change",{bubbles:true}))`);
await ev(f, `const s=r.querySelector(".search"); s.value="shelly"; s.dispatchEvent(new Event("input"))`);
await ev(f, `const el=r.querySelector('tr.filter-row [data-col="ap_name"]'); el.value="Keller"; el.dispatchEvent(new Event("input",{bubbles:true}))`);
await ev(f, `const t=r.querySelector('.filter-seen'); t.value="24h"; t.dispatchEvent(new Event("change",{bubbles:true}))`);
const setsBefore = await p.evaluate(() => window.__udSets || 0);
await p.waitForTimeout(700);
const setsAfter = await p.evaluate(() => window.__udSets || 0);
let d = await ud(p);
check("HA-Speicher: offline, WLAN, IP absteigend, MAC aus (breit)", d.onlineFilter === "offline" && d.connFilter === "wireless" && d.sortKey === "ip" && d.sortDir === "desc" && JSON.stringify(d.hiddenColsWide) === '["mac"]' && d.hiddenColsNarrow.length === 0, JSON.stringify(d));
check("Kein Suchtext/Textfilter/Zuletzt gesehen im Speicher", !("search" in d) && !("colFilters" in d) && !("seenFilter" in d));
check("Gebündelt: wenige Schreibvorgänge", setsAfter - setsBefore <= 1, `${setsAfter - setsBefore}`);
const local = await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")));
check("Lokale Kopie ohne Suche/Textfilter", local.connFilter === "wireless" && !("search" in local) && !("colFilters" in local), JSON.stringify(local));

// 2. "Anderes Gerät": lokale Kopie weg, HA-Speicher bleibt
await f.evaluate(() => localStorage.clear());
await p.reload(); f = await frameOf(p);
let st = await panelState(f);
check("Anderes Gerät: Einstellungen von HA übernommen", st.online === "offline" && st.conn === "wireless" && st.sortKey === "ip" && st.sortDir === "desc", JSON.stringify(st));
check("Anderes Gerät: MAC ausgeblendet, Pfeil ▼ bei IP", !(await heads(f)).includes("mac") && (await ev(f, `return r.querySelector('th[data-sort-key="ip"] .sort-arrow').textContent`)) === "▼");
check("Suchtext/Textfilter/Zuletzt gesehen nicht übernommen", st.search === "" && st.col === "{}" && st.seen === "all" && (await ev(f, `return r.querySelector(".search").value==="" && r.querySelector('tr.filter-row [data-col="ap_name"]').value===""`)), JSON.stringify(st));
check("Filterfelder zeigen gespeicherten Stand", await ev(f, `return r.querySelector(".filter-conn").value==="wireless" && r.querySelector(".filter-status").value==="offline" && r.querySelector('.stat.active').dataset.filter==="offline"`));

// 3. Handy: eigene Spaltenauswahl
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
mp.on("pageerror", (e) => { ok = false; console.log("PAGEERROR", e.message); });
await mp.addInitScript((v) => { if (window === window.top && !sessionStorage.getItem("seeded")) { sessionStorage.setItem("ud_unifi_dynamic_panel", v); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(d));
await mp.goto(URL);
let mf = await frameOf(mp);
check("Handy: MAC sichtbar (Desktop-Auswahl gilt nicht)", (await heads(mf)).includes("mac"));
check("Handy: Filter/Sortierung gemeinsam", (await panelState(mf)).conn === "wireless" && (await panelState(mf)).sortKey === "ip");
await ev(mf, `r.querySelector(".filter-btn").click(); const i=r.querySelector('[data-fcolvis="linked"]'); i.checked=false; i.dispatchEvent(new Event("change",{bubbles:true}))`);
await mp.waitForTimeout(700);
const d2 = await ud(mp);
check("Handy: HA-Gerät nur schmal ausgeblendet", JSON.stringify(d2.hiddenColsNarrow) === '["linked"]' && JSON.stringify(d2.hiddenColsWide) === '["mac"]', JSON.stringify(d2));
// Breite wechseln im selben Fenster
await mp.setViewportSize({ width: 1300, height: 844 });
await mp.waitForTimeout(200);
let h = await heads(mf);
check("Auf breit gewechselt: Desktop-Auswahl aktiv", h.includes("linked") && !h.includes("mac"), h.join(","));
await mp.setViewportSize({ width: 390, height: 844 });
await mp.waitForTimeout(200);
h = await heads(mf);
check("Zurück auf schmal: Handy-Auswahl aktiv", !h.includes("linked") && h.includes("mac"), h.join(","));
await m.close();

// 4. Übernahme aus 2.4.0 (altes lokales Format, HA-Speicher leer)
await p.evaluate(() => sessionStorage.clear());
await f.evaluate(() => localStorage.setItem("unifi_dynamic_panel_prefs", JSON.stringify({ search: "alt", onlineFilter: "online", connFilter: "wired", colFilters: { ip: "192" }, seenFilter: "1h", hiddenCols: ["essid", "bogus"], sortKey: "name", sortDir: "asc", hideLinked: true })));
await p.reload(); f = await frameOf(p);
await p.waitForTimeout(300);
d = await ud(p);
check("Übernahme: altes Format nach HA", d.onlineFilter === "online" && d.connFilter === "wired" && JSON.stringify(d.hiddenColsWide) === '["essid"]' && JSON.stringify(d.hiddenColsNarrow) === '["essid"]' && d.hideLinked === true, JSON.stringify(d));
st = await panelState(f);
check("Übernahme: Suche/Textfilter/Zeit verworfen", st.search === "" && st.col === "{}" && st.seen === "all", JSON.stringify(st));

// 4b. Schnelles Neuladen direkt nach einer Änderung: neuerer lokaler Stand gewinnt
await ev(f, `r.querySelector('.stat[data-filter="offline"]').click()`);
await p.reload(); f = await frameOf(p);
await p.waitForTimeout(300);
check("Neuladen nach 0 ms: Änderung bleibt und geht an HA", (await panelState(f)).online === "offline" && (await ud(p)).onlineFilter === "offline", JSON.stringify(await ud(p)));
// 4c. Tippen vor dem Laden überschreibt neueren HA-Stand nicht
await p.evaluate(() => { const v = JSON.parse(sessionStorage.getItem("ud_unifi_dynamic_panel")); v.connFilter = "wireless"; v.updated = Date.now() + 1000; sessionStorage.setItem("ud_unifi_dynamic_panel", JSON.stringify(v)); });
await p.reload(); f = await frameOf(p);
await ev(f, `const s=r.querySelector(".search"); s.value="x"; s.dispatchEvent(new Event("input"))`);
await p.waitForTimeout(600);
check("Neuerer HA-Stand (anderes Gerät) gewinnt gegen alte lokale Kopie", (await panelState(f)).conn === "wireless" && (await ud(p)).connFilter === "wireless");

// 5. HA ohne Benutzerspeicher: lokaler Rückfall
await p.evaluate(() => { const ha = document.querySelector("home-assistant"); const orig = ha.hass.callWS; ha.hass = { ...ha.hass, callWS: (m) => m.type.startsWith("frontend/") ? Promise.reject(new Error("unknown_command")) : orig(m) }; });
await f.evaluate(() => localStorage.setItem("unifi_dynamic_panel_prefs", JSON.stringify({ connFilter: "wired" })));
// iframe neu laden (Eltern-hass bleibt mit Fehler-callWS)
await f.evaluate(() => location.reload());
f = await frameOf(p);
st = await panelState(f);
check("Ohne HA-Speicher: lokale Kopie gilt, kein Absturz", st.conn === "wired", JSON.stringify(st));
await ev(f, `const s=r.querySelector('.filter-conn'); s.value="all"; s.dispatchEvent(new Event("change",{bubbles:true}))`);
await p.waitForTimeout(600);
check("Ohne HA-Speicher: lokal gespeichert", (await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")).connFilter)) === "all");
await b.close(); process.exit(ok ? 0 : 1);
