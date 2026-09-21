(async function () {
  'use strict';
  const CW = window.CW;
  try {
    await CW.loadMeta();
    await CW.load();
    CW.startRouter();
  } catch (e) {
    if (e && e.message === 'Please sign in') return;
    document.getElementById('view').innerHTML = '<div class="empty"><h3>We could not load your portfolio</h3><p>' + CW.esc(e && e.message ? e.message : 'Please refresh the page.') + '</p><button class="btn primary" onclick="location.reload()">Try again</button></div>';
  }
})();
