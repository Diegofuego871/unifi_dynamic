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
  // --- ein Hub

const openSettings = async (t) => {
  await t.click(".gear-btn");
  await t.f.waitForFunction(new Function(`return ${R}.querySelector("dialog.settings[open] .conn-sec")`));
  // Abschnitt ist zuklappbar und steht zuunterst: bei Bedarf aufklappen.
  const st = await t.ev(`const sec=r.querySelector(".conn-sec"); const all=[...r.querySelectorAll("dialog.settings .set-sec")]; return {open: sec.classList.contains("open"), last: all[all.length-1]===sec, sum: sec.querySelector(".set-sec-sum").textContent, body: !!sec.querySelector('[data-set="conn-edit"]')}`);
  if (!openChecked) {
    openChecked = true;
    check(`Verbindung: standardmässig zu, zuunterst, Zusammenfassung Host · Status`, !st.open && st.last && !st.body && st.sum.includes("192.0.2.10") && st.sum.includes("Verbunden"), JSON.stringify(st));
  }
  if (!st.open) await t.click('[data-set="section"][data-id="connection"]');
};
let openChecked = false;
const typeInto = async (t, mobile, sel, text) => {
  await t.click(sel);
  await t.p.keyboard.press("Control+A");
  await t.p.keyboard.press("Backspace");
  if (text) await t.p.keyboard.type(text);
};

for (const mobile of [false, true]) {
  const tag = mobile ? "mobile" : "desktop";
  // --- Anzeige und erfolgreiche Änderung
  {
    const t = await setup(mobile, false);
    const { p, ev, click } = t;
    await openSettings(t);
    const txt = await ev(`return r.querySelector(".conn-sec").innerText`);
    check(`[${tag}] Abschnitt Verbindung: Host, SSL, Key hinterlegt, Verbunden`, txt.includes("Verbindung") && txt.includes("192.0.2.10") && txt.includes("hinterlegt") && txt.includes("Verbunden") && txt.includes("nein"));
    check(`[${tag}] kein Banner bei ok`, await ev(`return !r.querySelector(".conn-banner")`));
    check(`[${tag}] kein Key-Wert im DOM`, await ev(`return !r.innerHTML.includes("api_key")`));
    await click('[data-set="conn-edit"]');
    check(`[${tag}] Verbindungsdialog offen über Einstellungen`, await ev(`return r.querySelector("dialog.conn-edit").open && r.querySelector("dialog.settings").open`));
    check(`[${tag}] Host vorbelegt, Key leer, Passwortfeld`, await ev(`return r.querySelector('[data-conn="host"]').value==="192.0.2.10" && r.querySelector('[data-conn="key"]').value==="" && r.querySelector('[data-conn="key"]').type==="password"`));
    check(`[${tag}] Speichern ohne Key erlaubt (Key behalten)`, await ev(`return !r.querySelector('[data-conn="save"]').disabled`));
    const bb = await ev(`const b=r.querySelector("dialog.conn-edit").getBoundingClientRect(); return {w:b.width,l:b.left,r:b.right,vw:innerWidth}`);
    check(`[${tag}] Dialog passt in Breite`, bb.l >= 0 && bb.r <= bb.vw, JSON.stringify(bb));
    await p.screenshot({ path: `${OUT}/connedit-${tag}-dialog.png` });
    // Host leeren -> gesperrt
    await typeInto(t, mobile, '[data-conn="host"]', "");
    check(`[${tag}] leerer Host sperrt Speichern`, await ev(`return r.querySelector('[data-conn="save"]').disabled`));
    await typeInto(t, mobile, '[data-conn="host"]', "192.0.2.99");
    // erster Versuch: Key ungültig
    await p.evaluate(() => { window.__connErrors = ["invalid_auth"]; });
    await typeInto(t, mobile, '[data-conn="key"]', "falsch-123");
    await click('[data-conn="save"]');
    check(`[${tag}] während Test: Knopf-Text, gesperrt`, await ev(`const b=r.querySelector('[data-conn="save"]'); return b.disabled && b.textContent.includes("getestet")`));
    await t.f.waitForFunction(new Function(`return ${R}.querySelector("dialog.conn-edit .dlg-error")`));
    check(`[${tag}] Fehler API-Key ungültig, Dialog bleibt offen, Eingaben erhalten`, await ev(`return r.querySelector("dialog.conn-edit .dlg-error").textContent.startsWith("API-Key ungültig") && r.querySelector("dialog.conn-edit").open && r.querySelector('[data-conn="host"]').value==="192.0.2.99" && r.querySelector('[data-conn="key"]').value==="falsch-123"`));
    check(`[${tag}] Key nicht im HTML-Attribut`, await ev(`return !r.querySelector("dialog.conn-edit").innerHTML.includes("falsch-123")`));
    await p.screenshot({ path: `${OUT}/connedit-${tag}-error.png` });
    // Tippen entfernt Fehler
    await typeInto(t, mobile, '[data-conn="key"]', "neu-key-456");
    check(`[${tag}] Tippen entfernt Fehlermeldung`, await ev(`return !r.querySelector("dialog.conn-edit .dlg-error")`));
    // SSL einschalten
    await click('dialog.conn-edit .switch');
    check(`[${tag}] SSL an`, await ev(`return r.querySelector('[data-conn="ssl"]').checked`));
    await p.evaluate(() => { window.__toasts = []; const h = document.querySelector("home-assistant"); if (h) h.addEventListener("hass-notification", (e) => window.__toasts.push(e.detail.message)); });
    await click('[data-conn="save"]');
    await t.f.waitForFunction(new Function(`return !${R}.querySelector("dialog.conn-edit").open`));
    const calls = await p.evaluate(() => window.__connCalls);
    const last = calls.at(-1);
    check(`[${tag}] gesendet: Host, Key, SSL`, calls.length === 2 && last.host === "192.0.2.99" && last.api_key === "neu-key-456" && last.verify_ssl === true, JSON.stringify(last));
    check(`[${tag}] beide Dialoge zu, Toast`, await ev(`return !r.querySelector("dialog.settings").open`) && (await p.evaluate(() => window.__toasts.join("|"))).includes("Verbindung gespeichert"), await p.evaluate(() => window.__toasts.join("|")));
    await openSettings(t);
    { const tx = await ev(`return r.querySelector(".conn-sec").innerText + " open=" + r.querySelector("dialog.settings").open + " conn=" + r.querySelector("dialog.conn-edit").open`); check(`[${tag}] neuer Stand angezeigt`, tx.includes("192.0.2.99"), tx.replace(/\n/g," ")); }
    // Abbrechen ohne Senden, Key leer lassen
    await click('[data-set="conn-edit"]');
    await click('dialog.conn-edit .dlg-actions [data-conn="close"]');
    check(`[${tag}] Abbrechen schliesst nur Verbindungsdialog`, await ev(`return !r.querySelector("dialog.conn-edit").open && r.querySelector("dialog.settings").open`));
    await click('[data-set="conn-edit"]');
    await p.evaluate(() => { window.__connErrors = ["cannot_connect"]; });
    await click('[data-conn="save"]');
    await t.f.waitForFunction(new Function(`return ${R}.querySelector("dialog.conn-edit .dlg-error")`));
    check(`[${tag}] Host nicht erreichbar`, (await ev(`return r.querySelector("dialog.conn-edit .dlg-error").textContent`)).startsWith("Host nicht erreichbar"));
    await p.evaluate(() => { window.__connErrors = ["already_configured"]; });
    await click('[data-conn="save"]');
    await p.waitForTimeout(500);
    check(`[${tag}] doppelte IP abgelehnt`, (await ev(`return r.querySelector("dialog.conn-edit .dlg-error")?.textContent||""`)).includes("anderen Hub"));
    const c2 = await p.evaluate(() => window.__connCalls.at(-1));
    check(`[${tag}] ohne Key: api_key nicht gesendet`, !("api_key" in c2), JSON.stringify(c2));
    check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
    await t.ctx.close();
  }
  // --- API-Key ungültig: Banner, Erneuern
  {
    const t = await setup(mobile, false);
    const { p, ev, click } = t;
    await p.evaluate(() => { window.__connStatus = "auth_failed"; });
    await openSettings(t);
    check(`[${tag}] Banner zuoberst`, await ev(`const b=r.querySelector("dialog.settings .dlg-body").firstElementChild; return b.classList.contains("conn-banner") && b.textContent.includes("API-Key erneuern")`));
    check(`[${tag}] Status rot: API-Key ungültig`, await ev(`const s=r.querySelector(".conn-status"); return s.classList.contains("auth_failed") && s.textContent==="API-Key ungültig"`));
    await p.screenshot({ path: `${OUT}/connedit-${tag}-banner.png` });
    await click('[data-set="conn-renew"]');
    check(`[${tag}] Erneuern: Titel, Key Pflicht, Fokus`, await ev(`return r.querySelector("dialog.conn-edit h2").textContent==="API-Key erneuern" && r.querySelector('[data-conn="save"]').disabled`));
    await typeInto(t, mobile, '[data-conn="key"]', "frisch-789");
    check(`[${tag}] mit Key freigegeben`, await ev(`return !r.querySelector('[data-conn="save"]').disabled`));
    await p.keyboard.press("Enter");
    await t.f.waitForFunction(new Function(`return !${R}.querySelector("dialog.conn-edit").open`));
    const last = await p.evaluate(() => window.__connCalls.at(-1));
    check(`[${tag}] Enter sendet, Key übergeben`, last.api_key === "frisch-789" && last.host === "192.0.2.10");
    await openSettings(t);
    check(`[${tag}] danach kein Banner, Verbunden`, await ev(`return !r.querySelector(".conn-banner") && r.querySelector(".conn-status").textContent==="Verbunden"`));
    check(`[${tag}] keine JS-Fehler`, t.errors.length === 0, t.errors.join("; "));
    await t.ctx.close();
  }
}
await b.close();
console.log(ok ? "ALL PASS" : "SOME FAILED");
