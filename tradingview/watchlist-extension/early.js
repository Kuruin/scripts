// Loaded at document_start, before TradingView's own scripts, so this listener
// runs first. While the dock is open or minimized, ↑ / ↓ on the TradingView page
// step through *this* watchlist (minimized is the default until the user picks
// otherwise), and the key is consumed so TradingView doesn't
// also switch through its own watchlist. With the dock fully closed, the keys
// are left to TradingView.
(() => {
  if (window.__wlEarly) return;
  window.__wlEarly = true;

  let mode = 'mini';     // minimized until the user chooses otherwise
  const read = (d) => { mode = d ? (d.mode || (d.open ? 'open' : 'closed')) : 'mini'; };
  try {
    chrome.storage.local.get('dock').then((r) => read(r.dock)).catch(() => {});
    chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.dock) read(c.dock.newValue); });
  } catch (e) {}

  const busy = (t) => t instanceof Element && (
    t.isContentEditable ||
    t.matches('input, textarea, select') ||
    t.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="combobox"], [data-dialog-name]')
  );

  let at = 0;
  window.addEventListener('keydown', (e) => {
    if (mode !== 'open' && mode !== 'mini') return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (busy(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const now = Date.now();
    if (e.repeat && now - at < 110) return;   // holding the key: about 9 symbols a second
    at = now;
    try { chrome.runtime.sendMessage({ wl: 'step', dir: e.key === 'ArrowDown' ? 1 : -1 }).catch(() => {}); } catch (err) {}
  }, true);
})();
