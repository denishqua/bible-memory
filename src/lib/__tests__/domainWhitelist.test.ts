import { describe, expect, it } from "vitest";
import { isHostWhitelisted, normalizeDomain } from "../domainWhitelist";

describe("normalizeDomain", () => {
  it("lowercases and passes through a bare domain", () => {
    expect(normalizeDomain("Google.com")).toBe("google.com");
    expect(normalizeDomain("  example.org  ")).toBe("example.org");
  });

  it("extracts the hostname from a full URL, dropping path and query", () => {
    expect(normalizeDomain("https://Mail.Google.com/inbox?tab=1#top")).toBe("mail.google.com");
    expect(normalizeDomain("http://example.com/some/path")).toBe("example.com");
  });

  it("strips path/query/fragment pasted without a scheme", () => {
    expect(normalizeDomain("example.com/path?q=1#frag")).toBe("example.com");
  });

  it("strips a port", () => {
    expect(normalizeDomain("example.com:8080")).toBe("example.com");
    expect(normalizeDomain("https://example.com:8443/x")).toBe("example.com");
  });

  it("strips a leading www.", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
  });

  it("strips a trailing dot (fully-qualified domain form)", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
    expect(normalizeDomain("https://example.com./path")).toBe("example.com");
  });

  it("allows localhost as a special case", () => {
    expect(normalizeDomain("localhost")).toBe("localhost");
    expect(normalizeDomain("http://localhost:5173/app")).toBe("localhost");
  });

  it("returns null on garbage", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("justoneword")).toBeNull(); // no dot, not localhost
    expect(normalizeDomain("https://")).toBeNull(); // unparseable URL
    expect(normalizeDomain("foo..bar")).toBeNull(); // empty label
    expect(normalizeDomain("héllo.com")).toBeNull(); // non-ascii label rejected
    expect(normalizeDomain("www.")).toBeNull(); // nothing left after stripping
  });
});

describe("isHostWhitelisted", () => {
  const whitelist = ["example.com", "google.com"];

  it("matches the exact host", () => {
    expect(isHostWhitelisted("example.com", whitelist)).toBe(true);
  });

  it("matches subdomains via suffix", () => {
    expect(isHostWhitelisted("mail.google.com", whitelist)).toBe(true);
    expect(isHostWhitelisted("a.b.example.com", whitelist)).toBe(true);
  });

  it("treats www. as noise on the host side", () => {
    expect(isHostWhitelisted("www.example.com", whitelist)).toBe(true);
  });

  it("is case-insensitive on the host", () => {
    expect(isHostWhitelisted("EXAMPLE.COM", whitelist)).toBe(true);
    expect(isHostWhitelisted("Mail.Google.Com", whitelist)).toBe(true);
  });

  it("treats a trailing dot (fully-qualified form) as the same host", () => {
    expect(isHostWhitelisted("example.com.", ["example.com"])).toBe(true);
    expect(isHostWhitelisted("mail.google.com.", whitelist)).toBe(true);
    // Stripping the dot must not open the suffix-attack hole.
    expect(isHostWhitelisted("evilexample.com.", whitelist)).toBe(false);
  });

  it("does NOT match lookalike hosts that merely end with the domain string", () => {
    expect(isHostWhitelisted("evilexample.com", whitelist)).toBe(false);
    expect(isHostWhitelisted("notexample.com", whitelist)).toBe(false);
    expect(isHostWhitelisted("fakegoogle.com", whitelist)).toBe(false);
  });

  it("does not match unrelated hosts or an empty whitelist", () => {
    expect(isHostWhitelisted("example.org", whitelist)).toBe(false);
    expect(isHostWhitelisted("example.com", [])).toBe(false);
  });
});
