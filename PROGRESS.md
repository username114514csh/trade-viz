# PROGRESS — 经济学可视化大作业（广度与深度）

- 题目：中国赢得了世界贸易的广度，赢得深度了吗？结论「广而不深」
- 网页：D:/trade-viz/web（Vite+D3+Scrollama），`npm run build` → web/dist
- 交付物：D:/trade-viz/deliver（GIF、screens 6 张、作品说明.md 199 字、source.zip、dataset/）
- 脚本：scripts/analyze.py → build_data.py → shots.py（截图）、record_hero_gif.py（录首页地球 GIF：`COLORS=96 python scripts/record_hero_gif.py "http://localhost:4173/?speed=300" out.gif 10 10.5 640`）
- 已知坑：Vite 生产构建丢 d3-transition 副作用，地图用 CSS transition 代替
- 已部署 2026-11-14：https://username114514csh.github.io/trade-viz/（gh-pages 分支 = web/dist；源码 main）。更新网页：cd web && npm run build，再把 dist 强推到 gh-pages（令牌 ~/.ai-keys/github_token，12-14 过期）
- 待办：去雨课堂确认提交入口和截止时间
