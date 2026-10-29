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
| 03 Game window | [Play](phase-5.5-visual/03-game-window.png) | Matches: full 16:9 arena, clean gameplay and named demo-ship toast. Difference: the game art and HUD remain Arena Survivor’s actual code-drawn visual system; the concept depicts a more elaborate reference game. Appendix 4 protects the game identity. |
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
- [x] HTTPS/HTTP2 flows, full suite, build and audit — `npm test` passed with 75 unit tests (4 opt-in skipped), 49 browser tests (1 opt-in WebGL skipped) and the HTTPS regression; `npm run build` passed and `npm audit --audit-level=high` found 0 vulnerabilities.

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
