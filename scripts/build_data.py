"""Build compact JSON for the web page from processed country-year table + geo."""
import json, pathlib, pandas as pd, numpy as np
R = pathlib.Path(__file__).resolve().parent.parent
D = R / "data"
t = pd.read_csv(D/"proc/country_year.csv")
pop = pd.DataFrame([{"iso3": r["countryiso3code"], "year": int(r["date"]), "pop": r["value"]}
                    for r in json.load(open(D/"raw/wb_pop.json"))[1] if r["value"]])
t = t.merge(pop, on=["iso3","year"], how="left")
# Scope: sovereign economies with population >= 1 million (drops micro-states/territories such as
# Marshall Islands whose ship-registry trade distorts ratios); exclude China's SARs and the US itself.
p23 = pop[pop.year==2023].set_index("iso3")["pop"]
big = set(p23[p23 >= 1e6].index)
t = t[t.iso3.isin(big) & ~t.iso3.isin(["HKG","MAC","USA"])]
t.to_csv(D/"proc/country_year_scoped.csv", index=False)
x = t[~t.eu_member]
years = list(range(1995, 2025))
counts = {k: [int(((x.year==y)&(x.top==k)).sum()) for y in years] for k in ["China","EU","USA"]}
cnus = [int(((x.year==y)&(x.top_cnus=="China")).sum()) for y in years]
ntot = [int((x.year==y).sum()) for y in years]
code = {"China":"C","USA":"U","EU":"E"}
countries = {}
for iso, g in t.groupby("iso3"):
    g = g.set_index("year")
    countries[iso] = {
        "n": g.name.iloc[0], "r": g.region.iloc[0], "eu": bool(g.eu_member.iloc[0]),
        "top": "".join(code[g.top[y]] if y in g.index else "-" for y in years),
        "cg": [None if (y not in g.index or pd.isna(g.cn_gdp[y])) else round(float(g.cn_gdp[y]),4) for y in years],
        "cs": [None if y not in g.index or pd.isna(g.cn_share[y]) else round(float(g.cn_share[y]),4) for y in years],
        "ug": [None if (y not in g.index or pd.isna(g.us_gdp[y])) else round(float(g.us_gdp[y]),4) for y in years],
    }
y = x[x.year==2023].dropna(subset=["cn_gdp"]); c = y[y.top=="China"]; u = y[y.top=="USA"]
stats = {"n_cn_2023": int(len(c)), "med_cn_gdp": float(c.cn_gdp.median()), "share_lt10": float((c.cn_gdp<0.10).mean()),
         "med_cn_share": float(c.cn_share.median()), "n_us_2023": int(len(u)), "med_us_gdp": float(u.us_gdp.median()),
         "n_cn_gt20": int((c.cn_gdp>0.20).sum())}
print(json.dumps(stats, indent=1)); print({k: (v[0], v[5], v[15], v[25], v[28], v[29]) for k, v in counts.items()}, "cnus", cnus[5], cnus[29])
print("deep (>20%):", c[c.cn_gdp>0.2].sort_values("cn_gdp",ascending=False)[["name","cn_gdp"]].to_string())
json.dump({"years": years, "counts": counts, "cnus": cnus, "ntot": ntot, "countries": countries, "stats": stats},
          open(R/"web/public/data.json","w"), separators=(",",":"))
# geo: keep ADM0_A3 + rounded coords
geo = json.load(open(D/"raw/ne_110m.geojson", encoding="utf-8"))
def rnd(c): return [rnd(v) for v in c] if isinstance(c[0], list) else [round(c[0],2), round(c[1],2)]
feats = [{"type":"Feature","id":f["properties"]["ADM0_A3"].replace("SDS","SSD").replace("KOS","XKX"),
          "properties":{"zh": f["properties"].get("NAME_ZH")}, "geometry":{"type":f["geometry"]["type"],"coordinates":rnd(f["geometry"]["coordinates"])}}
         for f in geo["features"] if f["properties"]["ADM0_A3"] != "ATA"]
json.dump({"type":"FeatureCollection","features":feats}, open(R/"web/public/world.json","w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))
missing = sorted(set(countries) - {f["id"] for f in feats}); print("no shape:", missing)
