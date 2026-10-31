/* NEU: Startet den Café-Bildschirm auf tv.html. Einfaches JavaScript für ältere TV-Browser. */
(function () {
  'use strict';
  function param(name) {
    var m = new RegExp('[?&#]' + name + '=([^&#]+)').exec(location.search + location.hash);
    return m ? decodeURIComponent(m[1]) : '';
  }
  var cfg = window.BillardDeployment || {};
  var base = cfg.apiBase ? String(cfg.apiBase).replace(/\/$/, '') : '';
  function get(path) {
    var url = base + '/api' + path;
    if (window.fetch) return window.fetch(url, {cache: 'no-store', credentials: base ? 'omit' : 'same-origin', headers: {Accept: 'application/json'}}).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return new Promise(function (ok, fail) {
      var x = new XMLHttpRequest(); x.open('GET', url, true); x.setRequestHeader('Accept', 'application/json');
      x.onload = function () { if (x.status >= 200 && x.status < 300) { try { ok(JSON.parse(x.responseText)); } catch (e) { fail(e); } } else fail(new Error(x.status)); };
      x.onerror = function () { fail(new Error('Netz')); }; x.send();
    });
  }
  function boot() { window.BCMTvPlayer.start({root: document.getElementById('tv'), fetch: get, screen: param('bildschirm') || 'haupt', pollMs: 10000}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
