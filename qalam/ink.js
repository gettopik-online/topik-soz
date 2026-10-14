/*INK2*/(function(){
  // The pen of every book, rebuilt to feel like the iPad's own (user 2026-10-12: "huddi ipadni kigi funksiyasidek
  // myagkiy chizsin, markerni ham").
  //   - every sample the screen reports is used (coalesced events — Apple Pencil gives up to 240 a second), the line is
  //     smoothed and drawn as curves, at the screen's real resolution;
  //   - Qalam: the width follows the pressure of the Pencil; with a finger or a mouse it follows the speed (slow =
  //     full, fast = thinner) and the ends taper;
  //   - Qalam comes in three kinds (user 2026-10-13: "o'ta nafis … ko'rgan odam maza qivoradigan"), chosen under
  //     Qalam / Marker and remembered on the device:
  //       Pat (pat ruchka, the default) — a broad nib held at a fixed angle, as in calligraphy: thick where the stroke
  //         crosses the nib, hair-thin where it runs along it, the ends cut at the nib's angle;
  //       Mo'yqalam (붓펜) — a brush: full where the hand is slow or presses, thin where it is fast, pointed ends;
  //       Oddiy — the even line described above;
  //   - Marker: one even, see-through band — it darkens the page like a real highlighter (multiply), the letters under
  //     it stay sharp, and it never gets blotchy where a stroke crosses itself; its ends are cut flat;
  //   - hold the pen still at the end of a stroke and it becomes a straight line (as on the iPad);
  //   - the ink belongs to the PAGE: it scrolls and zooms with it (it used to be wiped by scrolling);
  //   - once a Pencil has drawn, a finger moves the page instead of drawing (two fingers always zoom / move); only a
  //     touch that lands while the Pencil writes (or within 0.4 s after), a very broad one, or one that is on the glass
  //     when the Pencil comes down is the writing hand;
  //   - a TAP on one of the page's own buttons (an audio code, 문법과 표현, 대본 / 정답, a timer …) presses that button
  //     even while the pen tool is on — the pen's layer covers the page, and the teacher who was writing could not
  //     start the recording (user 2026-10-13: "nega yozib turilganda audiolar ishlamayapti"); a stroke drawn across
  //     a button is still a stroke;
  //   - a press on the 대본 bubble or on the audio bar moves it (nobody writes on those: the ink would stay on the
  //     page when they go) — user 2026-10-13: "ipadda 대본 qismini siljitib bo'lmas ekan";
  //   - the grammar sheet (문법과 표현 → a clean sheet over the book) is written on like a page: there the sheet is the
  //     page, the pen's layers and buttons come above it, and ↶ / the bin work on what was written on the sheet
  //     (user 2026-10-13: "yozish chizish bo'yash funksiyalari grammar bo'limida yo'q ekan, u yerga ham o'tkaz");
  //   - ↶ takes back the last stroke (also Ctrl+Z); the eraser rubs out part of a stroke; the bin clears everything.
  // Nothing is kept after the page is closed or reloaded.
  // topik-soz: the pages scroll with the window itself (no #stage-outer / #stage-inner)
  var surf = document.getElementById("draw-canvas"), so = document.getElementById("stage-outer") || document.scrollingElement, inner = document.getElementById("stage-inner") || document.body;
  var winScroll = so === document.scrollingElement;
  var pop = document.getElementById("draw-color-pop"), toggle = document.getElementById("draw-toggle-btn"),
      eraserBtn = document.getElementById("draw-eraser-btn"), clearBtn = document.getElementById("draw-clear-btn"),
      slider = document.getElementById("draw-thickness"), bar = document.getElementById("draw-toolbar");
  if (!surf || !so || !inner || !pop || !toggle || !slider || window.__ink2) return;
  window.__ink2 = { strokes: function(){ return history.length; }, penSeen: function(){ return penSeen; }, nib: function(){ return nib; }, sharp: function(){ return sharpOn; }, here: function(){ var n = 0; history.forEach(function(st){ if (here(st)) n++; }); return n; } };   // for checks

  var PAD = 28, STEP = 1, ERASER = 26;                 // page px around a page the ink may reach; curve step; eraser (screen px)
  var DPR = 1, W = 0, H = 0, lctx = surf.getContext("2d");
  var tail = document.createElement("canvas"), tctx = tail.getContext("2d");        // the moving end of the stroke being written
  tail.id = "ink-tail"; surf.parentNode.insertBefore(tail, surf.nextSibling);
  // topik-soz: the pages come and go (a new screen, a new slide) — the list is read again at every stroke
  var pages = [];
  function pagesNow(){ pages = Array.prototype.slice.call(inner.querySelectorAll(winScroll ? ".page" : ":scope > .page")); return pages; }
  var store = new Map(), history = [];                 // page → { strokes, pen, mark, f, w, h, dirty }; strokes in the order drawn
  var cur = null, penSeen = false, lastPen = 0, fingers = {}, multi = false, pan = null, glide = 0, liveRaf = 0, ring = null;
  var NIBS = ["plain", "nib", "brush"], nib = "nib", NIB_W = 1.5, NIB_A = -0.61;   // the nib: this many times the slider, held at −35°
  try { var savedNib = localStorage.getItem("gettopik_nib"); if (NIBS.indexOf(savedNib) >= 0) nib = savedNib; } catch (x) {}

  // ---------- the book, or the grammar sheet that lies over it ----------
  var gp = document.getElementById("gp"), gpStage = gp && gp.querySelector(".stage");
  function gpOn(){ return !!gpStage && gp.classList.contains("on"); }
  function sheetNow(){ return gpOn() ? gp.querySelector(".sheet") : null; }
  function onSheet(pg){ return !!gpStage && gp.contains(pg); }
  function kOf(pg){ return onSheet(pg) ? 1 : scaleOf(); }                // the sheet is not scaled as a whole
  function scroller(){ return gpOn() ? gpStage : so; }
  function alive(pg){ return document.documentElement.contains(pg); }

  // ---------- what the tool's own buttons say ----------
  function isOn(){ return surf.style.pointerEvents === "auto"; }
  function toolNow(){
    if (eraserBtn && eraserBtn.classList.contains("active")) return "eraser";
    var b = pop.querySelector(".type-btn.active");
    return b && b.dataset.type === "marker" ? "marker" : "pen";
  }
  function colorNow(){ var b = pop.querySelector(".swatch.active"); return b ? b.dataset.color : "#1a1a2e"; }

  // ---------- geometry ----------
  // the scale of the pages, EXACT — read from the transform itself. (Width ÷ offsetWidth is rounded to whole pixels:
  // 1.2040 instead of 1.20448 is nothing on one page, but the book is one column tens of thousands of pixels tall, and
  // on page 50 that error put the ink 22 px lower than it was written — user, iPad: "yozganda pastga tushib qolyapti".)
  function scaleOf(){
    var t = getComputedStyle(inner).transform, m = t && t !== "none" ? /matrix\(\s*([-0-9.e]+)/.exec(t) : null, k = m ? parseFloat(m[1]) : 0;
    return k > 0 ? k : (inner.getBoundingClientRect().width / inner.offsetWidth) || 1;
  }
  function pageAt(y){
    var sh = sheetNow(); if (sh) return sh;
    pagesNow();
    var lo = 0, hi = pages.length - 1, at = 0;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (pages[m].getBoundingClientRect().top <= y) { at = m; lo = m + 1; } else hi = m - 1; }
    var r = pages[at].getBoundingClientRect();                       // in the gap under a page: the nearer of the two
    if (y > r.bottom && at + 1 < pages.length && pages[at + 1].getBoundingClientRect().top - y < y - r.bottom) at++;
    return pages[at];
  }
  function data(pg){
    var d = store.get(pg);
    if (!d) { d = { strokes: [], pen: null, mark: null, f: 0, w: 0, h: 0, dirty: true }; store.set(pg, d); }
    return d;
  }
  // smoothed points with a width each: [x, y, w, x, y, w, …] (page px). The sums run forward only — a point, once
  // made, never changes — so the stroke being written takes in just the samples that came since the last frame
  // (growShape) and the finished stroke is the same sums over all of them (shape).
  function startShape(s){ var P = s.pts; return { i: 0, sx: P[0], sy: P[1], sw: 0, px: P[0], py: P[1], pt: P[3], G: [] }; }
  function growShape(s, L){
    var P = s.pts, n = P.length / 4, kind = s.tool === "pen" ? s.nib || "plain" : "";
    var a = s.tool === "marker" ? 0.4 : kind === "brush" ? (s.pen ? 0.55 : 0.4) : s.pen ? 0.62 : 0.44,
        wa = kind === "nib" ? 0.3 : kind === "brush" ? (s.pen ? 0.4 : 0.14) : s.pen ? 0.45 : 0.16,
        sx = L.sx, sy = L.sy, sw = L.sw, px = L.px, py = L.py, pt = L.pt, out = L.G;
    for (var i = L.i; i < n; i++) {
      var x = P[4 * i], y = P[4 * i + 1], p = P[4 * i + 2], t = P[4 * i + 3], target;
      var v = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)) * s.k / Math.max(1, t - pt);          // screen px / ms
      if (i) { sx += (x - sx) * a; sy += (y - sy) * a; }
      if (s.tool === "marker") target = s.w;
      else if (kind === "nib") target = s.w * NIB_W * (s.pen ? 0.72 + 0.56 * p : Math.max(0.82, Math.min(1.04, 1.1 - 0.12 * v)));   // the nib's width
      else if (kind === "brush") target = s.pen ? s.w * (0.22 + 2.5 * p) : s.w * Math.max(0.34, Math.min(2, 2.15 - 1.5 * v));
      else if (s.pen) target = s.w * (0.42 + 1.3 * p);                  // the Pencil's pressure
      else target = s.w * Math.max(0.6, Math.min(1.12, 1.18 - 0.2 * v));
      sw = i ? sw + (target - sw) * wa
             : kind === "brush" ? (s.pen ? target : s.w * 0.4) : (s.pen || s.tool === "marker" || kind === "nib" ? target : s.w * 0.72);
      out.push(sx, sy, sw);
      px = x; py = y; pt = t;
    }
    L.i = n; L.sx = sx; L.sy = sy; L.sw = sw; L.px = px; L.py = py; L.pt = pt;
  }
  // how the end of a stroke thins: `out` may be only the last part of it, `count` is the number of points of the whole
  function taper(s, out, final, count){
    var kind = s.tool === "pen" ? s.nib || "plain" : "", n = out.length / 3, m, i;
    if (kind === "brush") {                                             // a brush ends in a point — while it is drawn, too
      m = Math.min(s.pen ? 4 : 9, Math.floor(count / 3), n);
      for (i = 0; i < m; i++) out[out.length - 1 - 3 * i] *= (s.pen ? 0.45 : 0.14) + (s.pen ? 0.55 : 0.86) * i / m;
    } else if (final && !s.pen && kind === "plain") {                   // finger / mouse: the end thins out
      m = Math.min(7, Math.floor(count / 3), n);
      for (i = 0; i < m; i++) out[out.length - 1 - 3 * i] *= 0.5 + 0.5 * i / m;
    }
  }
  function shape(s, final){
    var P = s.pts, n = P.length / 4, kind = s.tool === "pen" ? s.nib || "plain" : "";
    if (s.straight) {
      var lw = kind === "nib" ? s.w * NIB_W : s.w;
      return [P[0], P[1], lw, P[4 * (n - 1)], P[4 * (n - 1) + 1], lw];
    }
    var L = startShape(s); growShape(s, L);
    var out = L.G;
    out.push(P[4 * (n - 1)], P[4 * (n - 1) + 1], L.sw);                  // the line always reaches the tip of the pen
    taper(s, out, final, out.length / 3);
    return out;
  }
  // ---------- drawing one stroke into a context whose units are page px ----------
  // g is a chain of curves through the middles of its points. `more` = the stroke goes on: the last point is only
  // looked at (it shapes the curve before it) and the place and width the chain has reached come back, so that the
  // next call can go on from exactly there — that is how a stroke is drawn bit by bit while it is written.
  function inkPen(ctx, g, col, more){
    var n = g.length / 3, curW = -1, open = false;
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineCap = ctx.lineJoin = "round";
    function seg(x0, y0, x1, y1, w){
      if (!open || Math.abs(w - curW) > curW * 0.035) {
        if (open) ctx.stroke();
        ctx.beginPath(); ctx.lineWidth = curW = w; ctx.moveTo(x0, y0); open = true;
      }
      ctx.lineTo(x1, y1);
    }
    var ax = g[0], ay = g[1], aw = g[2], i, k, end = more ? n - 1 : n;
    if (!more) {
      var len = 0; for (i = 1; i < n; i++) len += Math.abs(g[3 * i] - g[3 * i - 3]) + Math.abs(g[3 * i + 1] - g[3 * i - 2]);
      if (len < 0.6) { ctx.beginPath(); ctx.arc(ax, ay, Math.max(aw, 0.8) * 0.55, 0, 6.2832); ctx.fill(); return [ax, ay, aw]; }   // a dot
    }
    for (i = 1; i < end; i++) {
      var cx = g[3 * i], cy = g[3 * i + 1], cw = g[3 * i + 2], last = i === n - 1;
      var bx = last ? cx : (cx + g[3 * i + 3]) / 2, by = last ? cy : (cy + g[3 * i + 4]) / 2, bw = last ? cw : (cw + g[3 * i + 5]) / 2;
      var d = Math.abs(cx - ax) + Math.abs(cy - ay) + Math.abs(bx - cx) + Math.abs(by - cy), steps = Math.max(1, Math.ceil(d / STEP));
      var x0 = ax, y0 = ay;
      for (k = 1; k <= steps; k++) {
        var t = k / steps, u = 1 - t;
        var x1 = u * u * ax + 2 * u * t * cx + t * t * bx, y1 = u * u * ay + 2 * u * t * cy + t * t * by;
        seg(x0, y0, x1, y1, aw + (bw - aw) * t);
        x0 = x1; y0 = y1;
      }
      ax = bx; ay = by; aw = bw;
    }
    if (open) ctx.stroke();
    return [ax, ay, aw];
  }
  // Pat ruchka: the mark of a flat nib held at one angle. Every bit of the line is the patch the nib's edge sweeps —
  // all of them filled as ONE shape (no seams where they meet) — plus the hairline the edge leaves when it runs along
  // itself. The points' widths are the width of the nib (it follows the pressure a little).
  // `more` as in inkPen; `before` = the point just before g's first one (the last patch of the earlier bit is laid
  // again under the first of this one, so no seam shows where two bits meet); it comes back after the place reached.
  function inkNib(ctx, g, col, more, before){
    var n = g.length / 3, ux = Math.cos(NIB_A) / 2, uy = Math.sin(NIB_A) / 2, i, k, F = [], sum = 0, end = more ? n - 1 : n;
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineCap = ctx.lineJoin = "round";
    var ax = g[0], ay = g[1], aw = g[2];
    if (!more && !before) {
      var len = 0; for (i = 1; i < n; i++) len += Math.abs(g[3 * i] - g[3 * i - 3]) + Math.abs(g[3 * i + 1] - g[3 * i - 2]);
      if (len < 0.6) {                                   // a dot is the nib set down: a short slanted dash
        ctx.lineWidth = Math.max(0.5, aw * 0.3);
        ctx.beginPath(); ctx.moveTo(ax - ux * aw * 0.7, ay - uy * aw * 0.7); ctx.lineTo(ax + ux * aw * 0.7, ay + uy * aw * 0.7); ctx.stroke();
        return [ax, ay, aw];
      }
    }
    if (before) F.push(before[0], before[1], before[2]);
    F.push(ax, ay, aw);
    for (i = 1; i < end; i++) {                          // the same curve as the plain pen, cut into short bits
      var cx = g[3 * i], cy = g[3 * i + 1], cw = g[3 * i + 2], last = i === n - 1;
      var bx = last ? cx : (cx + g[3 * i + 3]) / 2, by = last ? cy : (cy + g[3 * i + 4]) / 2, bw = last ? cw : (cw + g[3 * i + 5]) / 2;
      var d = Math.abs(cx - ax) + Math.abs(cy - ay) + Math.abs(bx - cx) + Math.abs(by - cy), steps = Math.max(1, Math.ceil(d / STEP));
      for (k = 1; k <= steps; k++) {
        var t = k / steps, u = 1 - t;
        F.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by, aw + (bw - aw) * t);
      }
      ax = bx; ay = by; aw = bw;
    }
    var m = F.length / 3;
    if (m < 2) return [ax, ay, aw];
    ctx.beginPath();
    for (i = 1; i < m; i++) {
      var x0 = F[3 * i - 3], y0 = F[3 * i - 2], w0 = F[3 * i - 1], x1 = F[3 * i], y1 = F[3 * i + 1], w1 = F[3 * i + 2];
      sum += w1;
      if ((x1 - x0) * uy - (y1 - y0) * ux >= 0) {        // every patch wound the same way: together they are one shape
        ctx.moveTo(x0 + ux * w0, y0 + uy * w0); ctx.lineTo(x1 + ux * w1, y1 + uy * w1); ctx.lineTo(x1 - ux * w1, y1 - uy * w1); ctx.lineTo(x0 - ux * w0, y0 - uy * w0);
      } else {
        ctx.moveTo(x0 + ux * w0, y0 + uy * w0); ctx.lineTo(x0 - ux * w0, y0 - uy * w0); ctx.lineTo(x1 - ux * w1, y1 - uy * w1); ctx.lineTo(x1 + ux * w1, y1 + uy * w1);
      }                                                  // (no closePath: filling closes each patch, and on a long
    }                                                    //  path every closePath call cost more than the one before)
    ctx.fill();
    ctx.lineWidth = Math.max(0.45, sum / (m - 1) * 0.15);
    ctx.beginPath(); ctx.moveTo(F[0], F[1]);
    for (i = 1; i < m; i++) ctx.lineTo(F[3 * i], F[3 * i + 1]);
    ctx.stroke();
    return m > 2 ? [ax, ay, aw, F[3 * m - 6], F[3 * m - 5], F[3 * m - 4]] : [ax, ay, aw];
  }
  function trace(ctx, g){                                // one smooth path through the points
    var n = g.length / 3, i;
    ctx.beginPath(); ctx.moveTo(g[0], g[1]);
    for (i = 1; i < n - 1; i++) ctx.quadraticCurveTo(g[3 * i], g[3 * i + 1], (g[3 * i] + g[3 * i + 3]) / 2, (g[3 * i + 1] + g[3 * i + 4]) / 2);
    ctx.lineTo(g[3 * (n - 1)], g[3 * (n - 1) + 1]);
  }
  function inkMarker(ctx, g, col, w){
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = "round"; ctx.lineCap = "butt";
    var n = g.length / 3;
    if (Math.abs(g[0] - g[3 * (n - 1)]) + Math.abs(g[1] - g[3 * (n - 1) + 1]) < 1) { ctx.fillStyle = col; ctx.fillRect(g[0] - w / 4, g[1] - w / 2, w / 2, w); return; }
    trace(ctx, g); ctx.stroke();
  }
  function rub(ctx, P, from, w){                         // the eraser, from sample `from` on
    var n = P.length / 4, i = Math.max(1, from);
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.lineCap = ctx.lineJoin = "round"; ctx.lineWidth = w;
    ctx.beginPath();
    if (n === 1) { ctx.arc(P[0], P[1], w / 2, 0, 6.2832); ctx.fill(); }
    else { ctx.moveTo(P[4 * (i - 1)], P[4 * (i - 1) + 1]); for (; i < n; i++) ctx.lineTo(P[4 * i], P[4 * i + 1]); ctx.stroke(); }
    ctx.restore();
  }
  function paint(penCtx, markCtx, s, final){
    if (s.tool === "eraser") { if (penCtx) rub(penCtx, s.pts, 0, s.w); if (markCtx) rub(markCtx, s.pts, 0, s.w); return; }
    var g = s.g && final ? s.g : shape(s, final);
    if (s.tool === "marker") { if (markCtx) inkMarker(markCtx, g, s.color, s.w); }
    else if (penCtx) (s.nib === "nib" ? inkNib : inkPen)(penCtx, g, s.color);
  }

  // ---------- the pages' own ink layers (they scroll and zoom with the page) ----------
  var box = document.createElement("div");
  box.id = "ink-layers";
  inner.appendChild(box);
  function factor(d, pg){
    var f = Math.max(1, Math.min(3, kOf(pg) * DPR));
    while (d.w * f * d.h * f > 9e6 && f > 0.6) f *= 0.88;              // a canvas that iPads still accept
    return f;
  }
  function place(pg){
    if (onSheet(pg)) {                                   // the grammar sheet carries its own layers
      var ds = data(pg), ws = pg.offsetWidth + 2 * PAD, hs = pg.offsetHeight + 2 * PAD;
      if (ws !== ds.w || hs !== ds.h) { ds.w = ws; ds.h = hs; ds.dirty = true; }
      ["pen", "mark"].forEach(function(kind){
        var c = ds[kind]; if (!c) return;
        if (c.parentNode !== pg) pg.appendChild(c);
        c.style.left = c.style.top = -PAD + "px"; c.style.width = ws + "px"; c.style.height = hs + "px";
      });
      return;
    }
    var d = data(pg), ir = inner.getBoundingClientRect(), pr = pg.getBoundingClientRect(), k = scaleOf();
    var w = Math.round(pr.width / k) + 2 * PAD, h = Math.round(pr.height / k) + 2 * PAD;
    if (w !== d.w || h !== d.h) { d.w = w; d.h = h; d.dirty = true; }
    ["pen", "mark"].forEach(function(kind){
      var c = d[kind]; if (!c) return;
      var own = pg.offsetParent === inner;                // then offsetLeft / offsetTop are the page's place in the column
      var x = (own ? pg.offsetLeft : (pr.left - ir.left) / k) - PAD, y = (own ? pg.offsetTop : (pr.top - ir.top) / k) - PAD;
      c.style.left = x + "px"; c.style.top = y + "px";
      c.style.width = w + "px"; c.style.height = h + "px";
      // the ink must lie exactly on its page whatever the browser takes as the origin of this layer: look where it
      // landed and move it by the difference (user 2026-10-13, iPad: "yozganda pastga tushib qolyapti")
      var cr = c.getBoundingClientRect(), dx = pr.left - PAD * k - cr.left, dy = pr.top - PAD * k - cr.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        c.style.left = (x + dx / k) + "px"; c.style.top = (y + dy / k) + "px";
        d.fixed = [Math.round(dx), Math.round(dy)];
      }
    });
  }
  function ctxOf(pg, kind, make){
    var d = data(pg), c = d[kind];
    if (!c) {
      if (!make) return null;
      c = d[kind] = document.createElement("canvas");
      c.className = "ink-layer ink-" + kind;
      (onSheet(pg) ? pg : box).appendChild(c);
      place(pg);
      d.dirty = true;
    }
    var ctx = c.getContext("2d");
    ctx.setTransform(d.f, 0, 0, d.f, PAD * d.f, PAD * d.f);
    return ctx;
  }
  function render(pg){                                   // the whole page again, in the order drawn
    var d = data(pg);
    place(pg);
    d.f = factor(d, pg);
    var need = { pen: false, mark: false };
    d.strokes.forEach(function(s){ if (s.tool === "pen") need.pen = true; if (s.tool === "marker") need.mark = true; });
    ["pen", "mark"].forEach(function(kind){
      var c = d[kind];
      if (!need[kind]) { if (c) { c.remove(); d[kind] = null; } return; }
      if (!c) { c = d[kind] = document.createElement("canvas"); c.className = "ink-layer ink-" + kind; (onSheet(pg) ? pg : box).appendChild(c); }
      c.width = Math.round(d.w * d.f); c.height = Math.round(d.h * d.f);          // also wipes it
    });
    place(pg);
    var p = ctxOf(pg, "pen", false), m = ctxOf(pg, "mark", false);
    d.strokes.forEach(function(s){ paint(p, m, s, true); });
    d.dirty = false;
  }
  function release(pg){                                  // far from the screen: the picture goes, the strokes stay
    var d = data(pg);
    ["pen", "mark"].forEach(function(kind){ if (d[kind]) { d[kind].width = d[kind].height = 0; } });
    d.f = 0; d.dirty = true;
  }
  // ---------- the page at rest: the same ink, drawn for the screen ----------
  // A page's own layer is a picture the browser stretches with the page — at most 9 million points for a whole page,
  // so zoomed in (or on a wide iPad) it has fewer points than the screen, and the writing went soft the moment the pen
  // was lifted (user 2026-10-13: "yozib bo'lgandan keyin xira bo'lib qolyapti"). So whenever the page stands still,
  // the ink on the screen is drawn on a screen-sized sheet, point for point as it looked under the pen; the moment
  // the page moves (scroll, zoom) its own layers show the ink again and travel with it.
  var sharp = { pen: null, mark: null }, sharpOn = false, sharpT = 0, sharpAt = null, touching = 0;
  ["mark", "pen"].forEach(function(kind){
    var c = sharp[kind] = document.createElement("canvas");
    c.className = "ink-sharp ink-sharp-" + kind; c.id = "ink-sharp-" + kind; c.width = c.height = 0;
    if (winScroll) surf.parentNode.insertBefore(c, surf);   // topik-soz: after the page content, under the pen's layers
    else so.parentNode.insertBefore(c, kind === "mark" ? so.nextSibling : sharp.mark.nextSibling);   // just above the pages, under everything else
  });
  function sharpCtx(kind, pg, k){                        // that sheet, in the page's own units, cut to the page
    var c = sharp[kind], d = data(pg), r = pg.getBoundingClientRect();
    if (c.width !== surf.width || c.height !== surf.height) { c.width = surf.width; c.height = surf.height; c.style.width = W + "px"; c.style.height = H + "px"; }
    var ctx = c.getContext("2d");
    ctx.save();
    if (onSheet(pg)) {                                   // … and to the window the grammar sheet scrolls in (its bars stay clean)
      var q = gpStage.getBoundingClientRect();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.beginPath(); ctx.rect(q.left, q.top, q.width, q.height); ctx.clip();
    }
    ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * r.left, DPR * r.top);
    ctx.beginPath(); ctx.rect(-PAD, -PAD, d.w, d.h); ctx.clip();
    return ctx;
  }
  function sharpDraw(){
    var any = false, gpo = gpOn(), sc = scroller();
    clearTimeout(sharpT); sharpT = 0;
    ["pen", "mark"].forEach(function(kind){
      var c = sharp[kind]; if (!c.width) return;
      var x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    });
    store.forEach(function(d, pg){
      if (!d.strokes.length || onSheet(pg) !== gpo || !alive(pg)) return;      // only where the teacher is now
      place(pg);
      if (!d.w) return;
      var r = pg.getBoundingClientRect(), k = kOf(pg);
      if (r.bottom + PAD * k < 0 || r.top - PAD * k > H) return;
      var need = { pen: false, mark: false };
      d.strokes.forEach(function(st){ if (st.tool === "pen") need.pen = true; if (st.tool === "marker") need.mark = true; });
      var a = need.pen ? sharpCtx("pen", pg, k) : null, b = need.mark ? sharpCtx("mark", pg, k) : null;
      d.strokes.forEach(function(st){ paint(a, b, st, true); });
      if (a) a.restore(); if (b) b.restore();
      any = true;
    });
    sharpOn = any;
    document.documentElement.classList.toggle("ink-sharp-on", any);     // the pages' own layers step aside
    sharp.pen.style.display = sharp.mark.style.display = any ? "block" : "none";
    sharpAt = any ? [sc.scrollLeft, sc.scrollTop, scaleOf(), gpo] : null;
  }
  function soften(){                                     // the page moves (or is about to): its own layers take over
    clearTimeout(sharpT); sharpT = setTimeout(sharpen, 180);
    if (!sharpOn) return;
    sharpOn = false; sharpAt = null;
    document.documentElement.classList.remove("ink-sharp-on");
    sharp.pen.style.display = sharp.mark.style.display = "none";
  }
  function sharpen(){                                    // … and when it has come to rest, the sheet again
    sharpT = 0;
    if (touching > 0 || pan || multi || glide || (cur && cur.tool === "eraser")) { sharpT = setTimeout(sharpen, 200); return; }
    sharpDraw();
  }
  function sharpAdd(st){                                 // a stroke just written: onto the sheet as it is, nothing redrawn
    var sc = scroller();
    if (!sharpOn || !sharpAt || sharpAt[0] !== sc.scrollLeft || sharpAt[1] !== sc.scrollTop || sharpAt[2] !== scaleOf() || sharpAt[3] !== gpOn()) { sharpDraw(); return; }
    var kind = st.tool === "marker" ? "mark" : "pen", x = sharpCtx(kind, st.page, kOf(st.page));
    paint(kind === "pen" ? x : null, kind === "mark" ? x : null, st, true);
    x.restore();
  }
  // a finger that starts to drag the page: the layers must be back before the page moves under it
  so.addEventListener("touchstart", function(e){ touching = e.touches.length; }, { passive: true, capture: true });
  so.addEventListener("touchmove", soften, { passive: true, capture: true });
  ["touchend", "touchcancel"].forEach(function(t){
    so.addEventListener(t, function(e){ touching = e.touches.length; if (!sharpOn) soften(); }, { passive: true, capture: true });
  });
  so.addEventListener("wheel", soften, { passive: true });
  // the grammar sheet: the same care for its own scroller, and the strokes written on a sheet go when the sheet goes
  var lastSheet = null, lastKey = "", sheetRO = null;
  function gpSync(){
    var on = gpOn(), sh = sheetNow(), key = on ? (gp.querySelector(".lbl") || {}).textContent || "" : "";
    document.documentElement.classList.toggle("gp-on", on);
    if (cur && !alive(cur.page)) drop();
    if (sh !== lastSheet) {
      var d0 = lastSheet && store.get(lastSheet);
      if (d0) {
        store.delete(lastSheet);
        if (sh && key === lastKey && d0.strokes.length && lastSheet._inkW) {   // the same grammar drawn again at another width
          var r = sh.offsetWidth / lastSheet._inkW, d1 = data(sh);
          d0.strokes.forEach(function(st){
            for (var i = 0; i < st.pts.length; i += 4) { st.pts[i] *= r; st.pts[i + 1] *= r; }
            st.w *= r; st.k /= r; st.page = sh; st.g = st.tool === "eraser" ? null : shape(st, true);
          });
          d1.strokes = d0.strokes; d1.dirty = true;
        } else history = history.filter(function(st){ return st.page !== lastSheet; });
      }
      if (sheetRO) { sheetRO.disconnect(); sheetRO = null; }
      if (sh && window.ResizeObserver) { sheetRO = new ResizeObserver(function(){ sh._inkW = sh.offsetWidth; soften(); later(120); }); sheetRO.observe(sh); }
      lastSheet = sh; lastKey = key;
    }
    if (sh) sh._inkW = sh.offsetWidth;
    soften(); later(120);
  }
  if (gpStage) {
    gpStage.addEventListener("scroll", function(){ soften(); if (!refreshT) refreshT = setTimeout(refresh, 140); }, { passive: true });
    gpStage.addEventListener("touchstart", function(e){ touching = e.touches.length; }, { passive: true, capture: true });
    gpStage.addEventListener("touchmove", soften, { passive: true, capture: true });
    ["touchend", "touchcancel"].forEach(function(t){
      gpStage.addEventListener(t, function(e){ touching = e.touches.length; if (!sharpOn) soften(); }, { passive: true, capture: true });
    });
    gpStage.addEventListener("wheel", soften, { passive: true });
    if (window.MutationObserver) {
      new MutationObserver(gpSync).observe(gp, { attributes: true, attributeFilter: ["class"] });
      new MutationObserver(gpSync).observe(gpStage, { childList: true });
    }
  }

  var refreshT = 0;
  function refresh(){
    refreshT = 0;
    store.forEach(function(d, pg){
      if (!d.strokes.length || !alive(pg)) return;
      var r = pg.getBoundingClientRect(), near = r.bottom > -1.2 * H && r.top < 2.2 * H;
      if (!near) { if (d.f) release(pg); return; }
      place(pg);
      if (d.dirty || !d.f || Math.abs(factor(d, pg) - d.f) / d.f > 0.12) render(pg);
    });
  }
  function later(ms){ clearTimeout(refreshT); refreshT = setTimeout(refresh, ms); }
  (winScroll ? window : so).addEventListener("scroll", function(){ soften(); if (!refreshT) refreshT = setTimeout(refresh, 140); }, { passive: true });
  if (window.MutationObserver) new MutationObserver(function(){ soften(); later(200); }).observe(inner, { attributes: true, attributeFilter: ["style"] });   // zoom
  if (window.ResizeObserver) new ResizeObserver(function(){ soften(); later(120); }).observe(inner);                                                   // a page grew

  // ---------- the stroke being drawn (on the screen-sized layer, for the least delay) ----------
  function sizeSurf(){
    DPR = Math.min(3, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
    surf.width = Math.round(W * DPR); surf.height = Math.round(H * DPR);
    surf.style.width = W + "px"; surf.style.height = H + "px";
    tail.width = surf.width; tail.height = surf.height; tail.style.width = W + "px"; tail.style.height = H + "px";
    if (cur) cur.L = null;
    soften();
    live(); later(150);
  }
  function live(){ if (!liveRaf) liveRaf = requestAnimationFrame(drawLive); }
  // The stroke being written used to be drawn again from its first point on every frame: the longer (the faster) the
  // writing, the slower each frame, until the pen stuck (user 2026-10-13: "ro'chkada tez yozilsa qotib qolyapti").
  // Now what is written stays on this layer and each frame adds only what came since; the last few points — which
  // still move as the pen goes on (the curve into the tip, a brush's pointed end) — are drawn on a second layer that is
  // wiped every frame. The marker and a line being straightened are one short path: they are still drawn whole.
  function wipe(ctx, c){ ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); }
  function drawLive(){
    liveRaf = 0;
    var s = cur;
    wipe(tctx, tail);
    if (!s || s.tool !== "pen" || s.straight) {
      wipe(lctx, surf);
      if (s) s.L = null;
      if (s && s.tool !== "eraser") {
        var r0 = s.page.getBoundingClientRect(), k0 = kOf(s.page);
        lctx.setTransform(DPR * k0, 0, 0, DPR * k0, DPR * r0.left, DPR * r0.top);
        paint(lctx, lctx, s, false);
      }
    } else {
      var r = s.page.getBoundingClientRect(), k = kOf(s.page), L = s.L, ink = s.nib === "nib" ? inkNib : inkPen;
      if (L && (L.x !== r.left || L.y !== r.top || L.k !== k)) L = null;      // the page moved under the stroke: from the start
      if (!L) { wipe(lctx, surf); L = s.L = startShape(s); L.done = 0; L.at = null; L.x = r.left; L.y = r.top; L.k = k; }
      growShape(s, L);
      var G = L.G, n = G.length / 3, P = s.pts, hold = s.nib === "brush" ? (s.pen ? 6 : 11) : 2, upto = n - 1 - hold;
      lctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * r.left, DPR * r.top);
      tctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * r.left, DPR * r.top);
      if (n) {
        if (!L.at) L.at = [G[0], G[1], G[2]];
        if (upto > L.done) {                               // these points will not change any more: onto the lasting layer
          L.at = ink(lctx, L.at.slice(0, 3).concat(G.slice(3 * (L.done + 1), 3 * (upto + 2))), s.color, true, L.at.length > 3 ? L.at.slice(3) : null);
          L.done = upto;
        }
        var T = L.at.slice(0, 3).concat(G.slice(3 * (L.done + 1)));
        T.push(P[P.length - 4], P[P.length - 3], L.sw);                        // the line always reaches the tip of the pen
        taper(s, T, false, n + 1);
        ink(tctx, T, s.color, false, L.done && L.at.length > 3 ? L.at.slice(3) : null);
      }
    }
    if (ring) {                                          // where the eraser is
      lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      lctx.beginPath(); lctx.arc(ring[0], ring[1], ERASER / 2, 0, 6.2832);
      lctx.lineWidth = 1.5; lctx.strokeStyle = "rgba(60,70,90,.55)"; lctx.stroke();
    }
  }
  function local(e, s){                                  // a screen point in the page's own units
    var r = s.rect, k = s.k;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }
  function begin(e){
    var pg = pageAt(e.clientY), r = pg.getBoundingClientRect(), k = kOf(pg), t = toolNow(), v = +slider.value || 3;
    cancelAnimationFrame(glide); glide = 0;
    cur = { id: e.pointerId, page: pg, rect: r, k: k, tool: t, nib: t === "pen" ? nib : "", color: colorNow(), pen: e.pointerType === "pen", pts: [], straight: false,
            w: (t === "eraser" ? ERASER : t === "marker" ? v * 1.9 : v) / k, hold: 0, hx: e.clientX, hy: e.clientY, hx0: e.clientX, hy0: e.clientY, done: 0,
            t0: performance.now(), seen: performance.now(), hit: t === "marker" ? null : hitAt(e.clientX, e.clientY), far: 0 };
    surf.classList.toggle("ink-marking", t === "marker");
    if (t === "eraser") { ring = [e.clientX, e.clientY]; soften(); }    // the eraser rubs the layers themselves
    add(e);
  }
  function add(e){
    var s = cur, p = local(e, s), P = s.pts, n = P.length / 4, pr = e.pressure > 0 ? e.pressure : 0.5;
    s.seen = performance.now();
    s.far = Math.max(s.far, Math.abs(e.clientX - s.hx0) + Math.abs(e.clientY - s.hy0));
    if (s.straight) { P[4] = p[0]; P[5] = p[1]; P[6] = pr; P[7] = e.timeStamp; }
    else {
      if (n && Math.abs(p[0] - P[4 * n - 4]) + Math.abs(p[1] - P[4 * n - 3]) < 0.3 / s.k) return;
      P.push(p[0], p[1], pr, e.timeStamp);
    }
    if (s.tool === "eraser") {
      ring = [e.clientX, e.clientY];
      var a = ctxOf(s.page, "pen", false), b = ctxOf(s.page, "mark", false);
      if (a) rub(a, P, s.done, s.w); if (b) rub(b, P, s.done, s.w);
      s.done = P.length / 4 - 1;
      return;
    }
    // hold still → straight line
    if (Math.abs(e.clientX - s.hx) + Math.abs(e.clientY - s.hy) > 5) {
      s.hx = e.clientX; s.hy = e.clientY;
      clearTimeout(s.hold);
      if (!s.straight) s.hold = setTimeout(function(){ straighten(s); }, 700);
    }
  }
  function straighten(s){
    if (cur !== s || s.straight) return;
    if (performance.now() - s.seen > 1500) { drop(); return; }      // the screen stopped reporting this pen: no line left hanging
    var P = s.pts, n = P.length / 4; if (n < 6) return;
    var x0 = P[0], y0 = P[1], x1 = P[4 * n - 4], y1 = P[4 * n - 3], dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy), far = 0, i;
    if (L * s.k < 48) return;
    for (i = 1; i < n - 1; i++) far = Math.max(far, Math.abs((P[4 * i] - x0) * dy - (P[4 * i + 1] - y0) * dx) / L);
    if (far > L * 0.12) return;                           // not meant as a line
    s.straight = true;
    s.pts = [x0, y0, 0.5, P[3], x1, y1, 0.5, P[4 * n - 1]];
    live();
  }
  function commit(){
    var s = cur; cur = null; ring = null;
    if (!s) return;
    clearTimeout(s.hold);
    surf.classList.remove("ink-marking");
    live();
    if (!s.pts.length) return;
    var d = data(s.page);
    if (s.tool === "eraser" && !d.strokes.length) return;
    s.g = s.tool === "eraser" ? null : shape(s, true);
    d.strokes.push(s); history.push(s);
    if (s.tool === "eraser") { sharpDraw(); return; }     // already rubbed out as it went
    var kind = s.tool === "marker" ? "mark" : "pen";
    if (d.dirty || !d.f || !d[kind]) render(s.page);
    else {
      var c = ctxOf(s.page, kind, false);
      paint(kind === "pen" ? c : null, kind === "mark" ? c : null, s, true);
    }
    sharpAdd(s);
  }
  function drop(){                                       // a stroke that turned out to be the start of a pinch
    var s = cur; cur = null; ring = null;
    if (!s) return;
    clearTimeout(s.hold);
    surf.classList.remove("ink-marking");
    if (s.tool === "eraser") { render(s.page); soften(); }
    live();
  }
  function here(st){ return alive(st.page) && onSheet(st.page) === gpOn(); }   // on the book, or on the open grammar sheet
  function undo(){
    var j = history.length - 1;
    while (j >= 0 && !here(history[j])) j--;
    if (j < 0) return;
    var s = history.splice(j, 1)[0];
    var d = data(s.page), i = d.strokes.lastIndexOf(s);
    if (i >= 0) d.strokes.splice(i, 1);
    render(s.page);
    sharpDraw();
  }
  function clearAll(){
    var gpo = gpOn();
    history = history.filter(function(st){ return alive(st.page) && onSheet(st.page) !== gpo; });
    store.forEach(function(d, pg){
      if (onSheet(pg) !== gpo) return;
      d.strokes = []; ["pen", "mark"].forEach(function(kind){ if (d[kind]) { d[kind].remove(); d[kind] = null; } }); d.f = 0; d.dirty = true;
    });
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, surf.width, surf.height);
    sharpDraw();
  }

  // ---------- a finger moving the page while the Pencil is the one that draws ----------
  // The hand that holds the Pencil lies on the glass: its touches must never move the page, zoom it or end the stroke
  // being written (user 2026-10-13: "yozsam yozgan joyimda turmayapti"). So a touch is a hand, not a finger, when it
  // is large, when it lands while the Pencil writes or just after, or when the Pencil comes down during it — and a
  // finger starts to move the page only after it has really travelled; if the Pencil then comes down after all, the
  // page goes back to where it was.
  var palm = {}, lastPan = null;
  function panStart(e){
    cancelAnimationFrame(glide); glide = 0;
    pan = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: e.timeStamp, live: false,
            rx: e.clientX, ry: e.clientY, rt: e.timeStamp, v: 0,
            sc: scroller(), sl: scroller().scrollLeft, st: scroller().scrollTop, born: e.timeStamp, hit: hitAt(e.clientX, e.clientY) };
    try { surf.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function panMove(e){
    if (!pan.live) {
      var far = Math.abs(e.clientX - pan.x0) + Math.abs(e.clientY - pan.y0);
      // a finger moves the page when it has gone 22 px AND is really moving (70 px a second or more) — however long it
      // rested first. A hand that settles only creeps (it was 50 px in 1.5 s when it dragged the page down under the
      // writing): slow, so it never starts to move the page.
      var age = e.timeStamp - pan.rt;
      if (age >= 40) pan.v = (Math.abs(e.clientX - pan.rx) + Math.abs(e.clientY - pan.ry)) / age;
      if (age > 150) { pan.rx = e.clientX; pan.ry = e.clientY; pan.rt = e.timeStamp; }
      if (far < 22 || !(pan.v >= 0.07)) return;
      pan.live = true; pan.x = e.clientX; pan.y = e.clientY; pan.t = e.timeStamp;
      return;
    }
    var dx = e.clientX - pan.x, dy = e.clientY - pan.y, dt = Math.max(1, e.timeStamp - pan.t);
    pan.sc.scrollLeft -= dx; pan.sc.scrollTop -= dy;
    pan.vx = 0.7 * (dx / dt) + 0.3 * pan.vx; pan.vy = 0.7 * (dy / dt) + 0.3 * pan.vy;
    pan.x = e.clientX; pan.y = e.clientY; pan.t = e.timeStamp;
  }
  function panEnd(e){
    var vx = pan.vx, vy = pan.vy, last = performance.now(), was = pan;
    if (!pan.live || e.timeStamp - pan.t > 80) vx = vy = 0;          // it never moved, or stopped before it left
    lastPan = { sl: was.sl, st: was.st, at: last, live: was.live };
    pan = null;
    (function step(now){
      var dt = Math.min(40, now - last); last = now;
      if (Math.abs(vx) + Math.abs(vy) < 0.03) { glide = 0; return; }
      was.sc.scrollLeft -= vx * dt; was.sc.scrollTop -= vy * dt;
      vx *= Math.pow(0.996, dt); vy *= Math.pow(0.996, dt);
      glide = requestAnimationFrame(step);
    })(last);
  }
  function handDown(){                                   // the Pencil touches the glass: whatever the hand did is undone
    cancelAnimationFrame(glide); glide = 0;
    // only a touch still on the glass is the hand: what it moved goes back. A finger that moved the page and left
    // meant it — the page stays there (it used to jump back when the Pencil came down right after a scroll)
    if (pan) { if (pan.live) { pan.sc.scrollLeft = pan.sl; pan.sc.scrollTop = pan.st; } palm[pan.id] = 1; pan = null; }
    if (carry && carry.touch) { palm[carry.id] = 1; carryEnd(null, true); }
    lastPan = null;
    Object.keys(fingers).forEach(function(k){ palm[k] = 1; });
    fingers = {}; multi = false;
    if (window.__pinchCancel) window.__pinchCancel();
    if (cur && !cur.pen) drop();
  }
  // the pinch (zoom) code asks before it takes two touches on the pen's layer
  // (and over the grammar sheet two fingers move the sheet — see pointermove — they do not zoom the book under it)
  window.__inkBusy = function(){ return gpOn() || !!(cur && cur.pen) || performance.now() - lastPen < 400; };

  // ---------- a tap meant for the page ----------
  // The stroke starts as always; if it ends as a tap on a button of the page, it is taken back and the button gets
  // the click — the browser's own click (it arrives right after), so that a recording is allowed to start.
  var TAPPABLE = "button, a[href], .qa, .gref, .qa-sc .ln, .rt, .rt-an, .rt-ans, .rt-x, .toc-go, .toc-row, .audio-btn, .chip-btn, .time, .time-close, .fp-row" +
                 (window.INK_TAPPABLE ? ", " + window.INK_TAPPABLE : "");   // topik-soz: each page adds its own clickable things
  var tapHit = null, touchHits = {};
  function hitAt(x, y){
    var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] === surf) continue;
      var h = list[i].closest ? list[i].closest(TAPPABLE) : null;       // only what lies right under the pen counts
      return h && !h.disabled ? h : null;
    }
    return null;
  }
  // … and the things that lie ON the page and can be carried about: a press on one of them carries it
  var carry = null;
  function movableAt(x, y){
    var list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [], i;
    for (i = 0; i < list.length; i++) {
      if (list[i] === surf) continue;
      var m = list[i].closest ? list[i].closest(".qa-sc, .qa-bar") : null;
      return m && list[i].tagName !== "INPUT" && m.closest(".page") ? m : null;
    }
    return null;
  }
  function carryStart(e, el){
    var pg = el.closest(".page");
    carry = { el: el, pg: pg, id: e.pointerId, x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, on: false,
              k: pg.getBoundingClientRect().width / (pg.offsetWidth || 794) || 1, touch: e.pointerType === "touch",
              hit: hitAt(e.clientX, e.clientY), born: performance.now() };
    try { surf.setPointerCapture(e.pointerId); } catch (x) {}
  }
  function carryMove(e){
    var c = carry, dx = e.clientX - c.x, dy = e.clientY - c.y;
    if (!c.on) {
      if (Math.abs(dx) + Math.abs(dy) < 8) return;
      c.on = true; c.el.classList.add("moving");
      if (c.el.classList.contains("qa-sc")) c.el.classList.add("moved");   // it no longer points at its badge
    }
    c.el.style.left = Math.max(0, Math.min(c.l + dx / c.k, c.pg.offsetWidth - c.el.offsetWidth)) + "px";
    c.el.style.top = Math.max(0, Math.min(c.t + dy / c.k, c.pg.offsetHeight - c.el.offsetHeight)) + "px";
  }
  function carryEnd(e, back){
    var c = carry; carry = null;
    if (!c) return;
    c.el.classList.remove("moving");
    if (back) { c.el.style.left = c.l + "px"; c.el.style.top = c.t + "px"; }           // it was the hand, not a finger
    else if (!c.on && c.hit && e && e.type === "pointerup" && performance.now() - c.born < 600) tapHit = { el: c.hit, at: performance.now() };
  }
  surf.addEventListener("click", function(){
    var t = tapHit; tapHit = null;
    if (t && isOn() && performance.now() - t.at < 900 && document.documentElement.contains(t.el)) t.el.click();
  });

  // ---------- input ----------
  surf.addEventListener("pointerdown", function(e){
    if (!isOn()) return;
    if (e.pointerType === "touch") {
      // the hand: it lands while the Pencil writes or right after it, or it is a broad contact. (These limits were 1.5 s and
      // 48 px: a finger that scrolled soon after writing, or lay a little flat, was taken for the hand and the page did
      // not move — user 2026-10-13: "chizish bosilgan turganda barmoq bilan sursa yurmayapti".)
      if ((cur && cur.pen) || performance.now() - lastPen < 400 || e.width > 90 || e.height > 90) { palm[e.pointerId] = 1; return; }
      fingers[e.pointerId] = [e.clientX, e.clientY];
      if (Object.keys(fingers).length >= 2) { if (cur && !cur.pen) drop(); pan = null; if (carry) carryEnd(null, true); multi = true; return; }   // two fingers: zoom / move
    }
    var mov = toolNow() === "eraser" ? null : movableAt(e.clientX, e.clientY);
    if (e.pointerType === "touch" && penSeen) { if (mov && !carry) carryStart(e, mov); else if (!carry) panStart(e); return; }
    if (e.pointerType === "pen") { penSeen = true; lastPen = performance.now(); handDown(); }
    if (cur && performance.now() - cur.seen > 1200) drop();              // a stroke the screen never finished: let it go
    if (multi || cur || carry || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (mov) { carryStart(e, mov); return; }
    e.preventDefault();
    try { surf.setPointerCapture(e.pointerId); } catch (x) {}
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) sel.removeAllRanges();
    begin(e);
    live();
  });
  surf.addEventListener("pointermove", function(e){
    if (palm[e.pointerId]) return;
    if (fingers[e.pointerId]) {                           // two fingers on the grammar sheet: they move it
      var f0 = fingers[e.pointerId];
      if (multi && gpOn()) gpStage.scrollTop -= (e.clientY - f0[1]) / Object.keys(fingers).length;
      fingers[e.pointerId] = [e.clientX, e.clientY];
    }
    if (carry && e.pointerId === carry.id) { e.preventDefault(); carryMove(e); return; }
    if (pan && e.pointerId === pan.id) { if (!multi) panMove(e); return; }
    if (!cur || e.pointerId !== cur.id) return;
    e.preventDefault();
    if (cur.pen) lastPen = performance.now();
    var list = e.getCoalescedEvents ? e.getCoalescedEvents() : null, n = list ? list.length : 0;
    // some browsers report the in-between samples in other coordinates: they are used only if they end where the event is
    if (!n || Math.abs(list[n - 1].clientX - e.clientX) + Math.abs(list[n - 1].clientY - e.clientY) > 3) list = [e];
    for (var i = 0; i < list.length && cur; i++) add(list[i]);
    live();
  });
  function up(e){
    if (palm[e.pointerId]) { delete palm[e.pointerId]; return; }
    if (e.pointerType === "touch") { delete fingers[e.pointerId]; if (!Object.keys(fingers).length) multi = false; }
    if (carry && e.pointerId === carry.id) { carryEnd(e, false); return; }
    if (pan && e.pointerId === pan.id) {
      if (e.type === "pointerup" && !multi) { if (!pan.live && pan.hit) tapHit = { el: pan.hit, at: performance.now() }; panEnd(e); }
      else pan = null;
      return;
    }
    if (!cur || e.pointerId !== cur.id) return;
    if (cur.pen) lastPen = performance.now();
    if (e.type === "pointerup" && cur.hit && cur.far < 10 && performance.now() - cur.t0 < 600) {   // a tap on a button of the page
      tapHit = { el: cur.hit, at: performance.now() };
      drop();
    }
    else if (e.type === "pointerup") { add(e); commit(); }
    else if (cur.pen && cur.pts.length > 4) commit();     // the system took the Pencil's touch away: what was written stays
    else drop();
  }
  surf.addEventListener("pointerup", up);
  surf.addEventListener("pointercancel", up);
  // however a stroke ends for the screen — the pen taken away by the system, the tab hidden, the tool switched off —
  // it ends for us too: nothing may stay "stuck" on the glass
  function reset(){ pan = null; fingers = {}; palm = {}; multi = false; if (carry) carryEnd(null, false); }
  surf.addEventListener("lostpointercapture", function(e){ if (cur && e.pointerId === cur.id) { if (cur.pts.length > 4) commit(); else drop(); } });
  document.addEventListener("visibilitychange", function(){ if (document.hidden) { drop(); reset(); } });
  window.addEventListener("blur", function(){ if (cur) { if (cur.pts.length > 4) commit(); else drop(); } reset(); });
  toggle.addEventListener("click", function(){ if (!isOn()) { drop(); reset(); } });
  surf.addEventListener("contextmenu", function(e){ if (isOn()) e.preventDefault(); });
  surf.addEventListener("wheel", function(e){
    if (!isOn() || e.ctrlKey || cur) return;
    var sc = scroller(), u = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
    sc.scrollTop += e.deltaY * u; sc.scrollLeft += e.deltaX * u;
  }, { passive: true });
  // iPad: a touch that rests on the page selects the text under it and offers "Copy" — not while the pen tool is on.
  // (preventDefault on the touch itself is what stops the long-press menu and the magnifier; the pointer events above
  // still arrive.)
  // … except a touch that lands on a button of the page: left alone, the browser turns it into a click (see above)
  ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(function(t){
    surf.addEventListener(t, function(e){
      if (!isOn()) return;
      var c = e.changedTouches, i, own = false;
      if (t === "touchstart") for (i = 0; i < c.length; i++) if (hitAt(c[i].clientX, c[i].clientY)) touchHits[c[i].identifier] = 1;
      for (i = 0; i < c.length; i++) if (touchHits[c[i].identifier]) own = true;
      if (t === "touchend" || t === "touchcancel") for (i = 0; i < c.length; i++) delete touchHits[c[i].identifier];
      if (own && t !== "touchmove") return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
  });
  document.addEventListener("selectstart", function(e){
    if (!isOn()) return;
    var t = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
    if (t && t.closest && t.closest("#draw-toolbar, #draw-color-pop, input, textarea, [contenteditable='true']")) return;
    e.preventDefault();
  });
  function markOn(){
    var on = isOn();
    document.documentElement.classList.toggle("ink-on", on);
    if (on) { var sel = window.getSelection && window.getSelection(); if (sel && sel.rangeCount) sel.removeAllRanges(); }
  }
  if (window.MutationObserver) new MutationObserver(markOn).observe(surf, { attributes: true, attributeFilter: ["style"] });
  markOn();

  // ---------- buttons ----------
  if (bar && eraserBtn && !document.getElementById("draw-undo-btn")) {
    var u = document.createElement("button");
    u.type = "button"; u.id = "draw-undo-btn"; u.className = "draw-btn"; u.title = "Oxirgi chiziqni qaytarish";
    u.setAttribute("aria-label", u.title);
    u.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>';
    bar.insertBefore(u, eraserBtn);
    u.addEventListener("click", function(e){ e.stopPropagation(); undo(); });
  }
  var typeRow = pop.querySelector(".type-row");
  if (typeRow && !pop.querySelector(".nib-row")) {
    var nibRow = document.createElement("div");
    nibRow.className = "nib-row";
    [["plain", "Oddiy", "Oddiy qalam — bir tekis chiziq", '<path d="M2 11C6 3 10 3 13 10s7 6 11-2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'],
     ["nib", "Pat", "Pat ruchka — kalligrafiya: pastga qalin, yonga nozik", '<path d="M3.5 8.5C7.5.5 11.5.5 14.5 7.5s7 7 11-1l-3 3c-4 8-8 8-11 1s-7-7-11 1z" fill="currentColor"/>'],
     ["brush", "Mo'yqalam", "Mo'yqalam (붓펜) — sekin yozsa to'la, tez yozsa ingichka", '<path d="M2 11C7 3 11 3 13 9c2 6 7 5 11-2-4 9.5-9.5 10.5-12 4C10 6 7 6 2 11z" fill="currentColor"/>']
    ].forEach(function(o){
      var b = document.createElement("button");
      b.type = "button"; b.className = "nib-btn" + (o[0] === nib ? " active" : ""); b.dataset.nib = o[0]; b.title = o[2];
      b.setAttribute("aria-label", o[2]);
      b.innerHTML = '<svg viewBox="0 0 26 18" aria-hidden="true">' + o[3] + '</svg><span>' + o[1] + '</span>';
      b.addEventListener("click", function(e){
        e.stopPropagation();
        nib = o[0];
        try { localStorage.setItem("gettopik_nib", nib); } catch (x) {}
        Array.prototype.forEach.call(nibRow.children, function(c){ c.classList.toggle("active", c === b); });
      });
      nibRow.appendChild(b);
    });
    typeRow.parentNode.insertBefore(nibRow, typeRow.nextSibling);
    // the kinds belong to Qalam: with Marker or Lazer chosen the row steps aside
    var nibShow = function(){ var b = pop.querySelector(".type-btn.active"); nibRow.style.display = !b || b.dataset.type === "pen" ? "" : "none"; };
    pop.addEventListener("click", function(){ setTimeout(nibShow, 0); }, true);
    nibShow();
  }
  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  document.addEventListener("keydown", function(e){
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я") && isOn()) {
      var t = e.target;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault(); undo();
    }
  });
  if (/[?&]inkdebug/.test(location.search)) {
    var dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;left:6px;top:6px;z-index:9999;max-width:70vw;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#fff;font:11px/1.35 monospace;white-space:pre-wrap;pointer-events:none";
    document.body.appendChild(dbg);
    var lastEv = "";
    surf.addEventListener("pointerdown", function(e){ lastEv = e.pointerType + " y=" + Math.round(e.clientY) + " w=" + Math.round(e.width) + " p=" + (+e.pressure).toFixed(2); }, true);
    var oldCommit = commit;
    commit = function(){
      var s = cur; oldCommit();
      if (!s) return;
      var d = data(s.page), c = d.pen || d.mark, pr = s.page.getBoundingClientRect(), cr = c ? c.getBoundingClientRect() : null, vv = window.visualViewport, sr = surf.getBoundingClientRect();
      dbg.textContent = "ink debug\n" + lastEv + " tool=" + s.tool + " pts=" + s.pts.length / 4 +
        "\nDPR=" + window.devicePixelRatio + " inner=" + window.innerWidth + "x" + window.innerHeight + " client=" + document.documentElement.clientWidth + "x" + document.documentElement.clientHeight +
        (vv ? "\nvv=" + Math.round(vv.width) + "x" + Math.round(vv.height) + " off=" + Math.round(vv.offsetLeft) + "," + Math.round(vv.offsetTop) + " scale=" + (+vv.scale).toFixed(2) : "") +
        "\nsurf=" + [sr.left, sr.top, sr.width, sr.height].map(Math.round).join(",") + " bmp=" + surf.width + "x" + surf.height +
        "\nscale=" + scaleOf().toFixed(3) + " f=" + (+d.f).toFixed(2) + " scrollTop=" + Math.round(so.scrollTop) +
        "\npage=" + [pr.left, pr.top, pr.width, pr.height].map(Math.round).join(",") +
        (cr ? "\nlayer=" + [cr.left, cr.top, cr.width, cr.height].map(Math.round).join(",") + " want=" + Math.round(pr.left - PAD * s.k) + "," + Math.round(pr.top - PAD * s.k) + " bmp=" + c.width + "x" + c.height : "") +
        "\nfixed=" + (d.fixed ? d.fixed.join(",") : "no") + " penSeen=" + penSeen;
    };
  }
  window.addEventListener("resize", sizeSurf);
  sizeSurf();
})();/*INK2-end*/
