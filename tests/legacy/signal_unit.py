"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import sys, types, importlib.util, time
for m in ["homeassistant","homeassistant.core","homeassistant.helpers","homeassistant.helpers.storage"]:
    sys.modules[m]=types.ModuleType(m)
sys.modules["homeassistant.core"].HomeAssistant=object; sys.modules["homeassistant.core"].callback=lambda f: f
class Store:
    def __init__(s,*a): pass
    def async_delay_save(s,fn,d): s.last=fn()
sys.modules["homeassistant.helpers.storage"].Store=Store
pkg=types.ModuleType("cc"); pkg.__path__=[R]; sys.modules["cc"]=pkg
c=types.ModuleType("cc.const"); c.DOMAIN="unifi_dynamic"; c.STORAGE_VERSION=1; sys.modules["cc.const"]=c
spec=importlib.util.spec_from_file_location("cc.signal_log",R+"/signal_log.py"); S=importlib.util.module_from_spec(spec); spec.loader.exec_module(S)
ok=True
def chk(l,v,i=""):
    global ok; ok&=bool(v); print(("PASS " if v else "FAIL ")+l+(f" - {i}" if i and not v else ""))
log=S.SignalLog(None,"e1")
t0=(int(time.time())//3600)*3600-2*3600
mac="AA:BB:CC:DD:EE:01"
for k in range(2*12*2+3):  # alle 2.5 Min, gut 2 Stunden
    ts=t0+k*150+5
    log.record(mac, -60-(k%5), "ap:01" if k%6 else "ap:02", ts)
h24=log.history(mac,"24h"); h7=log.history(mac,"7d")
chk("24h: 5-Minuten-Blöcke mit Median/Min/Max", len(h24)==26 and h24[0][0]==t0 and h24[0][2]<=h24[0][1]<=h24[0][3], h24[:2])
chk("7d: Stunden inkl. laufender", [b[0]-t0 for b in h7]==[0,3600,7200], [b[0]-t0 for b in h7])
s=log.summary(mac,"7d")
chk("Zusammenfassung: Median, bester, schlechtester", s["best"]==-60 and s["worst"]==-64 and -64<=s["median"]<=-60, s)
chk("AP-Anteile, häufigster zuerst", s["aps"][0]["ap_mac"]=="ap:01" and sum(a["share"] for a in s["aps"])==100, s["aps"])
log2=S.SignalLog(None,"e1"); log2.load(log.data(), time.time())
chk("Speichern/Laden ohne Doppelungen", [b[0] for b in log2.history(mac,"7d")]==[b[0] for b in h7] and len(log2.history(mac,"24h"))==26)
log2._hours[mac.lower()].insert(0,[t0-40*86400,-70,-80,-60,10,"ap:01"]); log2.prune(time.time())
chk("31-Tage-Grenze", all(b[0]>=t0-31*86400 for b in log2._hours[mac.lower()]))
log2.forget(mac); chk("Vergessen nach Purge", log2.history(mac,"24h")==[] and log2.summary(mac) is None)
chk("Ohne Daten: keine Zusammenfassung", S.summarize([]) is None)
print("ALL PASS" if ok else "SOME FAILED")
# --- 2.16.0: abgelaufene offene Blöcke werden abgeschlossen, Zeitraum gefiltert
_now = time.time()
_g = S.SignalLog(None, "e")
_g.record("aa:00:00:00:00:01", -50, "ap1", _now - 3 * 86400)
_g.record("aa:00:00:00:00:02", -60, "ap1", _now - 30)
_g.prune(_now)
print(("PASS" if _g.history("aa:00:00:00:00:01", "24h") == [] and _g.summary("aa:00:00:00:00:01", "24h") is None else "FAIL") + " abwesender Client: kein alter Wert in 24 Std.")
print(("PASS" if len(_g.history("aa:00:00:00:00:01", "7d")) == 1 else "FAIL") + " abwesender Client: Stunde vor 3 Tagen in 7 Tagen enthalten")
_g2 = S.SignalLog(None, "e"); _g2.record("bb", -55, "ap", _now - 40 * 86400); _g2.prune(_now)
print(("PASS" if _g2.history("bb", "30d") == [] else "FAIL") + " Stunde vor 40 Tagen nicht in 30 Tagen")
print(("PASS" if _g.history("aa:00:00:00:00:02", "24h") and _g.history("aa:00:00:00:00:02", "24h")[-1][1] == -60 else "FAIL") + " aktueller Client: laufender Block bleibt")
