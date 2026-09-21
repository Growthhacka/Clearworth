/* Applies the saved theme before first paint to avoid a flash. */
(function () {
  try {
    var t = localStorage.getItem('cw_theme');
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  } catch (e) { /* storage unavailable: follow the OS setting */ }
})();
