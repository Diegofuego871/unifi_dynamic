import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;
async function setup(opts, q = "") {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html${q}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  return { ctx, p, f };
}
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));
const dlgText = (f) => ev(f, `return r.querySelector("dialog.device").innerText`);
{
  const { ctx, p, f } = await setup({ viewport: { width: 1400, height: 900 } });
  const hdr = await ev(f, `return [...r.querySelectorAll("thead th")].map(t=>t.textContent.trim())`);
  check("Spalte HA-Gerät nach Alias", hdr[1].startsWith("HA-Gerät"), hdr.join("|"));
  const cell = await ev(f, `const b=r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:02"] .linked-link');return b&&b.textContent`);
  check("Tabelle zeigt verknüpftes Gerät", cell === "HA Gerät 05", cell);
  check("Nicht verknüpft -> Strich", await ev(f, `return r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:01"] td:nth-child(2)').textContent.trim()==="–"`));
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:02"] .linked-link').click()`);
  const path = await p.evaluate(() => location.pathname);
  check("Klick in Tabelle öffnet HA-Geräteseite, kein Dialog", path === "/config/devices/device/ha-5" && !(await ev(f, `return r.querySelector("dialog.device").open`)), path);
  // Suche nach Gerätename
  await ev(f, `const s=r.querySelector(".search");s.value="HA Gerät 05";s.dispatchEvent(new Event("input"))`);
  const rows = await ev(f, `return [...r.querySelectorAll("tbody tr[data-key]")].map(t=>t.dataset.mac)`);
  check("Suche findet verknüpften Gerätenamen", rows.length === 1 && rows[0] === "aa:bb:cc:dd:ee:02", rows.join());
  await ev(f, `const s=r.querySelector(".search");s.value="";s.dispatchEvent(new Event("input"))`);
  // Sortierung
  await ev(f, `r.querySelector('th[data-sort-key="linked"]').click()`);
  const first = await ev(f, `return r.querySelector("tbody tr[data-key]").dataset.mac`);
  check("Sortieren nach HA-Gerät: verknüpfte zuerst", first === "aa:bb:cc:dd:ee:02", first);
  await ev(f, `r.querySelector('th[data-sort-key="linked"]').click();r.querySelector('th[data-sort-key="linked"]').click()`);
  // Dialog für Client 01 (MAC-Vorschlag)
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:01"] .menu-btn').click()`);
  await ev(f, `r.querySelector('.menu [data-action="details"]').click()`);
  let t = await dlgText(f);
  check("Dialog: kein Gerät verknüpft", t.includes("Kein Home-Assistant-Gerät verknüpft."));
  await ev(f, `r.querySelector('[data-dlg="link-open"]').click()`);
  check("Picker: Laden + Fokus im Suchfeld", (await dlgText(f)).includes("Lädt") && await ev(f, `return r.activeElement?.dataset.dlg`) === "picker-search");
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  const groups = await ev(f, `return [...r.querySelectorAll(".pick-group")].map(g=>g.textContent)`);
  const firstPick = await ev(f, `return r.querySelector(".pick .ln-name").textContent`);
  check("MAC-Vorschlag steht oben", groups[0] === "Passt zur MAC-Adresse" && firstPick.startsWith("Bodenheizung"), groups.join("|") + " / " + firstPick);
  const n = await ev(f, `return r.querySelectorAll(".pick").length`);
  check("Liste begrenzt (1 Vorschlag + 50) mit Hinweis", n === 51 && (await dlgText(f)).includes("30 weitere"), String(n));
  await p.screenshot({ path: `${OUT}/link-picker.png` });
  // Tippen: Fokus + Cursor bleiben
  await p.keyboard.type("Gerät 7");
  await p.waitForTimeout(100);
  const st = await ev(f, `const a=r.activeElement;return {dlg:a?.dataset.dlg,v:a?.value,pos:a?.selectionStart,n:r.querySelectorAll(".pick").length}`);
  check("Tippen filtert, Fokus+Cursor bleiben", st.dlg === "picker-search" && st.v === "Gerät 7" && st.pos === 7 && st.n === 10, JSON.stringify(st));
  await p.keyboard.press("ArrowLeft"); await p.keyboard.press("ArrowLeft"); await p.keyboard.type("0");
  const st2 = await ev(f, `const a=r.activeElement;return {v:a.value,pos:a.selectionStart}`);
  check("Einfügen in der Mitte: Cursor bleibt", st2.v === "Gerät0 7" && st2.pos === 6, JSON.stringify(st2));
  // Polling während Suche
  await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
  check("Polling: Fokus bleibt im Suchfeld", await ev(f, `return r.activeElement?.dataset.dlg`) === "picker-search");
  // Esc: erst Suchtext leeren (Browser), dann nur die Auswahl schliessen
  await p.keyboard.press("Escape");
  check("1. Esc leert Suche, Auswahl bleibt", await ev(f, `return r.querySelector('[data-dlg="picker-search"]')?.value === "" && r.querySelectorAll(".pick").length === 51`));
  await p.keyboard.press("Escape");
  check("2. Esc schliesst nur Auswahl", await ev(f, `return r.querySelector("dialog.device").open && !r.querySelector(".picker")`));
  // Verknüpfen per Vorschlag
  await ev(f, `r.querySelector('[data-dlg="link-open"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  await ev(f, `r.querySelector('.pick[data-device-id="ha-thermo"]').click()`);
  await p.waitForTimeout(200);
  t = await dlgText(f);
  const call = (await p.evaluate(() => window.__wsCalls.filter((c) => c.type === "unifi_dynamic/link_device"))).at(-1);
  check("Verknüpfen: WS-Aufruf korrekt", call.mac === "aa:bb:cc:dd:ee:01" && call.device_id === "ha-thermo" && call.entry_id === "entry1", JSON.stringify(call));
  check("Dialog zeigt Gerät mit Bereich/Hersteller", t.includes("Bodenheizung") && t.includes("Büro · Shelly ST1820") && !(await ev(f, `return !!r.querySelector(".picker")`)));
  check("Tabelle aktualisiert", await ev(f, `return r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:01"] .linked-link')?.textContent`) === "Bodenheizung");
  await p.screenshot({ path: `${OUT}/link-card.png` });
  // Ändern: aktuelles markiert
  await ev(f, `r.querySelector('.linked-actions [data-dlg="link-open"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  check("Ändern: aktuelles als verknüpft markiert", await ev(f, `return r.querySelector('.pick.current')?.dataset.deviceId`) === "ha-thermo");
  // Fehler beim Verknüpfen
  await ev(f, `const b=r.querySelector('.pick:not(.current)'); b.dataset.deviceId="ha-fail"; b.click()`);
  await p.waitForTimeout(200);
  t = await dlgText(f);
  check("Fehler: Meldung im Dialog, Auswahl bleibt offen", t.includes("Aktion fehlgeschlagen: Unbekanntes Gerät") && await ev(f, `return !!r.querySelector(".picker")`));
  await ev(f, `r.querySelector('[data-dlg="link-cancel"]').click()`);
  // Link im Dialog -> HA-Geräteseite
  await ev(f, `r.querySelector('.linked-main').click()`);
  check("Klick auf Gerät im Dialog öffnet Seite, Dialog zu", (await p.evaluate(() => location.pathname)) === "/config/devices/device/ha-thermo" && !(await ev(f, `return r.querySelector("dialog.device").open`)));
  // Entfernen
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:01"] td:nth-child(3)').click()`);
  await p.waitForTimeout(400);
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:01"] td:nth-child(3)').click()`);
  await ev(f, `r.querySelector('[data-dlg="link-remove"]').click()`);
  await p.waitForTimeout(200);
  check("Verknüpfung entfernen", (await dlgText(f)).includes("Kein Home-Assistant-Gerät verknüpft.") && !(await p.evaluate(() => window.__links["aa:bb:cc:dd:ee:01"])));
  // Ladefehler Geräteliste
  await p.evaluate(() => (window.__listDevicesFails = true));
  await ev(f, `r.querySelector('[data-dlg="link-open"]').click()`);
  await p.waitForTimeout(200);
  check("Ladefehler: Hinweis + Erneut versuchen", (await dlgText(f)).includes("boom") && await ev(f, `return !!r.querySelector('[data-dlg="link-retry"]')`));
  await p.evaluate(() => (window.__listDevicesFails = false));
  await ev(f, `r.querySelector('[data-dlg="link-retry"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  check("Erneut versuchen lädt Liste", true);
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  // Löschen eines verknüpften Clients
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:02"] td:nth-child(3)').click()`);
  p.once("dialog", (x) => x.accept());
  await ev(f, `r.querySelector('[data-dlg="remove"]').click()`);
  await p.waitForFunction(() => !window.__links["aa:bb:cc:dd:ee:02"], null, { timeout: 3000 }).catch(() => {});
  check("Client gelöscht: Verknüpfung weg", !(await p.evaluate(() => window.__links["aa:bb:cc:dd:ee:02"])));
  await ctx.close();
}
{
  const { ctx, p, f } = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, "?entry=entry1&mac=aa:bb:cc:dd:ee:01");
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device").open`));
  await ev(f, `r.querySelector('[data-dlg="link-open"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  await ev(f, `r.querySelector('.picker').scrollIntoView()`);
  const geo = await ev(f, `const d=r.querySelector("dialog.device");const i=r.querySelector('[data-dlg="picker-search"]').getBoundingClientRect();return {sw:d.scrollWidth,cw:d.clientWidth,iw:i.width,ir:i.right,fs:getComputedStyle(r.querySelector('[data-dlg="picker-search"]')).fontSize}`);
  check("Handy: kein Überlauf, Suchfeld 16px", geo.sw <= geo.cw && geo.fs === "16px" && geo.ir <= 390, JSON.stringify(geo));
  const off = await (await p.$("#panel-frame")).boundingBox();
  const pos = await ev(f, `const b=r.querySelector('.pick[data-device-id="ha-thermo"]').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`);
  await p.touchscreen.tap(off.x + pos.x, off.y + pos.y);
  await p.waitForTimeout(300);
  check("Handy: Tipp verknüpft", (await p.evaluate(() => window.__links["aa:bb:cc:dd:ee:01"])) === "ha-thermo");
  await p.screenshot({ path: `${OUT}/link-mobile.png` });
  await ctx.close();
}
await b.close(); process.exit(ok ? 0 : 1);
