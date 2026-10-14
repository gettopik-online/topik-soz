// topik-soz: load right after qalam_toolbar.js.
// On a narrow phone the colour popup (anchored to the pen button's right edge) ran off the left of the screen:
// once it has opened, keep it inside the screen.
(function(){
  var pen = document.getElementById("draw-pen-btn"), pop = document.getElementById("draw-color-pop");
  if (!pen || !pop) return;
  function fit(){
    if (!pop.classList.contains("open")) return;
    var r = pop.getBoundingClientRect(), M = 8;
    if (r.left < M) pop.style.right = Math.max(M, window.innerWidth - M - r.width) + "px";
  }
  pen.addEventListener("click", function(){ setTimeout(fit, 0); });
  window.addEventListener("resize", fit);
})();
// A tap on the ink layer is handed to the site's element under it (ink.js, on the layer itself).
// The layer's own click must not then reach the page: the site would take it for a tap on an empty spot
// and close what that tap has just opened (a word's translation).
(function(){
  var surf = document.getElementById("draw-canvas");
  if (surf) surf.addEventListener("click", function(e){ e.stopPropagation(); });
})();
