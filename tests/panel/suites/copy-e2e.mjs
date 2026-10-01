import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
async function setup(opts, mac = "aa:bb:cc:dd:ee:01") {
  const ctx = await b.newContext(opts);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:8950" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html?entry=entry1&mac=${mac}`);
  await p.evaluate(() => { window.__toasts = []; document.querySelector("home-assistant").addEventListener("hass-notification", (e) => window.__toasts.push(e.detail.message)); });
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelector("dialog.device")?.open`));
  return { ctx, p, f };
}
const copyBtns = (f) => f.evaluate(new Function(`return [...${R}.querySelectorAll('dialog.device [data-dlg="copy"]')].map(b=>({v:b.dataset.copy,t:b.title}))`));
const readClip = (p) => p.evaluate(() => navigator.clipboard.readText());
{
  const { ctx, p, f } = await setup({ viewport: { width: 1280, height: 900 } });
  const btns = await copyBtns(f);
  console.log(JSON.stringify(btns));
  const vals = btns.map((x) => x.v);
  check("Buttons für IP, MAC, Hostname, SSID, AP", ["192.0.2.101", "aa:bb:cc:dd:ee:01", "host-1", "HomeNet", "Kinderzimmer"].every((v) => vals.includes(v)));
  check("Button je Entity-ID", vals.filter((v) => /^(sensor|binary_sensor)\./.test(v)).length === 2);
  check("Kein Button für Status/Signal/Zeiten", btns.length === 7);
  const off = await (await p.$("#panel-frame")).boundingBox();
  const pos = await f.evaluate(new Function(`const b=${R}.querySelector('dialog.device [data-copy="aa:bb:cc:dd:ee:01"]').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`));
  await p.mouse.click(off.x + pos.x, off.y + pos.y);
  await p.waitForTimeout(150);
  check("MAC kopiert (echter Klick)", (await readClip(p)) === "aa:bb:cc:dd:ee:01");
  check("Häkchen am Button", await f.evaluate(new Function(`return ${R}.querySelector('[data-copy="aa:bb:cc:dd:ee:01"]').classList.contains("done")`)));
  check("HA-Toast", (await p.evaluate(() => window.__toasts)).includes("Kopiert: aa:bb:cc:dd:ee:01"));
  await p.waitForTimeout(1700);
  check("Häkchen verschwindet", !(await f.evaluate(new Function(`return ${R}.querySelector('[data-copy="aa:bb:cc:dd:ee:01"]').classList.contains("done")`))));
  const ent = btns.find((x) => x.v.startsWith("sensor.")).v;
  await f.evaluate(new Function("v", `${R}.querySelector('[data-copy="'+v+'"]').click()`), ent);
  await p.waitForTimeout(150);
  check("Entity-ID kopiert, kein more-info", (await readClip(p)) === ent && (await p.evaluate(() => window.__moreInfo.length)) === 0);
  await f.evaluate(new Function(`${R}.querySelector('li.entity .ent-state').click()`));
  check("Klick auf Zeile öffnet weiterhin more-info", (await p.evaluate(() => window.__moreInfo.length)) === 1);
  await f.evaluate(new Function(`const li=${R}.querySelectorAll('li.entity')[1]; li.focus(); li.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true}))`));
  check("Enter auf Entitätszeile", (await p.evaluate(() => window.__moreInfo.length)) === 2);
  check("Dialog noch offen", await f.evaluate(new Function(`return ${R}.querySelector("dialog.device").open`)));
  // Fokus bleibt auf dem richtigen Copy-Button beim Polling
  await f.evaluate(new Function(`${R}.querySelector('[data-copy="host-1"]').focus()`));
  await f.evaluate(() => document.querySelector("unifi-dynamic-panel")._fetchClients());
  check("Fokus bleibt auf Hostname-Button", await f.evaluate(new Function(`return ${R}.activeElement?.dataset.copy`)) === "host-1");
  await p.screenshot({ path: `${outDir}/copy-desktop.png` });
  // Fallback ohne Clipboard-API (wie bei http://)
  await p.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); });
  await f.evaluate(() => { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); });
  await p.evaluate(() => { window.__execCopy = []; });
  await f.evaluate(() => { const orig = document.execCommand.bind(document); document.execCommand = (c) => { const sel = document.querySelector("unifi-dynamic-panel").shadowRoot.querySelector("textarea"); window.parent.__execCopy.push(sel && sel.value); return orig(c); }; });
  await f.evaluate(new Function(`${R}.querySelector('[data-copy="192.0.2.101"]').click()`));
  await p.waitForTimeout(150);
  const ex = await p.evaluate(() => window.__execCopy);
  const toasts = await p.evaluate(() => window.__toasts);
  check("Fallback execCommand mit richtigem Text", ex[0] === "192.0.2.101", JSON.stringify(ex) + " " + toasts.at(-1));
  check("Textfeld wieder entfernt", await f.evaluate(new Function(`return !${R}.querySelector("textarea")`)));
  await ctx.close();
}
{
  const { ctx, p, f } = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const geo = await f.evaluate(new Function(`const d=${R}.querySelector("dialog.device");return {sw:d.scrollWidth,cw:d.clientWidth,btn:[...d.querySelectorAll(".copy-btn")].map(b=>{const r=b.getBoundingClientRect();return [r.width,r.height,r.right]})}`));
  check("Handy: kein horizontaler Überlauf", geo.sw <= geo.cw, JSON.stringify({ sw: geo.sw, cw: geo.cw }));
  check("Handy: Buttons 28px und im Bild", geo.btn.every(([w, h, r]) => w === 28 && h === 28 && r <= 390), JSON.stringify(geo.btn));
  const off = await (await p.$("#panel-frame")).boundingBox();
  const pos = await f.evaluate(new Function(`const b=${R}.querySelector('dialog.device [data-copy="host-1"]').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}`));
  await p.touchscreen.tap(off.x + pos.x, off.y + pos.y);
  await p.waitForTimeout(150);
  check("Handy: Tipp kopiert", (await readClip(p)) === "host-1");
  await p.screenshot({ path: `${outDir}/copy-mobile.png` });
  await ctx.close();
}
await b.close(); process.exit(ok ? 0 : 1);
