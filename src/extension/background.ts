// MV3 background service worker for the Bible Memory extension.
//
// This file is copied VERBATIM to dist/background.js (no bundling, no
// transpile — see scripts/build-extension.mjs), so it must stay plain,
// JS-compatible TypeScript: no imports, no exports, no type annotations.
// Storage shapes it reads are defined in src/types/settings.ts; any field
// rename there must be mirrored here by hand.
//
// Beyond the toolbar-click handler, this worker implements the "verse gate":
// every NEW TAB's first http(s) top-frame navigation is redirected to the
// bundled review page (#/gate) unless the destination domain is whitelisted.
// Completing the review unlocks that tab for the rest of its life — in-tab
// navigation after unlock is never gated again.

// Single settings object (see src/types/settings.ts). May be absent entirely,
// or present without the newTabGate block (older installs) — both mean the
// gate is off.
const SETTINGS_KEY = "bm.settings.v1";

// Tab ids that have passed (or been exempted from) the gate. Kept in
// chrome.storage.session rather than a worker global so the set survives the
// service worker being torn down, but still clears when Chrome closes —
// exactly the "for the tab's lifetime" semantics we want.
const UNLOCKED_TABS_KEY = "bm.unlockedTabs.v1";

const WHITELIST_MENU_ID = "bm-whitelist-domain";

// The app is a dedicated page (no new-tab override): clicking the toolbar
// icon focuses the already-open app tab if there is one, otherwise opens a
// fresh tab at the bundled index.html. Gate tabs (URL carries "gateTarget=")
// are the same origin but are mid-review, not "the app" — skip them so a
// toolbar click doesn't steal focus to a locked tab.
chrome.action.onClicked.addListener(async () => {
  const appUrl = chrome.runtime.getURL("index.html");
  const candidates = await chrome.tabs.query({ url: appUrl + "*" });
  const existing = candidates.find((t) => !(t.url || "").includes("gateTarget="));
  if (existing?.id !== undefined) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: appUrl });
  }
});

// --- storage helpers -------------------------------------------------------
//
// NOTE on style: this file is type-checked by the project's tsc but cannot
// use TS-only syntax, so helper parameters carry default values purely to
// give tsc an inferable type (every real call site passes a value).

// chrome.storage values are typed `unknown`; this file cannot use TS casts,
// so launder through a parameter whose default (JSON.parse returns `any`)
// gives tsc an inferable `any`. The default itself is never evaluated —
// every call site passes a value.
function loosen(value = JSON.parse("null")) {
  return value;
}

// Returns the stored settings object, or undefined if none. Deliberately
// loose: storage only ever holds what the app wrote, and callers guard the
// fields they touch.
async function readSettings() {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  return loosen(data[SETTINGS_KEY]);
}

async function readUnlockedTabs() {
  const data = await chrome.storage.session.get(UNLOCKED_TABS_KEY);
  const list = data[UNLOCKED_TABS_KEY];
  return Array.isArray(list) ? list : [];
}

async function addUnlockedTab(tabId = -1) {
  const list = await readUnlockedTabs();
  if (!list.includes(tabId)) {
    list.push(tabId);
    await chrome.storage.session.set({ [UNLOCKED_TABS_KEY]: list });
  }
}

async function removeUnlockedTab(tabId = -1) {
  const list = await readUnlockedTabs();
  if (list.includes(tabId)) {
    await chrome.storage.session.set({
      [UNLOCKED_TABS_KEY]: list.filter((id) => id !== tabId),
    });
  }
}

// Mirrors isHostWhitelisted() in src/lib/domainWhitelist.ts (which this file
// cannot import) — keep the two in sync. A whitelist entry is a bare,
// lowercased domain that matches the exact host and every subdomain, with
// "www." treated as noise.
function isHostWhitelisted(host = "", whitelist = [""]) {
  const h = host.toLowerCase().replace(/^www\./, "");
  return whitelist.some((d) => h === d || h.endsWith("." + d));
}

// Defaults mirror defaultNewTabGateSettings() in src/types/settings.ts.
function defaultNewTabGateSettings() {
  return {
    enabled: false,
    whitelist: [],
    snoozeUntil: null,
    collectionId: null,
    verseIds: null,
    mode: "type-it",
  };
}

// --- the gate itself -------------------------------------------------------

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Top-frame http(s) navigations only. The scheme check also excludes the
  // extension's own chrome-extension:// origin, so the gate page itself (and
  // the app) never gets intercepted.
  if (details.frameId !== 0) return;
  if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) return;

  const settings = await readSettings();
  const gate = settings && settings.newTabGate;
  // Missing settings/block or disabled gate: old installs and fresh ones
  // behave identically — no gating.
  if (!gate || !gate.enabled) return;

  // Snoozed until a future instant.
  if (gate.snoozeUntil) {
    const until = Date.parse(gate.snoozeUntil);
    if (!Number.isNaN(until) && until > Date.now()) return;
  }

  // Unconfigured verse pool: FAIL OPEN. A gate with nothing to review must
  // never lock the user out of the web.
  if (gate.collectionId === null || gate.collectionId === undefined) return;

  const host = new URL(details.url).hostname;
  const whitelist = Array.isArray(gate.whitelist) ? gate.whitelist : [];
  if (isHostWhitelisted(host, whitelist)) {
    // Also unlock the tab so subsequent same-tab navigations (possibly to
    // non-whitelisted sites) skip the gate — the "first navigation" already
    // resolved in the user's favor.
    await addUnlockedTab(details.tabId);
    return;
  }

  const unlocked = await readUnlockedTabs();
  if (unlocked.includes(details.tabId)) return;

  // Gate it: send the tab to the bundled review page, carrying the intended
  // destination so the gate page can navigate there after the review.
  await chrome.tabs.update(details.tabId, {
    url:
      chrome.runtime.getURL("index.html") +
      "?gateTarget=" +
      encodeURIComponent(details.url) +
      "#/gate",
  });
});

// The gate page (#/gate) reports a completed review with this message; we
// unlock the tab and send it on to where it was originally headed.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "bm-gate-unlock") return;
  const targetUrl = typeof message.targetUrl === "string" ? message.targetUrl : "";
  const tabId = sender.tab && sender.tab.id;
  // Only ever navigate to http(s) — a crafted gateTarget must not be able to
  // send the tab to javascript:, file:, chrome:, etc.
  if (
    tabId === undefined ||
    tabId === null ||
    (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))
  ) {
    sendResponse({ ok: false });
    return;
  }
  (async () => {
    // The unlock must be persisted BEFORE the navigation starts, or the
    // target load fires onBeforeNavigate while the tab still looks locked
    // and we'd bounce straight back to the gate.
    await addUnlockedTab(tabId);
    await chrome.tabs.update(tabId, { url: targetUrl });
    sendResponse({ ok: true });
  })();
  return true; // keep the message channel open for the async sendResponse
});

// --- "Whitelist this domain" context menu ----------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: WHITELIST_MENU_ID,
    title: "Whitelist this domain",
    contexts: ["action", "page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== WHITELIST_MENU_ID) return;

  let rawUrl = info.pageUrl || (tab && tab.url) || "";
  // Clicking on a gate tab means "whitelist the site I was headed to", not
  // the extension page itself — recover the destination from gateTarget.
  if (rawUrl.startsWith(chrome.runtime.getURL("")) && rawUrl.includes("gateTarget=")) {
    try {
      rawUrl = new URL(rawUrl).searchParams.get("gateTarget") || "";
    } catch {
      rawUrl = "";
    }
  }

  let host = "";
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    // Mirrors normalizeDomain() in src/lib/domainWhitelist.ts: lowercase,
    // strip the noise "www." prefix.
    host = url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return;
  }
  if (!host) return;

  // Read-modify-write the whole settings object: the Settings UI owns its
  // shape, we only append to the whitelist (creating missing pieces from the
  // same defaults the app uses).
  const stored = await readSettings();
  const settings = stored || { esvApiKey: "", newTabGate: defaultNewTabGateSettings() };
  if (!settings.newTabGate) {
    settings.newTabGate = defaultNewTabGateSettings();
  }
  if (!Array.isArray(settings.newTabGate.whitelist)) {
    settings.newTabGate.whitelist = [];
  }
  if (!settings.newTabGate.whitelist.includes(host)) {
    settings.newTabGate.whitelist.push(host);
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  // Unlock the tab too, so the user isn't gated on the very site they just
  // whitelisted (the gate redirect may already have happened).
  if (tab && tab.id !== undefined) {
    await addUnlockedTab(tab.id);
  }
});

// Tab ids are recycled by Chrome; drop closed tabs from the unlocked set so
// a future tab that happens to reuse the id doesn't inherit the unlock.
chrome.tabs.onRemoved.addListener((tabId) => {
  removeUnlockedTab(tabId);
});
