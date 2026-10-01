"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import asyncio, sys, types, importlib.util
# Stubs
aio=types.ModuleType("aiohttp")
class ClientError(Exception): pass
aio.ClientError=ClientError; aio.ClientTimeout=lambda total: total
sys.modules["aiohttp"]=aio
for m in ["homeassistant","homeassistant.config_entries","homeassistant.core","homeassistant.helpers","homeassistant.helpers.aiohttp_client"]:
    sys.modules[m]=types.ModuleType(m)
sys.modules["homeassistant.config_entries"].ConfigEntry=object
sys.modules["homeassistant.core"].HomeAssistant=object
STATUS={"v":200}; SEEN=[]; SITES={"v":{"data":[{"id":"x","internalReference":"default","name":"Default"}]}}
class Resp:
    def __init__(s): s.status=STATUS["v"]
    async def json(s, content_type=None):
        if SITES["v"]=="bad": raise ValueError("kein JSON")
        return SITES["v"]
    async def __aenter__(s):
        if STATUS["v"]=="net": raise ClientError("x")
        return s
    async def __aexit__(s,*a): pass
class Sess:
    def get(s,url,headers,timeout): SEEN.append((url,headers["X-API-KEY"])); return Resp()
sys.modules["homeassistant.helpers.aiohttp_client"].async_get_clientsession=lambda hass,verify_ssl: Sess()
pkg=types.ModuleType("cc"); pkg.__path__=[R]; sys.modules["cc"]=pkg
const=types.ModuleType("cc.const"); const.CONF_API_KEY="api_key"; const.CONF_HOST="host"; const.CONF_VERIFY_SSL="verify_ssl"; const.DOMAIN="unifi_dynamic"; const.SITES_PATH="/sites"; const.CONF_SITE="site"; const.CONF_SITE_NAME="site_name"; const.DEFAULT_SITE="default"
sys.modules["cc.const"]=const
spec=importlib.util.spec_from_file_location("cc.connection",R+"/connection.py"); c=importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
class E:
    def __init__(s,i,h,k,t=None): s.entry_id=i; s.unique_id=h.lower(); s.data={"host":h,"api_key":k,"verify_ssl":False}; s.title=t or f"UniFi {h}"
class CE:
    def __init__(s,es): s.es=es; s.updates=[]; s.reloads=[]
    def async_entries(s,d): return s.es
    def async_update_entry(s,e,**kw):
        s.updates.append(kw)
        for k in ("unique_id","title","data"): setattr(e,k,kw[k])
    async def async_reload(s,i): s.reloads.append(i)
class H:
    def __init__(s,es): s.config_entries=CE(es)
    def async_create_task(s,coro): coro.close(); s.config_entries.reloads.append("sched")
ok=True
def chk(l,v):
    global ok; ok&=bool(v); print(("PASS " if v else "FAIL ")+l)
chk("normalize", c.normalize_host(" https://10.0.0.1/proxy ")=="10.0.0.1" and c.normalize_host("HTTP://Unifi.local")=="Unifi.local")
a=E("a","10.0.0.1","OLD"); b=E("b","10.0.0.2","K2",t="Werkstatt"); h=H([a,b])
run=asyncio.run
chk("leerer Host", run(c.async_apply(h,a,"  ",None,False))=="invalid_host")
chk("doppelte IP", run(c.async_apply(h,a,"https://10.0.0.2/",None,False))=="already_configured" and not h.config_entries.updates)
STATUS["v"]=401; chk("401 -> invalid_auth, nichts gespeichert", run(c.async_apply(h,a,"10.0.0.9","bad",False))=="invalid_auth" and not h.config_entries.updates)
STATUS["v"]=403; chk("403 -> invalid_auth", run(c.async_check(h,"x","k",False))[0]=="invalid_auth")
STATUS["v"]=500; chk("500 -> cannot_connect", run(c.async_check(h,"x","k",False))[0]=="cannot_connect")
STATUS["v"]="net"; chk("Netz -> cannot_connect", run(c.async_check(h,"x","k",False))[0]=="cannot_connect")
STATUS["v"]=200; SEEN.clear()
chk("eigener Host erlaubt, alter Key behalten", run(c.async_apply(h,a,"10.0.0.1","",True)) is None and SEEN[-1]==("https://10.0.0.1/sites","OLD") and a.data["api_key"]=="OLD" and a.data["verify_ssl"] is True)
chk("neuer Host+Key, Titel mitgezogen, unique_id", run(c.async_apply(h,a,"10.0.0.5"," NEW ",False)) is None and a.data=={"host":"10.0.0.5","api_key":"NEW","verify_ssl":False} and a.title=="UniFi 10.0.0.5" and a.unique_id=="10.0.0.5")
chk("eigener Titel bleibt", run(c.async_apply(h,b,"10.0.0.7",None,False)) is None and b.title=="Werkstatt")
chk("Reload geplant", h.config_entries.reloads.count("sched")==3)
# 2.16.0: Sites
STATUS["v"]=200
SITES["v"]={"data":[{"internalReference":"default","name":"Default"},{"internalReference":"x7k2","name":"Ferienhaus"},{"internalReference":"x7k2","name":"dup"},{"name":"ohne ref"}]}
err,sites=run(c.async_check(h,"x","k",False))
chk("Sites gelesen, Duplikate/ohne Bezeichnung verworfen", err is None and sites==[{"site":"default","name":"Default"},{"site":"x7k2","name":"Ferienhaus"}])
SITES["v"]="bad"; chk("Antwort ohne JSON -> Erfolg, keine Sites", run(c.async_check(h,"x","k",False))==(None,[]))
chk("unique_id: default = Host", c.unique_id_for("Unifi.LOCAL","default")=="unifi.local" and c.unique_id_for("h","x7k2")=="h/x7k2")
chk("Titel mit Site", c.default_title("h","x7k2","Ferienhaus")=="UniFi h · Ferienhaus" and c.default_title("h")=="UniFi h")
s1=E("s1","10.0.0.20","K"); s1.data["site"]="x7k2"; s1.data["site_name"]="Ferienhaus"; s1.title="UniFi 10.0.0.20 · Ferienhaus"; s1.unique_id="10.0.0.20/x7k2"
h2=H([s1, E("d","10.0.0.20","K")])
chk("gleicher Host, andere Site: nicht belegt", not c.host_taken(h2,"10.0.0.20","new","beta") and c.host_taken(h2,"10.0.0.20","new","x7k2") and c.host_taken(h2,"10.0.0.20","new","default"))
SITES["v"]={"data":[{"internalReference":"default","name":"Default"}]}
chk("Panel: neuer Host ohne die Site -> site_not_found, nichts gespeichert", run(c.async_apply(h2,s1,"10.0.0.30",None,False))=="site_not_found" and not h2.config_entries.updates)
SITES["v"]={"data":[{"internalReference":"default","name":"Default"},{"internalReference":"x7k2","name":"Ferienhaus"}]}
chk("Panel: neuer Host mit der Site -> ok, Site bleibt, Titel mitgezogen", run(c.async_apply(h2,s1,"10.0.0.31",None,False)) is None and s1.data["site"]=="x7k2" and s1.unique_id=="10.0.0.31/x7k2" and s1.title=="UniFi 10.0.0.31 · Ferienhaus")
print("ALL PASS" if ok else "SOME FAILED")
