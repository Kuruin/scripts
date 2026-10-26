# Watchlist (Chrome extension for TradingView)

A slim watchlist that docks inside the TradingView page, holds up to **1,000 symbols per list**, and switches the chart in place when you pick a symbol.

## Install (unpacked)

1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this `watchlist-extension` folder. After updating files, click the reload icon on the extension's card, then refresh your TradingView tab.
4. On a TradingView chart, click the extension icon or press **Alt+W**. The watchlist docks on the right of the page.

## The dock

- It lives inside TradingView as one of its own panels, between the chart and TradingView's right toolbar, with the same gaps, colours and corner radius. A matching button is added to that toolbar; it, the extension icon and **Alt+W** all toggle the dock.
- Clicking the extension icon on any other site switches you to your TradingView tab, or opens one.
- Drag the dock's left edge to resize it (150-520px), double-click the edge to reset. The dock follows the pointer directly and the chart catches up when you pause or let go, so resizing stays smooth.
- It stays open across TradingView pages and reloads until you toggle it off.
- Theme "Auto" follows TradingView's light or dark mode and uses its exact panel colour.

## Using it

- **Rows** show the ticker, with the price and its change (points and percent) on the right in green or red. Prices come from TradingView's own data.
- **Price updates**: every 15 seconds by default, only for the rows on screen and only while TradingView is visible. Change it in the ⋯ menu (5s, 15s, 1m, or Off for manual). The ↻ button in the footer syncs right away (if a refresh is already running it waits for that one), and the footer shows when prices last updated.
- **Staying within TradingView's limits**: one request at a time; open docks share the prices they fetch instead of repeating requests; errors make polling slow down; and if TradingView answers "slow down" (or blocks a request), prices and symbol checks pause in every tab for 30 seconds, doubling each time up to 5 minutes. The footer shows **Paused** while that lasts. Large imports are checked slowly, with a progress popup, and stop at the first refusal.
- **Live or delayed**: the footer says **Live** or **Delayed 15m**. TradingView delays some exchanges (often 15 minutes) unless your TradingView plan includes real-time data for them. With **Use my TradingView login** on (the default), prices are fetched through your TradingView tab with your login, so you get whatever your plan includes.
- **Adding symbols**: typed, pasted or imported symbols are checked against TradingView. Tickers without an exchange are matched to the right one, and anything TradingView doesn't list is taken back out with a popup saying which symbols weren't added. Duplicates and a full list are reported too.
- **Click a symbol** to switch the chart.
- **↑ / ↓, Space / Shift+Space, Page Up/Down, Home/End** step through the list and switch the chart as you go.
- **Scroll switches chart** (⋯ menu) makes each wheel notch move to the next or previous symbol.
- **Add symbols** with **+**, or start typing anywhere in the dock. Search uses TradingView's own symbol search.
- **Filter** (magnifier or Ctrl+F) narrows the current list by symbol, company name or note. Useful once a list grows past one screen. Esc closes it.
- **Switch lists** by clicking the list name. Hover a list in the dropdown to rename or delete it. The five colour tags sit underneath.
- **Tags**: click the bookmark on a row to tag it red, blue, green, orange or purple. Each colour is a list that collects tagged symbols from every watchlist.
- **Notes**: double-click a row. The note shows under the ticker.
- **⋯ menu**: new list, add section, import, export for TradingView, copy, sort, price refresh, TradingView login, theme, scroll mode, remove all.

## Data and permissions

Everything is stored locally in `chrome.storage.local`. Lists from earlier versions are migrated automatically. Host permission is limited to `tradingview.com`. It is used to dock the watchlist, switch the chart symbol, and fetch symbol search results and prices from TradingView. Symbol search runs from your TradingView tab, the same way TradingView's own search does.

## Files

- `manifest.json`: Manifest V3 definition
- `content.js`: docks the watchlist inside TradingView pages and handles resizing and theme
- `background.js`: toolbar icon and Alt+W toggle the dock
- `tv.js`: bridge to TradingView (set and read the chart symbol, symbol search, prices, rate-limit detection)
- `sidepanel.html`, `styles.css`, `app.js`: the watchlist UI
- `theme-init.js`: applies the saved theme before first paint
- `icons/`: toolbar icons
