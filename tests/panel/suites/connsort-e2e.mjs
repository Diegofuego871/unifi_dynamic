import { chromium } from "playwright-core";
import { launchOptions, outDir } from "../lib.mjs";
const b = await chromium.launch(launchOptions);
let ok = true;
const check = (l, c, i = "") => { ok &&= !!c; console.log(`${c ? "PASS" : "FAIL"} ${l}${i ? " - " + i : ""}`); };
const R = `document.querySelector("unifi-dynamic-panel").shadowRoot`;
for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://127.0.0.1:8950/ha-sim-dialog.html");
  await p.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} }); await p.reload();
  const f = await (await p.waitForSelector("#panel-frame")).contentFrame();
  await f.waitForFunction(new Function(`return ${R}?.querySelectorAll("tbody tr[data-key]").length > 0`));
  const ev = (code) => f.evaluate(new Function(`const r=${R}; const P=document.querySelector("unifi-dynamic-panel");` + code));
  const order = () => ev(`return [...r.querySelectorAll("tbody tr[data-key]")].map(tr=>{const c=P._clientByKey(tr.dataset.key); return c.is_wired ? "K" : (typeof c.signal==="number" ? c.signal : "W")})`);
  await ev(`r.querySelector('th[data-sort-key="conn"]').click()`); await p.waitForTimeout(200);
  const asc = await order();
  const nums = asc.filter((x) => typeof x === "number");
  const firstK = asc.indexOf("K"), lastNum = asc.map((x) => typeof x === "number").lastIndexOf(true), firstW = asc.indexOf("W");
  check(`[${tag}] aufsteigend: WLAN bester Empfang zuerst, absteigend sortiert`, nums.length > 3 && nums.every((v, i) => i === 0 || nums[i - 1] >= v), JSON.stringify(asc));
  check(`[${tag}] aufsteigend: WLAN ohne Messwert nach WLAN, Kabel zuletzt`, (firstW === -1 || firstW > lastNum) && (firstK === -1 || firstK > lastNum) && (firstK === -1 || asc.slice(firstK).every((x) => x === "K")), JSON.stringify(asc));
  await ev(`r.querySelector('th[data-sort-key="conn"]').click()`); await p.waitForTimeout(200);
  const desc = await order();
  check(`[${tag}] absteigend: umgekehrt (Kabel zuerst, schlechtester Empfang vor dem besten)`, JSON.stringify(desc.filter((x) => typeof x === "number")) === JSON.stringify([...nums].reverse()) && (desc.indexOf("K") === -1 || desc[0] === "K"), JSON.stringify(desc));
  await ctx.close();
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
