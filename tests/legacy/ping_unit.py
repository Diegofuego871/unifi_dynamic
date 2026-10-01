"""Stub-basierter Test (ohne Home Assistant), siehe tests/test_legacy.py."""
import os
from pathlib import Path
R = str(Path(__file__).resolve().parents[2] / "custom_components" / "unifi_dynamic")
import asyncio, sys, types, importlib.util, time
for m in ["homeassistant","homeassistant.core","homeassistant.helpers","homeassistant.helpers.event","homeassistant.helpers.storage","homeassistant.config_entries"]:
    sys.modules[m]=types.ModuleType(m)
sys.modules["homeassistant.core"].HomeAssistant=object
sys.modules["homeassistant.core"].callback=lambda f: f
TICKS=[]
sys.modules["homeassistant.helpers.event"].async_track_time_interval=lambda hass, fn, iv, name=None: (TICKS.append(iv), (lambda: None))[1]
class Store:
    DATA={}
    def __init__(s,hass,v,key): s.key=key
    async def async_load(s): return Store.DATA.get(s.key)
    async def async_save(s,d): Store.DATA[s.key]=d
    def async_delay_save(s,fn,delay): Store.DATA[s.key]=fn()
sys.modules["homeassistant.helpers.storage"].Store=Store
pkg=types.ModuleType("cc"); pkg.__path__=[R]; sys.modules["cc"]=pkg
spec=importlib.util.spec_from_file_location("cc.const",R+"/const.py"); const=importlib.util.module_from_spec(spec); sys.modules["cc.const"]=const; spec.loader.exec_module(const)
oa=types.ModuleType("cc.options_api"); oa.PING_INTERVAL_RANGE=(30,3600); sys.modules["cc.options_api"]=oa
spec=importlib.util.spec_from_file_location("cc.ping",R+"/ping.py"); P=importlib.util.module_from_spec(spec); sys.modules["cc.ping"]=P; spec.loader.exec_module(P)
# icmplib-Stub
icmp=types.ModuleType("icmplib")
class SocketPermissionError(Exception): pass
icmp.SocketPermissionError=SocketPermissionError
MODE={"perm":"unpriv"}
async def async_ping(addr,count,timeout,privileged):
    if MODE["perm"]=="none" or (MODE["perm"]=="priv" and not privileged): raise SocketPermissionError()
icmp.async_ping=async_ping
class Host:
    def __init__(s,a,rtts,sent): s.address=a; s.rtts=rtts; s.packets_sent=sent; s.packets_received=len(rtts)
REPLY={}
CALLS=[]
async def async_multiping(addrs,count,interval,timeout,concurrent_tasks,privileged):
    CALLS.append((list(addrs),privileged)); return [Host(a,REPLY.get(a,[]),count) for a in addrs]
icmp.async_multiping=async_multiping
sys.modules["icmplib"]=icmp
ok=True
def chk(l,v,info=""):
    global ok; ok&=bool(v); print(("PASS " if v else "FAIL ")+l+(f" - {info}" if info and not v else ""))
chk("jitter", P.jitter([10,12,11]) == 1.5 and P.jitter([5]) is None)
b=P.bucket_from([10,30,20],3,3,1000.4); chk("bucket", b==[1000,20,15.0,3,3], b)
s=P.summarize([[0,10,1,3,3],[300,30,3,3,0+2],[600,None,None,3,0]]); chk("summary median/loss", s["median"]==20 and s["jitter"]==2 and s["loss"]==round((1-5/9)*100,1) and s["status"]=="ok", s)
chk("summary no reply", P.summarize([[0,None,None,3,0]])["status"]=="no_reply")
chk("summary empty", P.summarize([]) is None)
class Entry:
    def __init__(s,opts): s.options=opts; s.entry_id="e1"
class Coord:
    def __init__(s,e): s.entry=e; s.rows=[]
    def panel_clients(s): return s.rows
class Hass:
    def async_create_background_task(s,coro,name): asyncio.get_event_loop().create_task(coro)
async def main():
    e=Entry({"ping_enabled":False}); c=Coord(e); m=P.PingMonitor(Hass(),c); await m.async_start()
    chk("aus: status disabled, keine Runde", m.status=="disabled" and not TICKS)
    e.options={"ping_enabled":True,"ping_interval":10,"ping_entities":["AA:bb:cc:dd:ee:01"]}
    chk("Intervall auf Minimum geklemmt", P.ping_interval(e)==30)
    MODE["perm"]="none"; m=P.PingMonitor(Hass(),c); await m.async_start()
    chk("ohne Rechte: permission, kein Timer", m.status=="permission" and not TICKS)
    MODE["perm"]="priv"; m=P.PingMonitor(Hass(),c); 
    c.rows=[{"mac":"aa:bb:cc:dd:ee:01","ip":"10.0.0.1","online":True},{"mac":"aa:bb:cc:dd:ee:02","ip":"10.0.0.2","online":True},
            {"mac":"aa:bb:cc:dd:ee:03","ip":"10.0.0.3","online":False},{"mac":"aa:bb:cc:dd:ee:04","ip":None,"online":True}]
    REPLY.update({"10.0.0.1":[4.0,6.0,5.0]})
    await m.async_start(); await asyncio.sleep(0.01)
    chk("privilegiert erkannt, Timer 30s", m.status=="ok" and m._privileged is True and TICKS and TICKS[-1].total_seconds()==30, TICKS)
    chk("nur online mit IP gepingt", CALLS and sorted(CALLS[-1][0])==["10.0.0.1","10.0.0.2"], CALLS)
    l1=m.last("aa:bb:cc:dd:ee:01"); l2=m.last("aa:bb:cc:dd:ee:02")
    chk("letzte Runde: Median 5, Verlust 0; stumm: Verlust 100", l1["median"]==5.0 and l1["loss"]==0 and l2["median"] is None and l2["loss"]==100, (l1,l2))
    chk("Offline-Client ohne Wert", m.last("aa:bb:cc:dd:ee:03") is None)
    hits=[]; unsub=m.async_add_listener(lambda: hits.append(1))
    await m._async_round(); chk("Listener: kein Aufruf ohne Blockwechsel", hits==[] and m.entity_values("aa:bb:cc:dd:ee:01") is None, hits)
    # Entitäten: nur abgeschlossene 5-Minuten-Blöcke
    E=P.PingMonitor(Hass(),c); E.status="ok"; mac="aa:bb:cc:dd:ee:01"; ipm={"10.0.0.1":[mac]}
    B=(int(time.time())//300)*300 - 3000
    E._record(ipm,{"10.0.0.1":Host("10.0.0.1",[4.0,6.0],3)},B+10); chk("E: erster Block offen -> kein Wert", E._update_entities(B+10) is False and E.entity_values(mac) is None)
    E._record(ipm,{"10.0.0.1":Host("10.0.0.1",[8.0,8.0,8.0],3)},B+70); chk("E: gleicher Block -> keine Änderung", E._update_entities(B+70) is False)
    E._record(ipm,{"10.0.0.1":Host("10.0.0.1",[20.0,20.0,20.0],3)},B+310); ch=E._update_entities(B+310); v=E.entity_values(mac)
    chk("E: Blockwechsel -> Median 8.0 des alten Blocks, Verlust 1/6", ch and v["median"]==8.0 and v["loss"]==round(1/6*100,1) and v["ip"]=="10.0.0.1", v)
    E._record(ipm,{"10.0.0.1":Host("10.0.0.1",[30.0]*3,3)},B+360); chk("E: Runde im Block ändert nichts", E._update_entities(B+360) is False and E.entity_values(mac)["median"]==8.0)
    E._record({}, {}, B+620); ch=E._update_entities(B+620)
    chk("E: offline -> unbekannt, Block trotzdem abgeschlossen", ch and E.entity_values(mac) is None and E._buckets[mac][-1][1]==25.0 and mac not in E._open, E._buckets[mac])
    E._record(ipm,{"10.0.0.1":Host("10.0.0.1",[7.0]*3,3)},B+3000); chk("E: nach langer Pause kein alter Wert", E._update_entities(B+3000) is False and E.entity_values(mac) is None)
    # Neustart: offener Block aus dem Speicher wird in der ersten Runde abgeschlossen
    R2=P.PingMonitor(Hass(),c); R2.status="ok"; R2._load({"buckets":{},"hourly":{},"open":{mac:[B,[5.0,5.0],2,2]},"open_hours":{}},B+100)
    R2._record(ipm,{"10.0.0.1":Host("10.0.0.1",[9.0]*3,3)},B+320); chk("Neustart: Wert nach erster Runde", R2._update_entities(B+320) and R2.entity_values(mac)["median"]==5.0, R2.entity_values(mac))
    s1=m.summary("aa:bb:cc:dd:ee:01"); s2=m.summary("aa:bb:cc:dd:ee:02")
    chk("24h: ok / antwortet nicht", s1["status"]=="ok" and s1["median"]==5.0 and s2["status"]=="no_reply" and s2["loss"]==100, (s1,s2))
    # Blockwechsel und Speicher
    now=time.time(); m._record({"10.0.0.1":["aa:bb:cc:dd:ee:01"]},{"10.0.0.1":Host("10.0.0.1",[9.0,9.0,9.0],3)},now+400)
    h=m.history("aa:bb:cc:dd:ee:01"); chk("neuer 5-Min-Block", len(h)==2 and h[-1][1]==9.0, h)
    d=Store.DATA["unifi_dynamic_e1_ping"]; chk("gespeichert: abgeschlossener + laufender Block getrennt", len(d["buckets"]["aa:bb:cc:dd:ee:01"])==1 and "aa:bb:cc:dd:ee:01" in d["open"] and ("aa:bb:cc:dd:ee:01" in d["open_hours"] or "aa:bb:cc:dd:ee:01" in d["hourly"]), d)
    chk("nicht mehr gepingt -> letzte Runde weg", m.last("aa:bb:cc:dd:ee:02") is None)
    # Alte Blöcke fallen nach 24h raus
    m._buckets["aa:bb:cc:dd:ee:09"]=[[now-90000,1,1,3,3]]; m._prune(now); chk("24h-Grenze", "aa:bb:cc:dd:ee:09" not in m._buckets)
    # Neustart lädt Verlauf
    m2=P.PingMonitor(Hass(),c); await m2.async_start(); await asyncio.sleep(0.01)
    chk("Neustart: Verlauf geladen", len(m2.history("aa:bb:cc:dd:ee:01"))>=2)
    await m2.async_stop()
    # --- Stunden-Blöcke und Zeiträume
    m3=P.PingMonitor(Hass(),c); m3.status="ok"
    t0=(int(time.time())//3600)*3600 - 3*3600  # vor 3 Stunden, volle Stunde
    ip={"10.0.0.1":["aa:bb:cc:dd:ee:01"]}
    for k in range(0, 3*12+2):   # alle 5 Minuten, gut drei Stunden
        ts=t0+k*300+10
        m3._record(ip,{"10.0.0.1":Host("10.0.0.1",[float(10+k%3)]*3,3)},ts)
    h24=m3.history("aa:bb:cc:dd:ee:01","24h"); h7=m3.history("aa:bb:cc:dd:ee:01","7d")
    chk("24h: 5-Minuten-Blöcke", len(h24)==38 and all(b[0]%300==0 for b in h24), len(h24))
    chk("7d: Stunden-Blöcke inkl. laufender Stunde", [b[0]-t0 for b in h7]==[0,3600,7200,10800] and all(b[3]>0 for b in h7), [b[0]-t0 for b in h7])
    chk("Stunde: Median der Block-Mediane, Summe gesendet", h7[0][1]==11 and h7[0][3]==36, h7[0])
    s7=m3.summary("aa:bb:cc:dd:ee:01","7d"); chk("Zusammenfassung 7d", s7["median"]==11 and s7["loss"]==0, s7)
    # Speichern/Laden ohne Doppelungen
    data=m3._store_data(); m4=P.PingMonitor(Hass(),c); m4._load(data,time.time())
    chk("Laden: gleiche Stunden, laufende Stunde weiter", [b[0] for b in m4.history("aa:bb:cc:dd:ee:01","7d")]==[b[0] for b in h7])
    # 30 Tage: alte Stunden, 31-Tage-Grenze
    m4._hourly["aa:bb:cc:dd:ee:01"].insert(0,[t0-20*86400,50,2,36,30]); m4._hourly["aa:bb:cc:dd:ee:01"].insert(0,[t0-40*86400,50,2,36,36])
    m4._prune(time.time())
    chk("30d enthält 20 Tage alt, 7d nicht; 40 Tage verworfen", any(b[0]==t0-20*86400 for b in m4.history("aa:bb:cc:dd:ee:01","30d")) and not any(b[0]==t0-20*86400 for b in m4.history("aa:bb:cc:dd:ee:01","7d")) and not any(b[0]==t0-40*86400 for b in m4._hourly["aa:bb:cc:dd:ee:01"]))
    # Migration aus 2.14.0/2.14.1 (nur buckets)
    old={"buckets":{"aa:bb:cc:dd:ee:05":[[t0,5,1,3,3],[t0+300,7,1,3,3],[t0+3600,9,1,3,3]]}}
    m5=P.PingMonitor(Hass(),c); m5._load(old,time.time())
    h=m5.history("aa:bb:cc:dd:ee:05","7d"); chk("Migration: Stunden aus alten Blöcken", [b[0]-t0 for b in h]==[0,3600] and h[0][1]==6 and h[0][3]==6, h)

    # 2.16.0: Client seit 10 Tagen nicht mehr gepingt -> keine Stunde ausserhalb von 7 Tagen
    m6=P.PingMonitor(Hass(),c); m6.status="ok"; now6=time.time(); t6=now6-10*86400
    m6._record({"10.0.0.9":["aa:bb:cc:dd:ee:09"]},{"10.0.0.9":Host("10.0.0.9",[4.0]*3,3)},t6)
    m6._record({}, {}, now6)
    chk("10 Tage nicht gepingt: 7 Tage leer, 30 Tage mit einer Stunde", m6.history("aa:bb:cc:dd:ee:09","7d")==[] and len(m6.history("aa:bb:cc:dd:ee:09","30d"))==1, (m6.history("aa:bb:cc:dd:ee:09","7d"), m6._open_hour))

asyncio.run(main())
print("ALL PASS" if ok else "SOME FAILED")
