// Aplica el tema guardado antes de pintar la ventana (sin parpadeo). "sistema" sigue al tema de Windows.
(function () {
  var pref = "oscuro";
  try { pref = localStorage.getItem("reels-tema") || "oscuro"; } catch (e) { /* sin almacenamiento */ }
  var claro = pref === "claro" || (pref === "sistema" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.tema = claro ? "claro" : "oscuro";
})();
