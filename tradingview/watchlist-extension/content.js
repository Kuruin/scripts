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

  let state = { mode: 'mini', width: DEFAULT_W };     // mode: 'open' | 'mini' | 'closed'; minimized until the user chooses
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
      tvBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggle(); }, true);
      ref.after(tvBtn);
    }
    syncButton();
  }
  function syncButton() {
    if (!tvBtn) return;
    tvBtn.setAttribute('aria-pressed', String(state.mode !== 'closed'));
    tvBtn.style.color = state.mode !== 'closed' ? '#2962ff' : '';
  }
  // TradingView re-renders its toolbar now and then; put the button back when it does.
  let watchRaf = 0;
  new MutationObserver(() => {
    if (watchRaf) return;
    watchRaf = requestAnimationFrame(() => {
      watchRaf = 0;
      if (!tvBtn || !tvBtn.isConnected) injectButton();
      if (state.mode === 'open' && host && !(handle && handle.dragging)) placeDock();
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ---------- open / minimized / closed ----------
     open:      the dock, docked in TradingView's layout
     mini:      looks closed (TradingView gets its full width back) but ↑ / ↓ keep
                switching *this* watchlist; a small pill shows where you are
     closed:    off; TradingView's own keys work as normal
     Hiding the dock never removes it, so reopening doesn't reload the watchlist
     (or refetch prices). The watchlist pauses while hidden. */
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
      // Clicking minimize leaves keyboard focus in the watchlist frame, and hiding the
      // frame doesn't move it: ↑ / ↓ would keep going to the hidden panel instead of
      // reaching the page. Hand focus back to TradingView first.
      if (document.activeElement === frame) { frame.blur(); window.focus(); }
      host.style.display = 'none';
      style.remove();
      window.dispatchEvent(new Event('resize'));
      tellFrame(false);
    }
  }
  function render() {
    if (state.mode === 'open') { open(); hidePill(); }
    else if (state.mode === 'mini') { close(); showPill(); }
    else { close(); hidePill(); }
    syncButton();
  }
  function save() {
    chrome.storage.local.set({ [KEY]: { mode: state.mode, open: state.mode === 'open', width: clamp(state.width) } });
  }
  function setMode(m) {
    state.mode = m;
    render();
    save();
  }
  // Toolbar button, extension icon, Alt+W: open the dock, or close it if it's open.
  const toggle = () => setMode(state.mode === 'open' ? 'closed' : 'open');

  /* ---------- the minimized pill ----------
     Just the ticker and its place in the list (4/8) on a small solid surface over
     the chart, with ▲/▼ beside it. Switching symbols
     is not animated (it can happen many times a minute); the pill only fades in. */
  let pill = null;
  const chev = (d) => `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  function buildPill() {
    pill = document.createElement('div');
    pill.id = 'wl-pill';
    pill.setAttribute('role', 'group');
    pill.setAttribute('aria-label', 'Watchlist (minimized)');
    pill.innerHTML =
      '<button class="wlp-main" data-expand title="Expand the watchlist">' +
        '<span class="wlp-sym">Watchlist</span><span class="wlp-pos"></span>' +
      '</button>' +
      '<span class="wlp-steps">' +
        `<button data-step="-1" title="Previous symbol (↑)" aria-label="Previous symbol">${chev('m6 15 6-6 6 6')}</button>` +
        `<button data-step="1" title="Next symbol (↓)" aria-label="Next symbol">${chev('m6 9 6 6 6-6')}</button>` +
      '</span>';
    pill.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.step) chrome.runtime.sendMessage({ wl: 'step', dir: Number(b.dataset.step) }).catch(() => {});
      else setMode('open');
    });
    let acc = 0, at = 0;
    pill.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      acc += e.deltaY;
      const now = Date.now();
      if (Math.abs(acc) >= 40 && now - at > 140) {
        chrome.runtime.sendMessage({ wl: 'step', dir: Math.sign(acc) }).catch(() => {});
        acc = 0;
        at = now;
      }
    }, { passive: false });

    const css = document.createElement('style');
    css.id = 'wl-pill-style';
    css.textContent = `
      #wl-pill { position: fixed; z-index: 21; display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 10px;
        font: 12px/1.25 -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif;
        color: var(--wlp-fg); background: var(--wlp-bg); user-select: none;
        box-shadow: 0 6px 18px var(--wlp-shadow), inset 0 0 0 1px var(--wlp-line);
        transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease; }
      #wl-pill.wlp-in { animation: wlp-in 220ms ease; }
      @keyframes wlp-in { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { #wl-pill.wlp-in { animation: none; } }
      #wl-pill button { border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; padding: 0; margin: 0;
        transition: background-color 120ms ease, color 120ms ease, transform 120ms ease; }
      #wl-pill button:active { transform: scale(0.96); }
      #wl-pill .wlp-main { display: flex; align-items: baseline; gap: 8px; padding: 3px 7px; border-radius: 7px; }
      #wl-pill .wlp-sym { font-size: 13px; font-weight: 700; letter-spacing: .02em; max-width: 160px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #wl-pill .wlp-pos { font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      #wl-pill .wlp-pos:empty { display: none; }
      #wl-pill .wlp-steps { display: inline-flex; gap: 2px; }
      #wl-pill .wlp-steps button { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center;
        border-radius: 5px; color: var(--wlp-muted); }
      #wl-pill .wlp-steps button:hover { background: var(--wlp-hover); color: var(--wlp-fg); }`;
    (document.head || document.documentElement).appendChild(css);
  }
  function stylePill() {
    const dark = tvTheme() === 'dark';
    const s = pill.style;
    s.setProperty('--wlp-bg', dark ? 'rgba(24,24,24,.92)' : 'rgba(255,255,255,.94)');
    s.setProperty('--wlp-fg', dark ? '#e6e6e6' : '#131722');
    s.setProperty('--wlp-muted', dark ? '#8c8c8c' : '#6a6d78');
    s.setProperty('--wlp-line', dark ? 'rgba(255,255,255,.07)' : 'rgba(19,23,34,.08)');
    s.setProperty('--wlp-hover', dark ? 'rgba(255,255,255,.08)' : 'rgba(19,23,34,.05)');
    s.setProperty('--wlp-shadow', dark ? 'rgba(0,0,0,.4)' : 'rgba(19,23,34,.12)');
    // Bottom right of the chart, just above the time axis and clear of the price scale.
    const center = $('.layout__area--center');
    const r = center ? center.getBoundingClientRect() : { right: window.innerWidth - 50, bottom: window.innerHeight - 40 };
    s.left = 'auto';
    s.right = Math.max(8, Math.round(window.innerWidth - r.right + 76)) + 'px';
    s.top = 'auto';
    s.bottom = Math.max(8, Math.round(window.innerHeight - r.bottom + 34)) + 'px';
  }
  function setPill(info) {
    if (!pill || !info) return;
    const sym = pill.querySelector('.wlp-sym');
    const pos = pill.querySelector('.wlp-pos');
    const list = info.list || 'Watchlist';
    if (!info.sym) {
      sym.textContent = list;
      // Empty list, or the chart is on a symbol outside this list.
      pos.textContent = info.empty ? '· empty' : info.total ? `–/${info.total}` : '';
      pill.title = `${list} · ↑/↓ or scroll to switch symbols · click to expand`;
      return;
    }
    sym.textContent = info.sym.split(':').pop();
    pos.textContent = `${info.n}/${info.total}`;
    pill.title = `${info.sym} · ${info.n} of ${info.total} in ${list} · ↑/↓ or scroll to switch · click to expand`;
  }
  function showPill() {
    if (!pill) buildPill();
    if (!pill.isConnected) document.body.appendChild(pill);
    stylePill();
    pill.style.display = 'flex';
    pill.classList.remove('wlp-in');
    void pill.offsetWidth;
    pill.classList.add('wlp-in');
    chrome.runtime.sendMessage({ wl: 'where' }).then(setPill).catch(() => {});
  }
  function hidePill() {
    if (pill) pill.style.display = 'none';
  }
  window.addEventListener('resize', () => { if (state.mode === 'mini' && pill) stylePill(); });
  new MutationObserver(() => { if (state.mode === 'mini' && pill) stylePill(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  window.addEventListener('resize', () => { if (state.mode === 'open') requestAnimationFrame(placeDock); });

  // Toolbar icon / Alt+W, and position updates after a keyboard / pill step
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.wl === 'pos') { setPill(msg); return; }
    if (!msg || msg.wl !== 'dock') return;
    if (msg.action === 'toggle') toggle();
    else if (msg.action === 'open') setMode('open');
    else if (msg.action === 'close') setMode('closed');
    reply({ mode: state.mode });
  });

  // Messages from the watchlist inside the dock
  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow || !e.data) return;
    if (e.data.wl === 'close') setMode('closed');
    if (e.data.wl === 'minimize') setMode('mini');
    if (e.data.wl === 'ready') { syncTheme(); tellFrame(state.mode === 'open'); }
  });

  // Keep every TradingView tab in step (mode, width)
  const modeOf = (d) => (d && (d.mode || (d.open ? 'open' : 'closed'))) || 'mini';
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY] || !changes[KEY].newValue) return;
    const next = changes[KEY].newValue;
    const changed = modeOf(next) !== state.mode || clamp(next.width) !== clamp(state.width);
    state = { mode: modeOf(next), width: clamp(next.width) };
    if (changed) render();
  });

  chrome.storage.local.get(KEY).then((r) => {
    if (r[KEY]) state = { mode: modeOf(r[KEY]), width: clamp(r[KEY].width) };
    injectButton();
    render();
  });
})();
