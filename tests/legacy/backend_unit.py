"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import sys as _sys
_sys.path.insert(0, str(Path(R).parent))
import sys, types, time
from unittest.mock import MagicMock
class Stub(types.ModuleType):
    def __getattr__(self, n):
        if n.startswith("__"): raise AttributeError(n)
        v = MagicMock(name=n); setattr(self, n, v); return v
import importlib.abc, importlib.machinery
class F(importlib.abc.MetaPathFinder, importlib.abc.Loader):
    def find_spec(self, name, path, target=None):
        if name.split(".")[0] in ("homeassistant","voluptuous","aiohttp"):
            return importlib.machinery.ModuleSpec(name, self, is_package=True)
    def create_module(self, spec):
        m = Stub(spec.name); m.__path__ = []; return m
    def exec_module(self, m): pass
sys.meta_path.insert(0, F())
for m in ["homeassistant","homeassistant.core","homeassistant.config_entries","homeassistant.helpers","homeassistant.helpers.storage",
          "homeassistant.helpers.update_coordinator","homeassistant.helpers.aiohttp_client","homeassistant.helpers.device_registry",
          "homeassistant.helpers.entity_registry","homeassistant.components","homeassistant.components.persistent_notification",
          "homeassistant.exceptions","homeassistant.util","homeassistant.util.dt","homeassistant.helpers.event","homeassistant.const",
          "homeassistant.helpers.dispatcher","homeassistant.helpers.selector","homeassistant.data_entry_flow","voluptuous"]:
    __import__(m)
class DUC:
    def __init__(self,*a,**k): pass
    def __class_getitem__(cls, i): return cls
sys.modules["homeassistant.helpers.update_coordinator"].DataUpdateCoordinator = DUC
sys.modules["homeassistant.helpers.storage"].Store = MagicMock
sys.modules["homeassistant.core"].callback = lambda f: f
_ws = sys.modules["homeassistant.components"]
import homeassistant.components.websocket_api as _wsapi
_wsapi.websocket_command = lambda schema: (lambda f: f)
_wsapi.require_admin = lambda f: f
_ws.websocket_api = _wsapi
import importlib
ok=True
def check(l,c,i=""):
    global ok; ok&=bool(c); print(("PASS " if c else "FAIL ")+l+(" - "+i if i and not c else ""))
coord = importlib.import_module("unifi_dynamic.coordinator")
C = coord.UniFiDynamicCoordinator if hasattr(coord,"UniFiDynamicCoordinator") else [v for v in vars(coord).values() if isinstance(v,type) and hasattr(v,"panel_clients")][0]
from unifi_dynamic.const import FIELD_FIRST_SEEN, FIELD_SEEN_AT
check("first_seen Controller bevorzugt", coord._first_seen({"first_seen":1000,FIELD_FIRST_SEEN:2000})==1000)
check("first_seen Ersatz", coord._first_seen({FIELD_FIRST_SEEN:2000})==2000)
check("first_seen Millisekunden", coord._first_seen({"first_seen":1700000000000})==1700000000)
check("first_seen fehlt -> None", coord._first_seen({}) is None)
o = C.__new__(C)
now=time.time()
out = o._normalise_cache({"AA:BB:CC:00:00:01":{"name":"x",FIELD_SEEN_AT:now-5,FIELD_FIRST_SEEN:now-100,"first_seen":now-999,"signal":-60,"junk":1},
                          "aa:bb:cc:00:00:02":{FIELD_SEEN_AT:now-5,FIELD_FIRST_SEEN:now+9999}})
e=out["aa:bb:cc:00:00:01"]
check("normalise hält _first_seen/first_seen/signal, verwirft junk", e[FIELD_FIRST_SEEN]==now-100 and e["first_seen"]==now-999 and e["signal"]==-60 and "junk" not in e)
check("normalise kappt Zukunft", out["aa:bb:cc:00:00:02"][FIELD_FIRST_SEEN]<=time.time())
# Update-Pfad: neue MAC bekommt _first_seen, Erstbefüllung nicht
src=open(R + "/coordinator.py").read()
check("Erstkontakt nur ausserhalb Erstbefüllung", "if not first_fill:\n            for mac in new_macs:" in src)
notif = importlib.import_module("unifi_dynamic.notification")
entry=MagicMock(); entry.entry_id="E1"
entry.options={}
check("Default -> Panel-Link", notif.client_url(None,entry,"AA:BB:CC:00:00:01")=="/unifi-dynamic?entry=E1&mac=aa:bb:cc:00:00:01")
entry.options={"notify_click_target":"bogus"}
check("Unbekannter Wert -> Panel", notif.click_target(entry)=="panel")
entry.options={"notify_click_target":"device"}
notif.device_url=lambda h,e,m:"/config/devices/device/D1"
check("device -> HA-Geräteseite", notif.client_url(None,entry,"aa")=="/config/devices/device/D1")
notif.device_url=lambda h,e,m:None
check("device ohne Gerät -> None (Integrationsseite)", notif.client_url(None,entry,"aa") is None)
_ok_old = ok


# ---- v2.2.0: Verknüpfungen ----
ok = True
o = C.__new__(C)
o._client_cache = {"aa:bb:cc:00:00:01": {"mac": "aa:bb:cc:00:00:01"}}
o._device_links = {}
o._known_names = {}
saves = []
o._schedule_save = lambda: saves.append(1)
check("Link setzen", o.set_device_link("AA:BB:CC:00:00:01", "dev1") and o.linked_device_id("aa:bb:cc:00:00:01") == "dev1" and len(saves) == 1)
check("Gleicher Link -> keine Änderung", not o.set_device_link("aa:bb:cc:00:00:01", "dev1") and len(saves) == 1)
check("Unbekannter Client -> kein Link", not o.set_device_link("aa:bb:cc:00:00:99", "dev1") and "aa:bb:cc:00:00:99" not in o._device_links)
check("Link entfernen", o.set_device_link("aa:bb:cc:00:00:01", None) and o.linked_device_id("aa:bb:cc:00:00:01") is None)
check("Entfernen ohne Link -> False", not o.set_device_link("aa:bb:cc:00:00:01", None))
# Speichern/Laden
o._device_links = {"aa:bb:cc:00:00:01": "dev1"}
o._ap_names = {}; o._anchor = None; o._migration_done = True
saved = o._data_to_save()
check("Links werden gespeichert", saved["device_links"] == {"aa:bb:cc:00:00:01": "dev1"})
import asyncio
class FakeStore:
    async def async_load(self): return {"device_links": {"AA:BB:CC:00:00:01": "dev1", "x": ""}, "client_cache": {"aa:bb:cc:00:00:01": {"_seen_at": time.time()}}}
o2 = C.__new__(C); o2._store = FakeStore(); o2._device_links = {}; o2._known_names = {}; o2._ap_names = {}; o2._client_cache = {}
asyncio.run(o2.async_load_cache())
check("Links laden (klein, leere verworfen)", o2._device_links == {"aa:bb:cc:00:00:01": "dev1"})
# Purge/Entfernen räumt Link auf
o3 = C.__new__(C)
o3._client_cache = {"aa:bb:cc:00:00:01": {}}; o3._known_names = {}; o3._device_links = {"aa:bb:cc:00:00:01": "dev1"}
o3.data = {}; o3.entry = MagicMock(); o3._entity_entries_for_mac = lambda e, m: []; o3._notify_removed = lambda m: None; o3._reported = {}; o3._avail = {}
coord.get_client_device = lambda *a: None
o3._remove_client_records("aa:bb:cc:00:00:01", MagicMock(), MagicMock(), [])
check("Client entfernt -> Link weg", o3._device_links == {})
# WS: fremdes Gerät erlaubt, eigenes abgelehnt, gelöschtes aufgeräumt
init = importlib.import_module("unifi_dynamic")
dev_own = MagicMock(identifiers={("unifi_dynamic", "aa")}, connections=set())
dev_other = MagicMock(identifiers={("shelly", "x")}, connections={("mac", "AA:BB:CC:00:00:01")}, id="dev1", name_by_user=None, area_id="a1", manufacturer="Shelly", model="ST1820")
dev_other.name = "Bodenheizung"
check("Eigenes Gerät erkannt", init._is_own_device(dev_own) and not init._is_own_device(dev_other))
area_reg = MagicMock(); area_reg.async_get_area.return_value = MagicMock(); area_reg.async_get_area.return_value.name = "Büro"
init.dr.CONNECTION_NETWORK_MAC = "mac"
sm = init._device_summary(dev_other, area_reg)
check("Summary: Name/Bereich/MACs klein", sm["name"] == "Bodenheizung" and sm["area"] == "Büro" and sm["macs"] == ["aa:bb:cc:00:00:01"], str(sm))
dev_other.name_by_user = "Mein Name"
check("Summary bevorzugt name_by_user", init._device_summary(dev_other, area_reg)["name"] == "Mein Name")
# _ws_link_device
co = MagicMock(); co.client_snapshot.return_value = {"mac": "x"}; co.set_device_link.return_value = True
hass = MagicMock(); hass.data = {"unifi_dynamic": {"E1": co}}
reg = MagicMock(); init.dr.async_get = lambda h: reg
conn = MagicMock()
fn = getattr(init._ws_link_device, "__wrapped__", init._ws_link_device)
while hasattr(fn, "__wrapped__"): fn = fn.__wrapped__
reg.async_get.return_value = dev_own
fn(hass, conn, {"id": 1, "entry_id": "E1", "mac": "AA:BB", "device_id": "own"})
check("WS: eigenes Gerät abgelehnt", conn.send_error.call_args[0][1] == "invalid" and not co.set_device_link.called)
conn.reset_mock(); reg.async_get.return_value = None
fn(hass, conn, {"id": 2, "entry_id": "E1", "mac": "AA:BB", "device_id": "gone"})
check("WS: unbekanntes Gerät abgelehnt", conn.send_error.call_args[0][1] == "not_found")
conn.reset_mock(); reg.async_get.return_value = dev_other
fn(hass, conn, {"id": 3, "entry_id": "E1", "mac": "AA:BB", "device_id": "dev1"})
check("WS: fremdes Gerät verknüpft (MAC klein)", co.set_device_link.call_args[0] == ("aa:bb", "dev1") and conn.send_result.called)
conn.reset_mock(); co.set_device_link.reset_mock()
fn(hass, conn, {"id": 4, "entry_id": "E1", "mac": "aa:bb", "device_id": None})
check("WS: None entfernt", co.set_device_link.call_args[0] == ("aa:bb", None))
co.client_snapshot.return_value = {}
conn.reset_mock()
fn(hass, conn, {"id": 5, "entry_id": "E1", "mac": "aa:cc", "device_id": None})
check("WS: unbekannter Client", conn.send_error.call_args[0][1] == "not_found")
# list_clients: gelöschtes HA-Gerät -> Verknüpfung aufgeräumt
co = MagicMock(); co.panel_clients.return_value = [{"mac": "aa:01"}, {"mac": "aa:02"}]
co.linked_device_id.side_effect = lambda m: {"aa:01": "gone", "aa:02": "dev1"}.get(m)
co.entry = MagicMock(); co.host = "h"
hass = MagicMock(); hass.data = {"unifi_dynamic": {"E1": co}}
reg = MagicMock(); reg.async_get.side_effect = lambda i: dev_other if i == "dev1" else None
init.dr.async_get = lambda h: reg
init.ar.async_get = lambda h: area_reg
init.get_excluded_macs = lambda e: set()
init.get_client_device = lambda *a: None
conn = MagicMock()
init._ws_list_clients(hass, conn, {"id": 9})
rows = conn.send_result.call_args[0][1]["clients"]
check("list_clients: gelöschtes Gerät -> null + aufgeräumt", rows[0]["linked_device"] is None and co.set_device_link.call_args[0] == ("aa:01", None))
check("list_clients: vorhandenes Gerät geliefert", rows[1]["linked_device"]["name"] == "Mein Name")
# v2.2.1: UniFi-Network-Geräte nicht verknüpfbar
entries = {"e_unifi": MagicMock(domain="unifi"), "e_shelly": MagicMock(domain="shelly"), "e_own": MagicMock(domain="unifi_dynamic")}
hass = MagicMock(); hass.config_entries.async_get_entry.side_effect = lambda i: entries.get(i)
def dev(ids, ces, name="x"):
    d = MagicMock(identifiers=set(ids), config_entries=set(ces), connections=set(), id=name, name_by_user=None, area_id=None, manufacturer=None, model=None)
    d.name = name
    return d
d_unifi = dev({("unifi", "aa")}, {"e_unifi"}, "UniFi Client")
d_ap = dev({("unifi", "ap")}, {"e_unifi"}, "AP U7 Pro")
d_shelly = dev({("shelly", "s")}, {"e_shelly"}, "Bodenheizung")
d_shared = dev({("shelly", "s2"), ("unifi", "bb")}, {"e_shelly", "e_unifi"}, "Geteilt")
d_own = dev({("unifi_dynamic", "cc")}, {"e_own"}, "Eigen")
d_noentry = dev({("unifi", "dd")}, set(), "Ohne Entry")
d_orphan = dev(set(), set(), "Leer")
check("UniFi-Network-Client ausgeschlossen", not init._is_linkable(hass, d_unifi))
check("UniFi-Network-AP ausgeschlossen", not init._is_linkable(hass, d_ap))
check("Shelly wählbar", init._is_linkable(hass, d_shelly))
check("Gemeinsames Shelly/UniFi-Gerät wählbar", init._is_linkable(hass, d_shared))
check("Eigenes Gerät ausgeschlossen", not init._is_linkable(hass, d_own))
check("Ohne Entry: Identifier entscheiden", not init._is_linkable(hass, d_noentry))
check("Ohne Entry und Identifier: wählbar", init._is_linkable(hass, d_orphan))
reg = MagicMock(); reg.devices = {i: d for i, d in enumerate([d_unifi, d_ap, d_shelly, d_shared, d_own])}
init.dr.async_get = lambda h: reg
conn = MagicMock()
init._ws_list_devices(hass, conn, {"id": 20})
names = [d["name"] for d in conn.send_result.call_args[0][1]["devices"]]
check("list_devices liefert nur Shelly + geteiltes", names == ["Bodenheizung", "Geteilt"], str(names))
co = MagicMock(); co.client_snapshot.return_value = {"mac": "x"}
hass.data = {"unifi_dynamic": {"E1": co}}
reg.async_get.return_value = d_unifi
conn = MagicMock()
init._ws_link_device(hass, conn, {"id": 21, "entry_id": "E1", "mac": "aa", "device_id": "UniFi Client"})
check("link_device lehnt UniFi-Network-Gerät ab", conn.send_error.call_args[0][1] == "invalid" and not co.set_device_link.called)
# v2.2.2: bestehende Verknüpfung auf UniFi-Network-Gerät wird aufgeräumt
co = MagicMock(); co.panel_clients.return_value = [{"mac": "aa:01"}, {"mac": "aa:02"}]
co.linked_device_id.side_effect = lambda m: {"aa:01": "UniFi Client", "aa:02": "Bodenheizung"}.get(m)
co.entry = MagicMock(); co.host = "h"
hass.data = {"unifi_dynamic": {"E1": co}}
reg = MagicMock(); reg.async_get.side_effect = lambda i: {"UniFi Client": d_unifi, "Bodenheizung": d_shelly}.get(i)
init.dr.async_get = lambda h: reg
conn = MagicMock()
init._ws_list_clients(hass, conn, {"id": 30})
rows = conn.send_result.call_args[0][1]["clients"]
check("Alte UniFi-Network-Verknüpfung: null + aufgeräumt", rows[0]["linked_device"] is None and co.set_device_link.call_args_list == [(("aa:01", None),)], str(co.set_device_link.call_args_list))
check("Shelly-Verknüpfung bleibt", rows[1]["linked_device"]["name"] == "Bodenheizung")
sys.exit(0 if (ok and _ok_old) else 1)
