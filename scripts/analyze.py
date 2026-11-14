"""Per country-year: top partner among CN/US/EU (total goods trade), China share, China trade/GDP."""
import json, pathlib, pandas as pd
R = pathlib.Path(__file__).resolve().parent.parent / "data"
d = pd.read_csv(R/"raw/dot_annual.csv")
d = d[d.reporter.str.fullmatch(r"[A-Z]{2}")]          # drop aggregates like 1C_080
t = d.groupby(["reporter","partner","year"]).usd_mn.sum().unstack("partner").reset_index()
wbc = json.load(open(R/"raw/wb_countries.json"))[1]
iso = {c["iso2Code"]: c for c in wbc if c["region"]["value"] != "Aggregates"}
t = t[t.reporter.isin(iso)]
g = pd.DataFrame([{"reporter": r["country"]["id"], "year": int(r["date"]), "gdp": r["value"]}
                  for r in json.load(open(R/"raw/wb_gdp.json"))[1] if r["value"]])
EU = set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split())
t = t.merge(g, on=["reporter","year"], how="left")
t["region"] = t.reporter.map(lambda c: iso[c]["region"]["value"])
t["name"] = t.reporter.map(lambda c: iso[c]["name"])
t["iso3"] = t.reporter.map(lambda c: iso[c]["id"])
t["eu_member"] = t.reporter.isin(EU)
p = t[["CN","US","B0"]].fillna(0)
t["top"] = p.idxmax(axis=1).map({"CN":"China","US":"USA","B0":"EU"})
t["top_cnus"] = (p.CN > p.US).map({True:"China", False:"USA"})
t["cn_share"] = t.CN / t.W00
t["cn_gdp"] = t.CN*1e6 / t.gdp
t["us_gdp"] = t.US*1e6 / t.gdp
t = t[(t.year >= 1995) & (t.reporter != "CN") & t.W00.notna() & (t.W00 > 0)]
t.to_csv(R/"proc/country_year.csv", index=False)
x = t[~t.eu_member & ~t.reporter.isin(["US"])]
print("count top partner (non-EU reporters):")
print(x.pivot_table(index="year", columns="top", values="reporter", aggfunc="count").loc[[1995,2000,2005,2010,2015,2020,2023,2024]])
print("China>US count:", x.groupby("year").apply(lambda s: (s.top_cnus=="China").sum()).loc[[2000,2010,2020,2024]].to_dict())
y = x[x.year==2023].dropna(subset=["cn_gdp"])
c = y[y.top=="China"]
print("\n2023 China-top countries:", len(c), " median CN trade/GDP %.1f%%" % (100*c.cn_gdp.median()),
      " share <10%%: %.0f%%" % (100*(c.cn_gdp<0.10).mean()), " median CN share of trade %.0f%%" % (100*c.cn_share.median()))
u = y[y.top=="USA"]; print("USA-top:", len(u), " median US trade/GDP %.1f%%" % (100*u.us_gdp.median()))
print("\ndeepest China-dependence 2023:"); print(c.sort_values("cn_gdp", ascending=False)[["name","region","cn_gdp","cn_share"]].head(12).to_string())
print("\nby region 2023 (China-top count / median cn_gdp):"); print(c.groupby("region").agg(n=("name","count"), med=("cn_gdp","median")))
