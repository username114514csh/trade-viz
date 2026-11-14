/* ---------- 开场：点阵地球 + 年份演化 + 流光飞线 ---------- */
import * as d3 from "d3";

export function heroGlobe({ data, world, Y, C }) {
  const cv = document.getElementById("globe");
  const ctx = cv.getContext("2d");
  const hero = document.getElementById("hero");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
  const gpath = d3.geoPath(proj, ctx);
  const grat = d3.geoGraticule10();
  const rad = Math.PI / 180;
  let W, H, R0, cx, cy, dpr;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const mob = W < 860;
    R0 = mob ? Math.min(W * 0.48, H * 0.3) : Math.min(H * 0.41, W * 0.27);
    cx = mob ? W / 2 : W * 0.7; cy = mob ? H * 0.74 : H * 0.52;
  }
  resize();
  addEventListener("resize", resize);

  const stars = d3.range(240).map(() => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, p: Math.random() * 6.3 }));

  // 陆地点阵：等面积经纬网格，按国家归组（离屏栅格查表 + geoContains 校验）
  const RW = 1440, RH = 720;
  const off = document.createElement("canvas"); off.width = RW; off.height = RH;
  const octx = off.getContext("2d", { willReadFrequently: true });
  const eq = d3.geoEquirectangular().scale(RW / (2 * Math.PI)).translate([RW / 2, RH / 2]);
  const opath = d3.geoPath(eq, octx);
  world.features.forEach((f, i) => { octx.beginPath(); opath(f); octx.fillStyle = `rgb(${(i + 1) & 255},${(i + 1) >> 8},0)`; octx.fill(); });
  const px = octx.getImageData(0, 0, RW, RH).data;
  const groups = new Map();
  const STEP = 1.1;
  for (let lat = -56; lat <= 83; lat += STEP) {
    const n = Math.round((360 * Math.cos(lat * rad)) / STEP);
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + 0.5) * 360) / n;
      const [x, y] = eq([lon, lat]);
      const o = (Math.floor(y) * RW + Math.floor(x)) * 4;
      const idx = px[o] + (px[o + 1] << 8) - 1;
      if (idx < 0 || idx >= world.features.length || px[o + 2] !== 0) continue;
      if (!d3.geoContains(world.features[idx], [lon, lat])) continue;
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(lon, lat, Math.sin(lat * rad), Math.cos(lat * rad));
    }
  }
  const BASE = { C: "#ff5446", U: "#4f95f0", E: "#e2b04a", eum: "#7a6430", none: "#2b3650" };
  const colOf = (id, i) => {
    if (id === "CHN") return "#ff8a6e";
    if (id === "USA") return "#8cc0ff";
    const c = data.countries[id];
    if (!c) return BASE.none;
    if (c.eu) return BASE.eum;
    return BASE[c.top[i]] || BASE.none;
  };
  const dotGroups = [...groups].map(([idx, pts]) => {
    const id = world.features[idx].id;
    return { pts: Float32Array.from(pts), cols: Y.map((_, i) => colOf(id, i)) };
  });

  // 飞线：中心城市 → 各国质心
  const HUB = { C: [116.4, 39.9], U: [-77.0, 38.9], E: [4.35, 50.85] };
  const HUBNAME = { C: "北京", U: "华盛顿", E: "布鲁塞尔" };
  const cent = {};
  world.features.forEach((f) => (cent[f.id] = d3.geoCentroid(f)));
  const arcIds = Object.keys(data.countries).filter((id) => !data.countries[id].eu && cent[id]);
  const geomCache = {};
  function arcGeom(id, t) {
    const key = id + t;
    if (geomCache[key]) return geomCache[key];
    const a = HUB[t], b = cent[id], ip = d3.geoInterpolate(a, b), dist = d3.geoDistance(a, b);
    const N = 44, g = [];
    for (let k = 0; k <= N; k++) {
      const s = k / N, p = ip(s);
      g.push({ p, sl: Math.sin(p[1] * rad), cl: Math.cos(p[1] * rad), h: 1 + Math.sin(Math.PI * s) * Math.min(0.16, dist * 0.1) });
    }
    return (geomCache[key] = g);
  }
  const arcState = {};
  arcIds.forEach((id) => (arcState[id] = { t: null, born: 0, off: Math.random() * 1.6, spd: 0.28 + Math.random() * 0.12 }));

  // HUD
  const hudYear = document.getElementById("hudYear");
  const CK = { C: "China", E: "EU", U: "USA" };
  const hc = {}, hb = {};
  for (const k of "CEU") { hc[k] = document.getElementById("hc" + k); hb[k] = document.getElementById("hb" + k); }
  let shownYear = -1;
  function setHud(i, now) {
    if (i === shownYear) return;
    shownYear = i;
    hudYear.textContent = Y[i];
    for (const k of "CEU") {
      const v = data.counts[CK[k]][i];
      hc[k].textContent = v;
      hb[k].style.width = (v / 90) * 100 + "%";
    }
    for (const id of arcIds) {
      const t = data.countries[id].top[i];
      const st = arcState[id];
      const nt = HUB[t] ? t : null;
      if (nt !== st.t) { st.t = nt; st.born = now; }
    }
  }

  // 交互：拖动旋转
  let lam = -100, phi = -16, dragging = false, lastX = 0, lastY = 0, idleUntil = 0;
  const inGlobe = (e, f) => Math.hypot(e.offsetX - cx, e.offsetY - cy) < R0 * f;
  cv.addEventListener("pointerdown", (e) => {
    if (!inGlobe(e, 1.05)) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    cv.setPointerCapture(e.pointerId); cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", (e) => {
    if (!dragging) { cv.style.cursor = inGlobe(e, 1) ? "grab" : "default"; return; }
    lam += (e.clientX - lastX) * 0.3;
    phi = Math.max(-45, Math.min(45, phi - (e.clientY - lastY) * 0.3));
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = () => { if (dragging) { dragging = false; idleUntil = performance.now() + 1500; cv.style.cursor = "grab"; } };
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);

  const PER_YEAR = 230;
  const t0 = performance.now();
  let tStart = reduce ? -1e9 : t0 + 1500;
  document.getElementById("replay").addEventListener("click", () => {
    tStart = performance.now() + 300; shownYear = -1;
  });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  const strokePts = (pts, j0, j1) => {
    ctx.beginPath();
    let pen = false;
    for (let j = j0; j <= j1; j++) {
      const p = pts[j];
      if (!p) { pen = false; continue; }
      if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    ctx.stroke();
  };

  let last = t0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(64, now - last); last = now;
    if (!visible) return;
    if (!dragging && now > idleUntil && !reduce) lam += dt * 0.0045;
    const intro = reduce ? 1 : d3.easeCubicOut(Math.min(1, (now - t0) / 1600));
    const R = R0 * (0.9 + 0.1 * intro);
    proj.scale(R).translate([cx, cy]).rotate([lam, phi]);
    const yf = Math.max(0, Math.min(Y.length - 1, (now - tStart) / PER_YEAR));
    const i0 = Math.floor(yf), fr = yf - i0;
    setHud(i0, now);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // 星空
    ctx.fillStyle = "#cdd8ff";
    for (const s of stars) {
      ctx.globalAlpha = 0.15 + 0.45 * Math.sin(now / 1100 + s.p) ** 2;
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = intro;
    // 大气层辉光
    let g = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.32);
    g.addColorStop(0, "rgba(96,140,255,0.38)"); g.addColorStop(0.25, "rgba(70,110,230,0.14)"); g.addColorStop(1, "rgba(40,70,180,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.32, 0, 7); ctx.fill();
    // 海洋
    g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.05, cx, cy, R);
    g.addColorStop(0, "#1b2a4d"); g.addColorStop(0.6, "#0d1529"); g.addColorStop(1, "#060a14");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.beginPath(); gpath(grat); ctx.strokeStyle = "rgba(130,160,230,0.07)"; ctx.lineWidth = 0.6; ctx.stroke();

    // 陆地点阵
    const l0 = -lam * rad, p0 = -phi * rad, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
    const k = R / 380, ease = fr < 0.5 ? 0 : d3.easeCubicInOut((fr - 0.5) / 0.5);
    for (const grp of dotGroups) {
      const a = grp.cols[i0], b = grp.cols[Math.min(Y.length - 1, i0 + 1)];
      ctx.fillStyle = a === b || ease === 0 ? a : d3.interpolateRgb(a, b)(ease);
      ctx.beginPath();
      const P = grp.pts;
      for (let j = 0; j < P.length; j += 4) {
        const cosc = sp0 * P[j + 2] + cp0 * P[j + 3] * Math.cos(P[j] * rad - l0);
        if (cosc < 0.03) continue;
        const xy = proj([P[j], P[j + 1]]);
        const r = (0.55 + 1.15 * cosc) * k;
        ctx.moveTo(xy[0] + r, xy[1]); ctx.arc(xy[0], xy[1], r, 0, 6.2832);
      }
      ctx.fill();
    }
    // 边缘暗角 + 高光
    g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    g.addColorStop(0, "rgba(4,7,14,0)"); g.addColorStop(1, "rgba(4,7,14,0.6)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.45, cy - R * 0.5, R * 0.9);
    g.addColorStop(0, "rgba(170,200,255,0.10)"); g.addColorStop(1, "rgba(170,200,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();

    // 飞线
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const sec = now / 1000;
    for (const id of arcIds) {
      const st = arcState[id];
      if (!st.t) continue;
      const geo = arcGeom(id, st.t);
      const N = geo.length - 1;
      const grow = Math.min(1, (now - st.born) / 900);
      const nMax = Math.round(N * d3.easeCubicOut(grow));
      const pts = new Array(nMax + 1);
      for (let j = 0; j <= nMax; j++) {
        const q = geo[j];
        const cosc = sp0 * q.sl + cp0 * q.cl * Math.cos(q.p[0] * rad - l0);
        if (cosc < -0.08) { pts[j] = null; continue; }
        const xy = proj(q.p);
        pts[j] = [cx + (xy[0] - cx) * q.h, cy + (xy[1] - cy) * q.h];
      }
      ctx.strokeStyle = C[st.t]; ctx.globalAlpha = 0.16 * intro; ctx.lineWidth = 0.9;
      strokePts(pts, 0, nMax);
      if (grow < 1) {
        const p = pts[nMax];
        if (p) { ctx.globalAlpha = 0.9 * (1 - grow); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, 7); ctx.fill(); }
        continue;
      }
      // 流光
      const u = (sec * st.spd + st.off) % 1.6;
      if (u > 1.22) continue;
      const head = Math.min(N, u * N), tail = Math.max(0, head - 0.24 * N);
      ctx.lineWidth = 1.7;
      for (let s = 0; s < 6; s++) {
        const j0 = Math.floor(tail + ((head - tail) * s) / 6), j1 = Math.min(N, Math.ceil(tail + ((head - tail) * (s + 1)) / 6));
        ctx.globalAlpha = ((s + 1) / 6) ** 1.6 * 0.85 * intro;
        strokePts(pts, j0, j1);
      }
    }
    // 中心城市脉冲
    for (const [t, ll] of Object.entries(HUB)) {
      const cosc = sp0 * Math.sin(ll[1] * rad) + cp0 * Math.cos(ll[1] * rad) * Math.cos(ll[0] * rad - l0);
      if (cosc < 0.05) continue;
      const [x, y] = proj(ll);
      const ph = (sec % 2) / 2;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - ph) * 0.8 * intro; ctx.strokeStyle = C[t]; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, y, 4 + ph * 18, 0, 7); ctx.stroke();
      g = ctx.createRadialGradient(x, y, 0, x, y, 14);
      g.addColorStop(0, C[t]); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.9 * intro; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
      ctx.globalAlpha = Math.min(1, cosc * 3) * intro;
      ctx.font = "700 13px 'Noto Sans SC', sans-serif"; ctx.fillStyle = "#f3ece0";
      ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 6;
      ctx.fillText(HUBNAME[t], x + 10, y - 8);
      ctx.shadowBlur = 0;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);

  // 关键数字跳动
  document.querySelectorAll("#hero [data-count]").forEach((el, n) => {
    const to = +el.dataset.count, dec = +(el.dataset.dec || 0);
    if (reduce) { el.textContent = to.toFixed(dec); return; }
    el.textContent = (0).toFixed(dec);
    setTimeout(() => {
      const tm = d3.timer((e) => {
        const p = Math.min(1, e / 1600);
        el.textContent = (to * d3.easeCubicOut(p)).toFixed(dec);
        if (p === 1) tm.stop();
      });
    }, 1300 + n * 250);
  });
}
