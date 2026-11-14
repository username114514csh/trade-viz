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
  const fxc = document.createElement("canvas"), fx = fxc.getContext("2d");
  const smc = document.createElement("canvas"), sm = smc.getContext("2d");
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    fxc.width = W * dpr; fxc.height = H * dpr;
    smc.width = Math.ceil((W * dpr) / 4); smc.height = Math.ceil((H * dpr) / 4);
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
  const STEP = 0.95;
  for (let lat = -56, row = 0; lat <= 83; lat += STEP * 0.866, row++) {
    const n = Math.round((360 * Math.cos(lat * rad)) / STEP);
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + 0.25 + (row % 2) * 0.5) * 360) / n;
      const [x, y] = eq([lon, lat]);
      const o = (Math.floor(y) * RW + Math.floor(x)) * 4;
      const idx = px[o] + (px[o + 1] << 8) - 1;
      if (idx < 0 || idx >= world.features.length || px[o + 2] !== 0) continue;
      if (!d3.geoContains(world.features[idx], [lon, lat])) continue;
      if (!groups.has(idx)) groups.set(idx, []);
      groups.get(idx).push(lon, lat, Math.sin(lat * rad), Math.cos(lat * rad));
    }
  }
  // 海洋点阵（比陆地稀疏，离岸一点距离）
  const oc = [], OS = 2.2;
  for (let lat = -66, row = 0; lat <= 78; lat += OS * 0.866, row++) {
    const n = Math.round((360 * Math.cos(lat * rad)) / OS);
    for (let k = 0; k < n; k++) {
      const lon = -180 + ((k + (row % 2) * 0.5) * 360) / n;
      const [x, y] = eq([lon, lat]);
      let land = false;
      for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
        const xx = Math.min(RW - 1, Math.max(0, Math.floor(x) + dx)), yy = Math.min(RH - 1, Math.max(0, Math.floor(y) + dy));
        const o = (yy * RW + xx) * 4;
        if (px[o] || px[o + 1]) { land = true; break; }
      }
      if (!land) oc.push(lon, lat, Math.sin(lat * rad), Math.cos(lat * rad));
    }
  }
  const oceanPts = Float32Array.from(oc);
  const BASE = { C: "#ff4f3f", U: "#4f95f0", E: "#e9b54a", eum: "#6e5a2c", none: "#26314a" };
  const colOf = (id, i) => {
    if (id === "CHN") return "#ffc2ad";
    if (id === "USA") return "#b9d8ff";
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
      if (nt !== st.t) { st.t = nt; st.born = now + Math.random() * Math.min(600, PER_YEAR * 1.2); }
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

  // 首次播放稍快（约 8.7 秒），点「重播」放慢到约 16 秒，飞线依次长出不扎堆
  let PER_YEAR = 300;
  const t0 = performance.now();
  let tStart = reduce ? -1e9 : t0 + 1500;
  document.getElementById("replay").addEventListener("click", () => {
    PER_YEAR = 560;
    for (const id of arcIds) arcState[id].t = null;
    tStart = performance.now() + 700; shownYear = -1;
  });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  const strokePts = (X, pts, j0, j1) => {
    X.beginPath();
    let pen = false;
    for (let j = j0; j <= j1; j++) {
      const p = pts[j];
      if (!p) { pen = false; continue; }
      if (pen) X.lineTo(p[0], p[1]); else X.moveTo(p[0], p[1]);
      pen = true;
    }
    X.stroke();
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

    // ---- 背景层：星空、大气、海洋、经纬网、海岸线
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#cdd8ff";
    for (const s of stars) {
      ctx.globalAlpha = 0.12 + 0.45 * Math.sin(now / 1100 + s.p) ** 2;
      ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
    }
    ctx.globalAlpha = intro;
    let g = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.5);
    g.addColorStop(0, "rgba(120,165,255,0.45)"); g.addColorStop(0.1, "rgba(85,130,245,0.22)");
    g.addColorStop(0.4, "rgba(50,90,210,0.06)"); g.addColorStop(1, "rgba(40,70,180,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, 7); ctx.fill();
    // 海洋：深海渐变 + 偏青的浅层 + 阳光反射
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx, cy, R * 1.02);
    g.addColorStop(0, "#1d4170"); g.addColorStop(0.3, "#13305a"); g.addColorStop(0.62, "#0b1c3c"); g.addColorStop(0.88, "#060f24"); g.addColorStop(1, "#040814");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "screen";
    const gx = cx - R * 0.38, gy = cy - R * 0.42;
    g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 0.55);
    g.addColorStop(0, "rgba(120,200,255,0.22)"); g.addColorStop(0.35, "rgba(70,150,230,0.09)"); g.addColorStop(1, "rgba(40,100,200,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // 海洋点阵：稀疏、受光照
    {
      const l0 = -lam * rad, p0 = -phi * rad, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
      const bands = [new Path2D(), new Path2D(), new Path2D()], s = Math.max(1, R / 420);
      const P = oceanPts;
      for (let j = 0; j < P.length; j += 4) {
        const cosc = sp0 * P[j + 2] + cp0 * P[j + 3] * Math.cos(P[j] * rad - l0);
        if (cosc < 0.22) continue;
        const xy = proj([P[j], P[j + 1]]);
        const lit = ((xy[0] - cx) / R) * -0.48 + ((xy[1] - cy) / R) * -0.55 + cosc * 0.68;
        const w = s * (0.5 + 0.7 * cosc);
        bands[lit < 0.15 ? 0 : lit < 0.55 ? 1 : 2].rect(xy[0] - w / 2, xy[1] - w / 2, w, w);
      }
      ctx.fillStyle = "#7fb0ff";
      ctx.globalAlpha = 0.08 * intro; ctx.fill(bands[0]);
      ctx.globalAlpha = 0.17 * intro; ctx.fill(bands[1]);
      ctx.globalAlpha = 0.28 * intro; ctx.fill(bands[2]);
      ctx.globalAlpha = intro;
    }
    ctx.beginPath(); gpath(grat); ctx.strokeStyle = "rgba(140,180,240,0.05)"; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); gpath(world); ctx.strokeStyle = "rgba(160,190,250,0.13)"; ctx.lineWidth = 0.5; ctx.stroke();

    // ---- 发光层（离屏）：点阵、飞线、城市
    const X = fx;
    X.setTransform(dpr, 0, 0, dpr, 0, 0);
    X.globalCompositeOperation = "source-over"; X.globalAlpha = 1;
    X.clearRect(0, 0, W, H);
    const l0 = -lam * rad, p0 = -phi * rad, sp0 = Math.sin(p0), cp0 = Math.cos(p0);
    const k = R / 380, ease = fr < 0.5 ? 0 : d3.easeCubicInOut((fr - 0.5) / 0.5);
    const LX = -0.48, LY = -0.55, LZ = 0.68; // 左上方光源
    for (const grp of dotGroups) {
      const a = grp.cols[i0], b = grp.cols[Math.min(Y.length - 1, i0 + 1)];
      const col = a === b || ease === 0 ? a : d3.interpolateRgb(a, b)(ease);
      const bands = [new Path2D(), new Path2D(), new Path2D()];
      const P = grp.pts;
      for (let j = 0; j < P.length; j += 4) {
        const cosc = sp0 * P[j + 2] + cp0 * P[j + 3] * Math.cos(P[j] * rad - l0);
        if (cosc < 0.02) continue;
        const xy = proj([P[j], P[j + 1]]);
        const lit = ((xy[0] - cx) / R) * LX + ((xy[1] - cy) / R) * LY + cosc * LZ;
        const r = (0.45 + 1.05 * Math.sqrt(cosc)) * k;
        const bp = bands[lit < 0.15 ? 0 : lit < 0.55 ? 1 : 2];
        bp.moveTo(xy[0] + r, xy[1]); bp.arc(xy[0], xy[1], r, 0, 6.2832);
      }
      X.fillStyle = col;
      X.globalAlpha = 0.42 * intro; X.fill(bands[0]);
      X.globalAlpha = 0.75 * intro; X.fill(bands[1]);
      X.globalAlpha = intro; X.fill(bands[2]);
    }

    X.globalCompositeOperation = "lighter";
    X.lineCap = "round";
    const sec = now / 1000;
    for (const id of arcIds) {
      const st = arcState[id];
      if (!st.t) continue;
      const geo = arcGeom(id, st.t);
      const N = geo.length - 1;
      if (now < st.born) continue;
      const grow = Math.min(1, (now - st.born) / 1100);
      const nMax = Math.round(N * d3.easeCubicOut(grow));
      const pts = new Array(nMax + 1);
      for (let j = 0; j <= nMax; j++) {
        const q = geo[j];
        const cosc = sp0 * q.sl + cp0 * q.cl * Math.cos(q.p[0] * rad - l0);
        if (cosc < -0.08) { pts[j] = null; continue; }
        const xy = proj(q.p);
        pts[j] = [cx + (xy[0] - cx) * q.h, cy + (xy[1] - cy) * q.h];
      }
      X.strokeStyle = C[st.t]; X.globalAlpha = 0.14 * intro; X.lineWidth = 0.8;
      strokePts(X, pts, 0, nMax);
      if (grow < 1) {
        const p = pts[nMax];
        if (p) { X.globalAlpha = 0.7 * (1 - grow) * intro; X.fillStyle = "#fff"; X.beginPath(); X.arc(p[0], p[1], 1.6, 0, 7); X.fill(); }
        continue;
      }
      const u = (sec * st.spd + st.off) % 1.6;
      if (u > 1.22) continue;
      const head = Math.min(N, u * N), tail = Math.max(0, head - 0.26 * N);
      X.lineWidth = 1.6;
      for (let s = 0; s < 6; s++) {
        const j0 = Math.floor(tail + ((head - tail) * s) / 6), j1 = Math.min(N, Math.ceil(tail + ((head - tail) * (s + 1)) / 6));
        X.globalAlpha = ((s + 1) / 6) ** 1.8 * 0.9 * intro;
        strokePts(X, pts, j0, j1);
      }
      const hp = pts[Math.round(head)];
      if (u <= 1 && hp) { X.globalAlpha = 0.9 * intro; X.fillStyle = "#fff4ec"; X.beginPath(); X.arc(hp[0], hp[1], 1.3, 0, 7); X.fill(); }
    }
    const labels = [];
    for (const [t, ll] of Object.entries(HUB)) {
      const cosc = sp0 * Math.sin(ll[1] * rad) + cp0 * Math.cos(ll[1] * rad) * Math.cos(ll[0] * rad - l0);
      if (cosc < 0.05) continue;
      const [x, y] = proj(ll);
      const ph = (sec % 2.4) / 2.4;
      X.globalAlpha = (1 - ph) ** 1.5 * 0.9 * intro; X.strokeStyle = C[t]; X.lineWidth = 1.3;
      X.beginPath(); X.arc(x, y, 3 + ph * 22, 0, 7); X.stroke();
      g = X.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.18, C[t]); g.addColorStop(1, "rgba(0,0,0,0)");
      X.globalAlpha = intro; X.fillStyle = g; X.beginPath(); X.arc(x, y, 16, 0, 7); X.fill();
      labels.push([t, x, y, Math.min(1, cosc * 3)]);
    }

    // ---- 合成：清晰层 + 泛光
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(fxc, 0, 0);
    sm.globalCompositeOperation = "copy";
    sm.filter = "blur(2px)";
    sm.drawImage(fxc, 0, 0, smc.width, smc.height);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.75;
    ctx.drawImage(smc, 0, 0, cv.width, cv.height);

    // ---- 球体光影：夜面、菲涅尔边缘光、高光、轮廓
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = intro;
    g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.2, cx, cy, R * 1.05);
    g.addColorStop(0, "rgba(3,5,12,0)"); g.addColorStop(0.6, "rgba(3,5,12,0.05)"); g.addColorStop(1, "rgba(3,5,12,0.62)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "screen";
    g = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    g.addColorStop(0, "rgba(80,130,255,0)"); g.addColorStop(0.8, "rgba(90,140,255,0.08)"); g.addColorStop(1, "rgba(130,175,255,0.32)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 0.75);
    g.addColorStop(0, "rgba(190,215,255,0.13)"); g.addColorStop(1, "rgba(190,215,255,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    g.addColorStop(0, "rgba(185,210,255,0.6)"); g.addColorStop(0.5, "rgba(140,175,255,0.18)"); g.addColorStop(1, "rgba(120,160,255,0.04)");
    ctx.strokeStyle = g; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

    // ---- 城市标签
    ctx.font = "700 12px 'Noto Sans SC', sans-serif";
    ctx.textBaseline = "middle";
    for (const [t, x, y, al] of labels) {
      const txt = HUBNAME[t], tw = ctx.measureText(txt).width;
      const bx = x + 12, by = y - 22, bw = tw + 20, bh = 20;
      ctx.globalAlpha = al * intro;
      ctx.strokeStyle = C[t]; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x + 3, y - 3); ctx.lineTo(bx, by + bh / 2); ctx.stroke();
      ctx.fillStyle = "rgba(9,13,24,0.78)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10); else ctx.rect(bx, by, bw, bh);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = C[t]; ctx.beginPath(); ctx.arc(bx + 8, by + bh / 2, 2.5, 0, 7); ctx.fill();
      ctx.fillStyle = "#f3ece0"; ctx.fillText(txt, bx + 14, by + bh / 2 + 0.5);
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
