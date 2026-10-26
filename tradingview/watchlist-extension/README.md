# Watchlist (Chrome extension for TradingView)

A slim watchlist that docks inside the TradingView page. It holds up to **1,000 symbols per list**, shows live or delayed prices, and switches the chart in place when you pick a symbol.

Plain HTML, CSS and JavaScript: no build step, no dependencies.

## Install

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `watchlist-extension` folder.
4. On a TradingView chart, click the extension icon, the **Watchlist** button in TradingView's right toolbar, or press **Alt+W**.

After changing any file, click the reload icon on the extension's card, then refresh your TradingView tab.

> **Moving the folder.** Chrome ties an unpacked extension's saved data to its folder path. Loading it from a new folder starts with empty lists. Before switching, use **Export for TradingView** on each list, then **Import from file** in the new copy. Export keeps symbols and sections; tags and notes are not included.

## The dock

- Sits inside TradingView's own layout, between the chart and TradingView's right toolbar, with TradingView's gaps and panel colour. It only ever appears in TradingView tabs; the extension icon on any other site switches to your TradingView tab, or opens one.
- **Resize** by dragging its left edge (150 to 520px). Double-click the edge to reset to 240px. The dock follows the pointer and the chart catches up when you pause or let go.
- Stays open across TradingView pages and reloads until you toggle it off.
- **Minimize** (the arrows button in the dock's header) is also how the watchlist starts on a fresh install, so ↑ / ↓ work straight away. It collapses the dock into a small pill at the bottom right of the chart. TradingView gets its full width back, so it looks closed, but **↑ / ↓** on the chart keep switching through this watchlist instead of TradingView's. The pill shows the current symbol and its place in the list (for example "SSWL 2/4"). Its ▲ / ▼ buttons and the mouse wheel over it switch symbols too, and clicking the name expands the dock again.
- **Theme**: Auto (follows TradingView's light or dark mode), Light or Dark, from the ⋯ menu.
- Every popup (menu, list switcher, tag picker, search, dialogs, notifications) fits the dock at any width and height: long labels wrap, button groups stack on narrow docks, and tall content scrolls.

## Using it

### Rows

Each row shows the ticker on the left and the price over its change (points and percent, in green or red) on the right. Hover a row to see the full symbol and company name. The row for the symbol on the chart is highlighted. If a ticker would be cut off, that row drops the point change and keeps the percent.

### Adding symbols

- Click **+**, or start typing anywhere in the dock, to open symbol search. It uses TradingView's own search, with logos, exchange, type and category tabs. **Enter** adds the highlighted result; the search stays open for the next one.
- Type or paste several symbols (`AAPL, MSFT, NSE:TCS`) to add them all at once. A pasted TradingView export keeps its sections.
- **Import from file** (⋯ menu) reads a `.txt` or `.csv`, including TradingView's export format. You can also drag a file onto the dock.
- Everything typed, pasted or imported is checked against TradingView. Tickers without an exchange (`SSWL`) are matched to the right one, preferring the exchange your other symbols use. Tickers written with a dash are matched to TradingView's spelling (`NSE:BAJAJ-AUTO` becomes `NSE:BAJAJ_AUTO`). Anything TradingView doesn't list is taken back out, and a popup says how many weren't added, with a **Copy** button to copy them. Duplicates and a full list are reported too.

### Lists, sections and tags

- **Switch lists** by clicking the list name. Hover a list in the dropdown to rename or delete it. The selected list is highlighted.
- **Sections** (⋯ menu → Add section) group symbols inside a list. Click a section to collapse it, double-click to rename.
- **Tags**: click the bookmark on a row to tag it red, blue, green, orange or purple. Each colour is its own list in the dropdown, collecting tagged symbols from every watchlist.
- **Notes**: double-click a row. The note shows under the ticker.
- **Filter** (magnifier or Ctrl+F) narrows the current list by symbol, company name or note. Esc closes it.
- **Sort** (⋯ menu): A to Z, newest first, oldest first. Sections keep their place.

### Keyboard

| Key | Action |
| --- | --- |
| Alt+W | Open or close the dock |
| ↑ / ↓ | Previous / next symbol, switching the chart. Also works on the chart while the dock is open or minimized (not while it's fully closed) |
| Space / Shift+Space | Next / previous symbol |
| Page Up / Page Down, Home / End | Jump through the list |
| Enter | Show the selected symbol (or collapse a section) |
| Delete | Remove the selected symbol |
| Any letter or digit | Open symbol search with that character |
| Ctrl+F | Filter the list |
| Esc | Close the open popup, search or filter |

**Scroll switches chart** (⋯ menu) makes each mouse-wheel notch move to the next or previous symbol.


## Prices

- **How often**: when the TradingView tab loads, prices are fetched once for every symbol in all your lists. After that they refresh only on your setting in the ⋯ menu: every 5s, 15s, 1 minute, or Off (manual). Refreshes cover the rows on screen and pause while the TradingView tab is in the background or the dock is closed. Scrolling, switching lists and reopening the dock use the prices already fetched; only a newly added symbol gets its first price right away. The **↻** button in the footer syncs at any time, and the footer shows when prices last updated.
- **Live or delayed**: the footer says **Live** or **Delayed 15m**. TradingView delays some exchanges (often by 15 minutes) unless your TradingView plan includes real-time data for them. With **Use my TradingView login** on (the default), prices are fetched through your TradingView tab with your login, so you get whatever data your plan includes.
- **No data**: a symbol TradingView has no price for shows "—" and "No data from TradingView".

### Staying within TradingView's limits

The extension uses the same services TradingView's website uses. They have no published limits, so it is deliberately gentle:

- one fetch of every symbol when the tab loads, then one request at a time for the rows on screen;
- open docks in other tabs or windows share the prices they fetch instead of repeating the request;
- after errors it waits longer between attempts;
- if TradingView answers "slow down" or blocks a request, prices and symbol checks pause in every tab for 30 seconds, doubling each time up to 5 minutes. The footer shows **Paused** and the sync button is disabled until then;
- large imports are checked slowly, with a progress popup, and stop at the first refusal. Unchecked symbols are kept and checked later.

## Data and permissions

- All lists, tags, notes and settings are stored locally in `chrome.storage.local`. Nothing is sent anywhere except requests to TradingView for search results and prices.
- Permissions: `storage`, `unlimitedStorage`, `scripting`, and host access to `tradingview.com` only. They are used to dock the watchlist, switch the chart symbol, and fetch search results and prices.
- Symbol search runs from your TradingView tab without your login cookies. Prices use your login only when **Use my TradingView login** is on.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Manifest V3 definition |
| `content.js` | Docks the watchlist inside TradingView, adds the toolbar button and the minimized pill, handles resizing and theme |
| `early.js` | Loads before TradingView's scripts so ↑ / ↓ reach this watchlist first while the dock is open or minimized |
| `background.js` | Extension icon and Alt+W toggle the dock |
| `tv.js` | Bridge to TradingView: chart symbol, symbol search, prices, rate-limit detection |
| `sidepanel.html`, `styles.css`, `app.js` | The watchlist UI |
| `theme-init.js` | Applies the saved theme before first paint |
| `icons/` | Extension icons |

## Publishing to the Chrome Web Store

Zip the extension's files (not the folder) and upload the zip in the Chrome Web Store developer dashboard. From this folder in PowerShell:

```powershell
Compress-Archive -Path manifest.json,*.js,*.html,*.css,icons -DestinationPath watchlist.zip -Force
```

## Disclaimer

This is an independent project, not made by or affiliated with TradingView. It relies on TradingView's website and internal services, which can change without notice. Use it in line with TradingView's terms.
