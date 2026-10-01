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
  const t = await setup(mobile, true);
  const { p, f, ev, click } = t;
  const pick = await ev(`const cs=${panel}._clients; const w=cs.find(c=>c.online&&!c.is_wired&&c.ping&&c.ping.status==="ok"&&typeof c.signal==="number"&&c.stats.avail); const k=cs.find(c=>c.is_wired===true&&c.ping); const n=cs.find(c=>!c.ping&&!c.is_wired&&typeof c.signal==="number"); return {w:w&&w.mac, k:k&&k.mac, n:n&&n.mac}`);
  const openDev = async (mac) => { await ev(`const p=${panel}; p._openDialog([...p._clients].find(c=>c.mac==="${mac}").entry_id+"|${mac}")`); await p.waitForTimeout(300); };
  await openDev(pick.w);
  const tiles = await ev(`return [...r.querySelectorAll("dialog.device .st-tile")].map(x=>({k:x.dataset.kind, t:x.innerText.replace(/\\s+/g," ").trim()}))`);
  check(`[${tag}] 3 Kacheln: Verfügbarkeit, WLAN, Antwortzeit`, tiles.map((x) => x.k).join() === "avail,wifi,ping", JSON.stringify(tiles));
  check(`[${tag}] Kachelwerte (24 Std.) ohne Laden`, /%/.test(tiles[0].t) && /dBm/.test(tiles[1].t) && /ms/.test(tiles[2].t) && await p.evaluate(() => !(window.__sigCalls||[]).length && !(window.__pingCalls||[]).some(m=>m.type==="unifi_dynamic/ping_history")), JSON.stringify(tiles));
  check(`[${tag}] WLAN-Kachel mit Fächer`, await ev(`return !!r.querySelector('dialog.device .st-tile[data-kind="wifi"] svg.wfan')`));
  const cut = await ev(`return [...r.querySelectorAll("dialog.device .st-k")].some(e=>e.scrollWidth>e.clientWidth+1)`);
  check(`[${tag}] Kachel-Titel nicht abgeschnitten`, !cut);
  check(`[${tag}] Verfügbarkeit nicht mehr in der Geräteansicht`, await ev(`return !r.querySelector("dialog.device .avail-bar, dialog.device .avail-loading")`));
  // WLAN-Unter-Fenster mit Loader
  await p.evaluate(() => { window.__sigDelay = 1800; window.__sigCalls = []; });
  await click('dialog.device [data-dlg="stat"][data-kind="wifi"]');
  await p.waitForTimeout(500);
  check(`[${tag}] WLAN: Unter-Fenster über Geräteansicht, Loader`, await ev(`const s=r.querySelector("dialog.stat-dlg"); return s.open && r.querySelector("dialog.device").open && s.querySelector("h2").textContent==="WLAN-Empfang" && !!s.querySelector(".avail-loading")`));
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .sig-chart")`), null, { timeout: 5000 });
  const w = await ev(`const s=r.querySelector("dialog.stat-dlg"); return {stats:[...s.querySelectorAll(".ping-stat")].map(x=>x.innerText.replace(/\\s+/g," ")), bars:s.querySelectorAll(".sig-chart .pb").length, colored:[...s.querySelectorAll(".sig-chart .pb")].every(b=>/\\bw[1-4]\\b/.test(b.className)), list:s.querySelector(".stat-list").innerText.replace(/\\s+/g," "), legend:s.querySelectorAll(".sig-legend span").length}`);
  check(`[${tag}] WLAN: Median/Bester/Schlechtester, Säulen in Stufenfarben, APs, Lücken, Legende`, w.stats.length === 3 && w.stats[0].startsWith("Median") && w.bars > 200 && w.colored && w.list.includes("Wohnzimmer 20 %") && /Ohne WLAN-Daten \d/.test(w.list) && w.legend === 4, JSON.stringify(w));
  await p.screenshot({ path: `${OUT}/stat-${tag}-wifi.png` });
  // Zeitraum wechseln -> Anfrage mit range, Wahl gemerkt
  await p.evaluate(() => { window.__sigDelay = 0; });
  await click('dialog.stat-dlg [data-dlg="avail-range"][data-range="7d"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .sig-chart") && ${R}.querySelector("dialog.stat-dlg .ping-axis span").textContent==="vor 7 Tagen"`), null, { timeout: 5000 });
  check(`[${tag}] WLAN 7 Tage: Anfrage mit range, Stunden-Säulen`, (await p.evaluate(() => window.__sigCalls.at(-1).range)) === "7d" && (await ev(`return r.querySelectorAll("dialog.stat-dlg .sig-chart .pb").length`)) > 100);
  // Tabs: drei Statistiken, WLAN aktiv, Beschriftung lang (Desktop) bzw. kurz (Handy)
  const tb = await ev(`const s=r.querySelector("dialog.stat-dlg"); const tabs=[...s.querySelectorAll(".stat-tab")]; return {n:tabs.length, on:s.querySelector(".stat-tab.on").dataset.kind, labels:tabs.map(x=>x.innerText.trim())}`);
  check(`[${tag}] Tabs: 3, WLAN aktiv, ${mobile ? "kurz" : "lang"} beschriftet`, tb.n === 3 && tb.on === "wifi" && JSON.stringify(tb.labels) === JSON.stringify(mobile ? ["Verfügbar","WLAN","Ping"] : ["Verfügbarkeit","WLAN","Antwortzeit"]), JSON.stringify(tb));
  check(`[${tag}] Tabs nicht abgeschnitten`, await ev(`return [...r.querySelectorAll("dialog.stat-dlg .stat-tab")].every(b=>b.scrollWidth<=b.clientWidth+1)`));
  await click('dialog.stat-dlg [data-stat="tab"][data-kind="ping"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .ping-chart")`), null, { timeout: 5000 });
  const tp = await ev(`const s=r.querySelector("dialog.stat-dlg"); return {h:s.querySelector("h2").textContent, on:s.querySelector(".stat-tab.on").dataset.kind, range:s.querySelector('[data-range="7d"]').classList.contains("active"), open:s.open}`);
  check(`[${tag}] Tab Antwortzeit: Titel, Inhalt, Zeitraum 7 Tage bleibt, Fenster offen`, tp.h === "Antwortzeit" && tp.on === "ping" && tp.range && tp.open, JSON.stringify(tp));
  await p.screenshot({ path: `${OUT}/stat-${tag}-tabs.png` });
  await click('dialog.stat-dlg [data-stat="tab"][data-kind="avail"]');
  await p.waitForTimeout(400);
  check(`[${tag}] Tab Verfügbarkeit`, (await ev(`return r.querySelector("dialog.stat-dlg h2").textContent`)) === "Verfügbarkeit");
  await click('dialog.stat-dlg [data-stat="tab"][data-kind="wifi"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .sig-chart")`), null, { timeout: 5000 });
  // Kopf C2: Symbol links, X rechts, kein Zurück; X des Gerätedialogs ausgeblendet
  const hd = await ev(`const h=r.querySelector("dialog.stat-dlg .stat-head"); const kids=[...h.children]; const px=r.querySelector("dialog.device .dlg-head .dlg-close"); return {first:kids[0].className, last:kids.at(-1).dataset.stat, svg:!!kids[0].querySelector("svg"), back:!!h.querySelector(".stat-back"), parentX:getComputedStyle(px).visibility, bd:getComputedStyle(r.querySelector("dialog.stat-dlg"),"::backdrop").backgroundColor}`);
  check(`[${tag}] Kopf: Symbol + Titel + X, kein Zurück, X dahinter ausgeblendet, Hintergrund stark gedimmt`, hd.first.includes("stat-avatar") && hd.svg && hd.last === "close" && !hd.back && hd.parentX === "hidden" && hd.bd.includes("0.7"), JSON.stringify(hd));
  // X schliesst nur das Statistik-Fenster
  await click('dialog.stat-dlg [data-stat="close"]');
  await p.waitForTimeout(250);
  check(`[${tag}] X: Unter-Fenster zu, Geräteansicht offen, ihr X wieder sichtbar`, await ev(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open && getComputedStyle(r.querySelector("dialog.device .dlg-head .dlg-close")).visibility==="visible"`));
  // Escape schliesst ebenfalls nur das Statistik-Fenster und zeigt das X wieder
  await click('dialog.device [data-dlg="stat"][data-kind="wifi"]');
  await p.waitForTimeout(300);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(250);
  check(`[${tag}] Escape: Unter-Fenster zu, X der Geräteansicht wieder sichtbar`, await ev(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open && getComputedStyle(r.querySelector("dialog.device .dlg-head .dlg-close")).visibility==="visible"`));
  // Antwortzeit: gleicher Zeitraum (gemerkt)
  await click('dialog.device [data-dlg="stat"][data-kind="ping"]');
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .ping-chart")`), null, { timeout: 5000 });
  check(`[${tag}] Antwortzeit: Zeitraum 7 Tage übernommen, Hinweis auf Sensoren statt Schalter`, (await ev(`return r.querySelector('dialog.stat-dlg [data-range="7d"]').classList.contains("active")`)) && (await p.evaluate(() => window.__pingCalls.filter(m=>m.type==="unifi_dynamic/ping_history").at(-1).range)) === "7d" && await ev(`return !r.querySelector('dialog.stat-dlg [data-dlg="ping-entity"]') && !!r.querySelector("dialog.stat-dlg .ping-entity-note")`));
  await click('dialog.stat-dlg [data-stat="close"]');
  // Verfügbarkeit
  await click('dialog.device [data-dlg="stat"][data-kind="avail"]');
  await p.waitForTimeout(600);
  check(`[${tag}] Verfügbarkeit im Unter-Fenster, ohne doppelten Titel`, await ev(`const s=r.querySelector("dialog.stat-dlg"); return s.querySelector("h2").textContent==="Verfügbarkeit" && !s.querySelector(".avail-h3") && !!s.querySelector(".avail-range")`));
  const over = await ev(`const d=r.querySelector("dialog.stat-dlg"); return d.scrollWidth-d.clientWidth`);
  check(`[${tag}] kein Überlauf`, over <= 1, String(over));
  await p.screenshot({ path: `${OUT}/stat-${tag}-avail.png` });
  // Geräteansicht schliessen -> Unter-Fenster auch
  await ev(`${panel}._closeDialog()`);
  check(`[${tag}] Schliessen schliesst beide`, await ev(`return !r.querySelector("dialog.stat-dlg").open && !r.querySelector("dialog.device").open`));
  // Kabel-Client: keine WLAN-Kachel; Hub ohne Ping: keine Antwortzeit
  if (pick.k) { await openDev(pick.k); check(`[${tag}] Kabel: keine WLAN-Kachel, 2 Kacheln breiter`, await ev(`return !r.querySelector('dialog.device .st-tile[data-kind="wifi"]') && r.querySelector("dialog.device .st-tiles").classList.contains("n2")`)); await ev(`${panel}._closeDialog()`); }
  if (pick.n) { await openDev(pick.n); check(`[${tag}] ohne Ping: keine Antwortzeit-Kachel`, await ev(`return !r.querySelector('dialog.device .st-tile[data-kind="ping"]')`)); await ev(`${panel}._closeDialog()`); }
  // Einstellungen: Controller-Kachel
  await ev(`const p=${panel}; p._hub=${JSON.stringify("entry1")}; p._applyHub && p._applyHub()`);
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-set="stat"][data-kind="ctl"]')`), null, { timeout: 5000 });
  const ct = await ev(`return [...r.querySelectorAll("dialog.settings .st-tile")].map(x=>x.innerText.replace(/\\s+/g," ").trim())`);
  check(`[${tag}] Einstellungen: Controller-Kachel 99.9 % + Status`, ct.length === 2 && ct[0].includes("99.9") && ct[0].includes("1 Unterbruch") && ct[1].includes("Verbunden"), JSON.stringify(ct));
  await click('dialog.settings [data-set="stat"][data-kind="ctl"]');
  await p.waitForTimeout(500);
  check(`[${tag}] Controller-Unter-Fenster`, await ev(`const s=r.querySelector("dialog.stat-dlg"); return s.open && s.querySelector("h2").textContent==="Controller-Verfügbarkeit" && r.querySelector("dialog.settings").open`));
  await click('dialog.stat-dlg [data-stat="close"]');
  await p.waitForTimeout(250);
  check(`[${tag}] zurück zu den Einstellungen`, await ev(`return !r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.settings").open`));
  // --- Vorabversionen
  const setHacs = (attrs, sw) => p.evaluate(({ attrs, sw }) => {
    const ha = document.querySelector("home-assistant").hass;
    const id = "update.unifi_dynamic_clients_update", sid = "switch.unifi_dynamic_clients_pre_release";
    ha.entities[id] = { entity_id: id, platform: "hacs", device_id: "hacsdev1" };
    ha.states[id] = { entity_id: id, state: "on", attributes: { title: "UniFi Dynamic Clients", release_url: "https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v" + attrs.latest_version, supported_features: 23, in_progress: false, ...attrs } };
    if (sw === null) { delete ha.entities[sid]; delete ha.states[sid]; }
    else { ha.entities[sid] = { entity_id: sid, platform: "hacs", device_id: "hacsdev1", translation_key: "pre-release" }; if (sw === "disabled") delete ha.states[sid]; else ha.states[sid] = { entity_id: sid, state: sw, attributes: {} }; }
  }, { attrs, sw });
  const pushHass = () => ev(`${panel}.hass = {...${panel}.hass}`);
  await p.evaluate(() => { window.__version = { installed: "2.15.0", latest: "2.15.0" }; window.__pre = "2.16.0b1"; });
  await setHacs({ installed_version: "2.15.0", latest_version: "2.15.0" }, "disabled");
  await ev(`${panel}._loadVersion(false)`); await p.waitForTimeout(300);
  const vt = () => ev(`return r.querySelector("dialog.settings .ver-slot").innerText.replace(/\\s+/g," ")`);
  // Vorabversionen umschalten = Entwurf + Speichern; danach Einstellungen neu öffnen
  const togglePre = async () => {
    await click('[data-ver="prerelease"]');
    await click('[data-set="save"]');
    await p.waitForTimeout(500);
    await click(".gear-btn");
    await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-ver="prerelease"]')`), null, { timeout: 5000 });
    await p.waitForTimeout(300);
  };
  check(`[${tag}] Beta aus: aktuell 2.15.0, Schalter aus`, (await vt()).includes("2.15.0") && await ev(`return !r.querySelector("dialog.settings .ver").classList.contains("beta")`) && await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")==="false"`), await vt());
  // Schalter allein ist nur Entwurf: Speichern frei, Zeile noch unverändert
  await click('[data-ver="prerelease"]'); await p.waitForTimeout(300);
  check(`[${tag}] Schalter ohne Speichern: Entwurf, "geändert", noch keine Beta, nichts gesendet`, (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")==="true" && !!r.querySelector(".ver-opt .set-badge") && !r.querySelector('[data-set="save"]').disabled && !r.querySelector("dialog.settings .ver").classList.contains("beta")`)) && !(await p.evaluate(() => (window.__setPanel||[]).length)), await vt());
  await click('[data-ver="prerelease"]'); await p.waitForTimeout(200);
  await togglePre(); await p.waitForTimeout(500);
  const v1 = await vt();
  check(`[${tag}] Beta an: 2.16.0b1 violett, gesperrt, HACS-Hinweis`, v1.includes("2.16.0b1") && v1.includes("Beta") && v1.includes("Pre-release") && await ev(`const v=r.querySelector("dialog.settings .ver"); return v.classList.contains("beta") && v.querySelector(".ver-btn.primary").disabled && !!v.querySelector('[data-ver="hacs-device"]')`), v1);
  await p.screenshot({ path: `${OUT}/stat-${tag}-beta-blocked.png` });
  check(`[${tag}] Wahl für die ganze Instanz gespeichert (Backend)`, await p.evaluate(() => window.__panelSettings.prerelease === true && window.__setPanel.some(m=>m.prerelease===true)));
  // HACS-Schalter an, HACS kennt die Beta -> installierbar
  await setHacs({ installed_version: "2.15.0", latest_version: "2.16.0b1" }, "on"); await pushHass(); await p.waitForTimeout(300);
  check(`[${tag}] HACS Pre-release an: Aktualisieren frei, kein Hinweis`, await ev(`const v=r.querySelector("dialog.settings .ver"); return v.classList.contains("beta") && !v.querySelector(".ver-btn.primary").disabled && !v.querySelector(".ver-hint")`), await vt());
  // Schalter wieder aus -> keine Beta, auch wenn HACS sie kennt
  await togglePre(); await p.waitForTimeout(500);
  check(`[${tag}] Beta aus: HACS-Beta wird nicht angeboten`, !(await vt()).includes("2.16.0b1"), await vt());
  // Link zum HACS-Gerät
  await togglePre(); await setHacs({ installed_version: "2.15.0", latest_version: "2.15.0" }, "off"); await pushHass(); await p.waitForTimeout(500);
  await click('[data-ver="hacs-device"]'); await p.waitForTimeout(300);
  check(`[${tag}] Link öffnet HACS-Gerät`, (await p.evaluate(() => location.pathname + location.hash + (window.__nav || ""))).includes("") && await ev(`return !r.querySelector("dialog.settings").open`));
  // --- "In HACS freischalten": Entität deaktiviert -> aktivieren, warten, einschalten
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] .ver-slot')`), null, { timeout: 5000 });
  await p.evaluate(() => {
    const ha = document.querySelector("home-assistant").hass; const sid = "switch.unifi_dynamic_clients_pre_release";
    delete ha.entities[sid]; delete ha.states[sid];
    window.__entReg = [{ entity_id: sid, platform: "hacs", device_id: "hacsdev1", translation_key: "pre-release", disabled_by: "integration" }];
    window.__regUpdates = []; window.__services = []; window.__hacsStable = "2.15.0"; window.__hacsKnowsAfterRefresh = null;
  });
  await setHacs({ installed_version: "2.15.0", latest_version: "2.15.0" }, null);
  // Vorabversionen noch an (aus dem Abschnitt davor)? sicherstellen
  if (!(await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")==="true"`))) await togglePre();
  await ev(`${panel}._loadVersion(false)`); await p.waitForTimeout(500);
  check(`[${tag}] deaktivierte Entität gefunden: Knopf "In HACS freischalten"`, await ev(`return !!r.querySelector('[data-ver="hacs-enable"]') && r.querySelector(".ver-hint").innerText.includes("30 Sekunden")`), await vt());
  await p.screenshot({ path: `${OUT}/stat-${tag}-beta-enable.png` });
  await click('[data-ver="hacs-enable"]');
  await p.waitForTimeout(400);
  check(`[${tag}] während Freischalten: Fortschritt, gesperrt`, await ev(`const b=r.querySelector('[data-ver="hacs-enable"]'); return !!b && b.disabled && b.innerText.includes("freigeschaltet")`));
  await f.waitForFunction(new Function(`const v=${R}.querySelector("dialog.settings .ver"); return v && !v.querySelector(".ver-hint") && !v.querySelector(".ver-btn.primary").disabled`), null, { timeout: 10000 });
  const reg = await p.evaluate(() => ({ upd: window.__regUpdates, svc: window.__services.filter((x) => x.domain === "switch") }));
  check(`[${tag}] aktiviert (disabled_by null), eingeschaltet, Aktualisieren frei`, reg.upd.length === 1 && reg.upd[0].disabled_by === null && reg.svc.at(-1).service === "turn_on", JSON.stringify(reg));
  check(`[${tag}] gemerkt, dass das Panel den Schalter eingeschaltet hat`, (await p.evaluate(() => window.__panelSettings.prerelease_hacs)) === "switch.unifi_dynamic_clients_pre_release");
  // Vorabversionen aus -> HACS-Schalter wieder aus
  await togglePre(); await p.waitForTimeout(600);
  const off = await p.evaluate(() => ({ svc: window.__services.filter((x) => x.domain === "switch").at(-1), st: document.querySelector("home-assistant").hass.states["switch.unifi_dynamic_clients_pre_release"].state }));
  check(`[${tag}] Ausschalten räumt HACS-Schalter auf`, off.svc.service === "turn_off" && off.st === "off", JSON.stringify(off));
  // Nicht vom Panel eingeschaltet -> nicht anfassen
  await p.evaluate(() => { window.__services = []; const ha = document.querySelector("home-assistant").hass; ha.states["switch.unifi_dynamic_clients_pre_release"].state = "on"; });
  await togglePre(); await p.waitForTimeout(300); await togglePre(); await p.waitForTimeout(500);
  check(`[${tag}] fremd eingeschalteter HACS-Schalter bleibt`, (await p.evaluate(() => window.__services.filter((x) => x.domain === "switch").length)) === 0);
  // --- GitHub-Pre-Release ohne Zusatz in der Nummer (Tag v2.15.4 als Pre-Release)
  await p.evaluate(() => {
    const ha = document.querySelector("home-assistant").hass; const sid = "switch.unifi_dynamic_clients_pre_release";
    delete ha.entities[sid]; delete ha.states[sid];
    window.__entReg = [{ entity_id: sid, platform: "hacs", device_id: "hacsdev1", translation_key: "pre-release", disabled_by: "integration" }];
    window.__version = { installed: "2.15.3", latest: "2.15.3" }; window.__pre = "2.15.4"; window.__hacsStable = "2.15.3"; window.__hacsKnowsAfterRefresh = null;
  });
  await setHacs({ installed_version: "2.15.3", latest_version: "2.15.3" }, null);
  if (await ev(`return r.querySelector('[data-ver="prerelease"]').getAttribute("aria-checked")==="true"`)) await togglePre();
  await ev(`${panel}._loadVersion(false)`); await p.waitForTimeout(400);
  check(`[${tag}] Pre-Release 2.15.4, Schalter aus: aktuell 2.15.3`, !(await vt()).includes("2.15.4") && await ev(`return !r.querySelector("dialog.settings .ver").classList.contains("beta")`), await vt());
  await togglePre(); await p.waitForTimeout(600);
  check(`[${tag}] Pre-Release 2.15.4 ohne b/rc: violett, Beta, gesperrt, "In HACS freischalten"`, (await vt()).includes("2.15.4") && (await vt()).includes("Beta") && await ev(`const v=r.querySelector("dialog.settings .ver"); return v.classList.contains("beta") && v.querySelector(".ver-btn.primary").disabled && !!v.querySelector('[data-ver="hacs-enable"]')`), await vt());
  await setHacs({ installed_version: "2.15.3", latest_version: "2.15.4" }, "on"); await pushHass(); await p.waitForTimeout(300);
  check(`[${tag}] HACS kennt 2.15.4 (Pre-release an): installierbar`, await ev(`const v=r.querySelector("dialog.settings .ver"); return v.classList.contains("beta") && !v.querySelector(".ver-btn.primary").disabled && !v.querySelector(".ver-hint")`), await vt());
  await p.evaluate(() => { window.__services = []; });
  await togglePre(); await p.waitForTimeout(600);
  check(`[${tag}] Schalter aus: HACS-2.15.4 nicht als stabil angeboten`, !(await vt()).includes("2.15.4"), await vt());
  check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
  await t.ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
