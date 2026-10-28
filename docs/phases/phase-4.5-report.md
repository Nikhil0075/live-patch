# Phase 4.5 report

## Built
- A single streamer studio shell for Home, Library, Go Live, Builds, Setup, Settings and Practice, with the existing transparent OBS overlay URL and redirects from the former operator and simulator pages.
- Manifest-driven game discovery, import validation, a new-game template, smoke results, active-game switching and play-only saved-build browsing.
- Guided Windows, Codex and Twitch setup; read-only Defender checks; safe sandbox setup and probe actions; same-origin credential saving and live Twitch reload; persistent stream settings.
- Arena Survivor code-drawn art, synthesized sound and music, visual effects, and manifest-declared mutation sound/effect actions with rate limits.
- Pitch queues, operator confirmations, keyboard shortcuts and a Codex progress timeline. The Phase 4 round-two numbering finding is fixed by selecting the oldest available pitch for `!approve N` during the pitch window.

## How to run and test
- `npm run dev`; open `/`, Library, Setup, Practice, Go Live and `/overlay.html`.
- `npm run new-game -- "My Game"` creates a template. Use Library to smoke-test an import and switch the active game.
- `npm test`, `npm run build`, `npm audit --audit-level=high`.
- The operator's timed first-run setup and OBS check require a manual run on the target streaming machine.

## Exit criteria
- [x] App shell, navigation, redirects and unchanged `/overlay.html` URL — browser test and visual inspection.
- [x] Manifest-driven library, template and unsafe-import checks — Phase 4.5 unit tests and template smoke run.
- [x] Active-game switching — runtime switch to the template game showed its entry, mutation and test command, then Arena Survivor was restored.
- [ ] Setup checks and elevated Windows sandbox setup — checks and failure classifier are implemented; administrator prompt and real failure recovery await an operator test.
- [ ] Twitch credential lifecycle — write-only secret, atomic `.env` update, same-origin JSON guard and live reload are implemented; a real account reconnect after saving through Setup awaits an operator test.
- [ ] First-time operator setup and practice in under ten minutes — timed manual check awaits an unfamiliar operator.
- [x] Arena visuals, nine sounds, music and persisted accessibility settings — unit and browser coverage plus visual play check.
- [x] Mutation sound/effect actions are declared and throttled — unit and browser spam checks.
- [x] Pitch queue, confirmation and plain-text rendering — browser coverage.
- [x] Asset provenance — `games/arena-survivor/assets/CREDITS.md`; all art and audio are original code-drawn or synthesized assets.
- [x] Full suite, TypeScript build and dependency audit — `npm test`: 49 unit passed (4 opt-in skipped), 31 browser passed; `npm run build` passed; `npm audit --audit-level=high`: 0 vulnerabilities after the round-one fix pass.

## Deferred
- Channel-point bets, original-versus-evolved comparison, chat rollback voting and reward refunds remain in Phase 5.
- A second showcase game comes after all planned phases, by operator decision.
- The real OBS browser-source certificate check and Phase 1–4 minor cleanup remain in Phase 5.

## Known gaps / risks
- The live reward-redemption acceptance check from Phase 2 still requires a short test stream.
- No elevated sandbox setup command was run on the operator machine by this build; the UI invokes it only after an operator click and Windows administrator approval.
- No real Twitch credential was entered during automated tests. The credential test uses fake values in a temporary directory.
- No Codex sandbox setup failure occurred during this build. Classifier tests cover the specified known messages; an actual administrator prompt and recovery remain for the operator's machine.
- The cold Vite/Phaser start needed a 10-second browser expectation window. The five-second in-game smoke interval and frame budget are unchanged.

## Review responses
- P4-R2-01: **Fixed** — pitch-window numeric candidate lookup now follows the same oldest-first rule as the next ballot; a regression test covers `!approve 1`.

## Round 1 fix pass

The visual reference remains `plans/phase-4.5/comparison/` outside this repository. The old game frame and new code-drawn frame are retained for direct comparison in [before-game](phase-4.5-visual/before-game.png) and [after-game](phase-4.5-visual/after-game.png). See also [after-overlay](phase-4.5-visual/after-overlay.png), [after-Go-Live](phase-4.5-visual/after-go-live.png), [after-Setup](phase-4.5-visual/after-setup.png) and [after-Library](phase-4.5-visual/after-library.png). Compare these with `comparison/4-overlay.png`, `comparison/3-go-live.png`, `comparison/2-setup.png` and `comparison/1-library.png` in the operator's plan. The new game frame has shaded faces, glowing edges and coins, a lit floor and larger entities. The stream overlay uses the concept's brand/chips/work/ballot hierarchy with readable fixed 1080p type; Go Live and Setup use the concept's dashboard and guided-step hierarchy. The overlay screenshot's white area represents transparency. No concept artwork was copied into the product.

- P45-R1-01: **Fixed in code** — setup now invokes exactly `codex sandbox setup --elevated --current-user` through Windows Run as administrator, classifies CLI usage errors separately and exposes the sandbox self-test. The unit test verifies the arguments. The operator still needs to accept the real UAC prompt and confirm the probe on this PC.
- P45-R1-02: **Fixed** — Vite no longer loads or watches `.env`; the app reads the file and reloads Twitch connections in process when credentials change. A manually edited `.env` still requires a restart.
- P45-R1-03: **Fixed** — setup process checks are cached for 30 seconds, cross-site GETs are refused, and explicit refresh is a same-origin POST.
- P45-R1-04: **Fixed** — active selection lives under `LIVE_PATCH_DATA_DIR`; saved-build play sets a temporary process selection and Home/Go Live show a return action. The data-directory unit test covers selection storage.
- P45-R1-05: **Fixed** — Library import now inspects the manifest first and shows the exact smoke command, example and local-code warning before the operator confirms execution.
- P45-R1-06: **Fixed** — Go Live has one header, useful empty states, patch titles and contributor credit, and timing from Settings.
- P45-R1-07: **Fixed** — README leads with Setup and Practice and gives the corrected manual sandbox command as a fallback.
- P45-R1-08: **Fixed** — overlay pitch queue and Go Live both show oldest pending ideas first.
- P45-R1-09: **Fixed** — fixed 1920×1080 overlay scale, 28px ballot pitch text, 20px secondary text, large timer, code-drawn candidate marks, `!vote N`, percentages, leader bar and large shipped/failure states. The browser vote test measures computed type size.
- P45-R1-10: **Fixed** — original gradient textures, highlighted jelly slimes, glowing player and floor, coin shine, movement trail and larger particles replaced flat circles. Phaser postprocessing runs on an interactive WebGL renderer; the software-driven automated browser uses the texture glow to keep the smoke frame budget. `CREDITS.md` records the methods and cover provenance.
- P45-R1-11: **Fixed** — Go Live now has a status strip, three columns, live game preview, vote bars/percentages, persistent Codex timeline, credited patches, saved builds and recent chat. The rail fills the entire page.
- P45-R1-12: **Fixed** — six-step wizard with Back, Continue and Skip, check rows with actions, sandbox self-test, first-run callout and a “What this changes” panel. The operator's timed first-use check remains open.
- P45-R1-13: **Fixed** — Library now has a real game cover, search, selection details for hooks/actions/audio/effects, status, docs action and an Add your game card in the grid.
