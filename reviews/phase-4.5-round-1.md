# Phase 4.5 — Review round 1

## Verdict
Fail

Most of the phase is done well:
- the app shell, library, template, game switching and pitch queue on stream work;
- the effect limits are enforced in two places;
- all art and sound are made in code;
- the Twitch secret never reached a response, page or log in my probes.

One Blocker: **Run Codex sandbox setup** runs a command the bundled Codex CLI rejects, so the exit criterion that relies on it can't pass.

Four Majors cover visual fidelity, added at the operator's request after comparing the build with the plan's concept images:
- the stream overlay is too small to read on stream;
- the game art is well below the art sheet;
- Go Live is the old control page;
- Setup is not the first-run wizard the spec asks for.

Seven Minors and one Nit are listed below.

How I verified:
- I reviewed `phase-4-done..29ea948`. The repository's `docs/phases/phase-4.5.md` matches the approved plan's Spec section word for word; the only addition is a `## Spec` heading.
- I ran the suite, build and audit in this repository.
- In a scratch clone at `29ea948` with a **fake** `.env` (since deleted), I ran two probes against an isolated server:
  - P45-A covered credentials; P45-B, unsafe imports; P45-C, viewer markup on the overlay; P45-D, template creation and **Make active**.
  - I took screenshots of every page.
- I read the CLI help for `codex sandbox setup` (`--help` only; nothing was set up).
- For the visual comparison, I ran a second isolated server at `29ea948`. I played the game for about five seconds with movement and attacks, then ran a vote round with three sample pitches and six votes, and captured the game, overlay and Go Live.
  - Side-by-side images (concept on the left, built on the right) are in `D:\twitchconXcodex\plans\phase-4.5\comparison\` (`1-library.png` … `5-game-art.png`).
  - The raw screenshots are in `D:\twitchconXcodex\plans\phase-4.5\built-29ea948\`.
  - On the overlay comparison, the white halos come from my screenshot of a transparent page, not from the app.
- I did not run the sandbox setup or self-test, did not enter real Twitch credentials, and did not run the timed first-run check. Those are the operator's checks.

## Exit criteria
- [x] `/` opens the app shell; every former page is within two clicks; old URLs work; `/overlay.html` is unchanged — screenshots of Home, Library, Go Live, Builds, Setup, Settings and Practice. `/control.html` and `/simulator.html` redirect with a 302 (`vite.config.ts:32-41`), and the overlay URL is untouched.
- [x] Library lists every valid game through manifests only, with validation and smoke status; the template creates a passing game; invalid or unsafe imports change nothing.
  - No `engine/` file imports from `games/`.
  - P45-D: the template action created "Probe Game" in 11 s, and its smoke test **passed**.
  - P45-B: an invalid manifest returned 400 "Invalid JSON…"; a 1.2 MB file returned 400 "Oversized or unsupported file: huge.bin"; a cross-origin import returned 403. `imported-games.json` was unchanged in all three cases.
  - I could not test the symlink rule on this Windows account.
- [x] **Make active** switches the running game — P45-D: after switching to the template game and the automatic restart, `/api/game` reported `Probe Game`, with its own `mutationDir` and `testCommand`. `package.json` was untouched. See P45-R1-04 for where the choice is stored.
- [ ] Setup reports each check; **Run Codex sandbox setup** shows the administrator prompt and the probe passes afterwards — **fails: P45-R1-01.**
  - The checks and the "Ready / Needs action / Not available here" states work (`setup.png`).
  - The Defender checks only read settings (`Get-MpPreference`, `Get-WinEvent`), and the page links to `ms-settings:windowsdefender`. Nothing changes security settings.
  - The classifier has a unit test, but see P45-R1-01 for a misclassification.
- [x] Twitch credentials can be saved, replaced and removed, and are used without a manual restart — P45-A:
  - cross-origin, no-origin and `text/plain` saves returned 403;
  - a save returned only `clientId`, `redirectUri`, `rewardId` and `secretSet`;
  - `.env` kept an unrelated line;
  - saving with a blank secret kept the saved one;
  - a non-local redirect URI returned 400;
  - remove cleared the secret and kept the other line;
  - **0 occurrences** of either fake secret in all HTTP bodies, rendered pages and server log lines.

  The reload happens through a full server restart (P45-R1-02). The real-account reconnect is still the operator's check.
- [ ] A new operator finishes setup and a practice round in under 10 minutes — operator's timed check, pending (as the report says). It will need P45-R1-01 fixed first, and should be run after the wizard in P45-R1-12 exists.
- [x] At least 8 sounds, music and effects; settings persist; the overlay is silent — nine synthesised cues plus a music loop (`src/audio.ts`), and particles, shake, hit-stop, score pops, a vignette and the shipped banner (`src/main.ts`). Settings are saved in `settings.json`, and `stream.ts` has no audio code. Flashes are capped at 3 per second in the game itself (`main.ts:106-108`) as well as in the host, and "reduce flashing" turns both flash and shake off. The checklist is met, but the visual quality is not (P45-R1-10).
- [x] Mutations can use declared sound and effect actions, throttled — `EffectLimits` (`engine/mutation/effect-limits.ts`) allows only manifest-declared names and caps each module and the whole game (flash: 3 per second overall, shake: 1 per second). Dropped actions don't count as invalid. Unit and browser spam tests pass.
- [x] The overlay and Go Live show the pitch queue; destructive actions need confirmation; viewer text stays text — P45-C: the overlay listed three pitches, including `<img src=x onerror=alert(1)> gravity flips`, shown as literal text with **0** `img` elements created. Go Live lists the queue with authors. `confirm()` guards roll back, cancel build and remove credentials. Every `innerHTML` in `engine/` is a fixed template.
- [x] Every asset is listed with its origin and licence — `games/arena-survivor/assets/CREDITS.md`: all art is drawn in code and all sound is synthesised in code. It also states that the OpenArt concepts are not in the repository.
- [x] Full tests, build and audit pass — `npm test`: vitest 48 passed and 4 skipped (opt-in), Playwright 31/31. The build succeeded, `npm audit --audit-level=high` found 0 vulnerabilities, and the tree stayed clean apart from untracked review files.

## Previous findings
- P4-R2-01 — Resolved. During the pitch window, `!approve N` uses the same oldest-first order as the next ballot, with a regression test, and Go Live numbers the queue that way.

## Findings

### Blockers
- **P45-R1-01** · `engine/studio/setup.ts:79`, `engine/studio/setup.ts:22`, `README.md:37` — **Run Codex sandbox setup** runs `codex sandbox setup --elevated`. The bundled Codex 0.164 rejects that: `codex sandbox setup --help` prints `Error: Usage: setup [OPTIONS] <--user <USER>|--current-user>`. So the button fails every time, and the exit criterion "shows the Windows administrator prompt, and the probe passes afterwards" can't be met.
  - The error is also misdiagnosed. The usage text contains `--codex-home`, which matches the classifier's `codex.home` pattern, so the page would say "set up for another Windows user or Codex home".
  - Nothing shows that the command raises its own administrator prompt. The community instructions run it from an Administrator terminal, and the code spawns it as a normal process.
  - This also corrects my Phase 3 round 3 check of `README.md:37`: I confirmed the subcommand existed, but not its required option.

  **Smallest fix:**
  - Run `codex sandbox setup --elevated --current-user` through Windows' run-as-administrator prompt, so the UAC dialog appears, and wait for it to finish.
  - Classify a usage or argument error separately ("setup command rejected"), not as an account mismatch.
  - Add a unit test that checks the exact arguments.
  - Update the README command.
  - The operator's real setup check then decides the criterion.

### Majors
These four come from comparing the build with the concept images in the operator's plan. The spec ties the overlay layout to `concepts/04-stream-overlay.png` and the game art to `concepts/05-art-sheet.png`, and the phase goal is a production-quality studio. The concepts are direction, not pixel specs: aim for the same hierarchy, readability and visual weight, not a copy. Keep every asset code-made, so `CREDITS.md` stays valid; Phaser 3.90 already has the glow, bloom and gradient tools needed.

- **P45-R1-09** · `engine/overlay/stream.css:1-2`, `engine/overlay/stream.ts` — **The stream overlay is too small and too plain to read on stream** (`comparison/4-overlay.png`). The layout skeleton matches the concept (chips top right, Codex card on the right, ballot along the bottom), but every size is set in tiny `vw` units. On a 1920 px frame:

  | Element | CSS | Size at 1920 px |
  |---|---|---|
  | Ballot pitch text | `.72vw` | about 14 px |
  | Votes and author line | `.56vw` | about 11 px |
  | Patch-chip author line | `.5vw` | about 10 px |
  | Panel labels | `.55vw` | about 11 px |

  At a viewer's 720p or on a phone, that is roughly 6–9 px, which is unreadable. The concept also shows things the build doesn't:
  - `!vote 1/2/3` hints under each candidate (viewers aren't told how to vote);
  - vote percentages and a clear leader;
  - a picture per candidate;
  - a "SHIPPED" moment large enough to notice.

  Suggested fix:
  - Size the overlay for a 1080p canvas, scaled as a whole. The ballot pitch text should be at least about 28 px, secondary text at least about 20 px, and the timer and round label large.
  - Show `!vote N`, the vote count and percentage, and a highlight on the leader.
  - Give each candidate a small code-drawn mark (the game's own sprite for its theme, or a simple glyph).
  - Make shipped, failed and rolled-back states clearly visible at stream size; "reduce flashing" still turns off motion.
  - Add a browser test that measures computed font sizes at 1920×1080. Put a side-by-side comparison with the concept in the report.
- **P45-R1-10** · `games/arena-survivor/src/main.ts` (draw code) — **The game art is far below the art sheet** (`comparison/5-game-art.png`, `built-29ea948/built-game.png`).
  - The literal checklist is met: the player and slimes have faces, coins spin, and effects exist in code.
  - But in play the arena is still small flat circles on a grid, with no shading, glow or depth.
  - The art sheet asks for:
    - glowing jelly slimes with a highlight and shadow;
    - a glowing player with a dash trail;
    - sparkling coins;
    - visible hit sparks and death puffs;
    - a gravity-flip ripple.
  - The concept frame in the overlay concept shows the same: bloom, a glowing floor and score pops.

  Suggested fix:
  - Draw each kind of entity once to a texture, using gradients, a highlight and an outline, then reuse it. Add Phaser's WebGL glow and bloom effects (falling back gracefully on Canvas), a soft floor glow and vignette, and larger entities.
  - Make particles, score pops and the hurt flash readable in a still frame. Respect "effects intensity" and "reduce flashing".
  - Keep everything code-drawn, and update `CREDITS.md` if the methods change.
  - Show before-and-after screenshots against the art sheet in the report, and keep the smoke test's frame-rate budget passing with all effects on.
- **P45-R1-11** · `engine/overlay/control.ts`, `engine/app.ts:61` — **Go Live is still the Phase 4 control page, not a stream dashboard** (`comparison/3-go-live.png`). It is the streamer's main screen during a stream, and the concept and plan describe:
  - a status bar with the round timer and connection pills for Twitch, Codex, overlay and sound;
  - a three-column layout: pitch queue with authors and statuses; ballot with **vote bars and percentages** plus a small live game preview; and a Codex step timeline above active patches with credits and roll back;
  - a recent-chat strip.

  The build shows:
  - two plain cards;
  - vote totals only as "3 vote(s)", with no bars, while the overlay has bars;
  - patches listed by file name;
  - an empty Codex area until a run starts;
  - a sidebar that stops partway down a long page (`built-29ea948/built-go-live-vote.png`), and the duplicate header from P45-R1-06.

  Suggested fix: rebuild Go Live as that dashboard, reusing the shared data and `appendText` helpers. The timeline should always show the last run's steps, the layout should stay readable at 1440×900 without the sidebar cutting off, and P45-R1-06 should be fixed in the same pass.
- **P45-R1-12** · `engine/overlay/setup.ts:7-8`, `engine/app.ts` — **Setup is one long page, not the first-run wizard the spec asks for** (`comparison/2-setup.png`). The spec (Build C) says "A first-run wizard, also reachable later from Setup, in six steps". The six steps are plain labels (`appendText(..., 'span', step)`): they don't navigate or show progress, and nothing guides a first run (no Back, Continue or "Skip — practice with the simulator"). The checks render as a separate grid, not as one row per item with its status and its own action button. There is also no "What this changes" panel explaining that Windows Security stays on. This works against the "under 10 minutes using only the UI" criterion. Suggested fix:
  - Make it a real stepper: each step shows done, current or blocked, and Continue is enabled once its checks pass or are skipped.
  - Show one row per check, each with its status and its action (Run setup, Open Windows Security, Check again).
  - Open the wizard automatically on first launch, until setup is complete or skipped; it can still be reopened from Setup later.
  - Add the explanation panel from the concept.

### Minors
- **P45-R1-02** · `engine/twitch/server.ts:139`, `engine/studio/credentials.ts` — Saving Twitch credentials rewrites `.env`, and Vite restarts the whole dev server when `.env` changes. P45-A server log: `[vite] .env changed, restarting server...` then `server restarted`. In-flight requests drop, and a Codex build in progress is aborted (the runner stops on server close). The page meanwhile says "Twitch settings saved and reloaded". The in-process `reloadTwitch` is effectively replaced by the restart. The spec allows a restart only if done "cleanly and says so". Suggested fix: either stop Vite from watching `.env` (the app reads `.env` itself) and rely on the in-process reload, or block saving while a build runs and tell the operator the studio will restart.
- **P45-R1-03** · `engine/twitch/server.ts:144`, `engine/studio/setup.ts` — `GET /api/setup` starts new processes on every request: `git`, `codex login status` and two PowerShell queries. GET requests aren't origin-checked, so any web page the streamer visits can make the server run them repeatedly. Nothing leaks, but it's free CPU load during a stream. Suggested fix: cache the results for a short time and refresh them only through an origin-checked POST (the page already has a refresh action), or check the origin on this GET.
- **P45-R1-04** · `engine/manifest/library.ts:66-68`, `engine/manifest/load.ts:32`, `engine/twitch/server.ts:219` — The active game is stored at a fixed `.live-patch/active-game.json` under the repository root, ignoring `LIVE_PATCH_DATA_DIR`. P45-D, run with an isolated data folder, still wrote the repository's file, which breaks the test-isolation promise from Phase 1. **Play** on a saved build also makes that build the active game permanently, so the next `npm run dev` opens a play-only build where every patch is refused. Suggested fix: store the choice in the data folder. Make saved-build play temporary, or show "Playing a saved build (play-only) — Return to …" on Home and Go Live.
- **P45-R1-05** · `engine/manifest/library.ts` (`smokeGame`), `engine/overlay/library.ts:6` — Importing a game runs that game's own `testCommand` and its smoke specs on this PC. That is inherent to the design, but the page doesn't say so or show the command first. Suggested fix: show the command and a "this runs the game's code on your computer; import only games you trust" confirmation before the first smoke run.
- **P45-R1-06** · `engine/overlay/control.ts:5,69`, `engine/app.ts:61` — Go Live is the Phase 4 control page placed inside the shell:
  - it repeats its own header ("LIVE PATCH / OPERATOR — Stream control") under the "Go Live" title, and keeps its old nav links;
  - "Codex runs" and "Saved builds" show nothing when empty, although the spec asks every list for an empty state that says what to do next;
  - active patches are listed by file name;
  - the hint always says "Pitch: 60 seconds · Vote: 45 seconds", even after Settings changes the timings.

  Suggested fix: remove the inner header and nav, add empty states, show patch titles with credits, and read the timings from the settings.
- **P45-R1-07** · `README.md:37` — Beyond the missing option (P45-R1-01), the README still sends Windows setup through the README and `runs.json`, not the new Setup page, and tells the operator to use the simulator. Suggested fix: point the README at **Setup** and **Practice**, keeping the manual steps as a fallback.

- **P45-R1-13** · `engine/overlay/library.ts` — The Library meets the spec but falls short of its concept (`comparison/1-library.png`):
  - covers are generic glyphs, not a picture of the game (Arena Survivor could use a code-rendered cover);
  - there is no details panel for the selected game (description, supported hooks, allowed actions, sound and effects support, docs link);
  - there is no search;
  - "Add a game" is two forms at the bottom rather than an "Add your game" card in the grid with **Start from template**;
  - the status line ("Manifest valid · Smoke not run · 3 examples · 0 shipped") is small text rather than badges.

  Suggested fix: add the details panel and status badges, move "add game" into the grid, and generate a cover for Arena Survivor in code.

### Nits
- **P45-R1-08** · `engine/overlay/stream.ts` — The overlay shows the pitch queue newest-first (P45-C: Cy, Ben, Ava), while Go Live numbers it oldest-first. Using one order would avoid "which one is 1?" questions on stream.

## Working well — do not change
- The spec copied verbatim from the operator's plan.
- Secret handling: the field is write-only, blank keeps the saved value, only "set"/"not set" is reported, no-origin and cross-origin requests are refused, and nothing appeared in any response, page or log.
- Library discovery uses manifests only. Import checks for symlinks and oversized files and leaves nothing behind on failure. Covers are served through a validated endpoint, not raw file paths.
- Effect limits are enforced in two layers (host and game), with a global 3-per-second flash cap and "reduce flashing" turning flash and shake into no-ops.
- All art and sound are code-made, with a clear `CREDITS.md`, and the OpenArt references are kept out.
- The pitch queue is on stream, round controls have keyboard shortcuts, and destructive actions need confirmation.
- The report is honest: the operator-only checks are left unticked, not claimed.
