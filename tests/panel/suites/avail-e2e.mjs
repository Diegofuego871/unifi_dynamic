import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
const OUT = outDir;
const H = 3600, D = 86400;

async function run(mobile) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 1000 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  const ev = (code) => f.evaluate(new Function(`const r=${R};` + code));
  const panel = `document.querySelector("unifi-dynamic-panel")`;
  // Client 01: drei Unterbrüche in 24 h, einer vor 3 Tagen; Client 02: erst seit 9 h bekannt, durchgehend online
  const e1 = await ev(`const p=${panel}; const c=p._clients.find(c=>c.mac==="aa:bb:cc:dd:ee:01"); return p._onlineEntityId(c.device_id)`);
  const e2 = await ev(`const p=${panel}; const c=p._clients.find(c=>c.mac==="aa:bb:cc:dd:ee:02"); return p._onlineEntityId(c.device_id)`);
  check(`[${tag}] Online-Entität gefunden`, e1 && e1.startsWith("binary_sensor.") && e2, `${e1} ${e2}`);
  await p.evaluate(({ e1, e2, H, D }) => {
    window.__history = {
      [e1]: [[40 * D, "on"], [3 * D, "off"], [3 * D - 2 * H, "on"], [20 * H, "off"], [20 * H - 25 * 60, "on"],
        [9 * H, "off"], [9 * H - 180, "on"], [3 * H, "unavailable"], [3 * H - 60, "on"], [80 * 60, "off"], [80 * 60 - 24 * 60, "on"]],
      [e2]: [[9 * H, "on"]],
    };
  }, { e1, e2, H, D });
  const open = async (mac) => {
    await ev(`${panel}._openDialog([...${panel}._clients].find(c=>c.mac==="${mac}").entry_id+"|${mac}")`);
    // Ab 2.15.0: Verfügbarkeit im Unter-Fenster hinter der Kachel
    await ev(`r.querySelector('dialog.device [data-dlg="stat"][data-kind="avail"]').click()`);
    await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-bar") || ${R}.querySelector(".avail .dlg-note:not(:empty)")?.textContent.includes("Keine")`), null, { timeout: 5000 }).catch(() => {});
  };
  await open("aa:bb:cc:dd:ee:01");
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-bar")`), null, { timeout: 5000 });
  const txt = () => ev(`return r.querySelector(".avail").innerText`);
  let t = await txt();
  check(`[${tag}] Statistik-Kacheln über Netzwerk, Unter-Fenster offen`, await ev(`const hs=[...r.querySelectorAll("dialog.device h3")].map(h=>h.textContent); return hs[0].startsWith("Statistik") && hs[1].startsWith("Netzwerk") && r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.stat-dlg h2").textContent==="Verfügbarkeit"`));
  check(`[${tag}] 3 Unterbrüche, unavailable zählt nicht`, t.includes("3 Unterbrüche"), t);
  check(`[${tag}] Summe 52 Min., längster 25 Min.`, t.includes("zusammen 52 Min.") && t.includes("längster 25 Min."), t);
  const pct = await ev(`return r.querySelector(".avail-pct").textContent`);
  const expPct = ((1 - 52 / 1440) * 100).toFixed(1).replace(".", ".");
  check(`[${tag}] Prozent: 1-Min.-Neustartlücke überbrückt`, pct === `${expPct}%`, pct);
  check(`[${tag}] 3 orange Segmente, Neustartlücke nicht schraffiert`, await ev(`return r.querySelectorAll(".avail-bar .seg.off").length===3 && r.querySelectorAll(".avail-bar .seg.none").length===0 && !r.querySelector(".avail-legend i.none")`));
  const minW = await ev(`return Math.min(...[...r.querySelectorAll(".avail-bar .seg.off")].map(s=>s.getBoundingClientRect().width))`);
  check(`[${tag}] kurzer Unterbruch min. 3px sichtbar`, minW >= 3, String(minW));
  const list = await ev(`return [...r.querySelectorAll(".avail-list > div")].map(d=>d.innerText.replace(/\\s+/g," "))`);
  check(`[${tag}] Liste immer sichtbar, neueste zuerst`, list.length === 3 && list[0].endsWith("24 Min.") && list[2].endsWith("25 Min."), JSON.stringify(list));
  check(`[${tag}] Ticks + jetzt`, await ev(`const s=[...r.querySelectorAll(".avail-ticks span")].filter(x=>getComputedStyle(x).display!=="none"); return s.length >= ${mobile ? 3 : 6} && s.at(-1).textContent==="jetzt"`));
  const overlap = await ev(`const s=[...r.querySelectorAll(".avail-ticks span")].filter(x=>getComputedStyle(x).display!=="none").map(x=>x.getBoundingClientRect()).sort((a,b)=>a.left-b.left); return s.some((a,i)=>i&&a.left<s[i-1].right+2)`);
  check(`[${tag}] Ticks überlappen nicht`, !overlap);
  check(`[${tag}] kein horizontales Überlaufen`, await ev(`const d=r.querySelector("dialog.stat-dlg"); return d.scrollWidth<=d.clientWidth+1`));
  // Tooltip über dem 25-Min.-Unterbruch
  await p.waitForTimeout(500);
  const seg = await ev(`const s=[...r.querySelectorAll(".avail-bar .seg.off")].sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0].getBoundingClientRect(); return {x:s.left+s.width/2,y:s.top+s.height/2}`);
  const off = await (await p.$("#panel-frame")).boundingBox();
  if (mobile) await p.touchscreen.tap(off.x + seg.x, off.y + seg.y);
  else await p.mouse.move(off.x + seg.x, off.y + seg.y);
  await p.waitForTimeout(150);
  const tip = await ev(`const t=r.querySelector(".avail-tip"); const tr=t.getBoundingClientRect(), dr=r.querySelector("dialog.stat-dlg").getBoundingClientRect(); return {hidden:t.hidden, text:t.innerText, inside: tr.left>=dr.left && tr.right<=dr.right}`);
  check(`[${tag}] Tooltip zeigt Zeit und Dauer`, !tip.hidden && /^Offline \d\d:\d\d–\d\d:\d\d · 25 Min\.$/.test(tip.text), JSON.stringify(tip));
  check(`[${tag}] Tooltip innerhalb Dialog`, tip.inside);
  await p.screenshot({ path: `${OUT}/avail-${tag}-24h.png` });
  if (mobile) await p.touchscreen.tap(off.x + seg.x, off.y + seg.y);
  else await p.mouse.move(off.x + 5, off.y + 5);
  await p.waitForTimeout(100);
  check(`[${tag}] Tooltip verschwindet`, await ev(`return r.querySelector(".avail-tip").hidden`));
  check(`[${tag}] Dialog noch offen`, await ev(`return r.querySelector("dialog.stat-dlg").open && r.querySelector("dialog.device").open`));
  // Umschalten auf 7 Tage
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="7d"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-top")?.innerText.includes("4 Unterbrüche")`), null, { timeout: 5000 }).catch(() => {});
  t = await txt();
  check(`[${tag}] 7 Tage: 4 Unterbrüche, längster 2 Std.`, t.includes("4 Unterbrüche") && t.includes("längster 2 Std."), t);
  check(`[${tag}] 7 Tage: Liste mit Datum`, /\d+\.\d+\./.test(await ev(`return r.querySelector(".avail-list").innerText`)));
  check(`[${tag}] 7 Tage aktiv + gespeichert`, await ev(`return r.querySelector('[data-range="7d"]').getAttribute("aria-pressed")==="true"`) && await f.evaluate(() => JSON.parse(localStorage.getItem("unifi_dynamic_panel_prefs")).availRange === "7d"));
  await p.waitForTimeout(600);
  check(`[${tag}] Zeitraum bei HA gespeichert`, await p.evaluate(() => JSON.parse(sessionStorage.getItem("ud_unifi_dynamic_panel") || "{}").availRange === "7d"));
  await p.screenshot({ path: `${OUT}/avail-${tag}-7d.png` });
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="30d"]').click()`);
  await p.waitForTimeout(200);
  check(`[${tag}] 30 Tage: Ticks sichtbar`, await ev(`return r.querySelectorAll(".avail-ticks span").length >= 3`));
  // Kein ständiger Neuaufbau durch hass-Updates
  const before = await ev(`return ${panel}._dialogHtml`);
  await ev(`${panel}.hass = {...${panel}.hass}`);
  check(`[${tag}] hass-Update baut nicht neu`, before === await ev(`return ${panel}._dialogHtml`));
  const calls = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "history/history_during_period").length);
  check(`[${tag}] je Zeitraum eine Abfrage`, calls === 3, String(calls));
  // Client 02: neu, durchgehend online
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="24h"]').click()`);
  await open("aa:bb:cc:dd:ee:02");
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-top")`), null, { timeout: 5000 });
  t = await txt();
  check(`[${tag}] neu: 100 % durchgehend, Keine Daten in Legende, keine Liste`, t.includes("100.0") && t.includes("Durchgehend erreichbar") && t.includes("erst seit") && t.includes("Keine Daten") && !(await ev(`return !!r.querySelector(".avail-list")`)), t);
  // 30 Tage, Daten erst seit 9 h (< 10 %): Balken beginnt beim ersten Datenpunkt
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="30d"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-ticks .start-label")`), null, { timeout: 5000 }).catch(() => {});
  const zoom = await ev(`return {none: r.querySelectorAll(".avail-bar .seg.none").length, on: [...r.querySelectorAll(".avail-bar .seg.on")].map(s=>s.style.left+"/"+s.style.width), start: r.querySelector(".avail-ticks .start-label")?.textContent, ticks: [...r.querySelectorAll(".avail-ticks span:not(.start-label):not(.now-label)")].map(x=>x.textContent), legendNone: !!r.querySelector(".avail-legend i.none"), text: r.querySelector(".avail-top").innerText}`);
  check(`[${tag}] verkürzter Balken: ganz grün, Startzeit links, Stundenmarken`, zoom.none === 0 && zoom.on.length === 1 && /^0(\.0+)?%\/100(\.0+)?%$/.test(zoom.on[0]) && /^\d\d:\d\d$/.test(zoom.start || "") && zoom.ticks.length >= 1 && zoom.ticks.every((x) => /^\d\d:00$/.test(x)) && !zoom.legendNone && zoom.text.includes("erst seit"), JSON.stringify(zoom));
  await p.screenshot({ path: `${OUT}/avail-${tag}-zoom.png` });
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="24h"]').click()`);
  await p.waitForTimeout(150);
  check(`[${tag}] 24 Std. (37 %): normaler Balken mit Lücke`, await ev(`return r.querySelectorAll(".avail-bar .seg.none").length===1 && !r.querySelector(".avail-ticks .start-label")`));
  // Client ohne Gerät
  await open("aa:bb:cc:dd:ee:04");
  await p.waitForTimeout(100);
  const noDev = await ev(`return ${panel}._clients.find(c=>c.mac==="aa:bb:cc:dd:ee:04").device_id`);
  if (!noDev) check(`[${tag}] ohne Gerät: Hinweis`, (await txt()).includes("Keine Online-Entität"));
  // Fehler
  await p.evaluate(() => { window.__historyFails = true; });
  await ev(`${panel}._history=null; ${panel}._recorderCache={}`);
  await open("aa:bb:cc:dd:ee:01");
  await p.waitForTimeout(200);
  check(`[${tag}] Fehler angezeigt`, (await txt()).includes("recorder down"));
  // Eigenes Protokoll deckt 30 Tage ab: kein Recorder-Aufruf
  await p.evaluate(({ H, D }) => { window.__historyFails = false; window.__avail = { "aa:bb:cc:dd:ee:01": { since: 35 * D, events: [[35 * D, 1], [2 * D, 0], [2 * D - 3 * H, 1], [5 * H, null], [4 * H, 1]] } }; }, { H, D });
  await ev(`${panel}._history=null; ${panel}._recorderCache={}`);
  let before2 = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "history/history_during_period").length);
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="30d"]').click()`);
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-top")`), null, { timeout: 5000 });
  t = await txt();
  check(`[${tag}] Protokoll: 1 Unterbruch 3 Std., Lücke nicht gezählt`, t.includes("1 Unterbruch") && t.includes("zusammen 3 Std.") && t.includes("Keine Daten"), t);
  check(`[${tag}] Protokoll: kein Recorder-Aufruf`, before2 === await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "history/history_during_period").length));
  // Protokoll erst seit 2 Tagen: Recorder nur bis dahin, und langsam -> Loader
  await p.evaluate(({ H, D, e1 }) => { window.__historyDelay = 2500; window.__avail["aa:bb:cc:dd:ee:01"] = { since: 2 * D, events: [[2 * D, 1], [H, 0], [H - 600, 1]] }; window.__history[e1] = [[40 * D, "on"], [3 * D, "off"], [3 * D - 2 * H, "on"]]; }, { H, D, e1 });
  await ev(`${panel}._history=null; ${panel}._recorderCache={}`);
  await ev(`r.querySelector('[data-dlg="avail-range"][data-range="7d"]').click()`);
  await p.waitForTimeout(1300);
  check(`[${tag}] Loader: Elefant + Zähler`, await ev(`return !!r.querySelector(".avail-loading .ele-rider .leg") && r.querySelector(".avail-sec").textContent==="1"`));
  await p.screenshot({ path: `${OUT}/avail-${tag}-loader.png` });
  await f.waitForFunction(new Function(`return ${R}.querySelector(".avail-top")`), null, { timeout: 8000 });
  const hc = await p.evaluate(() => window.__wsCalls.filter((m) => m.type === "history/history_during_period").at(-1));
  check(`[${tag}] Recorder nur bis Protokollbeginn`, Math.abs(Date.parse(hc.end_time) - (Date.now() - 2 * 86400000)) < 60000, hc.end_time);
  t = await txt();
  check(`[${tag}] zusammengesetzt: 2 Unterbrüche`, t.includes("2 Unterbrüche") && t.includes("längster 2 Std."), t);
  await p.evaluate(() => { window.__historyDelay = 0; });
  // Überbrückung: 4 Min. Lücke weg, 10 Min. bleibt, echte 2-Min.-Unterbrüche bleiben
  const br = await ev(`const p=${panel}; const m=60000, S=0, E=120*m;
    const st=(t,s)=>({s, lu:t/1000});
    const a=p._availSegments([st(0,"on"),st(10*m,"unavailable"),st(14*m,"on"),st(30*m,"unavailable"),st(40*m,"on"),st(60*m,"off"),st(62*m,"on"),st(80*m,"unavailable"),st(83*m,"off"),st(90*m,"on")],S,E);
    return a.map(x=>x.kind+":"+(x.from/m)+"-"+(x.to/m)).join(" ")`);
  check(`[${tag}] Lücke ≤5 Min. überbrückt, 10 Min. bleibt, echte Unterbrüche bleiben`, br === "on:0-30 none:30-40 on:40-60 off:60-62 on:62-80 none:80-83 off:83-90 on:90-120", br);
  check(`[${tag}] keine JS-Fehler`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await run(false);
await run(true);
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
process.exit(ok ? 0 : 1);
