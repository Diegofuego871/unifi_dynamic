import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const OUT = outDir;
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (label, pass, info = "") => { ok &&= !!pass; console.log(`${pass ? "PASS" : "FAIL"} ${label}${info ? " - " + info : ""}`); };

async function open(ctxOpts, query = "") {
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html${query}`);
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  f.on?.("console", () => {});
  await f.waitForFunction(() => document.querySelector("unifi-dynamic-panel")?.shadowRoot?.querySelectorAll("tbody tr[data-key]").length > 0);
  return { ctx, p, f };
}
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const dlg = (f) => f.evaluate(new Function(`const r=${R};const d=r.querySelector("dialog.device");return {open:d.open,text:d.innerText,title:(d.querySelector("h2")||{}).textContent,
  openDev:d.querySelector('[data-dlg="open-device"]')?.disabled, ents:d.querySelectorAll('[data-dlg="more-info"]').length}`));
const rowCenter = async (f, mac) => { const r = await rowCenter0(f, mac); await new Promise((ok) => setTimeout(ok, 400)); return r; };
const rowCenter0 = (f, mac) => f.evaluate(new Function("mac", `const tr=${R}.querySelector('tr[data-mac="'+mac+'"] td:nth-child(3)');tr.scrollIntoView({block:"center"});const r=tr.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}`), mac);
const frameOffset = async (p) => { const r = await (await p.$("#panel-frame")).boundingBox(); return r; };

// ---------------- Desktop ----------------
{
  const { ctx, p, f } = await open({ viewport: { width: 1280, height: 800 } });
  const off = await frameOffset(p);
  let pt = await rowCenter(f, "aa:bb:cc:dd:ee:01");
  await p.mouse.click(off.x + pt.x, off.y + pt.y);
  let d = await dlg(f);
  check("Klick auf Zeile öffnet Dialog", d.open && d.title.startsWith("Licht Küche 1"), d.title);
  check("Hostname angezeigt", d.text.includes("host-1"));
  check("Signal/RSSI angezeigt", d.text.includes("-79 dBm · RSSI 21"), d.text.match(/Signal[^\n]*\n[^\n]*/)?.[0]);
  check("Zuerst gesehen angezeigt", /Zuerst gesehen\s*\n?\s*\d/.test(d.text) && d.text.includes("vorgestern"));
  check("2 Entitäten + formatierter Zustand", d.ents === 2 && d.text.includes("Verbunden"));
  check("HA-Geräteseite-Button aktiv", d.openDev === false);
  await p.screenshot({ path: `${OUT}/dlg-desktop.png` });
  // Entität -> more-info
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="more-info"]').click()`));
  const mi = await p.evaluate(() => window.__moreInfo);
  check("Entität öffnet HA-more-info", mi.length === 1 && mi[0].startsWith("binary_sensor."), JSON.stringify(mi));
  // Esc
  await p.keyboard.press("Escape");
  check("Esc schliesst", !(await dlg(f)).open);
  // Kein HA-Gerät
  pt = await rowCenter(f, "aa:bb:cc:dd:ee:03");
  await p.mouse.click(off.x + pt.x, off.y + pt.y);
  d = await dlg(f);
  check("Ohne HA-Gerät: Button deaktiviert + Hinweis", d.openDev === true && d.text.includes("noch kein Gerät"));
  check("Unbekanntes Erstdatum -> 'unbekannt' (i=3 hat first_seen)", !d.text.includes("Zuerst gesehen\nunbekannt"));
  // Hintergrund-Klick schliesst
  await p.mouse.click(off.x + 20, off.y + 20);
  check("Klick auf Hintergrund schliesst", !(await dlg(f)).open);
  // Kabel-Client (i=5): keine WLAN-Felder, first_seen null bei i=4/8 -> i=8 wireless? i%4==0 -> 0,4,8
  pt = await rowCenter(f, "aa:bb:cc:dd:ee:05");
  await p.mouse.click(off.x + pt.x, off.y + pt.y);
  d = await dlg(f);
  check("Kabel-Client ohne SSID/Signal", d.open && !d.text.includes("Signal") && !d.text.includes("SSID"));
  await p.keyboard.press("Escape");
  pt = await rowCenter(f, "aa:bb:cc:dd:ee:04");
  await p.mouse.click(off.x + pt.x, off.y + pt.y);
  d = await dlg(f);
  check("Kein first_seen -> unbekannt", /Zuerst gesehen\s+unbekannt/.test(d.text));
  // Schützen im Dialog (i=4 ist nicht geschützt? 4%5!=0 -> ja nicht)
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="exclude"]').focus(); ${R}.querySelector('[data-dlg="exclude"]').click()`));
  await f.waitForFunction(new Function(`return !!${R}.querySelector('dialog.device [data-dlg="unexclude"]')`));
  d = await dlg(f);
  check("Schützen: Dialog bleibt offen, Badge da", d.open && d.text.includes("geschützt"));
  // Polling-Neuaufbau: Fokus bleibt
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="unexclude"]').focus()`));
  await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
  const focus = await f.evaluate(new Function(`return ${R}.activeElement?.dataset?.dlg`));
  check("Fokus übersteht Polling", focus === "unexclude", focus);
  // Löschen fehlgeschlagen
  await p.evaluate(() => (window.__removeFails = true));
  p.once("dialog", (x) => x.accept());
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="remove"]').click()`));
  await p.waitForTimeout(300);
  d = await dlg(f);
  check("Löschen fehlgeschlagen: bleibt offen mit Fehler", d.open && d.text.includes("Aktion fehlgeschlagen: Unauthorized"));
  // Löschen abgebrochen
  await p.evaluate(() => (window.__removeFails = false));
  p.once("dialog", (x) => x.dismiss());
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="remove"]').click()`));
  await p.waitForTimeout(200);
  check("Löschen abgebrochen: bleibt offen", (await dlg(f)).open);
  // Löschen ok
  p.once("dialog", (x) => x.accept());
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="remove"]').click()`));
  await p.waitForTimeout(300);
  const gone = await f.evaluate(new Function(`return !${R}.querySelector('tr[data-mac="aa:bb:cc:dd:ee:04"]')`));
  check("Löschen ok: Dialog zu, Zeile weg", !(await dlg(f)).open && gone);
  // Menü -> Details
  await f.evaluate(new Function(`${R}.querySelector('tr[data-mac="aa:bb:cc:dd:ee:06"] .menu-btn').click()`));
  await f.evaluate(new Function(`${R}.querySelector('.menu [data-action="details"]').click()`));
  d = await dlg(f);
  check("Menü 'Details' öffnet Dialog", d.open && d.title.includes(" 6"));
  // HA-Geräteseite
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="open-device"]').click()`));
  const nav = await p.evaluate(() => location.pathname);
  check("Geräteseite: Navigation + Dialog zu", nav === "/config/devices/device/dev-6" && !(await dlg(f)).open, nav);
  await ctx.close();
}

// ---------------- Deep-Link ----------------
{
  const { ctx, p, f } = await open({ viewport: { width: 1280, height: 800 } }, "?entry=entry1&mac=AA:BB:CC:DD:EE:07");
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device").open`));
  const d = await dlg(f);
  const url = await p.evaluate(() => location.pathname + location.search);
  check("Deep-Link öffnet Dialog (MAC gross geschrieben)", d.title.includes(" 7"), d.title);
  check("Deep-Link-Parameter entfernt", url === "/ha-sim-dialog.html", url);
  await p.keyboard.press("Escape");
  // Panel schon offen: neue Meldung
  await p.evaluate(() => { history.pushState(null, "", "/ha-sim-dialog.html?entry=entry1&mac=aa:bb:cc:dd:ee:09"); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); });
  await p.waitForTimeout(100);
  check("Deep-Link bei offenem Panel", (await dlg(f)).title?.includes(" 9"));
  await p.keyboard.press("Escape");
  await p.evaluate(() => { history.pushState(null, "", "/ha-sim-dialog.html?entry=x&mac=00:11:22:33:44:55"); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); });
  await p.waitForTimeout(100);
  const d2 = await dlg(f);
  check("Unbekannte MAC: Hinweis statt Fehler", d2.open && d2.text.includes("nicht (mehr) vorhanden"));
  await p.keyboard.press("Escape");
  await ctx.close();
}

// ---------------- Mobile ----------------
{
  const { ctx, p, f } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const cdp = await ctx.newCDPSession(p);
  const off = await frameOffset(p);
  const touch = async (pts) => { for (const [type, x, y] of pts) { await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] }); await p.waitForTimeout(16); } };
  const drag = async (x, y1, y2, x2 = x) => { const pts = [["touchStart", x, y1]]; for (let i = 1; i <= 10; i++) pts.push(["touchMove", x + (x2 - x) * i / 10, y1 + (y2 - y1) * i / 10]); pts.push(["touchEnd", x2, y2]); await touch(pts); };
  const before = await f.evaluate(new Function(`return ${R}.querySelector(".content").scrollTop`));
  await drag(off.x + 150, off.y + 600, off.y + 300);
  await p.waitForTimeout(400);
  const after = await f.evaluate(new Function(`return ${R}.querySelector(".content").scrollTop`));
  check("Vertikales Wischen scrollt ohne Dialog", after > before + 100 && !(await dlg(f)).open, `${before}->${after}`);
  await drag(off.x + 300, off.y + 500, off.y + 500, off.x + 60);
  await p.waitForTimeout(400);
  const sl = await f.evaluate(new Function(`return ${R}.querySelector(".content").scrollLeft`));
  check("Horizontales Wischen scrollt ohne Dialog", sl > 50 && !(await dlg(f)).open, `scrollLeft=${sl}`);
  // Tipp kurz nach Scroll wird ignoriert
  await f.evaluate(new Function(`const c=${R}.querySelector(".content"); c.dispatchEvent(new Event("scroll")); ${R}.querySelector("tbody tr[data-key] td").click();`));
  check("Tipp direkt nach Scroll öffnet nichts", !(await dlg(f)).open);
  await p.waitForTimeout(400);
  // Menü offen, Tipp auf andere Zeile schliesst nur Menü
  let pt = await rowCenter(f, "aa:bb:cc:dd:ee:02");
  await f.evaluate(new Function(`${R}.querySelector('tr[data-mac="aa:bb:cc:dd:ee:03"] .menu-btn').click()`));
  await p.touchscreen.tap(off.x + pt.x, off.y + pt.y);
  const menuOpen = await f.evaluate(new Function(`return !!${R}.querySelector(".menu")`));
  check("Offenes Menü: Tipp schliesst nur das Menü", !menuOpen && !(await dlg(f)).open);
  // echter Tipp
  pt = await rowCenter(f, "aa:bb:cc:dd:ee:02");
  const tableTop = await f.evaluate(new Function(`return ${R}.querySelector(".content").scrollTop`));
  await p.touchscreen.tap(off.x + pt.x, off.y + pt.y);
  const geo = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.device");const r=d.getBoundingClientRect();const a=d.querySelector(".dlg-actions").getBoundingClientRect();return {open:d.open,l:r.left,w:r.width,b:r.bottom,h:r.height,vh:innerHeight,vw:innerWidth,sh:d.scrollHeight,ch:d.clientHeight,ab:a.bottom}`));
  check("Tipp öffnet Blatt von unten, volle Breite", geo.open && geo.l === 0 && Math.abs(geo.w - geo.vw) < 1 && Math.abs(geo.b - geo.vh) < 1, JSON.stringify(geo));
  check("Aktionsleiste im sichtbaren Bereich", geo.ab <= geo.vh + 0.5);
  await p.screenshot({ path: `${OUT}/dlg-mobile.png` });
  if (geo.sh > geo.ch) {
    const r = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.device");return d.getBoundingClientRect().top`));
    await drag(off.x + 200, off.y + r + 300, off.y + r + 100);
    await p.waitForTimeout(300);
    const st = await f.evaluate(new Function(`return ${R}.querySelector("dialog.device").scrollTop`));
    const content = await f.evaluate(new Function(`return ${R}.querySelector(".content").scrollTop`));
    check("Dialog scrollt intern, Tabelle darunter bleibt", st > 0 && content === tableTop, `dlg=${st} table=${content}/${tableTop}`);
    await p.screenshot({ path: `${OUT}/dlg-mobile-scrolled.png` });
  } else console.log("INFO Dialog passt ohne Scrollen");
  // Schliessen-Button
  await f.evaluate(new Function(`${R}.querySelector('[data-dlg="close"]').click()`));
  check("×-Button schliesst", !(await dlg(f)).open);
  await ctx.close();
}
// EN
{
  const { ctx, p, f } = await open({ viewport: { width: 1280, height: 800 } }, "?lang=en&entry=entry1&mac=aa:bb:cc:dd:ee:02");
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.device").open`));
  const d = await dlg(f);
  check("Englisch", d.text.includes("First seen") && d.text.includes("Open HA device page"));
  await ctx.close();
}
await b.close(); process.exit(ok ? 0 : 1);
