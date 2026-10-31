# Phase 4.5 — Review round 3

## Verdict
Fail

Every round-2 finding is fixed, and I confirmed each one:
- the wizard shows Codex as **Ready** and enables Continue;
- loading rows appear while the checks run, with Continue disabled;
- the step buttons show done, current and upcoming states;
- the setup command passes the user and Codex home explicitly;
- the Go Live preview is off by default.

But the full test suite **fails reproducibly on this machine** at `83770b8`. `one crowded Space attack keeps unrelated patches active` failed in **2 of 2** full runs, the second on an idle machine. I traced the cause to the new particle effects: a mass kill stalls the page long enough that the host disables an unrelated patch ("Danger Zone · failed · Event deadline exceeded"). That breaks the Phase 1 fault-isolation guarantee on stream, and fails the "full tests pass" exit criterion.

This is the last round allowed, so the smallest change to clear the Blocker is spelled out below. The operator decides whether to fix it now or cut the feature.

How I verified:
- I reviewed `969a1ac..83770b8`.
- I ran `npm test` twice: the first run overlapped my probes; the second ran on an idle machine. Both failed the same test.
- I ran the build and audit.
- In a scratch clone at `83770b8` (since deleted):
  - R3-A: printed the generated administrator command for a user and path with spaces and an apostrophe, and checked the sign-in parser;
  - R3-B and R3-C: captured the wizard's loading state and steps;
  - R3-D: opened Go Live and toggled the preview.
- In another scratch clone I ran the failing test on its own, three times per variant:
  - as committed;
  - without the startup warm-up;
  - at the previous commit;
  - with particle bursts turned off (four times).
- Screenshots are in `D:\twitchconXcodex\plans\phase-4.5\built-83770b8\`.
- I did not run the real sandbox setup, the Twitch reconnect or the timed first-run check.

## Exit criteria
- [x] App shell, two-click reachability, redirects, unchanged overlay URL — unchanged, and the duplicate heading is gone (`built-83770b8/go-live.png`).
- [x] Library through manifests only, template, safe imports — unchanged.
- [x] **Make active** switches the running game — unchanged.
- [ ] Setup reports each check; real sandbox setup works — the checks now report correctly. R3-C: step 2 reads "Codex CLI and sign-in · Signed in · **Ready**", with Continue enabled. The administrator prompt and the probe afterwards remain the **operator's check**.
- [x] Twitch credentials saved, replaced and removed without a restart — `credentials.ts` and the save path are unchanged since round 2's R2-A (no restart, no secret anywhere). The real-account reconnect is still the operator's check.
- [ ] A new operator finishes setup and a practice round in under 10 minutes — the operator's timed check, now unblocked.
- [x] At least 8 sounds, music and effects; the overlay is silent — present. But see P45-R3-01 for what the effects cost under load.
- [x] Mutation sound and effect actions are throttled — unchanged and passing.
- [x] The pitch queue is on stream; confirmations; viewer text stays text — unchanged.
- [x] Asset credits — unchanged.
- [ ] Full unit and browser tests, build and audit pass — **not reproduced.** In both of my `npm test` runs, vitest passed 50 tests with 4 skipped, and Playwright passed **31 and failed 1**: the crowded-attack test, both times. The build succeeded and `npm audit --audit-level=high` found 0 vulnerabilities. The report says 32 passed. See P45-R3-01.

## Previous findings
- P45-R2-01 — Resolved. `command()` returns stdout and stderr together. `codexSignedIn` accepts only a line that starts with "Logged in" or "Authenticated" (R3-A: `Logged in using ChatGPT` → true, `Not logged in` → false). The wizard shows Ready on this signed-in PC (R3-C).
- P45-R2-02 — Resolved in code. The command now passes `--user <whoami> --codex-home <CODEX_HOME>`, and it quotes correctly. R3-A produced:

  `Start-Process -FilePath 'C:\Program Files\Codex\codex.exe' -ArgumentList 'sandbox setup --elevated --user "LAPTOP\Some O''User" --codex-home "C:\Users\Some User\.codex"' -Verb RunAs -Wait -PassThru`

  The operator's real run should confirm that the CLI accepts the `DOMAIN\user` form that `whoami` prints.
- P45-R2-03 — Resolved. The server starts the checks at launch. At 0.7 s, every row read "Checking…" and Continue was disabled; the checks loaded at 4.3 s (R3-B, `setup-loading.png`). See P45-R3-02 for a side effect.
- P45-R2-04 — Resolved. Done steps show a tick with readable labels, the current step is highlighted, and upcoming steps are dark (`setup-step3.png`).
- P45-R2-05 — Resolved. The panel is titled "Game preview · separate run" and is off by default (R3-D: 0 frames loaded on open). **Start preview** loads `/preview.html`, and the preview stops when the page is hidden.
- P45-R2-06 — Resolved. The second heading under Go Live is gone.

## Findings

### Blockers
- **P45-R3-01** · `games/arena-survivor/src/main.ts:80-86`, `games/arena-survivor/src/main.ts:243`, `engine/mutation/host.ts:167` — **Particle bursts in a mass kill make the host disable an unrelated patch.**
  - **What happens:** the crowded-attack test spawns 28 enemies next to the player and attacks once. Each kill calls `burst()`, which adds up to 8 particles, so the 160-particle cap fills in one frame. Every frame then draws each particle as a glowing line plus a circle (`main.ts:243`).
  - **The effect:** this stalls the page long enough that "Danger Zone", an example patch that did nothing wrong, misses its 200 ms event deadline and is disabled.
  - **Evidence:**

    | Run | Result |
    |---|---|
    | Full suite at `83770b8` | Failed 2 of 2 |
    | Test alone at `83770b8` | Failed 2 of 3 |
    | Alone, without the startup warm-up | Failed 2 of 3, so the warm-up isn't the cause |
    | Alone at `969a1ac` | Failed 1 of 3 |
    | Alone, with `burst()` turned off | **Passed 4 of 4** |

  - **Why it matters:** mass kills are exactly what viewer patches produce on stream (splitting slimes, bombs). Losing an innocent patch because the effects stalled the page undoes the Phase 1 fix for this same scenario (P1-R2-01). A streaming PC that is also encoding video and running a Codex build has even less headroom.

  **Smallest change to clear it:** give the effects a frame budget.
  - Limit how many bursts can start in one frame (for example 4–6), and scale down the particles per burst when more fire together.
  - Lower the overall cap.
  - Draw all particles in one batched pass, without the per-particle glow stroke.

  Then show in the report that the crowded test passes 5 of 5 times on its own and the full suite passes twice in a row. If the operator would rather not spend this round on it, the alternative is to reduce burst effects to the Phase 4 level until Phase 5.

### Majors
None.

### Minors
- **P45-R3-02** · `engine/twitch/server.ts:73` — The new startup warm-up runs the setup checks (two PowerShell queries, Git and the Codex CLI) on **every** server start. That includes the isolated smoke-test servers the runner starts for each Codex build, and `npm test`. Those servers never show Setup, so the work only competes with the five-second smoke gate on the operator's PC. It wasn't the cause of P45-R3-01, but it adds load at the wrong moment. Suggested fix: skip the warm-up when `LIVE_PATCH_TEST_SERVER=1`.

### Nits
None.

## Working well — do not change
- A sign-in check with a precise parser and a stderr-only unit test, shared by Home and Setup.
- An explicit `--user` / `--codex-home` setup command with correct PowerShell quoting.
- The wizard's loading rows, the disabled Continue while checks run, and clear step states. It now looks and works like the concept.
- A preview that is opt-in, labelled honestly as a separate run, and stops when the page is hidden.
- A report that keeps the operator-only checks visibly open.

## Fix verification and manual run — `e4764e8` (added 28 October 2026)

**Updated verdict: Pass with minors.** P45-R3-01 and P45-R3-02 are fixed, and I reproduced each fix. Phase 4.5 is ready to tag once the operator's three checks pass. This section verifies the round-3 fixes; it is not a fourth review round.

**Verification:**
- **P45-R3-01 — Resolved.** `particle-budget.ts` gives each frame a falling burst allowance (8, 5, 3, 2, then 0), the overall cap is now 64 particles, and particles are drawn in one fill pass per colour. `crowded Space attack` passed **5 of 5** isolated runs (`scripts/test.mjs --browser-only --browser-grep crowded`, 5.3–6.3 s each). Two consecutive full `npm test` runs on an idle machine each passed vitest **52**, with 4 skipped, and Playwright **32/32**. The build succeeded and `npm audit` found 0 vulnerabilities. The new browser assertion keeps live particles at 64 or fewer.
- **P45-R3-02 — Resolved.** The warm-up is skipped when `LIVE_PATCH_TEST_SERVER=1` (`server.ts:73`).
- The new `--browser-only` and `--browser-grep` options in `scripts/test.mjs` only narrow a manual run; `npm test` still runs everything.

**Manual run.** I acted as a first-time operator in the built-in browser, against an isolated studio at `e4764e8`: HTTP test mode, an empty data folder, no Twitch credentials, and the real Codex CLI.

| Time | Step |
|---|---|
| 0:00 | First visit (`/?first-run`) redirected to Setup |
| 0:20 | Step 1: Node, Git, dependencies, browser and project location all Ready |
| 0:30 | Step 2: "Codex CLI and sign-in · Signed in · Ready" |
| 0:37 | Step 3, Sandbox: "Needs action", with Continue correctly disabled. I did **not** run **Run setup** (an administrator-approved security change) or **Run sandbox self-test**; both are the operator's. I took **Skip — practice with the simulator**. |
| 1:49 | Three pitches entered in Practice; the round moved to voting on its own |
| 2:14 | Five votes cast. The OBS overlay at 1920×1080 showed 60% / 20% / 20%, `!vote` hints and the countdown, readable even scaled down |
| 2:38 | Approval stage, with three "Approve and build" buttons and the winner on top |

I stopped there, because approving starts a real Codex build on the operator's account. That excludes the sandbox step, Twitch and the build itself, so this isn't the timed check, but the UI path through to approval works without the README.

**New findings from the manual run:**
- **P45-R3-03 (Minor)** · `engine/twitch/simulator.ts:6-9` — **Generate sample pitch** picks one of three fixed texts and never changes the viewer. In my run it gave the same pitch twice, and the second was refused: "Please wait three minutes before another idea". To fill a ballot, a new user has to edit three fields (account ID, login, display name) for every pitch and every vote. That's the slowest part of the practice loop, and it counts against the timed first-run check. Suggested fix: let the sample button rotate through practice viewers and distinct pitches, and add **Vote as a new viewer** shortcuts.
- **P45-R3-04 (Minor)** · `games/arena-survivor/src/main.ts:140` — The WebGL glow and bloom are turned on only when `navigator.webdriver` is false. Playwright sets it to true, so **no automated test ever runs the renderer streamers will use**. The frame budget and the crowd test are proven only on the plain path.
  - My one crowd measurement in the built-in browser showed 19 fps, a 342 ms stall and Danger Zone disabled. That run turned out to be in a **background tab**, where frames and timers are throttled, so I don't count it as evidence.
  - A headed Chromium couldn't be started from my shell (`spawn UNKNOWN`).

  Suggested fix: add an opt-in test that runs the crowd and five-second smoke scenarios with `webdriver` overridden in a headed or GPU browser, like the other opt-in tests. The operator should also watch the play view during a busy moment on their own PC before the first stream.

## Phase 4.5 closing note
This was round 3, the last round. After P45-R3-01 is fixed (or the effects are scaled back), the phase needs only the operator's three checks before tagging:
1. **Run setup** in the Sandbox step, approve the Windows prompt, then **Run sandbox self-test**. This also confirms the `DOMAIN\user` form.
2. Save Twitch credentials in Setup and reconnect both accounts.
3. The timed first-run setup plus a practice round, under 10 minutes.

P45-R3-02 can be fixed with P45-R3-01 or carried to Phase 5.

*Update for `e4764e8`:* P45-R3-01 and P45-R3-02 are fixed (see the verification section above). P45-R3-03 and P45-R3-04 are Minors; they can go to Phase 5, but fixing R3-03 first makes the timed check fairer. What remains before tagging are the operator's three checks above, plus a look at the play view during a crowd on the operator's own browser (R3-04).
