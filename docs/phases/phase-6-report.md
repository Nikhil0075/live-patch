# Phase 6 report

## Base

Phase 6 starts from `b3a4de0` (`phase 5.5: fixes for round 6`). The operator's review-file commit `cc85a2a` is the checked-out HEAD before Phase 6 work.

## Built

### Step 1 — platform browser tests

- Moved studio, Practice, Go Live, Library, Setup, overlay and security browser checks to `tests/browser/studio.spec.ts`. Their demo title, game name and built-in count come from the active manifest.
- Kept Arena Survivor play, mutation, fault isolation and saved-build checks in its own smoke suite.
- `npm test` now runs the studio suite once, then every built-in game suite in a separate copy. `npm run smoke` stays scoped to the active game's mutation gate.

## How to run and test

- Step 1: `npm test` — 92 unit tests passed (4 opt-in skipped); studio suite 28 passed; Arena Survivor suite 35 passed (1 opt-in WebGL skipped); HTTPS/HTTP2 regression passed. `npx tsc --noEmit` passed.

## Exit criteria

- [ ] 1. Engine stays game-agnostic — platform manifest work is pending.
- [ ] 2. Tests are per game — studio suite is split; second game is pending.
- [ ] 3–12. Lantern Run, integration, visual and clean-clone criteria — later steps.

## Deferred

## Known gaps / risks

## Review responses
