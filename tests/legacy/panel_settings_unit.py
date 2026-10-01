"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import asyncio, sys, types, importlib.util
for m in ["homeassistant","homeassistant.core","homeassistant.helpers","homeassistant.helpers.event","homeassistant.helpers.storage","homeassistant.helpers.aiohttp_client","homeassistant.helpers.issue_registry","homeassistant.loader","aiohttp","homeassistant.config_entries"]:
    sys.modules[m]=types.ModuleType(m)
sys.modules["homeassistant.core"].HomeAssistant=object; sys.modules["homeassistant.core"].callback=lambda f:f
ev=sys.modules["homeassistant.helpers.event"]; ev.async_call_later=ev.async_track_time_interval=lambda *a,**k:None
sys.modules["homeassistant.helpers"].issue_registry=sys.modules["homeassistant.helpers.issue_registry"]
sys.modules["homeassistant.helpers.aiohttp_client"].async_get_clientsession=None
sys.modules["homeassistant.loader"].async_get_integration=None
sys.modules["aiohttp"].ClientError=Exception; sys.modules["aiohttp"].ClientTimeout=lambda total: None
DATA={}
class Store:
    def __init__(s,h,v,k): s.k=k
    async def async_load(s): return DATA.get(s.k)
    async def async_save(s,d): DATA[s.k]=d
sys.modules["homeassistant.helpers.storage"].Store=Store
pkg=types.ModuleType("cc"); pkg.__path__=[R]; sys.modules["cc"]=pkg
for n in ["const","update_check"]:
    spec=importlib.util.spec_from_file_location("cc."+n,f"{R}/{n}.py"); m=importlib.util.module_from_spec(spec); sys.modules["cc."+n]=m; spec.loader.exec_module(m)
U=sys.modules["cc.update_check"]
class H: data={}
ok=True
def chk(l,c,i=""):
    global ok; ok&=bool(c); print(("PASS " if c else "FAIL ")+l, i if not c else "")
async def main():
    h=H()
    chk("Standard aus", U.panel_settings(h)=={"prerelease":False,"prerelease_hacs":None})
    await U.async_load_panel_settings(h); chk("geladen: aus", U.panel_settings(h)["prerelease"] is False)
    r=await U.async_set_panel_settings(h,{"prerelease":True}); chk("an, gespeichert", r["prerelease"] and DATA["unifi_dynamic_panel"]["prerelease"])
    await U.async_set_panel_settings(h,{"prerelease_hacs":"switch.x"}); chk("HACS-Schalter gemerkt, prerelease bleibt", U.panel_settings(h)=={"prerelease":True,"prerelease_hacs":"switch.x"})
    await U.async_set_panel_settings(h,{"prerelease_hacs":None}); chk("HACS-Schalter vergessen", U.panel_settings(h)["prerelease_hacs"] is None)
    h2=H(); h2.data={}; await U.async_load_panel_settings(h2); chk("Neustart: aus dem Speicher", U.panel_settings(h2)["prerelease"] is True)
asyncio.run(main()); print("ALL PASS" if ok else "SOME FAILED")
