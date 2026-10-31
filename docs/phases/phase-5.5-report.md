# Phase 5.5 report

## Built

- Studio design tokens and self-hosted Inter. The font package is included so the interface does not depend on an external font service.
- New dependency `@fontsource/inter`: supplies the specified interface typeface locally, without a network request from the studio or OBS browser source.
- Separate `/play` window, keyboard pause menu, manifest controls, persistent sound and accessibility settings, and game/mutation pause handling.
- First-visit welcome and Practice quick actions. A manifest-declared, validated Demo patch ships only for a Practice pitch and can be rolled back.
- Go Live panel grid, persisted presets/collapse/order, quick actions and activity derived from stored events. Its preview mirrors the real Play window with `BroadcastChannel` and overlays the OBS page without creating a second game.
- Library 3:4 covers, real-data filters/sort and manifest controls. OBS widgets now follow the shared HUD layout map; a browser test checks 1920 × 1080 placement and minimum ballot text sizes. The studio glossary defines eight recurring terms.
- Arena Survivor now has an original generated cover illustration instead of a game screenshot. Other games receive a deterministic generated SVG from their name when no cover is supplied. The active game's cover also appears on Home.
- Arena Survivor's canvas and code-drawn floor now use 1152 × 648 (16:9), filling a 1920 × 1080 Play capture. The Go Live mirror uses 480 × 270 frames from the real renderer.
- Go Live now has an OBS overlay editor: add/remove each widget, drag it, resize from its corner, enter exact x/y/width/height, and reset. Settings are bounded to the 1920 × 1080 canvas and persisted for the separate OBS source.
- Round-one fixes moved the default live patch card clear of the game HUD and ship toast, migrated the previous untouched default layout, marked keep-clear zones in the editor, and added a real rendered-rectangle overlap test.
- Codex and OBS checks now update the top bar and sidebar on every studio page. The default demo is a visible Coin Shower; the winning Practice idea records `demo` status and all viewer-facing surfaces explain the substitution and credit Live Patch Demo. Go Live can remove demo files before a live round.
- The welcome, Practice, Go Live, Library, Play controls, pause menu and vote overlay were reworked against all eight concepts. The Go Live editor opens on demand so the dashboard fits one 1920 × 1080 viewport. Practice keeps developer controls under Advanced.
- Paused actions from removed modules are discarded and active origins are checked again on resume. Gameplay keys leave the stream controls hidden. Back to studio focuses the existing Studio window and keeps Play paused.

## Research decisions

- [Phaser's Scale Manager](https://docs.phaser.io/phaser/concepts/scale-manager) preserves the game's aspect ratio in `FIT` mode. A 3:2 arena therefore left side bars in a 16:9 capture; the arena now uses a 16:9 logical canvas and matching code-drawn floor.
- [OBS Browser Source](https://obsproject.com/kb/browser-source) exposes an explicit source width and height. The overlay editor uses a 1920 × 1080 coordinate system and the overlay page scales it as a unit to the configured source.

## How to run and test

- `npm run dev` — open the studio and its Play window.
- `npm test` — unit, browser and HTTPS regression checks.
- `npm run build` — TypeScript and Vite build.
- `npm audit --audit-level=high` — dependency audit.
- `node scripts/capture-phase55.mjs` — capture eight concept screens plus the overlay editor against an isolated local HTTPS server with no Twitch credentials.

## Concept comparison

The concept images supplied in `plans/phase-5.5/concepts/` show the intended hierarchy and visual weight. The captures below use real app state; they do not invent connected accounts, extra games or shipped viewer patches.

| Concept | Captured implementation | Result |
| --- | --- | --- |
| 01 Studio Home | [Home](phase-5.5-visual/01-home.png) | Matches: compact header, numbered checklist, progress ring, illustrated active game and separate patch shelf. Difference: the shelf shows an honest empty state and four setup steps; the concept depicts fictional shipped patches and three steps. Appendix 4 calls for real state, so no fake patches are shown. |
| 02 Go Live | [Go Live](phase-5.5-visual/02-go-live.png) | Matches: one-viewport dashboard, preview, large round timer, vote bars, six visible action tiles, activity, Codex timeline and panel controls. Difference: active patches occupy a seventh panel, and chat is empty in the isolated capture. Appendix 4 requires no invented live chat or Twitch connection. The preview uses real Play frames. |
| 03 Game window | [Play](phase-5.5-visual/03-game-window.png), [controls visible](phase-5.5-visual/10-play-tools-visible.png) | Matches: full 16:9 arena, clean gameplay, named demo-ship toast and top-right controls that clear the HUD. Difference: the game art and HUD remain Arena Survivor’s actual code-drawn visual system; the concept depicts a more elaborate reference game. Appendix 4 protects the game identity. |
| 04 Pause menu | [Pause](phase-5.5-visual/04-pause-menu.png) | Matches: large PAUSED heading, icon sections, credited/statused patch cards and keyboard hints. The capture now opens the Patches section. Difference: the patch icons are a consistent code-drawn tile rather than unique art, because arbitrary third-party patches do not supply icons. |
| 05 Library | [Library](phase-5.5-visual/05-library.png) | Matches: generated cover, grid card, star, tags, status footer, details cover, two actions and expandable capability counts. Difference: only one real playable game is shown, per Appendix 4; the concept’s extra games are examples. |
| 06 Welcome | [Welcome](phase-5.5-visual/06-welcome.png) | Matches: near-full-screen welcome, exact tagline, illustrated chat/poll/patch loop, numbered steps, three choice cards and footer actions. Difference: the third code-drawn illustration uses a patch symbol rather than a puzzle-piece outline; no raster artwork is required for the onboarding flow. |
| 07 Overlay | [Stream composite in vote state](phase-5.5-visual/07-stream-overlay.png) | Matches: vertical live patches and credits, Codex card, three large ballot choices with `!vote` hints, ticker and clear toast/HUD regions. Difference: the isolated capture shows a prepared demo and Practice ideas, labelled as such, because Appendix 4 forbids fake Codex work. [Overlay editor](phase-5.5-visual/09-overlay-editor.png) marks safe zones. |
| 08 Practice | [Practice at pitch window](phase-5.5-visual/08-practice.png) | Matches: three-column chat, big timer, vertical timeline, checklist and safe-space note. The developer event form and Twitch status live under Advanced. Difference: the empty chat is honest on first arrival; sample viewers appear after the operator starts the round. |

## Exit criteria

- [x] Studio tokens, self-hosted type, contrast and brand — `tests/phase55.test.ts` covers the shared pairs, and no Twitch artwork is bundled.
- [x] Top bar, sidebar, two-click navigation and real setup dots — keyboard and non-Home status browser tests.
- [x] Home without embedded game; one named Play window and fullscreen controls — browser test and source; fullscreen requires an operator browser check.
- [x] Pause menu sections, manifest controls, persistent sound/accessibility and keyboard operation — browser tests and the Patches capture; Chromium fullscreen Escape remains an operator check.
- [x] Pause freezes frame, elapsed and delivered mutation ticks; resume continues; safe toasts — browser tests including rollback while paused.
- [x] First visit and account-free Practice-to-demo loop — browser tests prove an actual coin shower, `demo` idea status, credit and delayed Play toast.
- [x] Go Live dashboard, two presets, persistent layout, confirmation and one real-game mirror — browser tests and 1920 × 1080 vote capture.
- [x] Library and stream overlay with readable type and no default HUD/toast collision — unit, browser geometry test and composite capture.
- [x] Keyboard-only Studio navigation, named icon controls and reduce-flashing handling — browser navigation test plus existing accessibility checks.
- [ ] Two new users reach a shipped patch unaided in under five minutes — the operator must run observations using `docs/usability-check.md`.
- [x] HTTPS/HTTP2 flows, full suite, build and audit — `npm test` passed with 77 unit tests (4 opt-in skipped), 53 browser tests (1 opt-in WebGL skipped) and the HTTPS regression; `npm run build` passed and `npm audit --audit-level=high` found 0 vulnerabilities.

## Deferred

- Two-person first-time usability study requires two new human participants.
- The browser-specific full-screen Esc behavior and real OBS certificate/audio still need the operator's streaming PC check.

## Known gaps / risks

- A custom overlay layout can cover the game HUD or toast. The editor marks those zones and warns when a widget overlaps them. The operator should still inspect the actual OBS composite before streaming.

## Review responses

- **P55-R1-01 Fixed:** moved and resized the default patch card, migrated the previous untouched layout, marked/warned on keep-clear zones and tested against the rendered Play toast.
- **P55-R1-02 Fixed:** `/api/setup` summary runs on every page; Codex and OBS status chips/dots show resolved states. A browser test visits Go Live and Library.
- **P55-R1-03 Fixed:** reworked all eight views against the concepts and recaptured the requested states; the comparison table now records matches, differences and the reason for each difference.
- **P55-R1-04 Fixed:** the demo scatters visible coins, labels the actual prepared mechanic, records the pitch as `demo`, credits Live Patch Demo consistently and replays a recent ship toast when Play opens.
- **P55-R1-05 Fixed:** disposing a mutation drops its deferred actions; resume checks active origin. The browser test removes a module while paused and checks its write is never applied.
- **P55-R1-06 Fixed:** movement/attack keys no longer reveal controls; the title is visually hidden from the score HUD. A browser test presses movement after tools fade.
- **P55-R1-07 Fixed:** Back to studio focuses the opener without ending Play; without an opener it explains the consequence and asks before navigation.
- **P55-R1-08 Fixed:** server and UI require an all-Practice approval ballot with live chat disconnected; unit test covers mixed and live refusal.
- **P55-R1-09 Fixed:** demo files are Git-ignored and Go Live offers a confirmed Remove demo patches action; browser test checks removal.
- **P55-R1-10 Fixed:** mutation API doc defines active elapsed time and pause/deferred-action semantics.
- **P55-R1-11 Fixed:** test reads host tick deliveries, keyboard navigation test added, and all 11 exit criteria appear above.
- **P55-R1-12 Fixed:** shared chrome colours were moved into tokens and contrast tests extended; game art colours remain game-specific.
- **P55-R1-13 Fixed:** action feedback uses plain words, the Codex card resolves patch titles, and prediction activity uses its stored creation time.
- **P55-R2-01 Fixed:** right-aligned the visible Play controls, kept their right edge within the layout map and added a 1920 × 1080 browser geometry test against the HUD and toast. [Visible-controls capture](phase-5.5-visual/10-play-tools-visible.png). The round-one stream-clean wording in the spec is accepted and matches the operator's updated plan.
- **P55-R2-02 Fixed:** the server reads the validated demo module's literal `meta.title`, stores it on the run and uses it in the event and Practice reply; the overlay reads the stored title. Unit and browser tests use a second game demo title.
- **P55-R2-03 Fixed:** renamed the prepared module to `coin-shower.js` and reduced its start effect to 10 coin spawns, one burst and one message; the browser test checks that no actions are skipped.
- **P55-R2-04 Fixed:** Library now counts validated `.js` mutation files separately from shipped runs; a unit test adds a file and checks the active count rises.
- **P55-R2-05 Fixed:** detail rows use one-line flex summaries with the count on the right; the star sits within the cover. Browser geometry checks both.
- **P55-R2-06 Fixed:** the OBS patch card orders newer shipped patches first, shows three rows and counts additional active patches in a visible `+N more` line; browser test adds two extra patches.
- **P55-R2-07 Fixed:** moved Arena Survivor's message banner below the ship toast and added a layout bound test and layout-map entry.
- **P55-R2-08 Deferred:** the remaining rail icon and 25 px page-height polish can be revisited after the operator's usability and OBS checks.

## Live-stream fixes

- **LS-01 Fixed:** browser launch is probed at startup, approval and build start; launch failures retry once and remain infrastructure failures, cancel predictions and leave ideas pending; smoke steps complete only on `passed`, safe messages appear in chat and both timelines, and full diagnostics stay local. Unit and browser regressions cover these paths; three real HTTPS Codex builds shipped in an isolated clone.
- **LS-02 Fixed:** Pitch, Vote and Approval offer confirmed Reject, rejected candidates leave the ballot, and open menus and focus survive refresh. The browser test waits beyond the two-second refresh and rejects at each stage; reward confirmation says fulfilled points cannot return.
- **LS-03 Fixed:** missing stored Twitch scopes identify broadcaster or bot, change the top action to a click-only reconnect link, and label the chip “Twitch chat disconnected”; the existing callback restarts EventSub. Unit and browser tests cover the missing-scope prompt and route.
- **LS-04 Fixed:** Home and Library Play entries request the same reusable 1280 × 720 popup. Browser test verifies the popup and reuse; README describes OBS Window Capture.
- **LS-05 Fixed:** a new Practice demo removes the earlier demo file and rolls back its run. Browser test ships two and finds only one active.
- **LS-06 Fixed:** narrow ballots stack three readable rows; widget-specific minimums and protected-zone placement prevent HUD and toast overlap. Browser test measures a 500 px ballot without clipping or horizontal overflow.
- **LS-07 Fixed:** sidebar navigation uses one line-icon set with a Studio label, and Go Live fits 1920 × 1080 with the quick-action note visible. Browser geometry test checks both.

### Live verification and diagnosis

The original 31 October `chromium_headless_shell` “executable doesn't exist” error did not recur. Its intermittent cause remains unproven; the file was present and a later identical smoke command worked. The new child-process preflight launches Chromium rather than trusting file existence, and the local log includes the resolved missing executable path plus filesystem error if launch fails.

The isolated real HTTPS run found another smoke failure: with Play, Codex and smoke running together, the built-in Danger Zone module missed the former 200 ms event deadline and was disabled. The smoke gate correctly rejected the run, but this was a scheduler false positive. Raising the finite batch deadline to 1.8–2.2 seconds let the next three builds pass, while the endless-loop and three-second-stall browser tests still disable bad modules. Local smoke diagnostics now retain the first failed attempt even if a repair follows.

| Consecutive shipped run | Patch visible in Play pause menu | Runner time |
| --- | --- | ---: |
| 1 | Coin Pink Ring | 91 s |
| 2 | Enemy Hit Blue Ring | 93 s |
| 3 | Starting Coins | 166 s |

The third run repaired a first smoke rejection before shipping. The isolated clone had no Twitch credentials or operator data; its elevated sandbox self-test passed. The user-visible journey took 104 seconds for run 2 and 178 seconds for run 3, including navigation and the visible Play check.

Final checks: `npm test` passed 85 unit tests (4 opt-in skipped), 60 browser tests (1 opt-in WebGL skipped) and the HTTPS/HTTP2 regression. `npm run build` passed and `npm audit --audit-level=high` found 0 vulnerabilities. No dependencies were added. The operator-only OBS, Twitch and first-time usability checks remain open.

The later operator approval was refused by the new browser preflight. Running `npx playwright install chromium` repaired the operator's local Playwright browser, and builds then shipped. This confirms that the browser installation was missing or broken at that point; it does not prove the exact cause of the earlier intermittent launch error. The isolated verification also had a run that timed out at the former three-minute budget before the three consecutive shipped runs shown above.

## Round 4 responses

- **P55-R4-01 Fixed:** run records now store a stop reason separate from failure kind. Setup, Codex unavailable, timeout and cancellation use distinct truthful chat notices; runner-plus-outcome tests cover cancellation and timeout.
- **P55-R4-02 Fixed:** saved widget placement now checks other widgets as well as HUD and toast zones; the narrow-ballot migration regression checks that the patch card remains clear.
- **P55-R4-03 Fixed:** the popup test asserts `locationbar.visible === false`; README explains Chrome's remaining title/address strip and full-screen or OBS crop.
- **P55-R4-04 Fixed:** the reject browser test now covers approval-stage Reject and a More actions menu kept open through refresh.
- **P55-R4-05 Fixed:** Go Live displays the cached browser setup check as a persistent notice when it needs action.
- **P55-R4-06 Fixed:** architecture now states the current 1.8–2.2 second event deadline.
- **P55-R4-07 Fixed:** the browser probe runs before the build timer, the default budget is four minutes and `LIVE_PATCH_RUN_TIMEOUT_MS` can override it. The earlier three-minute timeout is recorded above.
- **P55-R4-08 Fixed:** removed the duplicate wide-screen panel-height rule.
- **P55-R4-09 Fixed:** removed the duplicate approval-stage Reject from More actions and named the rejected idea in the Go Live notice.
- **P55-R4-10 Deferred:** timeline repair-attempt polish remains for a later UI pass; no phase exit criterion depends on that nit.
- **P55-R4-11 Fixed:** Quick actions use a consistent icon column and two-column layout, and browser geometry checks tile overflow.
- **P55-R4-12 Fixed:** dark thin scrollbars, a non-scrolling Quick actions card and an always-visible Remove demo patches button are covered by browser geometry checks.
- **P55-R4-13 Fixed:** Setup and README link to Twitch app registration, explain 2FA, redirect URI, Confidential client type and credentials; Setup can copy the URI.
- **P55-R4-14 Fixed:** `npm test` copies only Git-tracked built-in mutations, while smoke and external games retain their active files; a unit regression leaves a shipped demo in the source and checks it is absent from the test copy.

The Go Live Recent chat panel now includes viewer commands such as `!idea` and `!vote`, while game mutation chat still filters commands and bot messages. The panel keeps its scroll position between refreshes and wraps long lines; a browser test covers command display and plain-text rendering.

Round 4 checks: `npm test` passed 88 unit tests (4 opt-in skipped), 62 browser tests (1 opt-in WebGL skipped), and the HTTPS/HTTP2 regression. `npm run build` passed, and `npm audit --audit-level=high` found 0 vulnerabilities. No dependency was added.

The same checks passed in a fresh local clone of commit `6127f4e`. In that clone, the real HTTPS Practice UI shipped one demo file into the working game. A second full `npm test` passed with the demo file still present (88 unit, 62 browser, HTTPS); `npm run build` and the audit passed there as well. Automatic approval review rejected recursive deletion of the disposable verification clone at `C:\Users\ROG\AppData\Local\Temp\live-patch-r4-6127f4e`, so it remains for the operator to remove.
