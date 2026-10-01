import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0 && !${R}.querySelector(".gear-btn").disabled`));
  const ev = (c) => f.evaluate(new Function(`const r=${R};` + c));
  const panel = `document.querySelector("unifi-dynamic-panel")`;
  const verText = () => ev(`return r.querySelector("dialog.settings .ver")?.innerText.replace(/\\s+/g," ") || ""`);
  const open = async () => {
    await ev(`if (r.querySelector("dialog.settings").open) r.querySelector('[data-set="close"]').click()`);
    await ev(`r.querySelector(".gear-btn").click()`);
    await p.waitForTimeout(250);
  };
  const setHacs = (attrs) => p.evaluate((attrs) => {
    const ha = document.querySelector("home-assistant").hass;
    const id = "update.unifi_dynamic_clients_update";
    if (attrs) {
      ha.entities[id] = { entity_id: id, platform: "hacs" };
      ha.states[id] = { entity_id: id, state: attrs.latest_version !== attrs.installed_version ? "on" : "off", attributes: { title: "UniFi Dynamic Clients", release_url: `https://github.com/Diegofuego871/unifi_dynamic/releases/tag/v${attrs.latest_version}`, supported_features: 23, in_progress: false, ...attrs } };
    } else { delete ha.entities[id]; delete ha.states[id]; }
  }, attrs);
  const pushHass = () => ev(`${panel}.hass = {...${panel}.hass}`);

  // 1. Ohne HACS, aktuell
  await open();
  let t = await verText();
  check(`[${tag}] ohne HACS aktuell: Version + Suchen-Knopf`, t.includes("UniFi Dynamic Clients 2.9.1") && t.includes("Aktuell") && t.includes("zuletzt geprüft") && t.includes("Nach Updates suchen"), t);
  check(`[${tag}] Versionszeile zuoberst`, await ev(`return r.querySelector("dialog.settings .dlg-body").firstElementChild.classList.contains("ver-slot")`));
  // 2. Prüfen -> neue Version (GitHub), ohne HACS kein Knopf
  await p.evaluate(() => { window.__version = { installed: "2.9.1", latest: "2.10.0" }; window.__versionDelay = 400; });
  const geo = () => ev(`const d=r.querySelector("dialog.settings").getBoundingClientRect(), v=r.querySelector("dialog.settings .ver").getBoundingClientRect(), bt=r.querySelector('[data-ver="check"]').getBoundingClientRect(); return {top:d.top, h:d.height, verH:v.height, btnW:bt.width}`);
  const before = await geo();
  await ev(`r.querySelector('[data-ver="check"]').click()`);
  await p.waitForTimeout(100);
  t = await verText();
  const during = await geo();
  check(`[${tag}] Prüfung läuft: Spinner, gleiche Beschriftung`, t.includes("Suche nach Updates") && await ev(`return !!r.querySelector(".ver-spin") && r.querySelector('[data-ver="check"]').getAttribute("aria-busy")==="true"`), t);
  check(`[${tag}] Blatt und Zeile springen nicht`, before.top === during.top && before.h === during.h && before.verH === during.verH && Math.abs(before.btnW - during.btnW) < 1, JSON.stringify([before, during]));
  await p.waitForTimeout(500);
  t = await verText();
  check(`[${tag}] ohne HACS Update gefunden: Hinweis, Release Notes, kein Knopf`, t.includes("Version 2.10.0 verfügbar") && t.includes("Installation über HACS oder manuell") && t.includes("Release Notes") && !(await ev(`return !!r.querySelector('[data-ver="install"]')`)), t);
  check(`[${tag}] Release-Link zeigt auf GitHub`, (await ev(`return r.querySelector(".ver-link").href`)).endsWith("/releases/tag/v2.10.0"));
  await p.evaluate(() => { window.__versionDelay = 20; });
  // 3. Mit HACS: Aktualisieren-Knopf
  await setHacs({ installed_version: "2.9.1", latest_version: "2.10.0" });
  await pushHass();
  t = await verText();
  check(`[${tag}] mit HACS: Aktualisieren-Knopf`, t.includes("über HACS") && await ev(`return !!r.querySelector('[data-ver="install"]')`), t);
  await p.screenshot({ path: `${OUT}/version-${tag}-update.png` });
  await p.evaluate(() => { window.__services = []; });
  await ev(`r.querySelector('[data-ver="install"]').click()`);
  await p.waitForTimeout(50);
  let svc = await p.evaluate(() => window.__services);
  check(`[${tag}] update.install mit Entität, ohne Version`, svc.length === 1 && svc[0].domain === "update" && svc[0].service === "install" && svc[0].data.entity_id === "update.unifi_dynamic_clients_update" && !("version" in svc[0].data), JSON.stringify(svc));
  // HACS meldet Fortschritt
  await setHacs({ installed_version: "2.9.1", latest_version: "2.10.0", in_progress: true });
  await pushHass();
  t = await verText();
  check(`[${tag}] Installation läuft: Balken`, t.includes("Wird aktualisiert auf 2.10.0") && await ev(`return !!r.querySelector(".ver-prog")`), t);
  // HACS fertig -> Neustart nötig
  await setHacs({ installed_version: "2.10.0", latest_version: "2.10.0" });
  await pushHass();
  t = await verText();
  check(`[${tag}] Neustart nötig`, t.includes("2.10.0 installiert – Neustart nötig") && await ev(`return !!r.querySelector('[data-ver="restart"]')`), t);
  await p.screenshot({ path: `${OUT}/version-${tag}-restart.png` });
  await p.evaluate(() => { window.__services = []; });
  await ev(`r.querySelector('[data-ver="restart"]').click()`);
  await p.waitForTimeout(50);
  svc = await p.evaluate(() => window.__services);
  check(`[${tag}] Neustart mit Rückfrage ausgelöst`, svc.length === 1 && svc[0].domain === "homeassistant" && svc[0].service === "restart");
  check(`[${tag}] Anzeige "startet neu"`, (await verText()).includes("Home Assistant startet neu"));
  // 4. HACS kennt die neue Version noch nicht, GitHub schon: kein Installieren,
  //    stattdessen Hinweis; HACS wird automatisch nachgeladen
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "2.9.1", latest_version: "2.9.1" });
  await p.evaluate(() => { window.__version = { installed: "2.9.1", latest: "2.10.0" }; window.__services = []; window.__hacsWs = []; window.__hacsKnowsAfterRefresh = null; });
  await p.evaluate(() => { window.__hacsRefreshDelay = 1500; });
  await open();
  await p.waitForTimeout(400);
  t = await verText();
  check(`[${tag}] während Abgleich: "Wird mit HACS abgeglichen", Knopf gesperrt mit Spinner`, t.includes("Wird mit HACS abgeglichen") && !t.includes("HACS kennt diese Version noch nicht") && await ev(`const b=r.querySelector('[data-ver="check"]'); return !!b && b.disabled && !!b.querySelector(".ver-spin")`), t);
  await p.screenshot({ path: `${OUT}/version-${tag}-syncing.png` });
  await p.evaluate(() => { window.__hacsRefreshDelay = 0; });
  await p.waitForTimeout(5500);
  t = await verText();
  check(`[${tag}] HACS veraltet: kein Aktualisieren, Hinweis + Suchen`, t.includes("Version 2.10.0 verfügbar") && t.includes("HACS kennt diese Version noch nicht") && !(await ev(`return !!r.querySelector('[data-ver="install"]')`)) && await ev(`return !!r.querySelector('[data-ver="check"]')`), t);
  let hws = await p.evaluate(() => window.__hacsWs);
  check(`[${tag}] HACS automatisch nachgeladen (Repo 123456)`, hws.includes("hacs/repository/refresh:123456"), JSON.stringify(hws));
  // 4b. Automatischer Abgleich bringt die Version: direkt "Aktualisieren", nie der Hinweis
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "2.9.1", latest_version: "2.9.1" });
  await p.evaluate(() => { window.__hacsKnowsAfterRefresh = "2.10.0"; window.__hacsRefreshDelay = 800; window.__seenPending = false; });
  await open();
  for (let i = 0; i < 30; i++) { if ((await verText()).includes("HACS kennt diese Version noch nicht")) await p.evaluate(() => { window.__seenPending = true; }); await p.waitForTimeout(100); }
  check(`[${tag}] Abgleich erfolgreich: kein Hinweis, Aktualisieren da`, !(await p.evaluate(() => window.__seenPending)) && await ev(`return !!r.querySelector('[data-ver="install"]')`), await verText());
  await p.evaluate(() => { window.__hacsRefreshDelay = 0; window.__hacsKnowsAfterRefresh = null; });
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "2.9.1", latest_version: "2.9.1" });
  await open();
  await p.waitForTimeout(4500);
  // Nach dem Nachladen kennt HACS die Version: Knopf erscheint, install ohne version
  await p.evaluate(() => { window.__hacsKnowsAfterRefresh = "2.10.0"; window.__services = []; });
  await ev(`r.querySelector('[data-ver="check"]').click()`);
  await p.waitForTimeout(300);
  check(`[${tag}] nach Nachladen: Aktualisieren da`, await ev(`return !!r.querySelector('[data-ver="install"]')`), await verText());
  await p.evaluate(() => { window.__services = []; });
  await ev(`r.querySelector('[data-ver="install"]').click()`);
  await p.waitForTimeout(50);
  svc = await p.evaluate(() => window.__services);
  check(`[${tag}] install ohne version-Angabe`, svc.length === 1 && svc[0].service === "install" && !("version" in svc[0].data), JSON.stringify(svc));
  // Fehler beim Installieren: inline, Knopf wieder da
  await setHacs({ installed_version: "2.9.1", latest_version: "2.10.0" });
  await pushHass();
  await p.evaluate(() => { window.__serviceFails = "The version 2.10.0 for this integration can not be used with HACS."; });
  await ev(`r.querySelector('[data-ver="install"]').click()`);
  await p.waitForTimeout(100);
  t = await verText();
  check(`[${tag}] Installfehler in der Zeile`, t.includes("Aktualisieren fehlgeschlagen") && t.includes("can not be used with HACS") && await ev(`return !!r.querySelector('[data-ver="install"]')`), t);
  await p.evaluate(() => { window.__serviceFails = null; });
  check(`[${tag}] nach Fehler: Prüfknopf vorhanden`, await ev(`return !!r.querySelector('.ver [data-ver="check"]')`));
  await p.evaluate(() => { window.__version = { installed: "2.9.1", latest: "2.10.1" }; });
  await setHacs({ installed_version: "2.9.1", latest_version: "2.10.1" });
  await ev(`r.querySelector('.ver [data-ver="check"]').click()`);
  await p.waitForTimeout(300);
  t = await verText();
  check(`[${tag}] erneut geprüft: Fehler weg, neueste Version`, !t.includes("fehlgeschlagen") && t.includes("Version 2.10.1 verfügbar") && await ev(`return !!r.querySelector('[data-ver="install"]')`), t);
  check(`[${tag}] Update-Zeile ohne Überlauf`, await ev(`const v=r.querySelector("dialog.settings .ver"); return v.scrollWidth<=v.clientWidth+1`));
  await p.screenshot({ path: `${OUT}/version-${tag}-update2.png` });
  // Prüfen mit HACS: update_entity wird ausgelöst
  await ev(`${panel}._version = null`);
  await setHacs({ installed_version: "2.9.1", latest_version: "2.9.1" });
  await p.evaluate(() => { window.__version = { installed: "2.9.1", latest: "2.9.1" }; window.__services = []; window.__hacsKnowsAfterRefresh = null; });
  await open();
  await ev(`r.querySelector('[data-ver="check"]').click()`);
  await p.waitForTimeout(600);
  svc = await p.evaluate(() => window.__services);
  check(`[${tag}] Prüfen fragt HACS neu ab`, svc.some((s) => s.domain === "homeassistant" && s.service === "update_entity" && s.data.entity_id === "update.unifi_dynamic_clients_update"), JSON.stringify(svc));
  // 5. Fehler bei der Prüfung
  await setHacs(null);
  await p.evaluate(() => { window.__versionFails = true; });
  await ev(`r.querySelector('[data-ver="check"]').click()`);
  await p.waitForTimeout(600);
  t = await verText();
  check(`[${tag}] Prüffehler angezeigt`, t.includes("Prüfung fehlgeschlagen") && t.includes("GitHub nicht erreichbar"), t);
  await p.evaluate(() => { window.__versionFails = false; });
  check(`[${tag}] kein Überlauf`, await ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth<=d.clientWidth+1`));
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
