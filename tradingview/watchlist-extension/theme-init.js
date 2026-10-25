// Apply the saved theme before first paint to avoid a flash.
(function () {
  try {
    if (/[?&]embed\b/.test(location.search)) document.documentElement.classList.add('embed');
    var t = localStorage.getItem('wl-theme') || 'system';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
