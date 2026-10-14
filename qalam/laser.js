/*LZR*/(function(){
  // Lazer: a kind beside Qalam and Marker. The line glows and, a second after the pen is lifted, fades away — for
  // pointing the class at something without leaving ink behind.
  // It never covers the page: a finger still scrolls, taps a cell and opens the keyboard; the pen (Apple Pencil) draws
  // the laser — and does not scroll the page while it does; on a computer, dragging the mouse draws it (a click stays
  // a click).
  var ink = document.getElementById("draw-canvas"), pop = document.getElementById("draw-color-pop");
  if (!ink || !pop || document.getElementById("laser-canvas")) return;
  var row = pop.querySelector(".type-row"), toggle = document.getElementById("draw-toggle-btn"), penBtn = document.getElementById("draw-pen-btn");
  var cv = document.createElement("canvas");
  cv.id = "laser-canvas";
  document.body.appendChild(cv);
  var ctx = cv.getContext("2d"), dpr = 1;
  function size(){
    dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
    cv.style.width = window.innerWidth + "px"; cv.style.height = window.innerHeight + "px";
  }
  size(); window.addEventListener("resize", size);

  var btn = document.createElement("button");
  btn.type = "button"; btn.className = "type-btn"; btn.dataset.type = "laser";
  btn.title = "Lazer — ruchka (yoki sichqoncha) bilan chiziladi, 1 soniyadan keyin yo'qoladi; barmoq sahifani aylantiradi";
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg><span>Lazer</span>';
  row.appendChild(btn);

  var on = false, color = "#E8264A", strokes = [], cur = null, raf = 0, self = false;
  function inkOn(){ return ink.style.pointerEvents === "auto"; }
  // iPad: Scribble turns an Apple Pencil line drawn over a writable field (an answer line, a model answer, the 원고지)
  // into handwritten letters typed into it — while the laser is on, nothing on the page is writable
  var locked = [];
  function lockEditing(v){
    if (v) {
      Array.prototype.forEach.call(document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]'), function(el){
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") { if (!el.readOnly) { el.readOnly = true; locked.push(el); } }
        else { el.setAttribute("contenteditable", "false"); locked.push(el); }
      });
      if (document.activeElement && document.activeElement.blur && document.activeElement !== document.body) document.activeElement.blur();
    } else {
      locked.forEach(function(el){
        if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") el.readOnly = false; else el.setAttribute("contenteditable", "true");
      });
      locked = [];
    }
  }
  function setOn(v){
    if (v !== on) lockEditing(v);
    on = v;
    btn.classList.toggle("active", v);
    if (penBtn) penBtn.classList.toggle("laser", v);
    if (v) {
      Array.prototype.forEach.call(row.querySelectorAll(".type-btn"), function(b){ if (b !== btn) b.classList.remove("active"); });
      Array.prototype.forEach.call(pop.querySelectorAll(".swatch"), function(b){ b.classList.toggle("active", b.dataset.color === color); });
      if (inkOn() && toggle) { self = true; toggle.click(); self = false; }   // the ink layer off: the page stays usable
    }
  }
  btn.addEventListener("click", function(e){ e.stopPropagation(); setOn(!on); });
  // Qalam / Marker / the eraser / Chizish: back to ink
  Array.prototype.forEach.call(row.querySelectorAll(".type-btn"), function(b){ if (b !== btn) b.addEventListener("click", function(){ setOn(false); }); });
  var er = document.getElementById("draw-eraser-btn");
  if (er) er.addEventListener("click", function(){ setOn(false); });
  if (toggle) toggle.addEventListener("click", function(){ if (!self) setOn(false); });
  // a colour picked while the laser is on colours the laser
  Array.prototype.forEach.call(pop.querySelectorAll(".swatch"), function(b){
    b.addEventListener("click", function(e){
      if (!on) return;
      e.stopImmediatePropagation(); e.stopPropagation();
      color = b.dataset.color;
      Array.prototype.forEach.call(pop.querySelectorAll(".swatch"), function(s){ s.classList.toggle("active", s === b); });
    }, true);
  });

  function ui(t){ return t && t.closest && t.closest("#draw-toolbar, #draw-color-pop"); }
  // the pen's touch is taken from its very start (Scribble — iPad's handwriting into fields — never starts then);
  // only the pen tool's own buttons and the page's buttons still take a pen tap
  function stylus(e){ for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].touchType === "stylus") return true; return false; }
  document.addEventListener("touchstart", function(e){
    if (!on || !stylus(e) || ui(e.target) || (e.target.closest && e.target.closest("button, a, .rt-pill, .rt-bar"))) return;
    e.preventDefault();
  }, { passive: false, capture: true });
  // the pen must not scroll the page while it draws (the finger still does)
  document.addEventListener("touchmove", function(e){
    if (!on) return;
    for (var i = 0; i < e.touches.length; i++) if (e.touches[i].touchType === "stylus") { e.preventDefault(); return; }
  }, { passive: false, capture: true });
  window.addEventListener("pointerdown", function(e){
    if (!on || e.pointerType === "touch" || ui(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (e.pointerType === "pen" && !(e.target.closest && e.target.closest("button, a, .rt-pill, .rt-bar"))) e.preventDefault();
    cur = { id: e.pointerId, pts: [[e.clientX, e.clientY]], color: color, end: 0, shown: e.pointerType === "pen", mouse: e.pointerType === "mouse" };
    if (cur.shown) { strokes.push(cur); loop(); }
  }, true);
  window.addEventListener("pointermove", function(e){
    if (!cur || e.pointerId !== cur.id) return;
    var ev = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (ev.length ? ev : [e]).forEach(function(c){ cur.pts.push([c.clientX, c.clientY]); });
    if (!cur.shown) {                                      // the mouse: only a real drag draws (a click stays a click)
      var p0 = cur.pts[0];
      if (Math.abs(e.clientX - p0[0]) + Math.abs(e.clientY - p0[1]) < 6) return;
      cur.shown = true; strokes.push(cur);
      document.documentElement.style.userSelect = "none";
    }
    if (window.getSelection && cur.mouse) window.getSelection().removeAllRanges();
    e.preventDefault();
    loop();
  }, true);
  function up(e){
    if (!cur || e.pointerId !== cur.id) return;
    cur.end = performance.now(); cur = null;
    document.documentElement.style.userSelect = "";
    loop();
  }
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);

  var HOLD = 1000, FADE = 300;
  function loop(){ if (!raf) raf = requestAnimationFrame(draw); }
  function draw(){
    var now = performance.now();
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    strokes = strokes.filter(function(s){ return !s.end || now - s.end < HOLD + FADE; });
    strokes.forEach(function(s){
      var a = s.end && now - s.end > HOLD ? 1 - (now - s.end - HOLD) / FADE : 1;
      if (s.pts.length < 2) s.pts.push([s.pts[0][0] + 0.1, s.pts[0][1]]);
      function path(){
        ctx.beginPath(); ctx.moveTo(s.pts[0][0], s.pts[0][1]);
        for (var i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      }
      // the glow, then the bright core
      ctx.shadowColor = s.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = s.color; ctx.lineWidth = 7; ctx.globalAlpha = a * 0.55; path(); ctx.stroke();
      ctx.shadowBlur = 8; ctx.globalAlpha = a; ctx.lineWidth = 3.5; path(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 1.4; path(); ctx.stroke();
    });
    ctx.globalAlpha = 1;
    if (strokes.length) loop();
  }
})();/*LZR-end*/
