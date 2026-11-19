// Admin -> Settings: tab switching (CSS shows the group that matches #settings[data-tab]).
(function () {
  var KEY = 'mxSettingsTab';
  function root() { return document.getElementById('settings'); }
  function setTab(name) {
    var r = root(); if (!r) return;
    var btn = r.querySelector('[data-stab-btn="' + name + '"]'); if (!btn) return;
    r.setAttribute('data-tab', name);
    r.querySelectorAll('[data-stab-btn]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    try { sessionStorage.setItem(KEY, name); } catch (e) { /* storage blocked: fine */ }
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-stab-btn]');
    if (b) setTab(b.getAttribute('data-stab-btn'));
  });
  try { var saved = sessionStorage.getItem(KEY); if (saved) setTab(saved); } catch (e) { /* ignore */ }
})();
