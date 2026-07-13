// MV3 background service worker for the Bible Memory extension.
//
// The app is a dedicated page (no new-tab override): clicking the toolbar
// icon focuses the already-open app tab if there is one, otherwise opens a
// fresh tab at the bundled index.html.
chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL("index.html");
  const [existing] = await chrome.tabs.query({ url: appUrl + "*" });
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: appUrl });
  }
});
