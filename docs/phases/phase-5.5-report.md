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
| 01 Studio Home | [Home](phase-5.5-visual/01-home.png) | Start checklist, game hero art, Play action and patch shelf; empty states show the next action. |
| 02 Go Live | [Go Live](phase-5.5-visual/02-go-live.png) | Three-column dashboard, real game mirror, ballot, chat, quick actions, activity and Codex progress. |
| 03 Game window | [Play](phase-5.5-visual/03-game-window.png) | Full 16:9 arena capture with HUD and a shipped-patch toast. |
| 04 Pause menu | [Pause](phase-5.5-visual/04-pause-menu.png) | Tabbed controls, patches, sound and accessibility. |
| 05 Library | [Library](phase-5.5-visual/05-library.png) | Illustrated 3:4 game cover, Add your game, filters and details. The concept's other game cards are examples and are not shown as fake available games. |
| 06 Welcome | [Welcome](phase-5.5-visual/06-welcome.png) | Three-step explanation and account-free Practice choice. |
| 07 Overlay | [Stream composite](phase-5.5-visual/07-stream-overlay.png) | Large ballot, credits, Codex progress and ticker over the real game. [Overlay editor](phase-5.5-visual/09-overlay-editor.png) adds move, resize, add and remove controls. |
| 08 Practice | [Practice](phase-5.5-visual/08-practice.png) | Sample pitches, voting and Demo shipping in one guided flow. |

## Exit criteria

- [x] Studio tokens, self-hosted type and contrast — `tests/phase55.test.ts`.
- [x] Navigation, Home welcome, one Play window and pause menu — browser tests in `games/arena-survivor/tests/smoke/smoke.spec.ts`.
- [x] Practice loop and clearly labelled Demo patch — browser test and the eight captured concept screens in `phase-5.5-visual/`.
- [x] Go Live dashboard and one renderer-backed preview — browser test and `02-go-live.png`.
- [x] Library covers and overlay typography — generated illustration, deterministic fallback, browser and unit tests.
- [x] 16:9 game capture and editable overlay — full-viewport browser test and editor persistence test.
- [x] HTTPS/HTTP2 core flow, TypeScript, build and audit — `npm test`: 73 unit passed (4 opt-in skipped), 45 browser passed (1 opt-in WebGL skipped), and HTTPS/HTTP2 Practice, Go Live and Play passed. `npm run build` passed. `npm audit --audit-level=high` found zero vulnerabilities.
- [ ] Two new users reach a shipped patch unaided in under five minutes — the operator must run the observations using `docs/usability-check.md`.

## Deferred

- Two-person first-time usability study requires two new human participants.
- The browser-specific full-screen Esc behavior and real OBS certificate/audio still need the operator's streaming PC check.

## Known gaps / risks

- A custom overlay layout can cover the game HUD or toast. The editor shows the game canvas and the default layout leaves those regions free; the operator should inspect custom layouts before streaming.

## Review responses

Pending review.
