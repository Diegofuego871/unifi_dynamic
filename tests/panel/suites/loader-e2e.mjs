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
  await p.goto(`http://127.0.0.1:8950/ha-sim-dialog.html${hubs ? "?hubs=2" : ""}`);
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
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-id="loader"]')`));
  check(`[${tag}] Abschnitt Loader, Standard Elefant`, (await ev(`return r.querySelector('[data-id="loader"] .set-sec-sum').textContent`)) === "Elefant · Balance auf dem Ball");
  await click('[data-set="section"][data-id="loader"]');
  check(`[${tag}] 6 Auswahlen, Elefant aktiv`, await ev(`const c=[...r.querySelectorAll(".ld-choice")]; return c.length===6 && c[0].classList.contains("on") && c.filter(x=>x.classList.contains("on")).length===1`));
  const over = await ev(`const d=r.querySelector("dialog.settings"); return d.scrollWidth - d.clientWidth`);
  check(`[${tag}] kein horizontaler Überlauf`, over <= 1, String(over));
  await ev(`r.querySelector(".ld-choices").scrollIntoView({block:"center"})`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/loader-${tag}-settings.png` });
  check(`[${tag}] kein "sofort wirksam" mehr`, !(await ev(`return !!r.querySelector('[data-id="loader"] .ld-now')`)));
  await click('[data-set="loader-pick"][data-kind="cat"]');
  check(`[${tag}] Katze gewählt: Entwurf, Etikett "geändert", Speichern frei`, await ev(`return r.querySelector('[data-kind="cat"]').classList.contains("on") && r.querySelector('[data-id="loader"] .set-sec-sum').textContent.startsWith("Katze") && !!r.querySelector('[data-id="loader"] .set-badge') && !r.querySelector('[data-set="save"]').disabled`));
  check(`[${tag}] vor dem Speichern noch nicht übernommen`, (await ev(`return ${panel}._loader`)) === "elephant");
  // Abbrechen verwirft
  await click('[data-set="close"]'); await p.waitForTimeout(300);
  check(`[${tag}] Abbrechen: weiterhin Elefant`, (await ev(`return ${panel}._loader`)) === "elephant");
  await click(".gear-btn");
  await f.waitForFunction(new Function(`return ${R}.querySelector('dialog.settings[open] [data-id="loader"]')`));
  await click('[data-set="section"][data-id="loader"]');
  await click('[data-set="loader-pick"][data-kind="cat"]');
  await click('[data-set="save"]');
  await p.waitForTimeout(600);
  check(`[${tag}] Speichern: Katze übernommen, keine Hub-Option gesendet, Fenster zu`, (await ev(`return ${panel}._loader`)) === "cat" && !(await ev(`return r.querySelector("dialog.settings").open`)) && !(await p.evaluate(() => (window.__wsCalls||[]).some(m=>m.type==="unifi_dynamic/set_options" && m.values && "loader" in m.values))));
  await p.waitForTimeout(1500);
  const stored = await p.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith("ud_")).map((k) => sessionStorage.getItem(k)).join(""));
  check(`[${tag}] pro Benutzer gespeichert`, stored.includes('"loader":"cat"'), stored.slice(0, 80));
  // Jede Variante im Geräte-Dialog anzeigen
  for (const kind of ["elephant", "cat", "hamster", "penguin", "runner"]) {
    await ev(`const p=${panel}; p._loader="${kind}"; p._closeSettings && p._closeSettings()`);
    await p.evaluate(() => { window.__historyDelay = 60000; });
    await ev(`const p=${panel}; p._history=null; p._recorderCache={}; p._openDialog([...p._clients].find(c=>c.mac==="aa:bb:cc:dd:ee:01").entry_id+"|aa:bb:cc:dd:ee:01"); r.querySelector('dialog.device [data-dlg="stat"][data-kind="avail"]').click()`);
    await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .avail-loading")`), null, { timeout: 5000 });
    check(`[${tag}] Loader ${kind} im Dialog`, await ev(`return r.querySelector("dialog.stat-dlg .avail-loading").classList.contains("ld-${kind}")`));
    await p.waitForTimeout(kind === "penguin" ? 4400 : kind === "runner" ? 5400 : 2600);
    await ev(`r.querySelector("dialog.stat-dlg .avail-loading").scrollIntoView({block:"center"})`);
    await p.screenshot({ path: `${OUT}/loader-${tag}-${kind}.png` });
    await ev(`${panel}._closeDialog ? ${panel}._closeDialog() : r.querySelector("dialog.device").close()`);
  }
  // Neuaufbau mitten in der Animation (Polling, Relativzeit): Szene läuft weiter
  for (const kind of ["penguin", "runner"]) {
    await ev(`${panel}._loader="${kind}"`);
    await p.evaluate(() => { window.__historyDelay = 60000; });
    await ev(`const p=${panel}; p._history=null; p._recorderCache={}; p._openDialog([...p._clients].find(c=>c.mac==="aa:bb:cc:dd:ee:01").entry_id+"|aa:bb:cc:dd:ee:01"); r.querySelector('dialog.device [data-dlg="stat"][data-kind="avail"]').click()`);
    await f.waitForFunction(new Function(`return ${R}.querySelector("dialog.stat-dlg .avail-loading")`), null, { timeout: 5000 });
    await p.waitForTimeout(3200);
    const before = await ev(`const l=r.querySelector("dialog.stat-dlg .avail-loading"); return Math.round(Math.max(...l.getAnimations({subtree:true}).map(a=>a.currentTime)))`);
    // Erzwungener Neuaufbau wie bei einer Änderung im Dialog
    const res = await ev(`const p=${panel}; const old=r.querySelector("dialog.stat-dlg .avail-loading"); p._statHtml=""; p._renderStat(); const l=r.querySelector("dialog.stat-dlg .avail-loading"); const t=l.getAnimations({subtree:true}).map(a=>a.currentTime); return {fresh: l!==old, min: Math.round(Math.min(...t)), sec: l.querySelector(".avail-sec").textContent}`);
    check(`[${tag}] ${kind}: nach Neuaufbau an derselben Stelle (${before} ms → min ${res.min} ms), Zähler ${res.sec} s`, res.fresh && res.min >= 3000 && Math.abs(res.min - before) < 400 && Number(res.sec) >= 3, JSON.stringify(res));
    await ev(`${panel}._closeDialog()`);
  }
  // Zufall: pro Ladevorgang stabil, nächster Ladevorgang anders
  await ev(`${panel}._loader="random"`);
  const k1 = await ev(`return [${panel}._loaderKind("a"), ${panel}._loaderKind("a"), ${panel}._loaderKind("b")]`);
  check(`[${tag}] Zufall stabil pro Laden, wechselt danach`, k1[0] === k1[1] && k1[2] !== k1[0], JSON.stringify(k1));
  // Nach Neuladen bleibt die Wahl (HA-Benutzerdaten)
  await ev(`${panel}._loader="hamster"; ${panel}._savePrefs()`);
  await p.waitForTimeout(1500);
  await p.reload();
  const f2 = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f2.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  await p.waitForTimeout(800);
  check(`[${tag}] nach Neuladen: Hamster`, (await f2.evaluate(new Function(`return ${panel}._loader`))) === "hamster");
  check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
  await t.ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
