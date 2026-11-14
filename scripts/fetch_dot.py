"""Fetch IMF DOTS annual bilateral goods trade (via DBnomics mirror) for partners CN/US/EU/World."""
import json, urllib.request, urllib.parse, csv, time, pathlib
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "raw"
dims = {"FREQ": ["A"], "INDICATOR": ["TXG_FOB_USD", "TMG_CIF_USD"],
        "COUNTERPART_AREA": ["CN", "US", "B0", "W00", "HK"]}
rows, offset = [], 0
while True:
    q = urllib.parse.urlencode({"dimensions": json.dumps(dims), "observations": 1, "limit": 1000, "offset": offset})
    d = json.load(urllib.request.urlopen(f"https://api.db.nomics.world/v22/series/IMF/DOT?{q}", timeout=60))
    docs = d["series"]["docs"]
    for s in docs:
        dv = s["dimensions"]
        for p, v in zip(s["period"], s["value"]):
            if v != "NA" and v is not None:
                rows.append([dv["REF_AREA"], dv["INDICATOR"], dv["COUNTERPART_AREA"], p, v])
    offset += len(docs)
    print(offset, "/", d["series"]["num_found"])
    if not docs or offset >= d["series"]["num_found"]:
        break
    time.sleep(0.5)
with open(OUT / "dot_annual.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["reporter", "indicator", "partner", "year", "usd_mn"]); w.writerows(rows)
print("rows", len(rows))
