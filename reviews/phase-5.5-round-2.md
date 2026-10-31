# Phase 5.5 — Review round 2

## Verdict
Fail

Round 1 is almost fully resolved:
- both Blockers are fixed;
- the eight screens now follow the concepts closely;
- the demo is honest and visible;
- every exit criterion Codex can meet is met.

Two small Majors keep the phase open:
- a regression puts the Play window's corner buttons on top of the score;
- the engine hard-codes this game's demo name.

Both are quick fixes. Round 3 is the last round for this phase.

How I verified, at `37e29aa` (`536739d..37e29aa`, one commit, local only; `origin/master` is still `40b7e5b`):
- I cloned the local repository into a scratch folder: no `.env` and no tokens.
- In the clone, I ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high`.
- I ran a headless Chromium walkthrough against the clone's real `npm run dev` (HTTPS/HTTP2) at 1920×1080. It used Practice and the demo patch only, and never approved a Codex build.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\r2-*.png`.
- I compared each new capture in `docs/phases/phase-5.5-visual/` side by side with `plans/phase-5.5/concepts/01–08`.

## Exit criteria
- [x] **Tokens, type, contrast and brand.**
  - Shared chrome colours now come from tokens.
  - `tests/phase55.test.ts` covers the added pairs (`accent-text`, `text-soft`).
  - The repository contains no Twitch artwork or font files.
- [x] **Top bar and sidebar match B.**
  - Status now resolves on every page. My run showed "● Codex ready" on Library 1.5 s after load.
  - The dots have Ready, Needs action and unavailable states.
  - Test: "Codex and OBS status resolve on Go Live and Library".
- [x] **Home without the game; one named Play window with a stable title.**
  - My run: the title is "Live Patch · Arena Survivor", and a second Play click kept the page count at 3.
  - Full screen is an operator check.
- [x] **Pause menu.**
  - My run: Esc opened it, with focus on Resume.
  - Patches showed 4 cards with icon, credit, status pill and age. Controls is an ACTION / KEY table, and the bottom hint bar uses keycaps.
- [x] **Pausing freezes game time and mutation ticks; toasts appear.** The test now asserts that `host.tickDeliveries()` stays constant while paused and grows after resume.
- [x] **First visit and the demo path.**
  - My run: the welcome was open on the first visit, and **Start practice** went to Practice.
  - The automatic round reached approval in **0.5 s**, with 3 distinct voters.
  - **Coin Shower** put **10 coins around the player** (`r2-04`).
  - The overlay reads "Demo patch: Coin Shower (stands in for 'Enemies split into two tiny slimes when hit') · by @Live Patch Demo".
  - When Play opened after the ship, it showed the toast "Demo patch: Coin Shower — by @Live Patch Demo".
  - The idea's status is `demo`. The Live refusal is unit-tested.
- [x] **Go Live panels.**
  - Presets, collapse, reorder and confirmations work, the Activity feed covers the event kinds, and the preview mirrors the real Play window.
  - The page is now **1,105 px tall at 1,080** (it was 3,045). See Nit P55-R2-08.
- [x] **Library and overlay; no widget covering the HUD or toast at 1920×1080 with the controls hidden.**
  - My composite: toast 721–1198 × 80–134, patch card 24–444 × 180–610, **0 px² overlap**.
  - Overlay type sizes pass (test).
- [x] **Keyboard alone, named icon buttons, reduce flashing.** New test: "studio navigation works with Tab and Enter and shows focus".
- [ ] **First-time usability check** — pending the operator, as planned.
- [x] **HTTPS/HTTP2, tests, build and audit.**
  - `npm test`: vitest **75 passed, 4 skipped**; Playwright **49 passed, 1 skipped** (the opt-in WebGL test); then "HTTPS regression passed: HTTP/2 same-origin, cross-origin denial, Practice, Go Live and Play window"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.

## Previous findings
- **P55-R1-01** — **Resolved.**
  - The default patch card moved to 24,180 (420×430), and an untouched old default layout is migrated.
  - The editor draws "Game HUD" and "Patch toast" keep-clear zones and warns on overlap.
  - The test now compares against the rendered toast. My composite shows 0 overlap.
- **P55-R1-02** — **Resolved.** The setup summary runs on every view (`engine/app.ts`), and the dots have three states.
- **P55-R1-03** — **Resolved, with remaining gaps.**
  - **Welcome, Practice, Go Live and the pause menu are now close to their concepts:**
    - Welcome: illustrated three-step loop, three cards, and the footer row.
    - Practice: three columns, a big timer, a vertical timeline, the checklist, and an Advanced disclosure.
    - Go Live: fits one screen, with a big timer, square icon tiles, an icon feed, a timeline with pills, and drag-handle headers.
    - Pause menu: PAUSED title, patch cards, a keycap table and the hint bar.
  - **Home, Library and the overlay also follow their concepts.**
  - **The report's table now lists differences, with reasons.**
  - **Still open:** P55-R2-01 (corner buttons), P55-R2-05 (Library details rows) and Nit P55-R2-08.
- **P55-R1-04** — **Resolved.**
  - Coin Shower is visible within a second.
  - The wording names the stand-in, and the idea status is `demo`.
  - One credit, "@Live Patch Demo", is used everywhere, and Play replays a recent ship toast.
  - New related findings: P55-R2-02 and P55-R2-03.
- **P55-R1-05** — **Resolved.**
  - `dispose` drops the module's held actions, and resume applies only those from active modules (`engine/mutation/host.ts:190,211-214`).
  - Test: "rollback while paused drops in-flight actions…".
- **P55-R1-06** — **Resolved** for keys: my run stayed `stream-clean` after pressing D. Hiding the title caused a new regression, P55-R2-01.
  - Codex also edited the spec copy (`docs/phases/phase-5.5.md`) to the clarified wording I proposed in round 1. I've updated the plan to match; the operator should accept that one-line spec change.
- **P55-R1-07** — **Resolved.** My run: after **Back to studio**, the Play window stayed on `/play` and the opener was focused. Without an opener, it asks before leaving.
- **P55-R1-08** — **Resolved.** `engine/twitch/practice-demo.ts` requires an all-Practice ballot with live chat disconnected, and has a unit test.
- **P55-R1-09** — **Resolved.**
  - `.gitignore` ignores `games/*/mutations/demo-*.js`.
  - Go Live has a confirmed **Remove demo patches** action, covered by a test.
- **P55-R1-10** — **Resolved.** The game's API doc now covers pausing and held actions, and says `elapsed` counts "active seconds".
- **P55-R1-11** — **Resolved.** Tick deliveries are asserted, a keyboard test exists, and the report lists all 11 criteria.
- **P55-R1-12** — **Resolved** for the shared chrome. Colours that belong to the game's own art stay local, which is fine.
- **P55-R1-13** — **Resolved.**

## Findings

### Blockers
None.

### Majors
- **P55-R2-01** · `engine/play.css` (`.play-title` is now `position:absolute`; `.play-top` uses `justify-content:space-between`) — **Regression: the Play window's corner buttons now sit at the top left, on top of the score.**
  - **Cause:** hiding the title took it out of the flex row, so the tools are the row's only item and move to the start.
  - **Evidence:** in `r2-04-play-tools-visible.png`, "Mute (M)", "Full screen (F)" and "Menu (Esc)" cover "SCORE 0 LIVES" at about 18–260 × 16–96.
  - **Why the captures don't show it:** the buttons appear on every mouse movement and menu key, but Codex's `03` capture is stream-clean.
  - **Why it matters:**
    - concept 03 and `docs/play-layout.md` both put these controls at the top right (1480–1896 × 16–100);
    - on stream, moving the mouse over the game hides the score for 3 seconds.
  - **Suggested fix:**
    - Right-align the tools group.
    - Add a geometry test that shows the tools (mouse move), then checks that their rect is in the top-right region and doesn't intersect the HUD text or the toast.
- **P55-R2-02** · `engine/overlay/stream.ts:44`, `engine/twitch/server.ts:376,378` — **The engine hard-codes this game's demo title, "Coin Shower".**
  - `demoMutation` is a generic manifest field (`docs/adding-a-game.md:40`). Any other game's demo would still be announced as "Coin Shower" in the overlay, the runner event and the Practice reply.
  - **Why it matters:** game-specific content belongs in the game, not in `engine/`; it's the same kind of boundary leak as a hard-coded game path.
  - **Suggested fix:**
    - The server already reads and validates the demo source, so take `meta.title` from it at that point.
    - Store the title on the demo run record, and have the overlay and the Practice reply use it.
    - Add a unit test with a second demo title.

### Minors
- **P55-R2-03** · `games/arena-survivor/demo/quick-feet.js` — The prepared demo exceeds the action limits it is meant to show off.
  - `onStart` issues 25 actions (12 spawns, 12 bursts, 1 message), but the host applies at most 20 per batch.
  - My run's patch list showed "Demo patch: Coin Shower · active · **7 actions skipped in 10s**", and its "DEMO PATCH: COIN SHOWER" banner never appeared.
  - A newcomer's first patch shouldn't report skipped actions.
  - Suggested fix: stay under the cap, for example 8 coins, one burst and the message. Also rename the file to match its new content.
- **P55-R2-04** · `engine/overlay/library.ts:96` — "N patches active" counts shipped runs, not active patches.
  - My run's card said "**1 patch active**" while four were active: three built-in patches plus the demo.
  - Suggested fix: count the active mutation files, or label it "N shipped".
- **P55-R2-05** · `engine/overlay/library.ts`, `engine/overlay/library-polish.css` — Layout glitches in the Library at 1920×1080, in both Codex's `05` and my `r2-08`:
  - each details row wraps onto three lines ("▶ / Controls · / 5 ›");
  - the card's star overlaps the cover's top-right edge, with a stray dark circle.
  - Suggested fix: one-line rows with the count right-aligned, and the star inside the cover corner.
- **P55-R2-06** · `engine/overlay/stream.ts:22,28` — The overlay's patch card has a fixed 430 px height, hides overflow, and lists patches in file-name order.
  - Only about four entries fit. With three built-ins plus a demo, the next viewer patch can be cut off on stream.
  - Suggested fix: list the newest first, cap the visible rows, and add "+N more".
- **P55-R2-07** · `engine/play.css` (`#play-toast` top 80 px) and the arena's message banner (canvas y 65, about 108 px on screen) — The ship toast covers the game's own message banner for 5 seconds.
  - You can see "QUICK FEET ACTIVATED" or "DEMO PATCH…" behind the toast in Codex's `03` and in my `r2-04`. A patch's own message is hidden at the moment it ships.
  - Suggested fix: move one of the two out of the other's band, and add the banner to `docs/play-layout.md`.

### Nits
- **P55-R2-08** — Small polish items:
  - Go Live is 25 px taller than the viewport, so the Quick actions note is cut off.
  - The welcome's "Connect Twitch" icon is a chess-pawn glyph.
  - The rail still lacks the concept's "Studio" group label and a consistent icon set.

## Working well — do not change
- **Welcome and Practice:** a first-time user goes from the welcome to a visible, honestly labelled demo patch in about 6 seconds of machine time. The toast replays when Play opens later.
- **Stream composite:** at 1920×1080 with the controls hidden, nothing overlaps. The overlay editor marks keep-clear zones, and an old default layout migrates automatically.
- **Pause:** it holds and drops in-flight actions correctly across a rollback, and the tests now check tick delivery directly.
- **Back to studio:** it keeps the game window and the OBS capture intact.
- **Demo rules:** a demo needs an all-Practice ballot and disconnected live chat. Demo files are Git-ignored, and Go Live can remove them before a stream.
- **Status:** it resolves on every studio page, with three states.
- **Screens:** they now read as the concepts do, especially Welcome, Practice, Go Live and the pause menu.

## Notes
- **Spec change:** Codex changed one line of the spec copy, the stream-clean wording I proposed in round 1. The plan now matches; please accept it.
- **Push state:** the commit is local only. The public repository is still at `40b7e5b`.
- **Cleanup:** I deleted my scratch clone after the run.
