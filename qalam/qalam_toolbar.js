// Pen tool: the toolbar's own logic (load BEFORE _laser.js and _ink.js).
// ---------- draw tool (freehand ink overlay so a teacher can mark up whatever is on screen) ----------
  (function(){
    var canvas = document.getElementById("draw-canvas");
    var dctx = canvas.getContext("2d");
    var penBtn = document.getElementById("draw-pen-btn");
    var toggleBtn = document.getElementById("draw-toggle-btn");
    var eraserBtn = document.getElementById("draw-eraser-btn");
    var clearBtn = document.getElementById("draw-clear-btn");
    var colorPop = document.getElementById("draw-color-pop");

    var thicknessSlider = document.getElementById("draw-thickness");

    var dtool = "pen"; // "pen" | "marker" | "eraser"
    var dcolor = "#1a1a2e";
    var penWidth = 3.2, markerWidth = 9; // each type remembers its own thickness
    var drawOn = false, drawing = false, lastX = 0, lastY = 0;

    function resizeDrawCanvas(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resizeDrawCanvas();
    window.addEventListener("resize", resizeDrawCanvas);

    function setDrawOn(on){
      drawOn = on;
      canvas.style.pointerEvents = on ? "auto" : "none";
      canvas.style.cursor = dtool === "eraser" ? "cell" : "crosshair";
      toggleBtn.classList.toggle("on", on);
    }

    function syncThicknessSlider(){
      if (dtool === "marker") { thicknessSlider.min = 4; thicknessSlider.max = 18; thicknessSlider.value = markerWidth; }
      else { thicknessSlider.min = 1; thicknessSlider.max = 10; thicknessSlider.value = penWidth; }
    }

    function selectTool(t, c){
      dtool = t;
      if (c) dcolor = c;
      penBtn.classList.toggle("active", t === "pen" || t === "marker");
      eraserBtn.classList.toggle("active", t === "eraser");
      Array.prototype.forEach.call(colorPop.querySelectorAll(".type-btn"), function(b){ b.classList.toggle("active", b.dataset.type === t); });
      Array.prototype.forEach.call(colorPop.querySelectorAll(".swatch"), function(b){ b.classList.toggle("active", b.dataset.color === dcolor); });
      if (t !== "eraser") syncThicknessSlider();
      setDrawOn(true);
    }

    penBtn.onclick = function(e){
      e.stopPropagation();
      var open = !colorPop.classList.contains("open");
      colorPop.classList.toggle("open", open);
      if (open) {
        syncThicknessSlider();
        var r = penBtn.getBoundingClientRect();
        colorPop.style.right = (window.innerWidth - r.right) + "px";
        colorPop.style.bottom = (window.innerHeight - r.top + 10) + "px";
      }
    };
    document.addEventListener("click", function(e){
      if (!colorPop.contains(e.target) && e.target !== penBtn) colorPop.classList.remove("open");
    });
    Array.prototype.forEach.call(colorPop.querySelectorAll(".type-btn"), function(b){
      b.onclick = function(e){ e.stopPropagation(); selectTool(b.dataset.type); };
    });
    Array.prototype.forEach.call(colorPop.querySelectorAll(".swatch"), function(b){
      b.onclick = function(e){ e.stopPropagation(); selectTool(dtool === "eraser" ? "pen" : dtool, b.dataset.color); };
    });
    thicknessSlider.oninput = function(){
      if (dtool === "marker") markerWidth = +thicknessSlider.value; else penWidth = +thicknessSlider.value;
    };

    eraserBtn.onclick = function(){ colorPop.classList.remove("open"); selectTool("eraser"); };
    toggleBtn.onclick = function(){ colorPop.classList.remove("open"); setDrawOn(!drawOn); };
    clearBtn.onclick = function(){ dctx.clearRect(0, 0, canvas.width, canvas.height); };

    /*INK2: the pen's input and ink are _ink.js*/

    // ink is anchored to the viewport, not the page, so scrolling to a new question would otherwise
    // leave old marks floating over unrelated content — clear the slate on scroll instead.
    /*INK2: ink stays on its page (it used to be wiped by scrolling)*/

    setDrawOn(false);
  })();
