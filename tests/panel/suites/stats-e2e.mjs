import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";

const OUT = outDir;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`);
};

const browser = await chromium.launch(launchOptions);

async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8950/ha-sim.html");
  const frame = await (await page.waitForSelector("#panel-frame")).contentFrame();
  await frame.waitForFunction(() => {
    const el = document.querySelector("unifi-dynamic-panel");
    return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length > 0;
  });
  await page.waitForTimeout(250);
  return { ctx, page, frame, errors };
}

const state = (frame) => frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const txt = (s) => root.querySelector(s).textContent.trim();
  const active = [...root.querySelectorAll(".stat")].filter((b) => b.classList.contains("active")).map((b) => b.dataset.filter);
  const pressed = [...root.querySelectorAll(".stat")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.filter);
  return {
    all: txt('[data-count="all"]'), online: txt('[data-count="online"]'), offline: txt('[data-count="offline"]'),
    label: txt('[data-label="all"]'),
    rows: root.querySelectorAll("tbody tr[data-key]").length,
    active, pressed,
    prefs: JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs") || "{}").onlineFilter,
  };
});
const tapStat = async (frame, f) => {
  const h = await frame.evaluateHandle((f) =>
    document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector(`.stat[data-filter="${f}"]`), f);
  await h.asElement().tap();
  await frame.page().waitForTimeout(150);
};

// ---- Mobile ----------------------------------------------------------------
const m = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
let s = await state(m.frame);
console.log("Start:", JSON.stringify(s));
check("Zähler: 40 Geräte / 34 online / 6 offline", s.all === "40" && s.online === "34" && s.offline === "6", `${s.all}/${s.online}/${s.offline}`);
check("Mehrzahl-Beschriftung 'Geräte'", s.label === "Geräte", s.label);
check("Anfangs 'alle' aktiv (auch aria-pressed)", s.active.join() === "all" && s.pressed.join() === "all", JSON.stringify(s.active));

await tapStat(m.frame, "offline");
s = await state(m.frame);
check("Tipp 'offline' filtert auf 6 Zeilen, aktiv + gespeichert", s.rows === 6 && s.active.join() === "offline" && s.prefs === "offline", JSON.stringify(s));
check("Zähler bleiben beim Filtern gleich", s.all === "40" && s.online === "34" && s.offline === "6");

await tapStat(m.frame, "offline");
s = await state(m.frame);
check("Erneuter Tipp 'offline' schaltet zurück auf alle", s.rows === 40 && s.active.join() === "all", JSON.stringify(s));

await tapStat(m.frame, "online");
s = await state(m.frame);
check("Tipp 'online' filtert auf 34 Zeilen", s.rows === 34 && s.active.join() === "online");

// Suche verändert die Zähler nicht
await m.frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const inp = root.querySelector(".search");
  inp.value = "Küche"; inp.dispatchEvent(new Event("input"));
});
await m.page.waitForTimeout(150);
s = await state(m.frame);
check("Suche filtert Zeilen, Zähler bleiben global", s.rows < 34 && s.all === "40" && s.online === "34", `rows=${s.rows}`);

// Reset
const reset = await m.frame.evaluateHandle(() => document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector(".reset-btn"));
await reset.asElement().evaluate((b) => b.click()); // auf dem Handy ausgeblendet (Filter-Blatt), Funktion gleich
await m.page.waitForTimeout(150);
s = await state(m.frame);
check("Zurücksetzen: alle aktiv, 40 Zeilen", s.rows === 40 && s.active.join() === "all" && s.prefs === "all");

// Persistenz über Neuladen
await tapStat(m.frame, "offline");
await m.page.reload();
const f2 = await (await m.page.waitForSelector("#panel-frame")).contentFrame();
await f2.waitForFunction(() => {
  const el = document.querySelector("unifi-dynamic-panel");
  return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length > 0;
});
await m.page.waitForTimeout(250);
s = await state(f2);
check("Filter 'offline' überlebt Neuladen", s.rows === 6 && s.active.join() === "offline", JSON.stringify(s));
await tapStat(f2, "offline"); // zurück auf alle

const lay = await f2.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const r = (sel) => root.querySelector(sel).getBoundingClientRect();
  const statRects = [...root.querySelectorAll(".stat")].map((b) => b.getBoundingClientRect());
  const act = root.querySelector(".stat.active");
  return {
    toolbarH: r(".toolbar").height, stats: r(".stats").toJSON(), search: r(".search-wrap").toJSON(),
    conn: r(".filter-btn").toJSON(), reset: r(".filter-btn").toJSON(),
    statWidths: statRects.map((x) => Math.round(x.width)),
    activeShadow: getComputedStyle(act).color,
    dotColor: getComputedStyle(root.querySelector(".dot.online")).backgroundColor,
    vw: innerWidth,
  };
});
console.log("Mobile-Layout:", JSON.stringify(lay));
check("Handy: Werkzeugleiste nicht höher als vorher (<= 175px)", lay.toolbarH <= 175, `h=${lay.toolbarH}`);
check("Handy: Statusleiste eigene Zeile über volle Breite", lay.stats.top > lay.search.bottom - 1 && Math.abs(lay.stats.width - (lay.vw - 24)) < 2, JSON.stringify(lay.stats));
check("Handy: drei Teile gleich breit", Math.max(...lay.statWidths) - Math.min(...lay.statWidths) <= 1, JSON.stringify(lay.statWidths));
check("Handy: Filter-Button neben dem Suchfeld", Math.abs(lay.conn.top - lay.search.top) < 6 && lay.conn.right <= lay.vw, JSON.stringify(lay.conn));
check("Aktiver Teil mit Akzentfarbe aus dem Design (#03a9f4)", lay.activeShadow.includes("rgb(3, 169, 244)"), lay.activeShadow);
check("Online-Punkt grün aus dem Design (#43a047)", lay.dotColor === "rgb(67, 160, 71)", lay.dotColor);
await m.page.screenshot({ path: `${OUT}/stats-mobile.png` });
check("Mobile: keine JS-Fehler", m.errors.length === 0, m.errors.join(" | "));
await m.ctx.close();

// ---- Desktop ---------------------------------------------------------------
const d = await open({ viewport: { width: 1400, height: 900 } });
const dl = await d.frame.evaluate(() => {
  const root = document.querySelector("unifi-dynamic-panel").shadowRoot;
  const r = (sel) => root.querySelector(sel).getBoundingClientRect();
  return { toolbarH: r(".toolbar").height, tops: [".search-wrap", ".stats", ".reset-btn"].map((q) => Math.round(r(q).top + r(q).height / 2)), searchW: r(".search-wrap").width };
});
console.log("Desktop-Layout:", JSON.stringify(dl));
check("Desktop: alles in einer Zeile", Math.max(...dl.tops) - Math.min(...dl.tops) <= 2 && dl.toolbarH < 90, JSON.stringify(dl));
await d.page.screenshot({ path: `${OUT}/stats-desktop.png` });
await d.ctx.close();

// ---- Englisch + Einzahl ------------------------------------------------------
const e = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const ep = await e.newPage();
await ep.addInitScript(() => {
  // nur im Elternfenster: Sprache EN und genau 1 Gerät
  if (window === window.top) {
    window.__override = true;
  }
});
await ep.goto("http://127.0.0.1:8950/ha-sim.html");
await ep.evaluate(() => {
  const ha = document.querySelector("home-assistant");
  const one = [{ mac: "02:00:00:00:00:01", name: "Solo", ip: "10.0.0.2", essid: null, ap_name: null, is_wired: true, seen_at: Date.now() / 1000, online: false, excluded: false, device_id: null, entry_id: "e", host: "h" }];
  ha.hass = { language: "en", callWS: async (m) => (m.type === "unifi_dynamic/list_clients" ? { clients: one } : {}) };
  document.getElementById("panel-frame").src = "/unifi_dynamic/panel/panel.html?v=13&t=en";
});
const ef = await (await ep.waitForSelector("#panel-frame")).contentFrame();
await ef.waitForFunction(() => {
  const el = document.querySelector("unifi-dynamic-panel");
  return el && el.shadowRoot && el.shadowRoot.querySelectorAll("tbody tr[data-key]").length === 1;
});
const es = await state(ef);
check("Englisch + Einzahl: '1 device', 0 online, 1 offline", es.label === "device" && es.all === "1" && es.online === "0" && es.offline === "1", JSON.stringify(es));
await e.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
