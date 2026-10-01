"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import ast, time, textwrap
src = open(R + "/coordinator.py").read()
tree = ast.parse(src)
cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "UnifiDynamicCoordinator")
names = {"_avail_append","_avail_mark_all","_avail_record","_avail_prune","availability","_register_failure","_drop_phantom_outages","_update_reported","reported_seen_at","reported_rssi"}
import logging
ns = {"OFFLINE_AFTER_SECONDS": 60, "LAST_SEEN_STEP_SECONDS": 300, "FIELD_SEEN_AT": "_seen_at", "as_epoch_seconds": (lambda v: float(v) if isinstance(v,(int,float)) else None), "_get_int_option": lambda e,k,d: 3, "CONF_OFFLINE_AFTER_FAILURES": "x", "DEFAULT_OFFLINE_AFTER_FAILURES": 3, "_LOGGER": logging.getLogger("t"), "callback": lambda f: f, "time": time, "AVAIL_KEEP_DAYS": 31, "AVAIL_CONTROLLER": "controller", "Any": object}
lines = src.splitlines()
code = "class C:\n" + "\n".join("\n".join(lines[f.lineno-1:f.end_lineno]) for f in cls.body if isinstance(f, ast.FunctionDef) and f.name in names)
exec(code, ns)
C = ns["C"]
class T(C):
    offline_after = 60
    def __init__(s):
        s._avail = {}; s._client_cache = {}; s._avail_pruned_at = 0; s.saves = 0; s.on = {}; s.seen = {}; s._reported = {}; s._anchor = None
    def is_client_online(s, m): raise AssertionError("_avail_record darf is_client_online nicht nutzen")
    def seen_at(s, m): return s.seen.get(m)
    def _schedule_avail_save(s): s.saves += 1
ok = True
def check(l, c, i=""):
    global ok; ok &= bool(c); print(("PASS" if c else "FAIL"), l, i)
t = T(); now = 1_000_000.0
seen = lambda tt, m, v: tt._client_cache.__setitem__(m, {"_seen_at": v})
seen(t, "a", now); seen(t, "b", now - 5000)
t._avail_record(now)
check("Erstes Protokoll (aus dem Cache)", t._avail == {"controller": [[now, 1]], "a": [[now, 1]], "b": [[now, 0]]}, t._avail)
seen(t, "a", now + 60); t._avail_record(now + 60); check("Kein Duplikat", len(t._avail["a"]) == 1)
seen(t, "a", now + 100)
t._avail_record(now + 400); check("Offline ab letztem Kontakt", t._avail["a"][-1] == [now + 100, 0], t._avail["a"])
t._avail_mark_all(None, now + 500); check("Controller weg: None", t._avail["a"][-1] == [now + 500, None] and t._avail["b"][-1] == [now + 500, None])
seen(t, "a", now + 900); t._avail_record(now + 900); check("Zurück: online", t._avail["a"][-1] == [now + 900, 1])
check("offline nach None: ab jetzt, nicht seen", t._avail["b"][-1] == [now + 900, 0], t._avail["b"])
# Neustart: self.data leer, Cache frisch -> kein Unterbruch
tr = T(); tr.data = None
tr._avail = {"x": [[0.0, 1]]}; seen(tr, "x", 5000.0)
tr._avail_record(5000.0)
check("Erster Poll nach Neustart: kein Unterbruch", tr._avail["x"] == [[0.0, 1]], tr._avail)
# Bereinigung alter Scheinunterbrüche
tp = T(); tp.update_interval = None; tp._avail = {
    "p": [[0.0, 1], [100.0, 0], [115.0, 1], [500.0, 0], [620.0, 1], [900.0, None], [950.0, 0], [965.0, 1]],
    "first": [[10.0, 0], [25.0, 1], [80.0, 0], [200.0, 1]],
    "controller": [[0.0, 1], [10.0, 0], [20.0, 1]],
}
changed = tp._drop_phantom_outages()
check("Bereinigung: kurze weg, echte (120 s) bleibt, nach Lücke online",
      changed and tp._avail["p"] == [[0.0, 1], [500.0, 0], [620.0, 1], [900.0, None], [965.0, 1]], tp._avail["p"])
check("Bereinigung: Scheinunterbruch am Anfang", tp._avail["first"] == [[25.0, 1], [80.0, 0], [200.0, 1]], tp._avail["first"])
check("Bereinigung: Controller unberührt", tp._avail["controller"] == [[0.0, 1], [10.0, 0], [20.0, 1]])
check("Bereinigung: zweiter Lauf ändert nichts", not tp._drop_phantom_outages())
import datetime
tq = T(); tq.update_interval = datetime.timedelta(seconds=120)
tq._avail = {"q": [[0.0, 1], [1000.0, 0], [1120.0, 1], [2000.0, 0], [2240.0, 1]]}
tq._drop_phantom_outages()
check("Intervall 120 s: Schein (120 s) weg, echt (240 s) bleibt", tq._avail["q"] == [[0.0, 1], [2000.0, 0], [2240.0, 1]], tq._avail["q"])
r = t.availability("A", now + 450)
check("availability: Zustand vor start + Rest", r["events"] == [[now + 450, 0], [now + 500, None], [now + 900, 1]] and r["since"] == now, r)
# Prune
t2 = T(); t2._client_cache = {"a": {}}; base = 10_000_000.0
t2._avail = {"a": [[base - 40*86400, 1], [base - 35*86400, 0], [base - 1000, 1]], "gone": [[base, 1]]}
t2._avail_prune(base)
cut = base - 31*86400
check("Prune: gelöschter Client weg", "gone" not in t2._avail)
check("Prune: Zustand vor Grenze behalten", t2._avail["a"] == [[cut, 0], [base - 1000, 1]], t2._avail["a"])
# Controller: Ausfall ab letztem Poll, Rückkehr beim nächsten Erfolg
t3 = T(); seen(t3, "a", 100.0)
t3._avail_record(100.0)
t3._avail_mark_all(None, 200.0); t3._avail_append("controller", 200.0, 0)
check("Controller offline ab Anker, Clients keine Daten", t3._avail["controller"] == [[100.0, 1], [200.0, 0]] and t3._avail["a"][-1] == [200.0, None], t3._avail)
seen(t3, "a", 900.0); t3._avail_record(900.0)
check("Controller zurück", t3._avail["controller"][-1] == [900.0, 1] and t3._avail["a"][-1] == [900.0, 1], t3._avail)
t3._client_cache = {}
t3._avail_prune(1_000_000_000.0)
check("Prune behält Controller", "controller" in t3._avail and "a" not in t3._avail, t3._avail)
# Neustart: letzter Poll vor dem Neustart bei 1000, HA startet bei 5000,
# danach schlagen drei Abfragen fehl -> Ausfall ab 5000, nicht ab 1000.
t4 = T(); t4._client_cache = {}; t4._avail = {"controller": [[0.0, 1]]}
t4._anchor = 1000.0; t4._started_at = 5000.0; t4._failures = 0; t4._offline = False
t4.entry = None; t4.host = "h"; t4._fire_contact_callback = lambda *a: None
for _ in range(3): t4._register_failure("Timeout")
check("Controller-Ausfall nach Neustart beginnt bei HA-Start", t4._avail["controller"][-1] == [5000.0, 0], t4._avail)
t5 = T(); t5._client_cache = {}; t5._avail = {"controller": [[0.0, 1]]}
t5._anchor = 8000.0; t5._started_at = 5000.0; t5._failures = 0; t5._offline = False
t5.entry = None; t5.host = "h"; t5._fire_contact_callback = lambda *a: None
for _ in range(3): t5._register_failure("Timeout")
check("Ausfall im laufenden Betrieb ab letztem Poll", t5._avail["controller"][-1] == [8000.0, 0], t5._avail)
# 2.16.0: Last seen / RSSI für Entitäten in 5-Minuten-Schritten, offline exakt
tr = T(); base = 2_000_000.0
tr._client_cache = {"a": {"_seen_at": base, "rssi": 30}}; tr._anchor = base; tr._update_reported()
check("Last seen: erster Poll gemeldet", tr._reported["a"] == (base, 30), tr._reported)
for k in range(1, 10):  # online, Poll alle 30 s
    tr._client_cache["a"] = {"_seen_at": base + 30 * k, "rssi": 30 + k}; tr._anchor = base + 30 * k; tr._update_reported()
check("Last seen: online innerhalb 5 Min. unverändert", tr._reported["a"] == (base, 30), tr._reported)
tr._client_cache["a"] = {"_seen_at": base + 300, "rssi": 50}; tr._anchor = base + 300; tr._update_reported()
check("Last seen: nach 5 Min. vorgerückt, RSSI mit", tr._reported["a"] == (base + 300, 50), tr._reported)
tr._client_cache["a"] = {"_seen_at": base + 420, "rssi": 44}; tr._anchor = base + 420; tr._update_reported()
check("Last seen: 2 Min. später noch alter Wert", tr._reported["a"] == (base + 300, 50))
tr._anchor = base + 420 + 61; tr._update_reported()
check("Last seen: offline -> exakter letzter Kontakt", tr._reported["a"] == (base + 420, 44), tr._reported)
tr._client_cache["a"] = {"_seen_at": base + 900, "rssi": 20}; tr._anchor = base + 900; tr._update_reported()
check("Last seen: wieder online -> sofort aktuell", tr._reported["a"] == (base + 900, 20), tr._reported)
print("ALL PASS" if ok else "SOME FAILED")
