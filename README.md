# Bible Memory

Memorize Bible verses through active recall. Bible Memory is a React +
TypeScript + Vite app that also ships as an unpacked Chrome extension — and the
extension can **gate your browsing** until you review a verse, turning idle new
tabs and address-bar detours into memorization reps.

Everything runs locally in your browser. There is no backend and no account:
verses, collections, and settings live in `localStorage` (web) or
`chrome.storage.local` (extension).

## Features

- **Verse library** — Add verses manually or look them up via the ESV API
  (your own key). Sort columns by canonical Bible book order (Genesis → Revelation),
  mastery score, or review schedule. Each verse tracks a mastery score and per-review history.
- **Collections** — Group verses into collections, reorder them via drag-and-drop,
  rename inline, and run reviews over a whole collection, a selected subset, or a random verse.
- **Six review modes** — from plain typing and reference recall to arcade games (see below).
- **First-letter or whole-word input** — practice by typing just the first
  letter of each word, or typing the full word with a live Hint button.
- **The verse gate (extension only)** — when enabled, opening a new tab or
  typing a URL in the address bar redirects you to a full-screen verse review.
  Complete it to proceed. Supports collection pooling and verse-level subsets. Whitelist domains you don't want gated, and
  optionally set a **cooldown** so one review buys you a stretch of gate-free
  browsing.
- **Backups & data management** — export all your data as a JSON file, import backups additively, or clear all stored data with 2-step confirmation.
- **Light / dark / system theme.**

### Review modes

Four mask-based active recall modes plus two arcade modes:

| Mode | What it does | SRS Advancement |
| --- | --- | --- |
| **Type It** | Whole verse visible — warm-up / typing practice. | Yes |
| **Memorize It** | Every other word masked. | Yes |
| **Master It** | Every word masked — full recall practice. | Yes |
| **Reference It** | Verse text visible; verse reference hidden & prompted. | No (Practice only) |
| **Verse Defender** | Tower-defense arcade: words descend as asteroids, type the first letter to blast them. | Yes |
| **Lane Defender** | 4-lane (`D`/`F`/`J`/`K`) rhythm variant, scored on per-word accuracy. | Yes |

Scoring is word-based. A word counts as "clean" if you typed it with no misses;
live accuracy is clean words ÷ total words. The pass threshold is 90%. A
verse's overall **mastery score** averages your accuracy across the harder
modes only (Master It, Verse Defender, Lane Defender). Reference It mode lets you practice recalling book, chapter, and verse references while keeping text visible, without affecting SRS schedules or mastery scores.

In a single-verse review, the verse's **reference is also a recall target** —
it's appended to the end and typed from memory like the rest of the verse. The
reference shown in the on-screen heading **auto-hides once you're roughly a
quarter of the way through**, so you can't read it back off the screen while
recalling it.

### Study Today

A single entry point (the **Study** tab) that shows *what to review now* using a
forgiving [Leitner](https://en.wikipedia.org/wiki/Leitner_system) schedule. It's
just one table — every verse **due for review**, most overdue first, shown the
same way as the Library (reference, preview, translation, score, and a Review
indicator) — plus a **Review all** button that runs through them one at a time.
When nothing's due, it simply says you're all caught up.

Each verse carries an SRS **bucket** (0–5); its **phase** and the mode it's
studied in ramp together:

| Phase | Bucket | Mode | Meaning |
| --- | --- | --- | --- |
| **New** | none yet | Type It | Never studied. Not shown here — a verse joins the schedule the first time you review it. |
| **Learning** | 0 | Memorize It | Started but not solid — always due. |
| **Reviewing** | 1–5 | Master It | Learned — resurfaces on an expanding schedule. |

There's **no daily "new verses" quota**: you decide when to start a new verse by
reviewing it (from the Library, a collection, or the verse gate). That first
review drops it into the schedule, and from then on Study Today surfaces it when
it's due. You can scope the study pool to specific collections in Settings
(default: whole library).

**Schedule.** Review intervals by bucket are `0, 1, 3, 7, 14, 30` days. Each
review adjusts the bucket by its accuracy, in three bands:

- **≥ 90% — advance:** climb one bucket (capped at 5), next review further out.
- **85–89% — hold:** stay on the current bucket, no penalty.
- **< 85% — miss:** eases off one bucket (or holds — configurable as "demote" vs "hold" in Settings).

It **never resets to bucket 0** from a high bucket and never drops below 0, so a
single stumble on a well-learned verse only nudges it back one step.

**Due badge & practice counter.** The **Study** nav tab carries a live badge with the number of
verses **due for review** right now (learning + reviewing whose time has come). The header also displays your cumulative **verses practiced** count (e.g. `⚡ 12`), updating automatically after every completed session.

**Per-verse schedule at a glance.** The Library table and each collection's verse
cards show a compact **Review** indicator per verse — when it's next due (e.g.
"Due in 3d", "Due now") plus its frequency (e.g. "Every 7d", "Daily", or "New"
when it hasn't been scheduled yet).

**Adjusting a verse's schedule.** A verse's detail page has a **Review schedule**
card where you can pick its review **frequency** from preset levels (Learning
daily up to every 30 days) — changing it restarts the schedule from today — and
**Restart countdown** to reset the days-until-due without changing the frequency.

### The verse gate

Available only in the extension. When enabled in Settings, the background
service worker intercepts:

- the first navigation of a **newly opened tab**, and
- **address-bar** navigations (typed URLs, omnibox searches, chosen bookmarks).

It redirects the tab to a full-screen gate that picks a verse from your chosen
collections or verse subset and runs your configured review mode. By default, the gate **surfaces verses
that are due for review first** (most overdue first), falling back to a random
verse when nothing is due. Alternatively, you can configure the gate to pick any verse from the pool at random, bypassing spaced-repetition checks. Finishing the review (pass *or* fail — it rewards
engagement) reveals a **Proceed to site** button, and **advances that verse's
spaced-repetition schedule** just like a Study Today review — for every mode
that counts toward the schedule, including the two arcade games. (Reference It
is practice-only, so completing a Reference It gate never advances the
schedule.)


The gate deliberately **fails open**: if it's off, unconfigured, pointed at an
empty verse set, or the destination is whitelisted, it never blocks you.
Clicked links, redirects, reloads, and back/forward are never gated. You can
whitelist the current domain from the right-click context menu.

**Cooldown.** Optionally set a review cooldown (in minutes) in Settings. While
it's active, completing *any* verse review — at the gate itself or in a normal
review or game — unlocks browsing for that window, so new tabs load without a
review until it lapses. Every review you finish restarts the timer. With the
cooldown off, each new tab needs its own review.

## Getting started (web app)

Requires Node.js.

```
npm install
npm run dev
```

This starts the Vite dev server with hot reload. To use ESV lookup, add your
own key from [api.esv.org](https://api.esv.org/) in **Settings** — it is stored
locally and never bundled into the app.

Other scripts:

```
npm run build     # type-check (tsc -b) + production build to dist/
npm run test      # run the Vitest suite
npm run lint      # oxlint
```

## The Chrome extension

The Chrome extension does **not** run the Vite dev server. It loads the static
build output in `dist/` (the Vite bundle plus a copied `manifest.json` and
`background.js`). Because of that:

- **`npm run dev` is for the web app only.** It runs the Vite dev server with
  hot reload. The extension never loads from it.
- **Clicking reload ↻ on `chrome://extensions` does not rebuild anything.** It
  only reloads whatever is *already* in `dist/`. If you edit source and only
  click reload, you'll see no change — because `dist/` is still the old build.

### The build → reload cycle

1. Rebuild `dist/` from source:
   ```
   npm run build:extension
   ```
   This runs `npm run build` (`tsc -b && vite build`) and then copies
   `manifest.json` + `background.js` into `dist/`.
2. Go to `chrome://extensions` and click the reload ↻ button on the Bible
   Memory card so Chrome picks up the new `dist/`.

Load the extension the first time via `chrome://extensions` → enable
"Developer mode" → "Load unpacked" → select the `dist/` folder.

### Watch mode (recommended while iterating)

```
npm run build:extension:watch
```

This runs `vite build --watch` and re-copies `manifest.json` +
`background.js` into `dist/` after every rebuild, so `dist/` stays current as
you edit. You still have to click reload ↻ on `chrome://extensions` after each
rebuild — Chrome does not hot-reload unpacked extensions. (Watch mode skips the
`tsc -b` type-check that `npm run build:extension` runs.)

> **Note:** `src/extension/background.ts` is intentionally plain, import-free
> TypeScript. It is copied to `dist/background.js` verbatim (not bundled), so it
> re-implements a few helpers (domain whitelisting, gate defaults) that must be
> kept in sync with `src/lib/domainWhitelist.ts` and `src/types/settings.ts`.

## Data & privacy

- All data (verses, collections, review history, settings) is stored locally —
  `localStorage` on the web, `chrome.storage.local` in the extension. Nothing is
  sent anywhere except your own requests to the ESV API.
- The **ESV API key is user-supplied** and lives only in your browser settings.
  No key is bundled with the app.
- **Backups include your ESV API key in plaintext.** The JSON produced by
  Settings → Export contains everything, including the key — treat the file
  accordingly and don't commit or share it.

## Tech stack

React 19 · react-router-dom 7 (HashRouter) · TypeScript · Vite 8 · Vitest ·
oxlint. Chrome extension is Manifest V3 (background service worker; no content
scripts). Styling is inline CSS-variable styles — no CSS framework.

Tests (Vitest + jsdom + Testing Library) cover the review-session engine, the
SRS scheduler, the verse + reference review tokenizer, the Verse Defender
engine, verse sorting, the storage adapter, verse scoring, the domain
whitelist, the tokenizer, and review-mode visibility.
