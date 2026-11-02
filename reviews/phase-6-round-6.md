# Phase 6 — Review round 6

> This round is past the three-round cap. The operator asked for it, to check Codex's fixes for round 5 (`c080132..8acd9ad`, two commits, local only):
> - `bfb47be` fixes for round 5;
> - `8acd9ad` the round-5 verification record.

## Verdict
Pass with minors

All six round-5 findings are fixed and checked:
- the pit's dark fill now starts at the grass line;
- the ground strip is masked out of the gaps;
- the holding forearm faces the right way;
- the grip test reads the real rig, and fails when the paw is moved;
- the frame-gap checks measure only their own window;
- the two report captions match their images.

One new Minor: two older Arena timing limits fail when the machine is heavily loaded (P6-R6-01). It doesn't block the phase.

How I verified, at `8acd9ad`:
- **Clean clones** of the local repository in a scratch folder (no `.env`, no tokens). Each ran `npm ci` and `npm test`; clone B also ran `npm run build` and `npm audit --audit-level=high`.
  - Clone A's first run overlapped my frame probe and failed two Arena timing limits (see P6-R6-01). I reran it with nothing else running, and it passed everything: 107/30/37/32 and HTTPS, `npm test` exit 0.
  - Clone B ran on its own and passed everything.
- **A third scratch clone** for a scratch studio (`npx vite`, Lantern Run, test mode, HTTP port 5199), driven by headless probes on a paused Playwright clock (each step exactly 1/60 s):
  - 1,400 frames, with a full-canvas capture every second frame (700 images), and `gripError` logged every frame;
  - fox close-ups at 3× device scale: eight run frames and a full jump.
- **A mutation check** in the third clone, reverted afterwards: the paw back at round 4's position.
- **Evidence images** are in `D:\twitchconXcodex\plans\phase-6\review-r6\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.**
  - The only engine change is the optional `resetFrameGap?()` on the adapter interface (`engine/game-api.ts:11`).
  - `git grep -i -E "arena|lantern|survivor|fox|firefly|owl" -- engine` returns nothing.
- [x] **2. Tests are per game.** Clone B, on its own:
  - vitest: **107 passed, 4 skipped** (one fewer than round 5, because the tautological test was removed);
  - studio: **30 passed**;
  - Arena Survivor: **37 passed, 1 skipped**;
  - Lantern Run: **32 passed** (including the new grip test);
  - the HTTPS regression passed, and `npm test` exited 0.
- [x] **3. Lantern Run is playable.**
  - In 1,400 probe frames the fox ran from 32 m to 669 m, falling and respawning on the way.
  - The only one-frame distance jumps were the intended respawn skips of 5–6 m (frames 534, 873, 1014 and 1155).
- [x] **4. Lantern Run performs.**
  - The crowded-storm test passed in clone B; it now measures the frame gap only during the storm.
  - The new geometry mask is one mask on one strip, rebuilt from the span list each frame.
- [x] **5. The mutation API is complete and safe.**
  - No action changes.
  - `gripError` is a read-only diagnostic in the snapshot, and it is documented (`games/lantern-run/docs/mutation-api.md:18`).
  - `resetFrameGap` is reachable only through the page's adapter, not from the mutation Worker's action API.
- [x] **6. Live Codex can build for it.** No new builds were run; the round-1 evidence stands.
- [x] **7. The studio works with it.** The studio suite passed (30).
- [x] **8. The overlay respects each game.** The HUD and overlay code are unchanged.
- [x] **9. It looks like the concepts.**
  - The pits are clean: the dark fill meets the grass on both sides, with no slab above it and no grass blades over the gap. See `pit-fill-at-grass-line.png` and `frame-0400-two-pits.png`.
  - The walls still slide in and out at both edges.
  - The holding arm reads as an arm on the stick.
- [x] **10. The standing checks hold.** The diff adds no HTML sinks and no token-like strings.
- [x] **11. The docs are in sync.**
  - `docs/adding-a-game.md:39` documents `resetFrameGap()`.
  - The Lantern mutation API lists `gripError`.
  - The round-5 responses match the code.
- [x] **12. A clean clone passes.**
  - Clone B: `npm run build` exit 0, and `npm audit --audit-level=high` found **0 vulnerabilities**.
  - `builds/` is absent after testing, and `git status --porcelain` is empty.

## Previous findings
- **P6-R5-01 — Resolved.**
  - The fill now starts at `cliffTopY(GROUND)` (`games/lantern-run/src/main.ts:361`), the same helper that places the wall tops (`games/lantern-run/src/ground-visibility.ts:4`, `:10-12`).
  - A geometry mask limits the ground strip to the visible solid spans (`main.ts:234-235`, `:349-350`; `visibleGroundRects` at `ground-visibility.ts:14-20`).
  - **Probe results:**
    - In 582 frames with a pit on screen, I traced the fill up from canvas y 600 in every interior pit column. **No column's fill starts above y 517** (round 5: y 506).
    - Only 3 grass-green pixels in total sit in rows 500–516 over pit interiors, so there is no blade band.
    - At 3×, the fill meets the grass and the moss caps exactly (`pit-fill-at-grass-line.png`).
  - **Edges:** all 7 left-edge exits and all 8 right-edge entries slide over several frames (`left-edge-wall-slides.png`).
  - Codex's refreshed `01-gameplay.png` shows the same clean pit.
- **P6-R5-02 — Resolved.**
  - The holding forearm is turned −135° (`games/lantern-run/src/rig.ts:76`).
  - Its sock end now sits under the gripping paw (the paw is drawn above it), and the light end hangs toward the elbow.
  - No dark tip hangs below the stick in any run frame (`holding-arm-r6.png`, `fox-run-r6.png`).
- **P6-R5-03 — Resolved.**
  - The stick texture and the rig now share `STICK_LINE` and the size constants (`games/lantern-run/src/fox-grip.ts:4-10`, `art-parts.ts:95`, `rig.ts:77-78`).
  - `gripError` measures the rendered paw against the rendered stick image (`rig.ts:87-89`), and the browser test reads it (`games/lantern-run/tests/smoke/smoke.spec.ts:134-138`).
  - **Mutation check:** with the paw back at round 4's (13, 12), the test fails (received 14.39, limit under 2).
  - **Probe:** across 1,400 frames the largest `gripError` was 0.007 px.
- **P6-R5-04 — Resolved.**
  - Both adapters reset the gap at the start of each measured window (`games/lantern-run/tests/smoke/smoke.spec.ts:402`, `games/arena-survivor/tests/smoke/smoke.spec.ts:81`, `:156`).
  - The frame-rate comparisons remain.
- **P6-R5-05 — Resolved.**
  - The run-strip caption now says only the free arm's paw shows (`docs/phases/phase-6-report.md:87`).
  - The round-4 pit response mentions the later fill correction (`:199`).
- **P6-R5-06 — Resolved.** The tautological spawn-offset test is gone; the natural-spawn browser test remains the guard.

## Findings

### Minors
- **P6-R6-01** · `games/arena-survivor/tests/smoke/smoke.spec.ts:160`, `:317` — **Two Arena wall-clock limits fail under heavy machine load.**
  - **Evidence:** clone A's first run overlapped my probe (a second headless Chromium capturing the full canvas every other frame, plus a Vite dev server). The five-second Arena smoke tests took 16–17 s each, and two tests failed:
    - `a three-second hook stall is rejected without a long host frame gap`: frame gap **369.6 ms**, limit 350;
    - `adding and removing a mutation updates the list without navigation`: hot reload took **2,765 ms**, limit 2,000.
  - Both limits predate this round, and the frame gap is now measured over the test's own window, so this is real main-thread time under load, not the old lifetime artefact.
  - Clone B, run on its own, passed both, and so did clone A's rerun on an idle machine.
  - **Why it matters:** only for anyone running `npm test` while the machine is busy, such as during a stream or a recording. It doesn't affect the game.
  - **Fix (Phase 5):** either note in the README's testing section that the browser suites expect an otherwise idle machine, or make these two checks relative (for example, compare the gap against a baseline measured in the same page, as the storm tests do with frame rate).

## Working well — do not change
- **One helper for the pit top.** `cliffTopY` places both the wall images and the fill, so the two can't drift apart again.
- **The strip mask,** built from the same span list that defines solid ground, with a unit test of the visible rectangles.
- **`gripError`,** a diagnostic read from the live Phaser objects. It fails on the old paw and keeps art and rig honest.
- **`resetFrameGap()`:** optional, documented, and kept out of the mutation API.

## Notes for the operator
- **Round status:** this round was outside the three-round cap, at your request. Every finding from rounds 1–5 is resolved. Only P6-R6-01 (Minor) remains, and it goes to Phase 5.
- **Phase 6 can close.** Tagging and committing are yours; the commands are in my reply.
- **Before recording the video:** don't run `npm test` while OBS is recording or streaming (P6-R6-01). The game itself is unaffected.
- **Leftovers** for you to delete (Codex's automatic approval refused to delete them):
  - Codex's clones `D:\twitchconXcodex\phase6-polish-clone-a-20261101` to `-d-20261101`;
  - the round-2 clone `D:\twitchconXcodex\phase6-r2-clean-a-20261101`;
  - Codex's round-5 clones A and B, wherever its report placed them.
- **Cleanup:** I stopped my scratch studio and deleted my scratch clones. Nothing is pushed or tagged by me. The review files remain untracked, as before.
