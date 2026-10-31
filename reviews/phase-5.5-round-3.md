# Phase 5.5 — Review round 3

## Verdict
Pass with minors

Codex's work for Phase 5.5 is finished:
- both round-2 Majors and all five Minors are fixed and verified;
- every exit criterion Codex can meet is met.

What's left:
- one deferred Nit and one new Nit;
- the operator-only checks (the two-person first-run test, full-screen Esc in Chromium, OBS). The phase can't close until you've done them.

How I verified, at `f78a0f6` (`37e29aa..f78a0f6`, one commit, local only; `origin/master` is still `40b7e5b`):
- I cloned the local repository into a scratch folder: no `.env` and no tokens.
- In the clone, I ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high`.
- I ran the same headless Chromium walkthrough as in round 2, against the clone's real `npm run dev` (HTTPS/HTTP2) at 1920×1080. It used Practice and the demo patch only, and never approved a Codex build.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\r3-*.png`.

## Exit criteria
- [x] **Tokens, type, contrast and brand** — unchanged since round 2; the tests pass.
- [x] **Top bar and sidebar match B** — status resolves on every page (test). On a busy machine it can still read "Codex checking…" for a few seconds while the setup check runs.
- [x] **Home without the game; one named Play window with a stable title.** My run: "Live Patch · Arena Survivor", and a second Play click kept the page count at 3.
- [x] **Pause menu.** My run: Esc opened it with focus on Resume; it showed patch cards and the Controls table, and Esc closed it.
- [x] **Pausing freezes game time and mutation ticks; toasts appear** — unchanged since round 2; the tests pass.
- [x] **First visit and the demo path.**
  - My run: the welcome led to Practice, and the automatic round reached approval in **0.4 s**.
  - The demo put **10 coins around the player**, with **no skipped actions**. The patch list read "Demo patch: Coin Shower · active".
  - The title "Demo patch: Coin Shower" now comes from the demo module, in the overlay, the toast and the Practice reply.
- [x] **Go Live panels** — unchanged; the page is 1,105 px tall at 1,080 (deferred Nit P55-R2-08).
- [x] **Library and overlay; no widget covering the HUD or toast at 1920×1080 with the controls hidden.**
  - My composite: toast 721–1198 × 80–134, patch card 24–444 × 180–610, **0 px² overlap**.
  - The overlay patch card lists the newest first, then "+1 more active patch".
- [x] **Keyboard alone, named icon buttons, reduce flashing** — tests pass.
- [ ] **First-time usability check** — pending the operator.
- [x] **HTTPS/HTTP2, tests, build and audit.**
  - `npm test`: vitest **77 passed, 4 skipped**; Playwright **53 passed, 1 skipped** (the opt-in WebGL test); then "HTTPS regression passed: HTTP/2 same-origin, cross-origin denial, Practice, Go Live and Play window"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.

## Previous findings
- **P55-R2-01** — **Resolved.**
  - `.play-top` is now `justify-content:flex-end`.
  - My `r3-04` shows the Mute, Full screen and Menu buttons at the top right, clear of "SCORE / LIVES / TIME" and of the toast.
  - New browser geometry test, plus Codex's `10-play-tools-visible.png`.
- **P55-R2-02** — **Resolved.**
  - `engine/mutation/metadata.ts` reads the literal `meta.title` with the TypeScript parser. The server rejects a demo without one and stores the title on the run (`mutationTitle`).
  - The overlay and the Practice reply use the stored title.
  - The tests use a second demo title. The engine no longer contains "Coin Shower".
- **P55-R2-03** — **Resolved.** `demo/coin-shower.js` now issues 12 actions: 10 spawns, one burst and one message. My run showed no "skipped" note.
- **P55-R2-04** — **Resolved.** The Library counts the validated mutation files: "3 patches active" in Codex's capture, and "5" in my run, which had two demos on top of the three built-in patches.
- **P55-R2-05** — **Resolved.** The detail rows are one line with the count on the right, and the star sits inside the cover (Codex's `05`).
- **P55-R2-06** — **Resolved.** The list is newest first, capped at three rows, with a "+N more" line (my run and Codex's `07`).
- **P55-R2-07** — **Resolved.** The arena banner moved to canvas y 145, about 242 px on screen. My `r3-04` shows "DEMO PATCH: COIN SHOWER" below the toast, and the layout map lists it.
- **P55-R2-08** — **Accepted as deferred** (rail icon set, "Studio" label, and Go Live 25 px over the viewport).

## Findings

### Blockers
None.

### Majors
None.

### Minors
None.

### Nits
- **P55-R3-01** · `engine/twitch/server.ts` (demo ship) — Each Practice round can ship another copy of the demo.
  - My second walkthrough left two "Demo patch: Coin Shower" entries active, which doubled the coins.
  - **Remove demo patches** in Go Live clears them, so this is harmless.
  - Optionally, replace an earlier demo instead of adding a new one.

## Working well — do not change
- **The first five minutes:** welcome → **Start practice** → automatic round → a visible, honestly labelled demo → Play opens with that ship's toast → Esc shows the patch.
- **The Play window:** stream-clean during play, controls in the top right only when wanted, the toast and the game banner in separate bands, and one reused window that the OBS capture can rely on.
- **Pause:** it holds and drops in-flight actions correctly across a rollback, with tests that check tick delivery.
- **Platform boundary:** demo titles and counts come from the game's own files, not the engine.
- **Stream composite:** no overlap at 1920×1080. The overlay editor marks keep-clear zones and migrates old layouts.
- **Screens:** they now follow the eight concepts closely.

## Before Phase 5.5 can close (operator)
1. **First-time usability check** (exit criterion):
   - ask two people who have never seen Live Patch to go from the welcome to a shipped patch without help, in under 5 minutes each;
   - record each result in `docs/usability-check.md`.
2. **Full screen in Chromium:**
   - press **F**: Esc should open the menu while in full screen, and holding Esc should leave full screen;
   - in another browser, check that **P** opens the menu and the one-time hint appears.
3. **OBS:**
   - capture the "Live Patch · Arena Survivor" window and add `https://localhost:5173/overlay.html` as a browser source above it;
   - check that the certificate is trusted, the corner buttons fade, nothing overlaps, and the game sound is heard once.
4. **Spec change:** Codex wrote "I accept" about the stream-clean spec wording, but accepting it is your call. It matches the plan.
5. **Tag** `phase-5.5-done` at `f78a0f6` once 1–3 pass, then go back to the remaining Phase 5 checks (`reviews/phase-5-round-2.md`, "Operator checks before closing Phase 5").

## Notes
- **Push state:** nothing has been pushed; the public repository is still at `40b7e5b`. Push when you're ready, so the README and the judges see the new UI.
- **Cleanup:** I deleted my scratch clone after the run.
