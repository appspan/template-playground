/* Navigation feedback (#136): tapping an internal link shows a twinkling
   star veil until the next page commits. Fades in only after 250ms so
   instant (cached) navigations never flash it. Shared by every page. */
(function () {
  'use strict';
  var veil = null;
  function showVeil(label) {
    removeVeil();
    veil = document.createElement('div');
    veil.className = 'navveil';
    veil.innerHTML = '<div class="nv"><span class="nvstar">✦</span><b></b></div>';
    veil.querySelector('b').textContent = label || '';
    document.body.append(veil);
    // debug flag (the #56 overlay gesture) drops the grace period so the
    // veil is visible on every tap — for testing on fast connections
    var demo = false;
    try { demo = localStorage.getItem((self.APP?.prefix || 'app') + '-navdebug') === '1'; } catch (e) { /* storage unavailable: no debug mode */ }
    setTimeout(function () { if (veil) veil.classList.add('on'); }, demo ? 0 : 250);
    // failsafe: a canceled navigation (offline, long-press menu) must not
    // leave the veil stuck over a page that never left
    setTimeout(removeVeil, 10000);
  }
  function removeVeil() {
    if (veil) { veil.remove(); veil = null; }
  }
  addEventListener('click', function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    var u;
    try { u = new URL(a.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    if (u.pathname === location.pathname) return;   // in-page anchors
    var label = (a.textContent || '').replace(/[❮❯✦✨]/g, '').trim();
    showVeil(label);
  }, true);
  // returning via back/forward (bfcache) restores the old page as-is —
  // including a leftover veil, so clear it
  addEventListener('pageshow', removeVeil);
})();
