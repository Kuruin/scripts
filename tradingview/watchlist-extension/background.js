// Toolbar button and Alt+W: toggle the watchlist docked inside TradingView.
const TV_HOME = 'https://www.tradingview.com/chart/';
const isTV = (url) => /^https?:\/\/([a-z0-9-]+\.)*tradingview\.com\//i.test(url || '');

// Earlier versions used Chrome's side panel; make sure it no longer grabs the click.
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

chrome.action.onClicked.addListener((tab) => toggle(tab));

async function toggle(tab) {
  if (tab && isTV(tab.url)) {
    await send(tab.id, 'toggle');
    return;
  }
  // Not on TradingView: bring a TradingView tab forward (or open one) with the dock open.
  await chrome.storage.local.set({ dock: { ...(await getDock()), open: true } });
  const windowId = tab ? tab.windowId : undefined;
  const tvTabs = await chrome.tabs.query({ windowId, url: '*://*.tradingview.com/*' });
  const target = tvTabs.find((t) => /\/chart\//.test(t.url || '')) || tvTabs[0];
  if (target) {
    await chrome.tabs.update(target.id, { active: true });
    await send(target.id, 'open');
  } else {
    await chrome.tabs.create({ windowId, url: TV_HOME });
  }
}

async function getDock() {
  const r = await chrome.storage.local.get('dock');
  return r.dock || { open: false, width: 220 };
}

// Message the tab's dock script, injecting it first if the tab predates the extension.
async function send(tabId, action) {
  try {
    await chrome.tabs.sendMessage(tabId, { wl: 'dock', action });
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, { wl: 'dock', action });
    } catch (e2) {}
  }
}
