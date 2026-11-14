import * as d3 from "d3";
import scrollama from "scrollama";
import "@fontsource/noto-serif-sc/700.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/700.css";
import "./style.css";

const C = { C: "#e8453c", U: "#4a8fe7", E: "#d9a93f", eum: "#4a3d1f", none: "#1b2130" };
const NAME = { C: "中国", U: "美国", E: "欧盟" };
const fmtTick = (v) => (v < 0.01 ? (v * 100).toFixed(1) + "%" : Math.round(v * 100) + "%");
const pct = (v, d = 1) => (v == null ? "—" : (v * 100).toFixed(d) + "%");
const params = new URLSearchParams(location.search);

const [data, world] = await Promise.all([
  fetch("./data.json").then((r) => r.json()),
  fetch("./world.json").then((r) => r.json()),
]);
const Y = data.years;
const yi = (y) => Y.indexOf(y);
const zh = {};
world.features.forEach((f) => (zh[f.id] = f.properties.zh));
const ZH_FIX = { USA: "美国", COD: "刚果（金）", COG: "刚果（布）", KOR: "韩国", LAO: "老挝", SGP: "新加坡", BHR: "巴林", MUS: "毛里求斯", PSE: "巴勒斯坦" };
const cname = (id) => ZH_FIX[id] || zh[id] || data.countries[id]?.n || id;

/* ---------- tooltip ---------- */
const tip = d3.select("#tooltip");
function showTip(ev, html) {
  tip.html(html).style("opacity", 1)
    .style("left", Math.min(ev.clientX + 14, innerWidth - 230) + "px")
    .style("top", ev.clientY + 14 + "px");
}
const hideTip = () => tip.style("opacity", 0);
function countryTip(id, i) {
  const c = data.countries[id];
  if (!c) return `<div class="tt-name">${cname(id)}</div><div>不在样本内</div>`;
  const t = c.top[i];
  return `<div class="tt-name">${cname(id)} · ${Y[i]}</div>
    <div>头号伙伴：${c.eu ? "欧盟成员国" : t === "-" ? "无数据" : `<b style="color:${C[t]}">${NAME[t]}</b>`}</div>
    <div>对华贸易占本国外贸：${pct(c.cs[i])}</div>
    <div>对华贸易占 GDP：${pct(c.cg[i])}</div>`;
}

/* ---------- 开场：地球 + 飞线 ---------- */
function globe() {
  const svg = d3.select("#globe");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const R = Math.min(W, H) * 0.4;
  const proj = d3.geoOrthographic().scale(R).translate([W / 2, H / 2]).clipAngle(90).rotate([-60, -18]);
  const path = d3.geoPath(proj);
  const defs = svg.append("defs");
  const g1 = defs.append("radialGradient").attr("id", "ocean").attr("cx", "40%").attr("cy", "35%");
  g1.append("stop").attr("offset", "0%").attr("stop-color", "#1d2a48");
  g1.append("stop").attr("offset", "100%").attr("stop-color", "#0c1222");
  const glow = defs.append("radialGradient").attr("id", "halo");
  glow.append("stop").attr("offset", "80%").attr("stop-color", "#3a5a9a").attr("stop-opacity", 0.25);
  glow.append("stop").attr("offset", "100%").attr("stop-color", "#3a5a9a").attr("stop-opacity", 0);
  svg.append("circle").attr("cx", W / 2).attr("cy", H / 2).attr("r", R * 1.12).attr("fill", "url(#halo)");
  svg.append("path").datum({ type: "Sphere" }).attr("fill", "url(#ocean)").attr("stroke", "#2c3a5c");
  const grat = svg.append("path").datum(d3.geoGraticule10()).attr("fill", "none").attr("stroke", "#1f2a44").attr("stroke-width", 0.5);
  const i24 = yi(2024);
  const land = svg.append("g").selectAll("path").data(world.features).join("path")
    .attr("fill", (f) => {
      const c = data.countries[f.id];
      if (f.id === "CHN") return "#7a2620";
      if (f.id === "USA") return "#1f3f6e";
      if (!c) return "#1e2638";
      if (c.eu) return "#4f4220";
      return "#273046";
    })
    .attr("stroke", "#0b0f17").attr("stroke-width", 0.4);
  const hubs = { C: [116.4, 39.9], U: [-77.0, 38.9], E: [4.35, 50.85] };
  const arcs = [];
  for (const f of world.features) {
    const c = data.countries[f.id];
    if (!c || c.eu) continue;
    const t = c.top[i24];
    if (!hubs[t]) continue;
    arcs.push({ t, a: hubs[t], b: d3.geoCentroid(f), delay: Math.random() });
  }
  const arcG = svg.append("g").attr("fill", "none").attr("stroke-linecap", "round");
  const arcSel = arcG.selectAll("path").data(arcs).join("path")
    .attr("stroke", (d) => C[d.t]).attr("stroke-width", (d) => (d.t === "C" ? 1.2 : 1));
  const hubSel = svg.append("g").selectAll("circle").data(Object.entries(hubs)).join("circle")
    .attr("r", 4).attr("fill", ([k]) => C[k]).attr("stroke", "#fff").attr("stroke-width", 1);

  function lifted(d, prog) {
    // raised great-circle arc; hidden where behind the globe
    const interp = d3.geoInterpolate(d.a, d.b);
    const dist = d3.geoDistance(d.a, d.b);
    const n = 40, pts = [];
    const center = proj.invert([W / 2, H / 2]);
    for (let k = 0; k <= n * prog; k++) {
      const s = k / n, p = interp(s);
      if (d3.geoDistance(p, center) > Math.PI / 2 - 0.05) { pts.push(null); continue; }
      const xy = proj(p), h = 1 + Math.sin(Math.PI * s) * Math.min(0.14, dist * 0.09);
      pts.push([W / 2 + (xy[0] - W / 2) * h, H / 2 + (xy[1] - H / 2) * h]);
    }
    return d3.line().defined((p) => p)(pts);
  }
  const t0 = performance.now();
  d3.timer((el) => {
    const r = proj.rotate();
    proj.rotate([r[0] + 0.12, r[1]]);
    land.attr("d", path); grat.attr("d", path);
    svg.select("path").attr("d", path);
    const time = (performance.now() - t0) / 1000;
    arcSel.attr("d", (d) => lifted(d, Math.max(0, Math.min(1, (time - 0.6 - d.delay * 2.5) / 1.4))))
      .attr("opacity", 0.7);
    hubSel.attr("cx", ([, p]) => proj(p)[0]).attr("cy", ([, p]) => proj(p)[1])
      .attr("display", ([, p]) => (d3.geoDistance(p, proj.invert([W / 2, H / 2])) > Math.PI / 2 ? "none" : null));
  });
}

/* ---------- 第一幕：广度地图 ---------- */
let curYear = 1995;
function drawMap(sel) {
  const svg = d3.select(sel);
  const W = svg.node().getBoundingClientRect().width, H = Math.round(W / 1.95);
  svg.attr("viewBox", `0 0 ${W} ${H}`);
  const proj = d3.geoNaturalEarth1().fitExtent([[0, 4], [W, H - 4]], { type: "Sphere" });
  const path = d3.geoPath(proj);
  svg.append("path").datum({ type: "Sphere" }).attr("d", path).attr("fill", "#0e1420").attr("stroke", "#1f2738");
  svg.append("path").datum(d3.geoGraticule10()).attr("d", path).attr("fill", "none").attr("stroke", "#161d2c");
  return svg.append("g").selectAll("path").data(world.features).join("path")
    .attr("class", "country").attr("d", path);
}
function fillBreadth(id, i) {
  if (id === "CHN") return "#ffffff22";
  const c = data.countries[id];
  if (!c) return C.none;
  if (c.eu) return C.eum;
  const t = c.top[i];
  return C[t] || C.none;
}
const breadthPaths = drawMap("#map")
  .on("mousemove", (ev, f) => showTip(ev, countryTip(f.id, yi(curYear))))
  .on("mouseleave", hideTip);
d3.select("#mapLegend").html(`<span><i class="sw cn"></i>中国</span><span><i class="sw us"></i>美国</span>
  <span><i class="sw eu"></i>欧盟</span><span><i class="sw eum"></i>欧盟成员国</span><span><i class="sw none"></i>无数据/不在样本</span>`);

// counts chart
const cc = (() => {
  const svg = d3.select("#countChart");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 18, r: 70, t: 10, b: 20 };
  const x = d3.scaleLinear([1995, 2024], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, 95], [H - m.b, m.t]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues([1995, 2000, 2005, 2010, 2015, 2020, 2024]).tickFormat(d3.format("d")).tickSize(3));
  const series = ["E", "U", "C"].map((k) => ({ k, v: data.counts[{ C: "China", U: "USA", E: "EU" }[k]] }));
  const line = d3.line().x((_, i) => x(Y[i])).y((d) => y(d)).curve(d3.curveMonotoneX);
  const clip = svg.append("clipPath").attr("id", "ccclip").append("rect").attr("x", 0).attr("y", 0).attr("height", H);
  const g = svg.append("g").attr("clip-path", "url(#ccclip)");
  g.selectAll("path").data(series).join("path").attr("fill", "none").attr("stroke", (d) => C[d.k]).attr("stroke-width", 2.5).attr("d", (d) => line(d.v));
  const dots = svg.selectAll(".cdot").data(series).join("g");
  dots.append("circle").attr("r", 4).attr("fill", (d) => C[d.k]);
  dots.append("text").attr("x", 8).attr("dy", "0.35em").attr("class", "lab").style("font-weight", 700).attr("fill", (d) => C[d.k]);
  return (yr) => {
    const i = yi(yr);
    clip.attr("width", x(yr) + 1);
    dots.attr("transform", (d) => `translate(${x(yr)},${y(d.v[i])})`);
    dots.select("text").text((d) => `${NAME[d.k]} ${d.v[i]}`).attr("fill", (d) => C[d.k]);
  };
})();

function setYear(yr, dur = 500) {
  curYear = yr;
  const i = yi(yr);
  d3.select("#yearLabel").text(yr);
  breadthPaths.style("transition", `fill ${dur}ms`).style("fill", (f) => fillBreadth(f.id, i));
  cc(yr);
}
setYear(1995, 0);

let playing = null;
function play() {
  if (playing) { playing.stop(); playing = null; d3.select("#playBtn").text("▶ 播放"); return; }
  d3.select("#playBtn").text("❚❚ 暂停");
  let yr = curYear >= 2024 ? 1995 : curYear;
  setYear(yr, 0);
  const speed = +(params.get("speed") || 330);
  playing = d3.interval(() => {
    yr += 1;
    if (yr > 2024) {
      if (params.has("loop")) { yr = 1995; setYear(yr, 0); return; }
      playing.stop(); playing = null; d3.select("#playBtn").text("▶ 重播"); return;
    }
    setYear(yr, speed * 0.8);
  }, speed);
}
d3.select("#playBtn").on("click", play);

/* ---------- 第二幕：深度 ---------- */
const I23 = yi(2023);
const depthBins = [0.05, 0.1, 0.2];
const depthCol = d3.scaleThreshold(depthBins, ["#5c2724", "#9a332b", "#dc4b3a", "#ffa07a"]);
drawMap("#depthMap")
  .attr("fill", (f) => {
    if (f.id === "CHN") return "#ffffff22";
    const c = data.countries[f.id];
    if (!c) return C.none;
    if (c.eu) return "#241f15";
    if (c.top[I23] !== "C" || c.cg[I23] == null) return "#222938";
    return depthCol(c.cg[I23]);
  })
  .on("mousemove", (ev, f) => showTip(ev, countryTip(f.id, I23)))
  .on("mouseleave", hideTip);
d3.select("#depthLegend").html(`<span style="color:var(--ink)">对华贸易占 GDP（2023，仅头号伙伴为中国的国家）：</span>` +
  ["&lt;5%", "5–10%", "10–20%", "≥20%"].map((t, k) => `<span><i class="sw" style="background:${depthCol.range()[k]}"></i>${t}</span>`).join("") +
  `<span><i class="sw" style="background:#222938"></i>头号伙伴非中国</span>`);

// rows for 2023
const rows23 = Object.entries(data.countries)
  .filter(([, c]) => !c.eu && c.cg[I23] != null)
  .map(([id, c]) => ({ id, t: c.top[I23], cg: c.cg[I23], cs: c.cs[I23], ug: c.ug[I23] }));

function strip() {
  const svg = d3.select("#strip");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 30, r: 30, t: 70, b: 50 };
  const x = d3.scaleLog([0.02, 1], [m.l, W - m.r]).clamp(true);
  const rowsY = { C: m.t + (H - m.t - m.b) * 0.28, U: m.t + (H - m.t - m.b) * 0.78 };
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(0,${H - m.b})`)
    .call(d3.axisBottom(x).tickValues([0.02, 0.05, 0.1, 0.2, 0.5, 1]).tickFormat(fmtTick).tickSize(-(H - m.t - m.b)));
  svg.append("text").attr("class", "lab dim").attr("x", W - m.r).attr("y", H - 12).attr("text-anchor", "end").text("与头号伙伴的贸易额 ÷ 本国 GDP（2023，对数刻度）→");
  const pts = [
    ...rows23.filter((d) => d.t === "C").map((d) => ({ ...d, k: "C", v: d.cg })),
    ...rows23.filter((d) => d.t === "U" && d.ug != null).map((d) => ({ ...d, k: "U", v: d.ug })),
  ];
  pts.forEach((p) => { p.x = x(p.v); p.y = rowsY[p.k]; });
  const sim = d3.forceSimulation(pts).force("x", d3.forceX((d) => x(d.v)).strength(1))
    .force("y", d3.forceY((d) => rowsY[d.k]).strength(0.08)).force("c", d3.forceCollide(7.5)).stop();
  for (let k = 0; k < 200; k++) sim.tick();
  for (const k of ["C", "U"]) {
    const vs = pts.filter((p) => p.k === k).map((p) => p.v);
    const med = d3.median(vs), mx = x(med);
    svg.append("line").attr("x1", mx).attr("x2", mx).attr("y1", rowsY[k] - 62).attr("y2", rowsY[k] + 62).attr("stroke", C[k]).attr("stroke-width", 2).attr("stroke-dasharray", "4 3");
    svg.append("text").attr("class", "anno").attr("x", mx + 6).attr("y", rowsY[k] - 50).attr("fill", C[k]).style("fill", C[k]).text(`中位数 ${pct(med)}`);
    svg.append("text").attr("class", "anno").attr("x", m.l).attr("y", rowsY[k] - 70)
      .text(k === "C" ? `头号伙伴是中国的 ${vs.length} 国：对华贸易 / GDP` : `头号伙伴是美国的 ${vs.length} 国：对美贸易 / GDP`);
  }
  svg.append("line").attr("x1", x(0.1)).attr("x2", x(0.1)).attr("y1", m.t - 20).attr("y2", H - m.b).attr("stroke", "#ece6d855").attr("stroke-width", 1);
  svg.append("text").attr("class", "lab dim").attr("x", x(0.1) - 6).attr("y", m.t - 26).attr("text-anchor", "end").text("← 10% 以下：一半以上的「中国伙伴」");
  svg.selectAll(".sdot").data(pts).join("circle").attr("cx", (d) => d.x).attr("cy", (d) => d.y).attr("r", 6.5)
    .attr("fill", (d) => C[d.k]).attr("fill-opacity", 0.85).attr("stroke", "#0b0f17")
    .on("mousemove", (ev, d) => showTip(ev, `<div class="tt-name">${cname(d.id)}</div>${d.k === "C" ? "对华" : "对美"}贸易占 GDP：${pct(d.v)}`))
    .on("mouseleave", hideTip);
  const lab = { MNG: -1, VNM: 1, BRA: -1, JPN: 1, MEX: 1, CAN: -1, AUS: 1, KHM: -1 };
  svg.selectAll(".slab").data(pts.filter((p) => lab[p.id])).join("g").each(function (d) {
    const up = lab[d.id] < 0, ly = up ? rowsY[d.k] - 34 : rowsY[d.k] + 40;
    const g = d3.select(this);
    g.append("line").attr("x1", d.x).attr("x2", d.x).attr("y1", d.y + (up ? -7 : 7)).attr("y2", ly + (up ? 4 : -12)).attr("stroke", "#a9a493").attr("stroke-width", 0.8);
    g.append("text").attr("class", "lab").attr("x", d.x).attr("y", ly).attr("text-anchor", "middle").text(cname(d.id));
  });
}

function scatter() {
  const svg = d3.select("#scatter");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 60, r: 30, t: 30, b: 50 };
  const x = d3.scaleLinear([0, 0.65], [m.l, W - m.r]);
  const y = d3.scaleLog([0.004, 1], [H - m.b, m.t]).clamp(true);
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(7, ".0%").tickSize(-(H - m.t - m.b)));
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues([0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]).tickFormat(fmtTick).tickSize(-(W - m.l - m.r)));
  svg.append("text").attr("class", "lab dim").attr("x", W - m.r).attr("y", H - 12).attr("text-anchor", "end").text("广度：对华贸易占本国外贸比重 →");
  svg.append("text").attr("class", "lab dim").attr("x", m.l + 6).attr("y", m.t - 10).text("↑ 深度：对华贸易占 GDP（对数）");
  // quadrant shading
  svg.append("rect").attr("x", x(0.2)).attr("y", y(1)).attr("width", x(0.65) - x(0.2)).attr("height", y(0.15) - y(1)).attr("fill", "#e8453c10");
  svg.append("text").attr("class", "anno").attr("x", x(0.21)).attr("y", y(0.85)).attr("text-anchor", "start").style("fill", "#ff8a7a").text("既广又深");
  svg.append("rect").attr("x", x(0.2)).attr("y", y(0.15)).attr("width", x(0.65) - x(0.2)).attr("height", y(0.004) - y(0.15)).attr("fill", "#ffffff06");
  svg.append("text").attr("class", "anno").attr("x", x(0.64)).attr("y", y(0.006)).attr("text-anchor", "end").style("fill", "#a9a493").text("份额高，依赖浅");
  const pts = rows23.filter((d) => d.cs > 0 && d.cg > 0.004 && d.t !== "-");
  svg.selectAll(".pdot").data(pts).join("circle").attr("cx", (d) => x(d.cs)).attr("cy", (d) => y(d.cg)).attr("r", 6)
    .attr("fill", (d) => C[d.t]).attr("fill-opacity", (d) => (d.t === "C" ? 0.9 : 0.55)).attr("stroke", "#0b0f17")
    .on("mousemove", (ev, d) => showTip(ev, `<div class="tt-name">${cname(d.id)}</div>头号伙伴：${NAME[d.t]}<br>对华贸易占外贸：${pct(d.cs)}<br>对华贸易占 GDP：${pct(d.cg)}`))
    .on("mouseleave", hideTip);
  const lab = ["MNG", "VNM", "BRA", "JPN", "MYS", "AUS", "CHL", "KOR", "IND", "MEX", "USA", "KGZ", "IDN", "RUS", "SAU", "COD", "TKM", "SGP"];
  const off = { SGP: [-9, 4, "end"], RUS: [9, 16], AUS: [9, -4], MNG: [-9, 4, "end"], IDN: [9, 8], SAU: [9, 8], JPN: [9, 6] };
  svg.selectAll(".plab").data(pts.filter((p) => lab.includes(p.id))).join("text").attr("class", "lab")
    .attr("x", (d) => x(d.cs) + (off[d.id]?.[0] ?? 9)).attr("y", (d) => y(d.cg) + (off[d.id]?.[1] ?? 4))
    .attr("text-anchor", (d) => off[d.id]?.[2] || "start").text((d) => cname(d.id));
}

/* ---------- 第三幕：斜率图 ---------- */
function slope() {
  const svg = d3.select("#slope");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const ids = ["VNM", "THA", "CHL", "PER", "KOR", "AUS", "RUS", "IDN", "BRA", "JPN", "ZAF", "KEN"].filter((id) => data.countries[id]?.top[I23] === "C");
  const i0 = yi(2000);
  const m = { l: 200, r: 260, t: 40, b: 50 };
  const x0 = m.l, x1 = W - m.r;
  const y = d3.scaleLog([0.01, 0.42], [H - m.b, m.t]).clamp(true);
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(${x0},0)`).call(d3.axisLeft(y).tickValues([0.01, 0.02, 0.05, 0.1, 0.2, 0.4]).tickFormat(fmtTick).tickSize(-(x1 - x0)));
  svg.selectAll(".axis.grid text").attr("x", (x1 - x0) / 2).attr("dy", "-0.4em").attr("text-anchor", "middle");
  [[x0, "2000"], [x1, "2023"]].forEach(([xx, t]) => svg.append("text").attr("class", "anno").attr("x", xx).attr("y", m.t - 14).attr("text-anchor", "middle").text(t));
  const rows = ids.map((id) => ({ id, a: data.countries[id].cg[i0] ?? 0, b: data.countries[id].cg[I23], top0: data.countries[id].top[i0] }));
  const deep = (d) => d.b >= 0.12;
  const relax = (arr, key) => {
    const s = arr.map((d) => ({ d, y: y(d[key]) })).sort((p, q) => p.y - q.y);
    for (let it = 0; it < 60; it++) for (let k = 1; k < s.length; k++) if (s[k].y - s[k - 1].y < 19) { const o = (19 - (s[k].y - s[k - 1].y)) / 2; s[k].y += o; s[k - 1].y -= o; }
    s.forEach((p) => (p.d[key + "y"] = p.y));
  };
  relax(rows, "a"); relax(rows, "b");
  const g = svg.selectAll(".sl").data(rows).join("g");
  g.append("line").attr("x1", x0).attr("x2", x1).attr("y1", (d) => y(d.a)).attr("y2", (d) => y(d.b))
    .attr("stroke", (d) => (deep(d) ? C.C : "#8a8578")).attr("stroke-width", (d) => (deep(d) ? 3 : 1.6)).attr("opacity", (d) => (deep(d) ? 1 : 0.8));
  g.append("circle").attr("cx", x0).attr("cy", (d) => y(d.a)).attr("r", 4).attr("fill", (d) => C[d.top0] || "#888");
  g.append("circle").attr("cx", x1).attr("cy", (d) => y(d.b)).attr("r", 5).attr("fill", C.C);
  g.append("text").attr("class", "lab dim").attr("x", x0 - 12).attr("y", (d) => d.ay + 4).attr("text-anchor", "end")
    .text((d) => `${cname(d.id)} ${pct(d.a)}`);
  g.append("text").attr("class", (d) => (deep(d) ? "lab" : "lab dim")).attr("x", x1 + 12).attr("y", (d) => d.by + 4)
    .style("font-weight", (d) => (deep(d) ? 700 : 400)).text((d) => `${cname(d.id)} ${pct(d.b)}`);
  svg.append("text").attr("class", "lab dim").attr("x", 10).attr("y", H - 6).text("纵轴为对数刻度。左端圆点颜色 = 2000 年的头号伙伴（蓝：美国，金：欧盟，红：中国）");
}

/* ---------- 第四幕：贸易战之后 ---------- */
function trend() {
  const svg = d3.select("#trend");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 40, r: 80, t: 20, b: 30 };
  const yrs = Y.filter((y) => y >= 2008);
  const x = d3.scaleLinear([2008, 2024], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, 90], [H - m.b, m.t]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(8, "d"));
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)));
  svg.append("rect").attr("x", x(2018)).attr("y", m.t).attr("width", x(2024) - x(2018)).attr("height", H - m.t - m.b).attr("fill", "#ffffff07");
  svg.append("line").attr("x1", x(2018)).attr("x2", x(2018)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#ece6d8").attr("stroke-dasharray", "4 4");
  svg.append("text").attr("class", "lab").attr("x", x(2018) + 6).attr("y", m.t + 12).text("2018 贸易战");
  for (const [k, key] of [["C", "China"], ["E", "EU"], ["U", "USA"]]) {
    const v = yrs.map((yy) => [yy, data.counts[key][yi(yy)]]);
    svg.append("path").datum(v).attr("fill", "none").attr("stroke", C[k]).attr("stroke-width", 3)
      .attr("d", d3.line().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX));
    const last = v.at(-1);
    svg.append("text").attr("class", "lab").attr("x", x(2024) + 8).attr("y", y(last[1]) + 4).style("fill", C[k]).style("font-weight", 700).text(`${NAME[k]} ${last[1]}`);
  }
}
function switches() {
  const a = yi(2017), b = yi(2024);
  const moves = {};
  for (const [id, c] of Object.entries(data.countries)) {
    if (c.eu) continue;
    const f = c.top[a], t = c.top[b];
    if (f !== t && f !== "-" && t !== "-") (moves[f + t] ||= []).push(id);
  }
  const usNow = Object.entries(data.countries).filter(([, c]) => !c.eu && c.top[b] === "U").map(([id]) => id);
  const chip = (ids, cls) => `<div class="chips">${ids.map((id) => `<span class="chip ${cls}">${cname(id)}</span>`).join("")}</div>`;
  d3.select("#switch").html(`
    <h3>2017 → 2024 换了头号伙伴的国家</h3>
    <p><b class="t-eu">欧盟</b> → <b class="t-cn">中国</b>：${(moves.EC || []).length} 国</p>${chip(moves.EC || [], "cn")}
    <p><b class="t-us">美国</b> → <b class="t-cn">中国</b>：${(moves.UC || []).length} 国 ${(moves.UC || []).length ? chip(moves.UC, "cn") : ""}</p>
    <p>其他变动：${Object.entries(moves).filter(([k]) => k !== "EC" && k !== "UC").map(([k, ids]) => ids.map((id) => `${cname(id)}（${NAME[k[0]]}→${NAME[k[1]]}）`).join("、")).join("、")}</p>
    <h3 style="margin-top:20px">2024 年仍以美国为头号伙伴的 ${usNow.length} 国</h3>${chip(usNow, "us")}`);
}
function median() {
  const svg = d3.select("#median");
  const { width: W, height: H } = svg.node().getBoundingClientRect();
  const m = { l: 50, r: 80, t: 30, b: 30 };
  const list = Object.values(data.countries).filter((c) => !c.eu);
  const med = (key) => Y.map((yy, i) => [yy, d3.median(list, (c) => c[key][i])]);
  const sc = med("cg"), su = med("ug");
  const x = d3.scaleLinear([1995, 2024], [m.l, W - m.r]);
  const y = d3.scaleLinear([0, 0.08], [H - m.b, m.t]);
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6, "d"));
  svg.append("g").attr("class", "axis grid").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4, ".0%").tickSize(-(W - m.l - m.r)));
  svg.append("line").attr("x1", x(2018)).attr("x2", x(2018)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", "#ece6d8").attr("stroke-dasharray", "4 4");
  svg.append("text").attr("class", "lab dim").attr("x", m.l + 4).attr("y", m.t - 12).text("所有非欧盟经济体：贸易额占 GDP 的中位数");
  for (const [k, s] of [["C", sc], ["U", su]]) {
    svg.append("path").datum(s).attr("fill", "none").attr("stroke", C[k]).attr("stroke-width", 3)
      .attr("d", d3.line().x((d) => x(d[0])).y((d) => y(d[1])).curve(d3.curveMonotoneX));
    svg.append("text").attr("class", "lab").attr("x", x(2024) + 8).attr("y", y(s.at(-1)[1]) + 4).style("fill", C[k]).style("font-weight", 700)
      .text(`${k === "C" ? "对华" : "对美"} ${pct(s.at(-1)[1])}`);
  }
}

/* ---------- 组装 ---------- */
globe();
strip();
scatter();
slope();
trend();
switches();
median();

d3.select("#vDepthMap").classed("on", true);
scrollama().setup({ step: "#breadth .step", offset: 0.6 }).onStepEnter(({ element }) => {
  d3.selectAll("#breadth .step").classed("active", false);
  element.classList.add("active");
  if (!playing) setYear(+element.dataset.year, 900);
});
scrollama().setup({ step: "#depth .step", offset: 0.6 }).onStepEnter(({ element }) => {
  d3.selectAll("#depth .step").classed("active", false);
  element.classList.add("active");
  d3.selectAll("#depth .view").classed("on", false);
  d3.select("#" + element.dataset.view).classed("on", true);
});

// 录屏/截图辅助：?autoplay 直接跳到地图并播放
if (params.has("autoplay")) {
  document.querySelector("#breadth").scrollIntoView();
  setTimeout(play, +(params.get("delay") || 800));
}
window.__ready = true;
