# Phase 5.5 — Review round 1

## Verdict
Fail

The new structure is there and it works: the welcome, one-click Practice round, demo ship, named Play window, Esc menu, pause, Go Live mirror, overlay editor and generated cover. Tests, build and audit pass. The phase still fails for three reasons:
- Two exit criteria are not met: an overlay widget collides with the ship toast at 1920×1080, and the Codex chip and setup dots don't show real state on most pages.
- The screens don't yet match the concepts, which was the operator's headline requirement for this phase.
- The demo patch has no visible effect and claims the winning idea shipped.

How I verified, at `536739d` (`40b7e5b..536739d`, 7 commits, local only; `origin/master` is still `40b7e5b`):
- I cloned the local repository into a scratch folder: no `.env` and no tokens.
- In the clone, I ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high`.
- I ran a headless Chromium walkthrough against the clone's real `npm run dev` (HTTPS/HTTP2) at 1920×1080. It used Practice and the demo patch only, and never approved a Codex build.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\` (`55-01` to `55-07`).
- I compared each of Codex's captures in `docs/phases/phase-5.5-visual/` side by side with `plans/phase-5.5/concepts/01–08`.

## Exit criteria
- [x] **Tokens, type, contrast and brand.** `engine/tokens.css` defines the planned values, and Inter is self-hosted (`@fontsource/inter`). `tests/phase55.test.ts` checks the token contrast pairs. The repository contains no Twitch logo, Glitch or Twitch font files (grep). Several page styles still hard-code colours (P55-R1-12).
- [ ] **Top bar and sidebar match B.**
  - Met: Practice comes before Go Live; every page is one click away; the rail collapses; Settings sits at the bottom.
  - **Not met:** the setup dots and the Codex chip reflect real check results only on Home and Setup (P55-R1-02).
- [x] **Home no longer embeds the game; Play opens one named window with a stable title.**
  - My run: the title is "Live Patch · Arena Survivor", and a second Play click kept the page count at 3 (the same window was reused).
  - Full screen via the button and F is in the code (`engine/play-menu.ts:63-70`). It can't be exercised headless, so it's an operator check.
- [x] **Pause menu.**
  - My run: Esc opened it, with focus on Resume (`activeElement = resume-button`).
  - The Patches tab listed 4 patches with credit, status, age and description. Controls come from the manifest, and Esc closes the menu.
  - P is covered by a test. Keyboard Lock in Chromium full screen is an operator check.
  - See P55-R1-07 (Back to studio) and P55-R1-11 (keyboard test coverage).
- [x] **Pausing freezes game time and mutation ticks; toasts appear.**
  - The test checks that `frame` and `elapsed` freeze and then continue.
  - Tick and event delivery stop in the code (`engine/mutation/host.ts:86,170`), but no test asserts it (P55-R1-11).
  - Toasts for ship, rollback and failure exist (`engine/client.ts:61-65`). See also P55-R1-05.
- [x] **First visit and the demo path.**
  - My run: the welcome was open on the first visit, and **Try it now** went to `?view=practice`.
  - **Run a full round automatically** reached approval in **0.5 s**: 3 ideas, 3 votes from 3 distinct voters, all marked `practice`.
  - **Ship a demo patch** shipped `demo-*.js` with `demo: true`, labelled in Play, Go Live and the overlay.
  - The criterion's wording is met, but the demo misleads (P55-R1-04) and the Live-mode rule exists only in the UI (P55-R1-08).
- [x] **Go Live panels.**
  - Two presets, collapse and reorder persist (test).
  - Destructive actions confirm (`engine/overlay/control.ts:50-51`).
  - The Activity feed covers pitches, votes, redemptions and refunds, runner events, saved builds and predictions.
  - The preview mirrors the real Play window, with no second game (test, plus my run).
  - The layout is far from the concept (P55-R1-03).
- [ ] **Library and overlay match G and H; the 1920×1080 overlay-over-Play capture shows no widget covering the HUD or a toast.**
  - Overlay type sizes pass (test).
  - **Not met:** the default patch-credits widget overlaps the ship toast (P55-R1-01).
  - The Library has a nested page header, which section B rules out (P55-R1-03).
- [ ] **Studio and pause menu work with the keyboard alone; icon buttons have names; reduce flashing is respected.**
  - Icon buttons have accessible names (`engine/client.ts:11`, panel buttons as in "Collapse Recent chat").
  - **No evidence yet** that the studio works with the keyboard alone. The report leaves this criterion out (P55-R1-11).
- [ ] **First-time usability check** — pending the operator, as planned. `docs/usability-check.md` is ready and honestly marked pending.
- [x] **HTTPS/HTTP2, tests, build, audit and README.**
  - `npm test`: vitest **73 passed, 4 skipped**; Playwright **45 passed, 1 skipped** (the opt-in WebGL test); then "HTTPS regression passed: HTTP/2 same-origin, cross-origin denial, Practice, Go Live and Play window"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
  - The README describes the new journey.
  - The diff has 0 token-like secret patterns, and no `.env`, token or demo files are tracked.

## Previous findings
Phase 5 round 2 (Step 0, `175bfac`):
- **P5-R2-01** — **Resolved.** The game's API doc now states the 200–575 ms event budget, and the root addendum links to the full contract.
- **P5-R2-02** — **Resolved.** `docs/architecture.md` now says the limit is 20 actions "per event batch".
- **P5-R2-03** — **Resolved.**
  - With no shipped patch, `!rollback` replies "Nothing to roll back. Ship a patch first." (`engine/pipeline/commands.ts:64`).
  - Unit test: "does not claim rollback when no patch has shipped".
- **Phase 4 carry-over (signed-in triage re-run)** — **Resolved.** It's now in the manual-check list in `phase-5-report.md`.

## Findings

### Blockers
- **P55-R1-01** · `engine/studio/settings-defaults.ts:4`, `docs/play-layout.md`, `games/arena-survivor/tests/smoke/smoke.spec.ts:120` — The default "Patch credits" widget covers the Play window's ship toast.
  - **Evidence:**
    - My composite of `/play` and `/overlay.html` at 1920×1080 with the controls hidden (`review-r1/55-06-composite-toast.png`) shows "Patch shipped — by @Sample viewer 1" overlapping the patch row.
    - Measured rects: the toast is 721–1198 × 80–134, and the overlay header is 24–1104 × 120–230, an overlap of 5,355 px².
    - The default widget (y 120, width 1080) also overlaps the toast zone in Codex's own layout map (720–1200 × 80–150).
  - **Why the test missed it:** it only checks `patches.y ≥ 110`, so it can't fail for this. Every extra patch chip extends the row further into the toast.
  - **Why it matters:** it's an exit criterion, and the toast is the moment viewers should see.
  - **Suggested fix:**
    - Move the default patch widget out of the toast band (below about y 160, or a left column under the HUD).
    - Make the test measure the real `#play-toast` rect from `/play` against every default widget rect.
    - In the overlay editor, draw the HUD and toast zones as keep-clear areas, or warn when a widget enters them.
- **P55-R1-02** · `engine/app.ts:80-86` — The Codex chip and the Codex and OBS setup dots update only inside `if (view === 'home' || view === 'setup')`.
  - **Evidence:**
    - On Practice, Go Live, Library, Builds and Settings, the top bar says "Codex checking…" forever and the dots stay grey.
    - This shows in Codex's own captures `02`, `05` and `08`, and in my run (Go Live at 37 s).
    - The dots also have only two states, so "needs action" can't be shown; the concepts use green and amber.
  - **Why it matters:** an exit criterion says the dots reflect the real check results. Go Live is the page a streamer watches most.
  - **Suggested fix:**
    - Run the setup summary on every view (briefly cached), and update the chips and dots everywhere.
    - Add a third "needs action" state.
    - Add a test that checks the chip on a non-Home page.

### Majors
- **P55-R1-03** · `docs/phases/phase-5.5-visual/*`, `engine/app.ts`, `engine/overlay/*.ts`, `engine/twitch/simulator.ts`, `engine/play-menu.ts` — **The screens don't match the concepts, and the report's comparison table lists only what matches.**
  - The operator decision in the plan header asks for a close match: layout, hierarchy, density, component shapes, placement and copy. Only the Appendix 4 corrections may differ.
  - The start prompt asked for a table of what differs and why; the report describes only matches.
  - Screen by screen, the largest gaps:
  - **01 Home:**
    - The mark is two-line upper-case "LIVE PATCH" with a ✳ glyph; the concept has a one-line "Live Patch" wordmark with an icon.
    - The rail has no "Studio" group label and no consistent line-icon set, and its collapse control is ☰ instead of « at the top and bottom.
    - The search box is narrow and has no "Ctrl K" hint.
    - The Start here rows aren't numbered circles with a subtitle, an inline **Start practice** button on the current step, chevrons on the others, and a ring that shows the step count and percent.
    - The game card has a link instead of two equal buttons (**Play in new window**, **Open library**).
    - The status tiles sit under the "Recently shipped patches" heading. That shelf should show patch cards (icon tile, title, description, @credit, time ago) or its empty state.
  - **Every page:**
    - The "LIVE PATCH STUDIO" kicker, the h1 block and the "? Words used here" button push content down by about 180 px.
    - Keep the spec's one header, but make it compact (title, description and primary action on one band, with the glossary as a "?" icon).
  - **02 Go Live:**
    - The page is **3,045 px tall** in a 1,080 px viewport (panel bottoms reach 1,897 px). The concept fits all six panels on one 1920×1080 screen; this is the main fix.
    - Panel headers should be: title, a centred drag handle, pop-out and a ⋮ menu. Move left and right can go into the menu.
    - The Round panel should have a phase label and a big timer, then one row per idea (number box, title, bar, %, votes, one **Approve**), with prediction and reject in the row menu.
    - Chat should have timestamps, coloured names and `!idea`/`!vote` chips.
    - Quick actions should be six **square icon tiles**: Pause, Next stage, Roll back (red), Save build, Open prediction, Cancel build.
    - The Activity feed should have an icon per event kind, a title and subtitle, and the time on the right.
    - Codex at work should be a vertical timeline with Done, In progress and Pending pills.
    - The connection chips in the top bar need coloured status dots.
  - **03 Game window:**
    - The corner buttons should be round icons with labels under them: "Mute (M)", "Full screen (F)", "Menu (Esc)".
    - The key-hint pill should use keycaps.
    - The toast should have an icon and read "New patch: *title* — by @viewer"; the built toast says only "Patch shipped".
  - **04 Pause menu:**
    - The title should be a large "PAUSED", and the section list needs icons.
    - Patch rows need an icon tile, "@viewer +N", a status pill and a right-aligned "active N min".
    - Controls should be an Action / Key table with keycaps.
    - Sound needs sliders that show percentages, plus an on/off switch.
    - Add the bottom hint bar "Esc Resume · Tab Switch section · Enter Select", plus P outside Chromium.
    - The `04` capture shows the empty Resume pane, not the requested state with patches listed.
  - **05 Library:**
    - Remove the nested "PICK YOUR STARTING WORLD / Game library" header (section B: no nested page headers).
    - The filter chips need icons.
    - Cards need a star, an "N patches active" line, tag chips and a status footer ("Ready to stream", ⋯).
    - The details panel should open with the cover, then the title and description, then the two large buttons. After that come the Controls, Hooks, Actions and Sound rows with counts and chevrons, instead of long inline lists, plus a close ✕.
  - **06 Welcome** (Appendix 4 says to build it nearly as shown):
    - Headline "Welcome to **Live Patch**" and the tagline "Your chat designs the game. Codex builds it. You keep playing."
    - Three code-drawn step illustrations (chat bubble, poll bars, puzzle piece) with numbered circles and the return arrow.
    - Three cards, each with an icon, subtitle and its own button (Start practice, Connect, Set up Codex), the first highlighted.
    - A footer with "What does Live Patch change on my PC?" and "Skip for now".
    - The built version is a small modal with a text-only loop.
  - **07 Overlay:**
    - Capture it in the vote state, as requested; the built capture shows the pitch state.
    - Patches should be a vertical "Live patches" card with icons and "by @viewer", placed per the layout map.
    - The Codex card should read "Codex is building · *title* · by @viewer" with a horizontal Writing → Testing → Ship stepper.
    - The ballot header should read "Chat decides — Round N — Vote 0:24", with rows that have a number box, bar, % and a `!vote N` chip.
    - The ticker should read "New pitch from @viewer: … — type !idea to pitch", with the time.
  - **08 Practice:**
    - Use three columns:
      - Practice chat: timestamped sample viewers with coloured names, a message box (the operator's decision), and the three buttons stacked with **Run a full round automatically** as primary;
      - Round status: phase name, big timer and a vertical five-step timeline;
      - Your first round: a checklist with ticks, plus the "safe space" note.
    - Move the developer "Send an event" form (Account ID, Login, Display name), the Twitch connection box and the raw Ideas list behind an "Advanced" disclosure, as Appendix 1 asked.
  - **Why it matters:** this was the operator's main instruction for the phase.
  - **Suggested fix:**
    - Rework each screen against its concept.
    - Recapture all eight in the requested states.
    - Replace the report's table with matches, differences and the reason for each difference, citing Appendix 4.
- **P55-R1-04** · `games/arena-survivor/demo/quick-feet.js`, `engine/twitch/server.ts:370`, `engine/overlay/stream.ts:33-48` — The demo patch shows no change and claims the winning idea shipped.
  - **No visible effect:** the demo sets `playerSpeed` to 300, exactly like `mutations/01-quick-feet.js`, which is always active as "Quick Feet · Built-in". A newcomer ships it and sees nothing change except a banner.
  - **Wrong claim:** right after the ship, my run's overlay read "DEMO PATCH · SHIPPED · Enemies split into two tiny slimes when hit · @Sample viewer 1" and "✦ PATCH SHIPPED ✦". Nothing like that shipped.
    - The winning idea is stored as `shipped` (`engine/twitch/server.ts:370`), so it counts as shipped wherever that status is read.
  - **Credits disagree:** the overlay chip says "@Sample viewer 1", but the pause menu says "by @Live Patch Demo".
  - **No toast:** in the journey, the user ships and *then* opens Play. The toast has already fired, so the window opens with no toast (`toast now: ""` in my run).
  - **Why it matters:** the demo is the first-visit payoff ("a newcomer sees the full loop end to end"). Viewer-facing text should never claim something that didn't happen.
  - **Suggested fix:**
    - Choose a demo with an effect that isn't already active and is visible within seconds.
    - Word it as "Demo patch: *title* (stands in for '*idea*')" everywhere.
    - Give the idea a "demo" status rather than "shipped".
    - Use one credit rule.
    - When Play opens within a short time after a ship, show that ship's toast once.
- **P55-R1-05** · `engine/mutation/host.ts:159`, `engine/mutation/host.ts:205-209` — Resuming applies deferred actions from modules that were removed while paused.
  - While paused, the host defers actions from replies already in flight. `setPaused(false)` then applies every deferred action without checking that its module is still loaded.
  - **Scenario:**
    1. A patch has an `onTick` that writes `setParameter`.
    2. The streamer pauses, and a moderator sends `!rollback`. `removeMutation` runs and restores the parameter.
    3. On resume, that module's last write applies again, under an origin nobody will ever remove.
    - The same happens to a module disabled or replaced while paused.
  - **Why it matters:** this is half-applied state after a rollback. A ticking patch nearly always has a reply in flight, so this isn't rare on stream.
  - **Suggested fix:**
    - Drop a module's deferred actions when it is disposed, disabled or replaced, or apply on resume only those whose origin is still active.
    - Add a test: pause, roll back, resume, and the parameter stays at its default.
- **P55-R1-06** · `engine/play-menu.ts:80`, `engine/play.css:8-9` — Every gameplay key brings the corner tools and the title box back, so the Play window is never stream-clean while someone plays.
  - **Evidence:**
    - My run: `stream-clean` was `true` after 3.6 s idle, and `false` right after pressing D.
    - When visible, the title box ("Arena Survivor / Arena Survivor · LIVE", 18–200 × 16–79) sits on the arena's "SCORE" text, an overlap of about 7,200 px². See `review-r1/55-04-play-tools-visible.png`.
  - **Cause:** my spec wording ("come back on mouse movement or a key press") invited this, so the fix is a clarification, not a mistake on Codex's part.
  - **Why it matters:** OBS Window Capture is meant to show a clean game during play.
  - **Suggested fix:**
    - Bring the tools back only on mouse movement and on the menu keys (Esc, P, F, M, Tab), never on the manifest's movement or attack keys.
    - Move the title and status off the HUD, or drop them; the window title already carries the name.

### Minors
- **P55-R1-07** · `engine/client.ts:11` (`<a href="/">Back to studio</a>`) — **Back to studio** turns the game window into the studio.
  - My run: afterwards the Play window's URL was `/` and its title "Live Patch". The run ends, and OBS Window Capture loses its window.
  - Suggested fix: focus the studio window that opened Play, if there is one, and keep the game paused. Navigate only when no studio is open, and tell the player the run will end.
- **P55-R1-08** · `engine/twitch/server.ts:350-356` — The server's demo rule only checks that the chosen idea came from Practice. It allows a demo while Twitch chat is connected, or in a round that mixes real and Practice ideas, and no test covers the Live refusal.
  - Suggested fix: refuse the demo while Twitch chat is connected or when the round contains Twitch-origin ideas, and add a negative test.
- **P55-R1-09** · `engine/twitch/server.ts` (demo write), `.gitignore` — Demo patches are written as untracked `games/arena-survivor/mutations/demo-*.js`.
  - They stay active after Practice, so they're included in saved builds and still active when the streamer goes live.
  - Nothing ignores them, so a broad `git add` would commit them to the public repository.
  - Suggested fix:
    - add an ignore rule;
    - offer "Remove demo patches" in Go Live, or remove them automatically when a Twitch round starts;
    - show any leftover demo patch in the Go Live checklist.
- **P55-R1-10** · `games/arena-survivor/docs/mutation-api.md:23` (the doc live Codex reads) — The doc wasn't updated for pausing, which the start prompt asked for.
  - `elapsed` is still described as "seconds since page load", but it no longer advances while the game is paused.
  - The doc also doesn't say that `onTick` and event delivery stop while paused, or that in-flight actions apply on resume.
  - Suggested fix: one short paragraph.
- **P55-R1-11** · `games/arena-survivor/tests/smoke/smoke.spec.ts:69-86`, `docs/phases/phase-5.5-report.md` — Test and report gaps against the criteria:
  - **Pause test:** the probe module counts ticks, but the test never reads the count. It shows that frames freeze, not that tick delivery stops, which the criterion asks for.
  - **Keyboard:** no test drives the studio with the keyboard alone (Tab through Home → Practice → Go Live with visible focus).
  - **Report:** it condenses the spec's 11 criteria into 8 and leaves out the keyboard one.
  - Suggested fix:
    - assert that the probe's tick count is frozen during pause and grows after resume;
    - add a keyboard-only test;
    - list every spec criterion with its evidence.
- **P55-R1-12** · `engine/play.css`, `engine/overlay/*.css` — Many colours are hard-coded instead of taken from the token file, for example `#bf94ff`, `#c9c9d1`, `#6c6583`, `#47474e` and `#0b1828`.
  - So "every studio page uses the token file" only partly holds, and the contrast check can't see these colours.
  - Suggested fix: move them into tokens and extend the contrast test.

### Nits
- **P55-R1-13** · `engine/overlay/control.ts` — Developer wording on Go Live:
  - the toast says "advance complete";
  - the Codex card shows the file name `demo-87fdbde9.js` instead of the patch title;
  - the Prediction activity entry always shows the current time (`control.ts:184`).

## Working well — do not change
- **Play window:** one named `/play` window that is reused, with the stable title "Live Patch · Arena Survivor".
  - Esc and P open the menu, focus starts on Resume, and Esc closes it.
  - Pause truly freezes frames, `elapsed` and audio; resume continues without a time jump (`lastFrameAt` reset).
- **Practice:** **Run a full round automatically** reaches approval in half a second, with three distinct sample voters. Practice ideas are flagged at the source.
- **Demo endpoint safety:**
  - it needs a same-origin JSON request, an approval-stage Practice candidate, and a manifest path inside the game folder;
  - it runs `validateMutation`, writes atomically, and rolls back without Git.
- **The Go Live mirror:** it sends only 480×270 bitmaps once a second over `BroadcastChannel`, without a second game instance.
- **Overlay editor:** the server normalises the layout with whitelisted widget types, no duplicates, and bounds inside 1920×1080. It persists across reloads.
- **Covers:** the generated Arena Survivor cover is on-theme, text-free, 169 KB and credited. The SVG fallback for other games is escaped and tested.
- **Viewer text:** no HTML sink takes viewer or game text. Every `innerHTML` is a static string, and dynamic text goes through `textContent`.
- **16:9 canvas:** the change carries through the manifest action bounds and the API doc's coordinates.
- **Tests:** the HTTPS/HTTP2 regression now covers the Play window.

## Notes
- **Extra work the operator asked for:** the full-frame game, the overlay editor and the generated Library art weren't in the spec, so I reviewed them as additions. Their only open issue is P55-R1-01: the editor lets users place widgets over the HUD or toast, which the report lists as a known risk.
- **Push state:** the 7 commits are local only. The public repository is still at `40b7e5b`.
- **Cleanup:** I deleted my scratch clone after the run.
