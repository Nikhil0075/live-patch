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
- [x] Full suite, TypeScript build and dependency audit — `npm test`: 48 unit passed (4 opt-in skipped), 31 browser passed; `npm run build` passed; `npm audit --audit-level=high`: 0 vulnerabilities.

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
