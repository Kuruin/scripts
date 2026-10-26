// Docks the watchlist inside TradingView's own layout, as a panel between the
// chart and TradingView's right toolbar, and adds a toggle button to that toolbar.
//
// How it fits in: TradingView positions its panels from the page width. We
// narrow the page by the dock width, slide TradingView's right toolbar back to
// the screen edge, and place the dock in the space that opens up. Panel colour
// and gap colour are read from TradingView itself.
(() => {
  if (window.__wlDock) return;
  window.__wlDock = true;

  const MIN_W = 150;
  const MAX_W = 520;
  const DEFAULT_W = 240;
  const GAP = 4;          // TradingView's gap between panels
  const KEY = 'dock';

  let state = { open: false, width: DEFAULT_W };
  let host = null;        // dock container (panel)
  let frame = null;       // the watchlist iframe
  let handle = null;      // resize handle
  let style = null;       // stylesheet that makes room in TradingView's layout
  let tvBtn = null;       // our button in TradingView's right toolbar

  const clamp = (w) => Math.max(MIN_W, Math.min(MAX_W, Math.round(w) || DEFAULT_W));
  const $ = (sel) => document.querySelector(sel);

  /* ---------- geometry ---------- */
  // Width and top of TradingView's right area (toolbar + any open TV widget panel).
  function rightArea() {
    const ra = $('.layout__area--right');
    if (!ra || ra.classList.contains('js-hidden') || !ra.offsetWidth) return { w: 0, top: 0 };
    return { w: ra.offsetWidth, top: Math.round(ra.getBoundingClientRect().top) };
  }

  // Reserve room in TradingView's layout. Called on open and when a resize settles.
  function commitLayout() {
    if (!style) return;
    const room = clamp(state.width) + GAP;
    const topLeft = $('.layout__area--top')?.offsetLeft || 52;
    // The page and TradingView's panel container normally clip at their edge;
    // let them show the toolbar and header we slide back out to the screen edge.
    style.textContent = `
      html { width: calc(100% - ${room}px) !important; overflow: hidden !important; }
      html > body, html body.chart-page, html body.i-no-scroll { overflow: visible !important; }
      .js-rootresizer__contents > * { overflow: visible !important; }
      .layout__area--right, .layout__area--tradingpanel { transform: translateX(${room}px) !important; }
      .layout__area--top { width: calc(100vw - ${topLeft}px) !important; }
    `;
    window.dispatchEvent(new Event('resize'));
    placeDock();
    requestAnimationFrame(placeDock);   // again once TradingView has re-laid out
  }

  // Position the dock next to TradingView's right area (cheap; no TradingView relayout).
  function placeDock() {
    if (!host) return;
    const ra = rightArea();
    host.style.top = (ra.top || 0) + 'px';
    host.style.right = (ra.w ? ra.w + GAP : 0) + 'px';
    host.style.width = clamp(state.width) + 'px';
  }

  /* ---------- theme: copy TradingView's own colours ---------- */
  const tvTheme = () => (document.documentElement.classList.contains('theme-dark') ? 'dark' : 'light');
  const clear = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  function tvColors() {
    const panelEl = $('.widgetbar-tabs') || $('[data-name="right-toolbar"]');
    let panel = panelEl ? getComputedStyle(panelEl).backgroundColor : '';
    if (clear(panel)) panel = tvTheme() === 'dark' ? '#0f0f0f' : '#ffffff';
    return { panel };
  }
  function syncTheme() {
    const t = tvTheme();
    const c = tvColors();
    if (host) host.style.background = c.panel;
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({ wl: 'tvTheme', theme: t, bg: c.panel }, '*');
  }
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  /* ---------- build ---------- */
  function build() {
    host = document.createElement('div');
    host.id = 'wl-dock-host';
    host.style.cssText =
      'position:fixed;top:0;right:0;bottom:0;z-index:20;display:flex;border-radius:4px 4px 0 0;';

    // The handle sits in the gap on the dock's left edge, like TradingView's own splitters.
    handle = document.createElement('div');
    handle.title = 'Drag to resize · double-click to reset';
    handle.style.cssText =
      `position:absolute;left:-${GAP + 2}px;top:0;bottom:0;width:${GAP + 4}px;cursor:col-resize;z-index:2;touch-action:none;`;
    const line = document.createElement('div');
    line.style.cssText =
      `position:absolute;left:${(GAP + 4) / 2 - 1}px;top:0;bottom:0;width:2px;border-radius:2px;` +
      'background:#2962ff;opacity:0;transition:opacity 120ms ease;pointer-events:none;';
    handle.appendChild(line);
    let hoverTimer;
    handle.addEventListener('pointerenter', () => { hoverTimer = setTimeout(() => (line.style.opacity = '1'), 120); });
    handle.addEventListener('pointerleave', () => { clearTimeout(hoverTimer); if (!handle.dragging) line.style.opacity = '0'; });
    handle.addEventListener('pointerdown', startResize);
    handle.addEventListener('dblclick', () => { state.width = DEFAULT_W; commitLayout(); save(); });
    handle.line = line;

    frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('sidepanel.html?embed=1');
    frame.allow = 'clipboard-write';
    frame.style.cssText =
      'border:0;width:100%;height:100%;display:block;background:transparent;color-scheme:normal;border-radius:inherit;';
    frame.addEventListener('load', syncTheme);

    host.append(handle, frame);

    style = document.createElement('style');
    style.id = 'wl-dock-style';
  }

  /* ---------- fluid resizing ----------
     While dragging, only the dock changes width: one fixed element, so it keeps
     up with the pointer. TradingView's layout catches up when the pointer rests
     and on release. Re-laying out the chart on every pointer move is what made
     resizing feel laggy. */
  function startResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.dragging = true;
    handle.line.style.opacity = '1';
    frame.style.pointerEvents = 'none';
    document.documentElement.style.cursor = 'col-resize';

    const startX = e.clientX;
    const startW = clamp(state.width);
    let raf = 0, pending = startW, settle = 0;

    const apply = () => { raf = 0; host.style.width = pending + 'px'; };
    const onMove = (ev) => {
      pending = clamp(startW + (startX - ev.clientX));
      state.width = pending;
      if (!raf) raf = requestAnimationFrame(apply);
      clearTimeout(settle);
      settle = setTimeout(commitLayout, 160);
    };
    const onUp = (ev) => {
      try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      clearTimeout(settle);
      if (raf) { cancelAnimationFrame(raf); apply(); }
      handle.dragging = false;
      handle.line.style.opacity = '0';
      frame.style.pointerEvents = '';
      document.documentElement.style.cursor = '';
      commitLayout();
      save();
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  }

  /* ---------- toggle button in TradingView's right toolbar ---------- */
  const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44" fill="none">' +
    '<path fill="currentColor" d="M13 14h18v1H13zm0 7h18v1H13zm0 7h10v1H13z"/>' +
    '<path fill="currentColor" d="M26 25h7v10l-3.5-2.2L26 35zm1 1v7.2l2.5-1.6 2.5 1.6V26z"/></svg>';

  function injectButton() {
    const tb = $('[data-name="right-toolbar"]');
    if (!tb) return;
    tvBtn = tb.querySelector('[data-name="wl-watchlist"]');
    if (!tvBtn) {
      const ref = tb.querySelector('[data-name="base"]') || tb.querySelector('button');
      if (!ref) return;
      tvBtn = ref.cloneNode(true);                    // inherits TradingView's exact button styling
      tvBtn.dataset.name = 'wl-watchlist';
      tvBtn.setAttribute('aria-label', 'Watchlist');
      tvBtn.dataset.tooltip = 'Watchlist (Alt+W)';
      tvBtn.removeAttribute('id');
      const icon = tvBtn.querySelector('svg');
      if (icon) icon.outerHTML = ICON; else tvBtn.innerHTML = ICON;
      tvBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setOpen(!state.open); }, true);
      ref.after(tvBtn);
    }
    syncButton();
  }
  function syncButton() {
    if (!tvBtn) return;
    tvBtn.setAttribute('aria-pressed', String(state.open));
    tvBtn.style.color = state.open ? '#2962ff' : '';
  }
  // TradingView re-renders its toolbar now and then; put the button back when it does.
  let watchRaf = 0;
  new MutationObserver(() => {
    if (watchRaf) return;
    watchRaf = requestAnimationFrame(() => {
      watchRaf = 0;
      if (!tvBtn || !tvBtn.isConnected) injectButton();
      if (state.open && host && !(handle && handle.dragging)) placeDock();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- open / close ---------- */
  // Closing hides the dock instead of removing it, so reopening doesn't reload
  // the watchlist (and refetch every price). The watchlist pauses while hidden.
  function tellFrame(open) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage({ wl: 'dockVisible', open }, '*');
  }
  function open() {
    if (!host) build();
    if (!host.isConnected) document.body.appendChild(host);
    host.style.display = 'flex';
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    commitLayout();
    syncTheme();
    tellFrame(true);
  }
  function close() {
    if (host && host.isConnected && host.style.display !== 'none') {
      host.style.display = 'none';
      style.remove();
      window.dispatchEvent(new Event('resize'));
      tellFrame(false);
    }
  }
  function render() {
    if (state.open) open(); else close();
    syncButton();
  }
  function save() {
    chrome.storage.local.set({ [KEY]: { open: state.open, width: clamp(state.width) } });
  }
  function setOpen(v) {
    state.open = v;
    render();
    save();
  }

  window.addEventListener('resize', () => { if (state.open) requestAnimationFrame(placeDock); });

  // Toolbar icon / Alt+W
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (!msg || msg.wl !== 'dock') return;
    if (msg.action === 'toggle') setOpen(!state.open);
    else if (msg.action === 'open') setOpen(true);
    else if (msg.action === 'close') setOpen(false);
    reply({ open: state.open });
  });

  // Messages from the watchlist inside the dock
  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || !e.data) return;
    if (e.data.wl === 'close') setOpen(false);
    if (e.data.wl === 'ready') { syncTheme(); tellFrame(state.open); }
  });

  // Keep every TradingView tab in step (open/closed, width)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY] || !changes[KEY].newValue) return;
    const next = changes[KEY].newValue;
    const changed = !!next.open !== state.open || clamp(next.width) !== clamp(state.width);
    state = { open: !!next.open, width: clamp(next.width) };
    if (changed) render();
  });

  chrome.storage.local.get(KEY).then((r) => {
    if (r[KEY]) state = { open: !!r[KEY].open, width: clamp(r[KEY].width) };
    injectButton();
    render();
  });
})();
