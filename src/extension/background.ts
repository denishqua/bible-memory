// MV3 background service worker for the Bible Memory extension.
//
// The app's `chrome_url_overrides.newtab` entry in manifest.json already
// makes every new tab open the app, but the toolbar action icon also needs
// to do something sensible when clicked (MV3 requires either a popup or an
// onClicked handler — this app has no popup UI, so it opens/creates a tab
// pointing at the bundled index.html instead).
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
