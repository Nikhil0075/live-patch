# Phase 4.5 — Review round 2

## Verdict
Fail

Round 2 is a big step forward. The Blocker and all four visual Majors from round 1 are fixed, and I re-tested each:
- the overlay now measures 28 px for ballot text and shows `!vote N`, percentages and a gold leader bar;
- the game has glowing, shaded slimes, coins and player on a lit floor;
- Go Live is a real three-column dashboard;
- Setup is a step-by-step wizard;
- saving credentials no longer restarts the server.

One new Major is open: the wizard's **Codex sign-in** check reads the wrong output stream. It always says "Needs action" on a machine that is signed in, which blocks **Continue** on step 2. The fix is one line. Five Minors and one Nit are also listed.

How I verified:
- I reviewed `29ea948..969a1ac` and ran the suite (twice), build and audit in this repository.
- In a scratch clone at `969a1ac` with a **fake** `.env` (since deleted), I ran probes R2-A to R2-F against an isolated server:
  - credentials and restart behaviour;
  - the cross-site setup request and setup timing;
  - the overlay's order, font sizes and markup;
  - the Go Live preview;
  - the first-run redirect;
  - the wizard's loading and steps.
- I played the game, ran a vote round with three pitches and six votes, and captured every screen.
- New concept-versus-built images are in `D:\twitchconXcodex\plans\phase-4.5\comparison-r2\`, and the raw screenshots in `built-969a1ac\`.
- I ran `codex login status` and compared its stdout and stderr, printing only lengths and whether they matched.
- I did not run the sandbox setup or self-test, did not enter real Twitch credentials, and did not run the timed first-run check. Those remain the operator's checks.

## Exit criteria
- [x] App shell, two-click reachability, redirects, unchanged overlay URL — unchanged from round 1. The navigation rail now fills long pages (`built-969a1ac/go-live-full.png`).
- [x] Library through manifests only, template, safe imports — unchanged and passing. Import now inspects the manifest first and shows the test command before running it.
- [x] **Make active** switches the running game — the round-1 P45-D evidence still applies. The selection now lives under `LIVE_PATCH_DATA_DIR` (`library.ts:66-68`, `load.ts:32`).
- [ ] Setup reports each check; real sandbox setup works — **not met:**
  - the Codex sign-in check reports the wrong state (P45-R2-01);
  - the administrator prompt and the probe afterwards are still the operator's check.

  The setup command is now correct (see P45-R1-01 below).
- [x] Twitch credentials can be saved, replaced and removed, and are used without a manual restart — R2-A:
  - the save returned 200, `.env` was updated, and **0** restart lines appeared in the server log afterwards;
  - **0** occurrences of either fake secret in any HTTP body, rendered page or log line;
  - a cross-site `GET /api/setup` returned 403.

  The real-account reconnect is still the operator's check.
- [ ] A new operator finishes setup and a practice round in under 10 minutes — operator's timed check, pending. It needs P45-R2-01 fixed first, or the operator has to use **Skip** at step 2.
- [x] At least 8 sounds, music and effects; the overlay is silent — unchanged. The art now matches the art sheet's direction much more closely (`comparison-r2/5-game-art.png`).
- [x] Mutation sound and effect actions are throttled — unchanged and passing.
- [x] The pitch queue is on stream; destructive actions need confirmation; viewer text stays text — R2-B/C:
  - the overlay queue is now oldest-first;
  - the ballot shows three `!vote` hints;
  - a pitch containing `<img src=x onerror=…>` was shown as literal text, with **0** `img` elements.
- [x] Asset credits — `CREDITS.md` adds `src/art.ts` and `cover.png`, which is a screenshot of the code-drawn game.
- [x] Full tests, build and audit:
  - Second `npm test` run: vitest 49 passed and 4 skipped, Playwright 31/31. The build succeeded and `npm audit --audit-level=high` found 0 vulnerabilities.
  - My first run had one timeout, `simulator submits ideas and chat through the live game path as plain text`, at 30.3 s. That run overlapped my own probe servers. On the clean rerun the same test took 3.1 s, so I'm not counting it, but the test has little slack under load.

## Previous findings
- P45-R1-01 — Resolved in code. Setup now runs `codex sandbox setup --elevated --current-user` through `Start-Process -Verb RunAs -Wait` (`studio/setup.ts`). Usage errors get their own message, a unit test checks the arguments, and the README gives the same command. The real administrator prompt and probe remain the operator's check; see P45-R2-02 for one edge case.
- P45-R1-02 — Resolved. `envDir: false` stops Vite reloading on `.env` changes, and Twitch reloads in-process (R2-A: no restart).
- P45-R1-03 — Resolved. Results are cached for 30 s, cross-site GETs are refused (R2-A: 403), and refresh is an origin-checked POST. The first, uncached call took **13.95 s** (P45-R2-03).
- P45-R1-04 — Resolved. The selection is stored under the data folder; saved-build play is temporary, with a "Return to original game" action.
- P45-R1-05 — Resolved. Import inspects first, then shows the command, example and a local-code warning before running anything.
- P45-R1-06 — Resolved, apart from a duplicate heading (P45-R2-06). Empty states, patch titles with credits, and the timings from Settings ("Pitch 60s · Vote 45s") are all there.
- P45-R1-07 — Resolved. The README leads with Setup and Practice.
- P45-R1-08 — Resolved. Overlay and Go Live are both oldest-first (R2-B).
- P45-R1-09 — Resolved. R2-C computed sizes at 1920×1080:

  | Element | Size |
  |---|---|
  | Ballot text | 28 px |
  | Secondary text | 20 px |
  | Patch chips | 23 / 20 px |
  | Panel labels | 20 px |
  | Clock | 42 px |
  | Phase | 30 px |

  `!vote N`, percentages, a gold leader bar and a mark per candidate are present (`comparison-r2/4-overlay.png`), and a browser test checks the sizes.
- P45-R1-10 — Resolved. Code-drawn gradient textures in `src/art.ts` give shaded jelly slimes with faces, a glowing player with a trail, shining coins, a lit floor and larger entities (`comparison-r2/5-game-art.png`).
- P45-R1-11 — Resolved.
  - Go Live has a status strip, a pitch queue, a live preview, a ballot with bars, percentages and `!vote` hints, a Codex timeline with an empty state, credited patches, saved builds and recent chat (`built-969a1ac/go-live-full.png`).
  - The rail now runs the full height of the page.
  - See P45-R2-05 for the preview.
- P45-R1-12 — Resolved as a structure: six steps with Back, Continue and Skip, one row per check with its status and action, the explanation panel, and a first-visit redirect (R2-E: `/?first-run` → `?view=setup`). Three defects remain: P45-R2-01, -03 and -04.
- P45-R1-13 — Resolved. Real cover, search, details panel with hooks, actions, audio and effects plus status badges, and an "Add your game" card in the grid.

## Findings

### Blockers
None.

### Majors
- **P45-R2-01** · `engine/studio/setup.ts:12-13`, `engine/studio/setup.ts:42` — The **Codex sign-in** check always fails on a signed-in machine.
  - The `command()` helper returns only stdout, but the bundled Codex CLI prints its login status to **stderr**. On this PC, `codex login status` wrote nothing to stdout and 23 characters to stderr ("Logged in using ChatGPT…"). This is the same Codex install that ran the Phase 3 evaluation.
  - So the check reports "Needs action — Open Codex and sign in with ChatGPT", the wizard disables **Continue** at step 2 (`built-969a1ac/setup-step3.png`), and Home never reports Codex as ready.
  - A correctly set-up streamer can't finish the wizard without **Skip**, which also undermines the timed first-run check.

  Suggested fix: read stdout and stderr together (or use the command's exit status), and add a unit test with the recorded stderr-only output. Make sure the Home summary uses the corrected check too.

### Minors
- **P45-R2-02** · `engine/studio/setup.ts` (`sandboxSetupArgs`) — `--current-user` is decided inside the elevated process. When a standard Windows account approves the administrator prompt with an administrator's password (common on shared or family PCs), the elevated process runs as the administrator. The sandbox would then be set up for the wrong account, and the self-test would keep failing. The CLI's help offers `--user <USER>` with `--codex-home <DIR>` for this case. Suggested fix: before elevating, read the launching account's name and Codex home, and pass `--user … --codex-home …` explicitly; that works in both cases. If the self-test still fails, show the "set up for another user" explanation.
- **P45-R2-03** · `engine/studio/setup.ts`, `engine/overlay/setup.ts:52` — The first setup check takes about **14 s** (R2-A: 13,950 ms uncached), and the wizard shows nothing while it waits. At 1.5–4 s the step area was empty and **Continue was enabled** (`built-969a1ac/setup-step1.png`). Suggested fix: show a "Checking…" row for each check, keep Continue disabled until the step's checks have loaded, and start the checks when the server starts so the first visit is fast.
- **P45-R2-04** · `engine/app.css:8`, `engine/overlay/setup.ts:44` — The steps don't show progress. Every step is drawn with the same mint fill. A finished step's label turns mint on that mint fill and disappears: step 1 is blank in `setup-step3.png`. Only the current step is distinct. Suggested fix: give the step buttons their own styles that override the generic button fill, with readable done, current and upcoming states (a tick on done steps).
- **P45-R2-05** · `engine/overlay/control.ts:10`, `preview.html` — The Go Live "Live game preview" is a second, independent copy of the game. `preview.html` loads the full `engine/client.ts`, so it runs its own Phaser game and every mutation again. It is labelled **LIVE**, but it isn't the streamer's game (different state, different score), and while Go Live is open the streaming PC runs the game and all mutation sandboxes twice. Suggested fix: label it as a separate preview and pause it when Go Live is hidden, or let the operator turn it off. Or replace it with a light mirror of the real play view, such as periodic snapshots.

### Nits
- **P45-R2-06** · `engine/overlay/control.ts:6` — Go Live still has a second heading block ("RUN THE SHOW / Stream control") under the page's own "Go Live" title. Drop it, or merge it into the status strip.

## Working well — do not change
- The overlay is sized for a 1080p stream, and a test checks the font sizes. Together with `!vote` hints and percentages, chat can now read and act on it.
- Code-drawn art in `src/art.ts` holds the art sheet's look without any outside assets, and the smoke test's frame budget still passes.
- Go Live's three columns are clear, and every empty state says what to do next.
- Credentials: no restart, write-only secret, and no secret in any response, page or log; the cross-site setup request is refused.
- The import preview shows exactly what will run before anything runs.
- The report's before-and-after visuals and its honest list of operator-only checks.
