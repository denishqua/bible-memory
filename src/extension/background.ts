// MV3 background service worker for the Bible Memory extension.
//
// This file is copied VERBATIM to dist/background.js (no bundling, no
// transpile — see scripts/build-extension.mjs), so it must stay plain,
// JS-compatible TypeScript: no imports, no exports, no type annotations.
// Storage shapes it reads are defined in src/types/settings.ts; any field
// rename there must be mirrored here by hand.
//
// Beyond the toolbar-click handler, this worker implements the "verse gate":
// a top-frame http(s) navigation to a non-whitelisted domain is redirected to
// the bundled review page (#/gate). Two gestures trigger it:
//   1. Opening a NEW TAB (its first real navigation), and
//   2. Typing a URL into the address bar (or picking an omnibox suggestion /
//      bookmark) in ANY tab.
// Everything else passes through untouched: clicked links, server redirects,
// form submits, reloads, back/forward, popups (OAuth sign-in), and
// session-restore tabs. The point is to gate the deliberate "go to this site"
// gesture without making ordinary in-page browsing unusable.
const SETTINGS_KEY = "bm.settings.v1";

// Epoch ms of the last completed verse review, written by the app's storage
// adapters (touchGateReview) and read here to enforce the gate's cooldown:
// while the window is open, browsing is un-gated. Mirrors KEYS.gateCooldown in
// the storage adapters — this file cannot import, so keep the string in sync.
const COOLDOWN_KEY = "bm.gateCooldown.v1";

// New tabs whose opening navigation hasn't been handled yet — the ONLY
// navigations eligible for the gate. A navigation in a tab that isn't listed
// here is an in-tab navigation (redirect, typed URL, clicked link) and is
// never gated: that's the "new tab opens only, never same-tab" rule.
//
// Tracked two ways on purpose: an in-memory Set (synchronous, so a tab that
// navigates the instant it opens — e.g. a target=_blank link — is never
// missed to a storage race) mirrored to chrome.storage.session (survives the
// service worker being torn down between opening a tab and navigating it, and
// clears when Chrome closes). A tab is removed from both the moment its
// opening navigation is handled, so every later navigation in it is in-tab.
const PENDING_TABS_KEY = "bm.pendingNewTabs.v1";
const pendingNewTabs = new Set();

// Session restore recreates every previously-open tab in a burst at startup;
// those are not "new tab opens" and must not be gated. Suppress new-tab
// tracking briefly after the browser starts. Best-effort (in-memory): if the
// worker is recycled mid-restore the window is lost, but the failure mode is
// only that a restored tab might get gated — never that a tab is trapped.
let startupSuppressUntil = 0;

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

// --- new-tab tracking ------------------------------------------------------

async function readPendingTabs() {
  const data = await chrome.storage.session.get(PENDING_TABS_KEY);
  const list = data[PENDING_TABS_KEY];
  return Array.isArray(list) ? list : [];
}

async function markTabPending(tabId = -1) {
  pendingNewTabs.add(tabId);
  const stored = await readPendingTabs();
  if (!stored.includes(tabId)) {
    await chrome.storage.session.set({ [PENDING_TABS_KEY]: stored.concat(tabId) });
  }
}

async function isTabPending(tabId = -1) {
  // In-memory first (race-free for a tab that navigates the moment it opens),
  // then the persisted mirror (in case the worker restarted since onCreated).
  if (pendingNewTabs.has(tabId)) return true;
  const stored = await readPendingTabs();
  return stored.includes(tabId);
}

async function clearTabPending(tabId = -1) {
  pendingNewTabs.delete(tabId);
  const stored = await readPendingTabs();
  if (stored.includes(tabId)) {
    await chrome.storage.session.set({
      [PENDING_TABS_KEY]: stored.filter((id) => id !== tabId),
    });
  }
}

// Every freshly opened tab is a candidate to be gated on its first
// navigation. Popups/app/devtools windows and session restores are filtered
// out later (onBeforeNavigate checks the window type; the startup window
// suppresses restores).
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === undefined) return;
  if (Date.now() < startupSuppressUntil) return;
  void markTabPending(tab.id);
});

chrome.runtime.onStartup.addListener(() => {
  startupSuppressUntil = Date.now() + 8000;
});

// Tab ids are recycled by Chrome; drop closed tabs so a future tab that
// reuses the id doesn't inherit a stale "pending" flag.
chrome.tabs.onRemoved.addListener((tabId) => {
  void clearTabPending(tabId);
});

// Mirrors isHostWhitelisted() in src/lib/domainWhitelist.ts (which this file
// cannot import) — keep the two in sync. A whitelist entry is a bare,
// lowercased domain that matches the exact host and every subdomain, with
// "www." treated as noise.
function isHostWhitelisted(host = "", whitelist = [""]) {
  // A trailing dot is a fully-qualified form of the same host
  // ("example.com." === "example.com") — strip it so it can't bypass a match.
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\.+$/, "");
  return whitelist.some((d) => h === d || h.endsWith("." + d));
}

// Defaults mirror defaultNewTabGateSettings() in src/types/settings.ts.
function defaultNewTabGateSettings() {
  return {
    enabled: false,
    whitelist: [],
    collectionIds: [],
    verseIds: null,
    mode: "type-it",
    cooldownEnabled: false,
    cooldownMinutes: 15,
  };
}

// Epoch ms of the last completed review, or null if none / unreadable.
async function readGateCooldownAt() {
  const data = await chrome.storage.local.get(COOLDOWN_KEY);
  const value = data[COOLDOWN_KEY];
  return typeof value === "number" ? value : null;
}

// --- the gate itself -------------------------------------------------------

// Shared gate decision for a destination URL: true means "show the gate".
// FAILS OPEN on every disabled/unconfigured state (no settings, gate off,
// no collection picked, unparseable URL) so the gate can never lock the user
// out of the web; a whitelisted host also passes.
async function shouldGateUrl(url = "") {
  const settings = await readSettings();
  const gate = settings && settings.newTabGate;
  if (!gate || !gate.enabled) return false;
  // Cooldown: once any review is completed, browsing is un-gated for a
  // configurable window; every completed review restarts it (touchGateReview
  // rewrites the timestamp). While the window is still open, let every
  // navigation through. Guarded on both the toggle and a positive duration so a
  // stale/zero value can never silently disable the gate.
  const cooldownMinutes = Number(gate.cooldownMinutes);
  if (gate.cooldownEnabled && cooldownMinutes > 0) {
    const lastReviewAt = await readGateCooldownAt();
    if (lastReviewAt !== null) {
      // Guard the elapsed time on BOTH ends. A negative elapsed means the
      // stored stamp is in the future (clock moved back, NTP correction, a
      // stamp written while the clock ran fast) — treat that as "cooldown not
      // active" rather than letting it silently disable the gate until the
      // clock catches up.
      const elapsed = Date.now() - lastReviewAt;
      if (elapsed >= 0 && elapsed < cooldownMinutes * 60000) {
        return false;
      }
    }
  }
  // Read collections defensively: the current shape is `collectionIds` (an
  // array), but data stored before the multi-collection change carried a single
  // `collectionId`. Support both; an empty result means unconfigured.
  const collectionIds = Array.isArray(gate.collectionIds)
    ? gate.collectionIds
    : gate.collectionId
      ? [gate.collectionId]
      : [];
  if (collectionIds.length === 0) return false;
  // An explicitly-empty verse subset means there is nothing to review — the
  // gate page would just fail open anyway, so don't hijack the navigation.
  if (Array.isArray(gate.verseIds) && gate.verseIds.length === 0) return false;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  const whitelist = Array.isArray(gate.whitelist) ? gate.whitelist : [];
  return !isHostWhitelisted(host, whitelist);
}

// Never gate popups / app / devtools windows (e.g. OAuth sign-in popups) —
// only normal browser tabs. Returns false if the tab/window is already gone.
async function isGatableWindow(tabId = -1) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId === undefined) return true;
    const win = await chrome.windows.get(tab.windowId);
    return !win.type || win.type === "normal";
  } catch {
    return false;
  }
}

// Send the tab to the bundled review page, carrying the intended destination
// so the gate page can navigate there once the review is done.
async function sendTabToGate(tabId = -1, url = "") {
  await chrome.tabs.update(tabId, {
    url:
      chrome.runtime.getURL("index.html") +
      "?gateTarget=" +
      encodeURIComponent(url) +
      "#/gate",
  });
}

// True when a navigation was initiated from the address bar — a typed URL, an
// omnibox suggestion/keyword search, or a chosen bookmark. That's the
// deliberate "go to this site" gesture the gate exists to intercept. Link
// clicks, redirects, form submits, reloads, and back/forward are all excluded
// so ordinary browsing within a page is never gated. `transitionType` is only
// available on onCommitted, which is why the address-bar case can't be handled
// in onBeforeNavigate.
function isAddressBarNavigation(details = loosen()) {
  const quals = Array.isArray(details.transitionQualifiers) ? details.transitionQualifiers : [];
  // Revisiting history (Back/Forward) isn't new browsing, even when it replays
  // a URL that was originally typed.
  if (quals.indexOf("forward_back") !== -1) return false;
  if (quals.indexOf("from_address_bar") !== -1) return true;
  const type = details.transitionType;
  return (
    type === "typed" ||
    type === "generated" ||
    type === "keyword" ||
    type === "keyword_generated" ||
    type === "auto_bookmark"
  );
}

// Trigger 1: the opening navigation of a newly opened tab. Handled here (not
// onCommitted) so a link that opens a new tab is intercepted before its
// destination begins to load. Sub-frames and the New Tab page bail on the
// scheme check, which leaves the tab "pending" until its first real navigation.
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) return;

  if (!(await isTabPending(details.tabId))) return;
  // Consumed: from here on this tab behaves like any other — its later
  // navigations are in-tab (only address-bar ones are re-gated, below), so the
  // Proceed button can navigate the tab to its destination without re-gating.
  await clearTabPending(details.tabId);

  if (!(await isGatableWindow(details.tabId))) return;
  if (await shouldGateUrl(details.url)) {
    await sendTabToGate(details.tabId, details.url);
  }
});

// Trigger 2: a URL typed into the address bar (or an omnibox suggestion /
// bookmark) in ANY tab — the in-tab case new-tab tracking deliberately misses.
// Because `transitionType` only exists on onCommitted, this fires slightly
// later than onBeforeNavigate: the destination may begin to load before we
// redirect to the gate. The synchronous isAddressBarNavigation() check bails
// immediately for the overwhelmingly common link/redirect/reload navigations,
// so only real address-bar entries pay for a settings read. A programmatic
// tabs.update (e.g. the Proceed button's navigation) has a "link" transition,
// so it is never re-gated here.
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) return;
  if (!isAddressBarNavigation(details)) return;

  if (!(await isGatableWindow(details.tabId))) return;
  if (await shouldGateUrl(details.url)) {
    await sendTabToGate(details.tabId, details.url);
  }
});

// The gate page (#/gate) reports a completed review with this message; we
// send the tab on to where it was originally headed. The gate tab is no
// longer "pending" (its opening navigation was consumed when we redirected it
// here), so this navigation isn't re-gated.
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
    await clearTabPending(tabId); // belt-and-suspenders
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
});
