# 广度与深度：中国如何成为世界的头号贸易伙伴

经济数据可视化期末作品。滚动叙事网页，回答「中国赢得了世界贸易的广度，赢得深度了吗？」

## 复现
```bash
# 1. 数据（可选，data/raw 已包含原始数据）
python scripts/fetch_dot.py        # IMF DOTS via DBnomics
python scripts/analyze.py          # -> data/proc/country_year.csv
python scripts/build_data.py       # -> web/public/data.json, world.json
# 2. 网页
cd web && npm install && npm run dev      # 开发
npm run build                             # 产出 web/dist，可直接部署为静态网站
```
世界银行 GDP/人口：`https://api.worldbank.org/v2/country/all/indicator/{NY.GDP.MKTP.CD|SP.POP.TOTL}?format=json&per_page=20000`；
地图：Natural Earth 1:110m。

## 口径
贸易额 = 出口(FOB) + 进口(CIF)，各国报告值；头号伙伴只在中国（不含港澳）、美国、欧盟 27 国三方中比较；样本为 2023 年人口 ≥100 万的经济体，欧盟成员国不计入计数。
