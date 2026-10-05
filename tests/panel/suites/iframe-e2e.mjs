import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const OUT = outDir;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
page.on("response", (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

await page.goto("http://127.0.0.1:8950/ha-sim.html");
const frameEl = await page.waitForSelector("#panel-frame");
const frame = await frameEl.contentFrame();
await frame.waitForFunction(() => {
  const el = document.querySelector("unifi-dynamic-panel");
  return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length > 0;
}, null, { timeout: 10000 });
await page.waitForTimeout(300);

// --- 1. Grundzustand ---------------------------------------------------
const base = await frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const content = root.querySelector(".content");
  return {
    rows: root.querySelectorAll("tbody tr[data-key]").length,
    placeholder: root.querySelector(".search").placeholder,
    hasOwnMenuButton: !!root.querySelector(".menu-toggle-btn"),
    hasH1: !!root.querySelector("h1"),
    toolbarBg: getComputedStyle(root.querySelector(".stats")).backgroundColor,
    hostColor: getComputedStyle(root.host).color,
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    docScrollH: document.documentElement.scrollHeight,
    docClientH: document.documentElement.clientHeight,
    contentScrollW: content.scrollWidth,
    contentClientW: content.clientWidth,
    contentScrollH: content.scrollHeight,
    contentClientH: content.clientHeight,
    toolbar: root.querySelector(".toolbar").getBoundingClientRect().toJSON(),
    th: root.querySelector("thead tr.head-row th:nth-child(3)").getBoundingClientRect().toJSON(), th1: root.querySelector("thead th").getBoundingClientRect().toJSON(),
    contentRect: content.getBoundingClientRect().toJSON(),
  };
});
const top = await page.evaluate(() => ({
  scale: window.visualViewport.scale,
  layoutW: document.documentElement.clientWidth,
  scrollX: window.scrollX,
  scrollY: window.scrollY,
}));
console.log("Grundzustand iframe:", JSON.stringify(base));
console.log("Grundzustand Elternseite:", JSON.stringify(top));

check("40 Zeilen gerendert", base.rows === 40, `rows=${base.rows}`);
check("Sprache Deutsch aus Eltern-hass", base.placeholder.startsWith("In allen"), base.placeholder);
check("Kein eigener Menü-Button mehr", !base.hasOwnMenuButton);
check("Kein eigener Titel (h1) mehr", !base.hasH1);
check("Dunkles Design übernommen (Statusleiste #1c1c1c)", base.toolbarBg === "rgb(28, 28, 28)", base.toolbarBg);
check("Textfarbe übernommen (#e1e1e1)", base.hostColor === "rgb(225, 225, 225)", base.hostColor);
check("Kein Zoom-out der HA-Seite (scale 1, Breite 390)", top.scale === 1 && top.layoutW === 390, JSON.stringify(top));
check("iframe-Dokument selbst läuft nicht über (Breite)", base.docScrollW === base.docClientW, `${base.docScrollW}/${base.docClientW}`);
check("iframe-Dokument selbst läuft nicht über (Höhe)", base.docScrollH === base.docClientH, `${base.docScrollH}/${base.docClientH}`);
check("Tabelle breiter als Bildschirm (horizontal scrollbar in .content)", base.contentScrollW > base.contentClientW, `${base.contentScrollW}>${base.contentClientW}`);
check("Tabelle höher als Platz (vertikal scrollbar in .content)", base.contentScrollH > base.contentClientH, `${base.contentScrollH}>${base.contentClientH}`);
check("Kopfzeile sitzt oben in .content", Math.abs(base.th.top - base.contentRect.top) <= 1.5, `th=${base.th.top} content=${base.contentRect.top}`);

const lay = await frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const r = (sel) => root.querySelector(sel).getBoundingClientRect();
  return { icon: r(".brand-icon").toJSON(), search: r(".search-wrap").toJSON(), toolbarH: r(".toolbar").height };
});
check("Handy: Icon und Suchfeld in derselben Zeile",
  lay.search.top < lay.icon.bottom && lay.search.left > lay.icon.right, JSON.stringify(lay));
await page.screenshot({ path: `${OUT}/e2e-mobile-initial.png` });

// --- 2. Echte Touch-Scrollgesten (CDP), nicht nur gesetzte scrollTop/Left ---
const cdp = await context.newCDPSession(page);
const frameBox = await frameEl.boundingBox();
const gx = frameBox.x + 200;
const gy = frameBox.y + base.contentRect.top + 200;

// synthesizeScrollGesture wirkt in dieser Headless-Umgebung nachweislich
// nicht einmal auf einer Kontrollseite; daher echte Touch-Events.
async function touchDrag(x, y, dx, dy) {
  const steps = 15;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
}
await touchDrag(gx, gy, 0, -250);   // nach oben wischen = nach unten scrollen
await touchDrag(gx, gy, -250, 0);   // nach links wischen = nach rechts scrollen

const after = await frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const content = root.querySelector(".content");
  return {
    contentScrollLeft: content.scrollLeft,
    contentScrollTop: content.scrollTop,
    docScrollX: window.scrollX,
    docScrollY: window.scrollY,
    toolbar: root.querySelector(".toolbar").getBoundingClientRect().toJSON(),
    th: root.querySelector("thead tr.head-row th:nth-child(3)").getBoundingClientRect().toJSON(), th1: root.querySelector("thead th").getBoundingClientRect().toJSON(),
    contentRect: content.getBoundingClientRect().toJSON(),
  };
});
const topAfter = await page.evaluate(() => ({
  scale: window.visualViewport.scale, scrollX: window.scrollX, scrollY: window.scrollY,
  headerTop: document.querySelector(".sim-toolbar").getBoundingClientRect().top,
}));
console.log("Nach Gesten iframe:", JSON.stringify(after));
console.log("Nach Gesten Elternseite:", JSON.stringify(topAfter));

check("Geste hat .content tatsächlich vertikal gescrollt", after.contentScrollTop > 100, `scrollTop=${after.contentScrollTop}`);
check("Geste hat .content tatsächlich horizontal gescrollt", after.contentScrollLeft > 50, `scrollLeft=${after.contentScrollLeft}`);
check("iframe-Dokument blieb unbewegt", after.docScrollX === 0 && after.docScrollY === 0);
check("HA-Seite blieb unbewegt, Kopfzeile oben", topAfter.scrollX === 0 && topAfter.scrollY === 0 && topAfter.headerTop === 0, JSON.stringify(topAfter));
check("Werkzeugleiste unverändert (Position + volle Breite)",
  after.toolbar.top === base.toolbar.top && after.toolbar.left === 0 && after.toolbar.width === base.toolbar.width,
  `top=${after.toolbar.top} left=${after.toolbar.left} w=${after.toolbar.width}`);
check("Kopfzeile bleibt oben in .content (vertikal fixiert)", Math.abs(after.th.top - after.contentRect.top) < 1, `th=${after.th.top} content=${after.contentRect.top}`);
check("Kopfzeile läuft horizontal mit ihrer Spalte mit", after.th.left < base.th.left - 50, `vorher=${base.th.left} nachher=${after.th.left}`);
check("Alias-Spalte bleibt beim Querscrollen stehen (Handy)", Math.abs(after.th1.left) < 1.5, `links=${after.th1.left}`);

await page.screenshot({ path: `${OUT}/e2e-mobile-scrolled.png` });

// --- 3. Zeilenmenü: Geräteseite öffnen navigiert das Elternfenster ------
await frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  root.querySelector(".content").scrollTo(0, 0);
});
await page.waitForTimeout(200);
const menuBtn = await frame.evaluateHandle(() =>
  document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector('tr[data-key] .menu-btn'));
await menuBtn.asElement().tap();
await page.waitForTimeout(200);
const menuInfo = await frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const menu = root.querySelector(".menu");
  if (!menu) return null;
  const r = menu.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight,
    items: [...menu.querySelectorAll("button")].map((b) => b.textContent.trim()) };
});
check("Zeilenmenü öffnet innerhalb des sichtbaren Bereichs",
  !!menuInfo && menuInfo.top >= 0 && menuInfo.bottom <= menuInfo.vh && menuInfo.left >= 0 && menuInfo.right <= menuInfo.vw,
  JSON.stringify(menuInfo));
await page.screenshot({ path: `${OUT}/e2e-mobile-menu.png` });

const openBtn = await frame.evaluateHandle(() =>
  document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector('.menu button[data-action="open-device"]'));
await openBtn.asElement().tap();
await page.waitForTimeout(200);
const nav = await page.evaluate(() => ({ path: location.pathname, events: window.__locationChanged }));
check("Geräteseite: Elternfenster navigiert + location-changed", nav.path === "/config/devices/device/dev-0" && nav.events.length === 1, JSON.stringify(nav));
// HA (Frontend ab 20260930) braucht history.state.from, sonst führt der
// Pfeil der Geräteseite zur Geräteliste statt zurück ins Panel.
const navState = await page.evaluate(() => history.state);
check("Geräteseite: history.state.from = Pfad vor der Navigation", navState?.from === "/ha-sim.html", JSON.stringify(navState));

// --- 4. Löschen: confirm() im Sandbox-iframe + WebSocket über Eltern-hass
await page.goto("http://127.0.0.1:8950/ha-sim.html");
const frameEl2 = await page.waitForSelector("#panel-frame");
const frame2 = await frameEl2.contentFrame();
await frame2.waitForFunction(() => {
  const el = document.querySelector("unifi-dynamic-panel");
  return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length > 0;
});
let dialogMsg = null;
page.once("dialog", async (d) => { dialogMsg = d.message(); await d.accept(); });
const mb2 = await frame2.evaluateHandle(() =>
  document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector('tr[data-key] .menu-btn'));
await mb2.asElement().tap();
await page.waitForTimeout(150);
const rm = await frame2.evaluateHandle(() =>
  document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector('.menu button[data-action="remove"]'));
await rm.asElement().tap();
await page.waitForTimeout(400);
const calls = await page.evaluate(() => window.__wsCalls.map((c) => c.type));
check("confirm()-Dialog erscheint im Sandbox-iframe", !!dialogMsg, dialogMsg || "kein Dialog");
check("Löschen ruft remove_client über die Eltern-Verbindung", calls.includes("unifi_dynamic/remove_client"), JSON.stringify(calls));

check("Keine JS-Fehler", errors.length === 0, errors.join(" | "));

// --- 5. Desktop-Gegenprobe ------------------------------------------------
const desk = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const dp = await desk.newPage();
await dp.goto("http://127.0.0.1:8950/ha-sim.html");
const df = await (await dp.waitForSelector("#panel-frame")).contentFrame();
await df.waitForFunction(() => {
  const el = document.querySelector("unifi-dynamic-panel");
  return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length > 0;
});
await dp.waitForTimeout(300);
const d = await df.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const c = root.querySelector(".content");
  const r = (sel) => root.querySelector(sel).getBoundingClientRect();
  return { toolbarH: r(".toolbar").height, sw: c.scrollWidth, cw: c.clientWidth,
    searchW: r(".search-wrap").width, searchTop: r(".search-wrap").top, selTop: r(".stats").top, resetTop: r(".reset-btn").top };
});
check("Desktop: Werkzeugleiste einzeilig, Tabelle ohne Querscroll", d.toolbarH < 90 && d.sw <= d.cw, JSON.stringify(d));
check("Desktop: Suchfeld max. 820px, Filter und Reset in derselben Zeile",
  d.searchW <= 820 && Math.abs(d.selTop - d.searchTop) < 20 && Math.abs(d.resetTop - d.searchTop) < 20, JSON.stringify(d));
await dp.screenshot({ path: `${OUT}/e2e-desktop.png` });

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
