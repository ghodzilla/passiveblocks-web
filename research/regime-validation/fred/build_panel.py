#!/usr/bin/env python3
"""Reconstruct as-of (vintage = decision date - 1 calendar day) panel from ALFRED real-time intervals.
asof(series, V) = observations with rt_start <= V <= rt_end, date <= V, value != '.'"""
import json,datetime as dt,hashlib,glob,os
MIN={"WALCL":156+13,"WTREGEN":156+13,"RRPONTSYD":None,"DFEDTARU":None,"DGS2":252,"BAMLH0A0HYM2":252}
FULL={"DGS2":756,"BAMLH0A0HYM2":756}
def load(sid):
    rows=[json.loads(l) for l in open(f"intervals_{sid}.jsonl")]
    return [r for r in rows if r["value"]!="."]
def asof(rows,V):
    d={}
    for r in rows:
        if r["rt_start"]<=V<=r["rt_end"] and r["date"]<=V: d[r["date"]]=float(r["value"])
    return d
def dates():
    d=dt.date(2024,10,18);e=dt.date(2026,11,6)
    while d<=e:
        if d.weekday()<5: yield d
        d+=dt.timedelta(1)
if __name__=="__main__":
    meta={m["series_id"]:m for m in json.load(open("fetch_meta.json"))}
    S=[s for s in meta if meta[s]["rows"]]
    data={s:load(s) for s in S}
    viol={s:sum(1 for r in data[s] if r["date"]>r["rt_end"]) for s in S}
    out=open("panel_asof_summary.jsonl","w");man={s:dict(dates=0,empty=[],below_min=[],below_full=0,max_obs_after_vintage=0) for s in S}
    for D in dates():
        V=(D-dt.timedelta(1)).isoformat();rec={"decision":D.isoformat(),"vintage":V}
        for s in S:
            a=asof(data[s],V);ks=sorted(a);m=man[s];m["dates"]+=1
            if any(k>V for k in ks): m["max_obs_after_vintage"]+=1
            if not ks: m["empty"].append(D.isoformat()); rec[s]=None; continue
            rec[s]=dict(n=len(ks),first=ks[0],last=ks[-1],last_value=a[ks[-1]],lag_days=(dt.date.fromisoformat(V)-dt.date.fromisoformat(ks[-1])).days)
            if MIN.get(s) and len(ks)<MIN[s]: m["below_min"].append(D.isoformat())
            if FULL.get(s) and len(ks)<FULL[s]: m["below_full"]+=1
        out.write(json.dumps(rec)+"\n")
    out.close()
    files={f:dict(bytes=os.path.getsize(f),sha256=hashlib.sha256(open(f,"rb").read()).hexdigest()) for f in sorted(glob.glob("*.jsonl")+glob.glob("raw/*.json")+glob.glob("*.py")+["fetch_meta.json"])}
    for s in S:
        m=man[s];m["below_min_count"]=len(m["below_min"]);m["first_ok"]=None
        m["empty_count"]=len(m["empty"])
        m["mandatory"]=meta[s]["mandatory"];m["id_provenance"]=meta[s]["id_provenance"];m["interval_rows"]=len(data[s]);m["rows_date_after_rt_end"]=viol[s]
        m["below_min"]=m["below_min"][:3]+(["..."] if len(m["below_min"])>3 else [])+m["below_min"][-2:]
        m["empty"]=m["empty"][:5]
    json.dump(dict(generated_utc=dt.datetime.now(dt.timezone.utc).isoformat(),rule="vintage = decision - 1 calendar day; decision dates = weekdays (exchange holidays NOT removed)",
      min_obs=MIN,full_obs=FULL,series=man,missing_series=[s for s in meta if not meta[s]["rows"]],not_fetched={"DGS10":"not named in PROTOCOL.md/run-availability.ts; not fetched"},files=files),open("manifest.json","w"),indent=1)
    print(json.dumps({s:{k:man[s][k] for k in ("dates","empty_count","below_min_count","below_full","max_obs_after_vintage")} for s in S}))
