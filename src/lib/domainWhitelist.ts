// Domain-whitelist helpers for the verse gate. A whitelist entry is a bare,
// lowercased domain ("google.com") that matches the exact host and every
// subdomain ("mail.google.com"). "www." is treated as noise on both sides so
// whitelisting "www.google.com" and visiting "google.com" (or vice versa)
// still match.
//
// The background service worker duplicates this matching logic inline (it is
// copied to dist/ unbundled and cannot import) — keep the two in sync.

// Accepts a full URL, a host, or a bare domain typed by the user; returns the
// canonical whitelist entry, or null if it can't be a valid domain.
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("://")) {
    try {
      s = new URL(s).hostname;
    } catch {
      return null;
    }
  }
  // Strip any path/query the user pasted, a port, leading "www.", and any
  // trailing dot(s) (a fully-qualified "example.com." means the same host).
  s = s
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.+$/, "");
  if (!s) return null;
  if (s === "localhost") return s;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

export function isHostWhitelisted(host: string, whitelist: string[]): boolean {
  // A trailing dot is a fully-qualified form of the same host
  // ("example.com." === "example.com") — strip it so it can't bypass a match.
  const h = host.toLowerCase().replace(/^www\./, "").replace(/\.+$/, "");
  return whitelist.some((d) => h === d || h.endsWith("." + d));
}
