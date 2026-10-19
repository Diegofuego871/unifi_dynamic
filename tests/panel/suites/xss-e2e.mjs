// Werte aus dem Netzwerk (Hostname, SSID, Gerätename ...) dürfen nie als HTML
// gelten: kein Ausbrechen aus Attributen, keine eingeschleusten Elemente oder
// Ereignis-Attribute, und angezeigte Werte bleiben unverändert.
import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;
const ev = (f, code) => f.evaluate(new Function(`const r=${R};` + code));

// Durchsucht den ganzen Shadow-DOM nach Eingeschleustem.
const SCAN = `
  const bad = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll("*")) {
      const tag = el.localName;
      if (["script", "iframe", "object", "embed", "style"].includes(tag) && !el.hasAttribute("data-own")) {
        if (tag !== "style") bad.push("Element " + tag);
      }
      if (tag === "img" && el.getAttribute("src") === "x") bad.push("img src=x");
      for (const a of el.attributes) {
        // Eigenes Logo-Bild im Panel: fester onerror, kein Wert von aussen.
        if (/^on/i.test(a.name) && !(tag === "img" && a.name === "onerror" && a.value === "this.style.display='none'")) bad.push(tag + "[" + a.name + "]");
        // "x" ist bei SVG-Elementen eine Koordinate, nur bei HTML ein Fremdling.
        if (a.name === "autofocus" || (a.name === "x" && el.namespaceURI !== "http://www.w3.org/2000/svg")) bad.push(tag + "[" + a.name + "]");
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(r);
  return bad;`;

async function run(name, opts) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html?hostile=1&hubs=2&ping=1");
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  const HX = (l) => p.evaluate((l) => window.__hostile(l), l);
  const scan = async (label) => {
    const bad = await ev(f, SCAN);
    const pwned = (await p.evaluate(() => window.__pwned)) || (await f.evaluate(() => window.__pwned));
    check(`[${name}] ${label}: nichts eingeschleust`, bad.length === 0 && !pwned, JSON.stringify(bad) + (pwned ? " PWNED" : ""));
  };
  await scan("Tabelle");
  // Werte erscheinen unverändert als Text und in data-Attributen
  const n1 = await HX("n1");
  const names = await ev(f, `return [...r.querySelectorAll("tbody tr[data-key]")].map(t=>t.dataset.name)`);
  check(`[${name}] data-name enthält den Namen unverändert`, names.includes(n1), JSON.stringify(names.filter((x) => x.startsWith("n1"))));
  const cellText = await ev(f, `return [...r.querySelectorAll("tbody tr[data-key] .name-text .t")].map(e=>e.textContent)`);
  check(`[${name}] Name erscheint als Text`, cellText.some((x) => x.includes(n1)));
  // Zeilenmenü
  await ev(f, `r.querySelector('tr[data-name^="n1"] .menu-btn').click()`);
  await scan("Zeilenmenü");
  await ev(f, `r.querySelector('.menu [data-action="details"]').click()`);
  await p.waitForTimeout(300);
  await scan("Geräteansicht (Hostname, IP, MAC, SSID, AP)");
  const copies = await ev(f, `return [...r.querySelectorAll("dialog.device [data-copy]")].map(b=>b.dataset.copy)`);
  check(`[${name}] Kopierknöpfe tragen Hostname und IP unverändered`, copies.includes(await HX("h1")) && copies.includes(await HX("ip1")), JSON.stringify(copies));
  // Verknüpfungs-Auswahl
  await ev(f, `r.querySelector('[data-dlg="link-open"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelectorAll(".pick").length > 0`));
  await scan("Geräteauswahl");
  await ev(f, `r.querySelector('[data-dlg="link-cancel"]')?.click()`);
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  // Verknüpftes HA-Gerät (Name hostil) in Tabelle und Geräteansicht
  await scan("verknüpftes Gerät in Tabelle");
  const lt = await ev(f, `const b=r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:02"] .linked-link'); return b && {t:b.getAttribute("title"), id:b.dataset.linkedId, txt:b.textContent}`);
  check(`[${name}] Titel des Geräte-Knopfs trägt den Namen unverändert`, lt && lt.t.includes(await HX("dev")), JSON.stringify(lt));
  await ev(f, `r.querySelector('tr[data-mac="aa:bb:cc:dd:ee:02"] td:nth-child(3)').click()`);
  await p.waitForTimeout(300);
  await scan("Geräteansicht mit verknüpftem Gerät");
  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  // Client mit hostiler MAC: Zeile, Menü und Dialog
  const macRow = await ev(f, `return [...r.querySelectorAll("tbody tr[data-key]")].some(t=>t.dataset.mac.includes('"'))`);
  check(`[${name}] Zeile mit Anführungszeichen in der MAC vorhanden`, macRow);
  await ev(f, `[...r.querySelectorAll("tbody tr[data-key]")].find(t=>t.dataset.mac.includes('"')).querySelector(".menu-btn").click()`);
  await p.waitForTimeout(200);
  await scan("Menü der Zeile mit hostiler MAC");
  check(`[${name}] Menü öffnet sich auch bei hostiler MAC`, await ev(f, `return !!r.querySelector(".menu")`));
  await p.keyboard.press("Escape");
  // Suche und Spaltenfilter mit hostilem Text (Chips, Platzhalter, Wert)
  const q = await HX("q");
  await ev(f, `const s=r.querySelector(".search"); s.value=${JSON.stringify(q)}; s.dispatchEvent(new Event("input"))`);
  await ev(f, `const i=r.querySelector('.col-filter[data-col="name"]'); i.value=${JSON.stringify(q)}; i.dispatchEvent(new Event("input"))`);
  await p.waitForTimeout(300);
  await scan("Suche und Filter mit Sonderzeichen");
  await ev(f, `const s=r.querySelector(".search"); s.value=""; s.dispatchEvent(new Event("input")); const i=r.querySelector('.col-filter[data-col="name"]'); i.value=""; i.dispatchEvent(new Event("input"))`);
  // Hub-Auswahl (Titel hostil), danach Einstellungen: geschützte Clients,
  // Benachrichtigungsziel, Verbindung
  await scan("Hub-Auswahl");
  await ev(f, `const s=r.querySelector(".hub-select"); s.value="entry1"; s.dispatchEvent(new Event("change"))`);
  await p.waitForTimeout(400);
  await ev(f, `r.querySelector(".gear-btn").click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings[open] .ver-slot")`), null, { timeout: 5000 });
  await p.waitForTimeout(300);
  for (const id of ["polling", "cleanup", "push", "persistent", "updates", "ping", "loader", "connection"]) {
    await ev(f, `r.querySelector('dialog.settings [data-set="section"][data-id="${id}"]')?.click()`);
  }
  await p.waitForTimeout(300);
  await scan("Einstellungen mit allen Abschnitten");
  const stxt = await ev(f, `return r.querySelector("dialog.settings").innerText`);
  const dbg = {};
  for (const l of ["n5", "notify", "host", "hub"]) dbg[l] = stxt.includes(await HX(l));
  check(`[${name}] Einstellungen zeigen den geschützten Client und das Ziel als Text`, dbg.n5 && dbg.notify, JSON.stringify(dbg));
  await p.screenshot({ path: `${OUT}/xss-${name}-settings.png` });
  await ev(f, `r.querySelector('dialog.settings [data-set="close"]')?.click()`);
  await p.waitForTimeout(200);
  check(`[${name}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await run("desktop", { viewport: { width: 1400, height: 900 } });
await run("handy", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await b.close();
process.exit(ok ? 0 : 1);
