// MV3 background service worker for the Bible Memory extension.
//
// This file is copied VERBATIM to dist/background.js (no bundling, no
// transpile — see scripts/build-extension.mjs), so it must stay plain,
// JS-compatible TypeScript: no imports, no exports, no type annotations.
// Storage shapes it reads are defined in src/types/settings.ts; any field
// rename there must be mirrored here by hand.
//
// Beyond the toolbar-click handler, this worker implements the "verse gate":
// when a NEW TAB is opened, its first http(s) top-frame navigation is
// redirected to the bundled review page (#/gate) unless the destination
// domain is whitelisted. Only the opening navigation of a freshly opened tab
// is gated — same-tab navigations (typed URLs, clicked links, server
// redirects), popups, and session-restore tabs all pass through untouched.
const SETTINGS_KEY = "bm.settings.v1";

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
  // the app) never gets intercepted. Sub-frames and the New Tab page bail
  // here too, which importantly leaves a new tab still "pending" until its
  // first *real* navigation.
  if (details.frameId !== 0) return;
  if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) return;

  // Gate ONLY the opening navigation of a newly opened tab. A navigation in
  // any tab that wasn't just created is an in-tab navigation — a redirect, a
  // typed URL, a clicked link — and passes through untouched.
  if (!(await isTabPending(details.tabId))) return;
  // Consumed: from here on this tab behaves like any other — its later
  // navigations are in-tab and never gated (that's also what lets the
  // Proceed button navigate the tab to its destination without re-gating).
  await clearTabPending(details.tabId);

  // Never gate popups / app / devtools windows (e.g. OAuth sign-in popups) —
  // only normal browser tabs.
  try {
    const tab = await chrome.tabs.get(details.tabId);
    if (tab.windowId !== undefined) {
      const win = await chrome.windows.get(tab.windowId);
      if (win.type && win.type !== "normal") return;
    }
  } catch {
    // Tab or window already gone — nothing to gate.
    return;
  }

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
  if (isHostWhitelisted(host, whitelist)) return;

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
