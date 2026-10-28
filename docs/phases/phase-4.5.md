## Spec

### Goal

Turn the four separate developer pages into one product a streamer can set up in minutes and run with confidence on stream:
- an app shell with a game library;
- a guided setup that takes the friction out of Codex, Windows and Twitch;
- stream screens that show every step of the loop;
- a game with sound and visual effects that viewers' patches can use too.

### Build

**A. App shell and organisation (must)**
- Give `/` an app shell with one navigation rail: **Home, Library, Go Live, Builds, Setup, Settings**. The play view, the operator controls (today's `control.html`) and the practice tools (today's `simulator.html`) become sections of this shell.
- Keep `/overlay.html` free of app chrome, and keep its URL unchanged so OBS sources don't break. Old page URLs keep working as redirects.
- **Home** shows: how far setup has got, Twitch, Codex and overlay status, the active game, the last saved build, and one primary action ("Start a practice round" before setup is done, "Go live" after).
- One set of design tokens (colour, type scale, spacing, radii) shared by every page, and one button set (primary, secondary, danger).
  - Every list gets an empty state that says what to do next.
  - Destructive actions (roll back, cancel build, discard triage) need a confirmation.
  - Notices appear as toasts, not as a permanent bar at the bottom.
  - Round controls get keyboard shortcuts, shown on the buttons.
- Viewer-facing copy replaces developer copy. "Add or remove a .js file in the game's mutations folder" moves to the docs, and the simulator loses its "PHASE THREE" label.

**B. Game library (must)**
- **Library** lists every folder under `games/` (and other configured folders) that has a valid `live-patch.json`. The engine discovers games only through manifests, as before, and imports nothing from `games/`.
- New optional manifest fields: `description`, `cover` (an image inside the game folder; PNG, JPEG or WebP; at most 1 MB), `tags`, `version`, `author`, `audio` and `effects` (see D). Old manifests stay valid.
- Each game card shows the cover, the manifest validation result, the last smoke-test result and time, the number of examples and shipped patches, and these actions:
  - **Play**;
  - **Make active**: switches the running game without editing `package.json` or using a command-line flag, and the runner, prompt and smoke command follow the new manifest;
  - **Open mutation API docs**.
- **Add game** offers two routes:
  1. **Import a folder**: validate the manifest and paths, refuse symlinks and oversized files, then run the smoke test. Show readable errors and change nothing on failure.
  2. **Start from a template**: `npm run new-game -- <name>` (also a button) creates a minimal game with a manifest, entry, API doc, one example mutation and a smoke test that passes.
- Show our own **Arena Survivor** plus up to two clearly labelled **"Concept — not playable"** cards, so the library doesn't look empty. A second playable game is **not** part of this phase; it comes after all phases are finished.
- The **Make active** switch must still be proven. Test it with a minimal game created from the template, kept as test data, not with a second showcase game.
- **Builds** lists saved builds with their patch notes (rendered as plain text, or as Markdown with links and images turned off), **Play (play-only)**, and a disabled "Compare with original" slot labelled Phase 5.

**C. Guided setup and settings (must)**
- A first-run wizard, also reachable later from **Setup**, in six steps: Requirements → Codex sign-in → Sandbox → Twitch (optional) → Choose game → OBS and practice round.
- Every check shows **Ready**, **Needs action** or **Not available here**, with a plain-language reason. The checks:
  - Node version, Git, installed dependencies and the Playwright browser;
  - Codex CLI present and signed in;
  - the Codex elevated Windows sandbox, using the runner's existing probe;
  - Microsoft Defender Controlled Folder Access: whether it's on, whether the project folder is protected, and recent blocks of the app's executables, all read-only;
  - project path issues, such as a folder synced by OneDrive or protected by Windows;
  - Twitch app credentials present (never shown);
  - broadcaster and bot connected;
  - reward ID set (optional);
  - overlay reachable.
- **"One-click" means safe one-click.** Allowed actions:
  - **Run Codex sandbox setup**: starts the official `codex sandbox setup --elevated` through the normal Windows administrator prompt, then re-runs the probe.
  - **Open Windows Security**: opens the exact settings page.
  - **Copy overlay URL**.
  - **Connect broadcaster / bot**: the existing OAuth flow.
  - **Run sandbox self-test**.
- If Controlled Folder Access blocks the app, the Setup page explains it and shows step-by-step instructions to allow **the specific blocked executables** shown in Windows Security's Protection history, or to move the project out of a protected folder. The app must **never** turn Defender off, add folder or process exclusions, or change any security setting by itself. Any command shown is for the operator to copy and run themselves, and it names exact executable paths, never folders or wildcards.
- **Known Codex sandbox setup failures.** Handle the failures described in the Codex Windows sandbox write-ups (see Appendix 2). For each one, detect it, explain it in plain words, and offer the fix:
  - **Not set up for this Windows account** (the probe says "cannot write in its worktree"): **Run Codex sandbox setup**, with the Windows administrator prompt.
  - **Administrator approval refused or unavailable** (for example, a managed PC): explain why it's needed and what to ask IT for. Never fall back to the weaker unelevated sandbox; the runner refuses it on purpose.
  - **The sandbox user lacks the "Log on locally" right** (Error 1385, often caused by group policy): explain it and give the exact policy name for IT.
  - **Folder permission failures**, on the runner's temporary worktree folder, or because the project sits in a protected or synced folder (Controlled Folder Access, OneDrive): show the path, and suggest moving the project or allowing the specific blocked executable.
  - **Security software blocks the sandbox's firewall or policy changes**: point to the Windows Security Protection history entry and give instructions to allow that specific executable.
  - **Setup was done for a different Windows user or Codex home folder**: explain it and offer to run setup again.
- Map known error codes and messages to these cases. An unknown error shows a short message, plus **Copy diagnostics**, which copies the local error text with secrets removed.
- The phase report records which of these failures occurred on the operator's machine during testing, and how the Setup page resolved each.
- **Practice mode:** a round driven by the simulator, with a sample-pitch generator, so the whole loop can be tested without Twitch or going live. It takes the place of today's standalone simulator page.
- **Settings:**
  - round timings (pitch and vote seconds);
  - sound: master, music and effects volume, plus mute;
  - effects intensity and **reduce flashing and shake**;
  - overlay options;
  - Twitch reward ID.

  Settings persist in `.live-patch/settings.json` (ignored by Git and denied by Vite).
- **Twitch credentials from the Setup page (approved).** The Twitch step has fields for client ID, client secret, redirect URI and reward ID, so the operator never edits `.env` by hand.
  - Saving uses a same-origin JSON request with the existing origin check. Cross-origin and non-JSON requests are refused.
  - The server writes `.env` atomically, creating it from `.env.example` if it's missing, and keeps every other line.
  - The secret is **write-only**: the field is always empty when the page loads, and the page shows only "set" or "not set" with a **Replace** button. The client ID may be shown, because it isn't secret.
  - Credential values are never logged, never returned in a response, an error, a runner event or `/api/twitch/status`, and never written anywhere but `.env`.
  - After saving, the Twitch service reloads its settings without a manual restart, or the page restarts it cleanly and says so. The Phase 2 note that a restart is needed after editing `.env` must no longer apply.
  - **Remove Twitch credentials** clears them and disconnects both accounts.
  - The README's manual `.env` steps remain as a fallback.

**D. Sound and visual effects (must)**
- **Game baseline (Arena Survivor):**
  - readable art: a player with a face, jelly-slime enemies, spinning coins (see `concepts/05-art-sheet.png`);
  - particle bursts for hits, coin pickups and enemy deaths;
  - a short screen shake on damage (50–300 ms, easing out);
  - hit-stop on kills (≤ 80 ms);
  - floating score numbers;
  - a red vignette on the last life;
  - a "Patch shipped" banner.
- **Sound map, at least 8 events:** coin, hit, enemy death or split, player hurt, round start, vote tick, patch shipped, patch failed, rollback.
- **Background music (approved):** at least one seamless loop for play.
  - It is on by default at a low level (about 25%), with its own volume slider and mute.
  - It dips briefly under the "patch shipped" jingle and the round-start sound, and fades in and out rather than cutting.
  - Every sound, music included, plays from the play view only. The OBS overlay stays silent, so stream audio never doubles.
- **Where art and sound come from:**
  - Art and sound are either **made for this project by Codex** (generated images, art drawn in code or SVG, synthesised effects, composed or generated music) or **CC0** (for example, Kenney audio packs).
  - If generated images aren't available, draw the art in code with Phaser graphics or SVG; the art sheet's style works with vector shapes.
  - The OpenArt concepts are reference only and never go into the repository.
  - Every asset's origin goes in `games/arena-survivor/assets/CREDITS.md`: what made it, how (tool, prompt summary or source URL), and its licence. AI-generated assets are labelled as such. Assets with unclear origin are not allowed.
- **Audio rules:**
  - Browsers block audio until the user interacts, so show a "Click to enable sound" prompt in the play view.
  - Document how OBS browser-source audio works ("Control audio via OBS").
  - Sound follows the Settings volumes and mute.
- **Effects for mutations:** add sound and effect actions, declared in the manifest, so viewers' patches can use them through the existing `game` handle. Examples: `playSound(name)`, `burst(kind, x, y)`, `shake(strength)`, `flash(colour)`. Keep the sandbox contract:
  - names come only from the manifest's `audio` and `effects` lists;
  - arguments are clamped;
  - per-module and global rate limits apply (for example, sounds ≤ 4/s per module, shake ≤ 1/s, and full-screen flashes never more than **3 in any one second**, all modules together, following WCAG 2.3.1);
  - volume and intensity are capped by the operator's settings;
  - "reduce flashing and shake" turns flash and shake into no-ops.
- Update `docs/mutation-api.md`, the game's API doc and the examples with the new actions. The runner's prompt picks them up from the manifest automatically.

**E. Stream screens show the whole loop (must)**
- During the pitch window, the overlay and Go Live show the **pitch queue**: count, newest pitches and authors, merges. Viewers can see that their idea landed. (Today the queue is invisible while pitching.)
- Ballot, numbering and `!approve N` follow one rule everywhere. This fixes P4-R2-01.
- The Codex panel shows a step timeline: sandbox → writing file → smoke test → shipped or failed. Shipped gets a celebration; failed and rolled-back get calm states. Both respect "reduce flashing and shake".
- Patch chips show the title and every credited contributor. Built-in examples say "Built-in", not "@Live Patch".
- The overlay keeps its transparent centre, and its layout follows `concepts/04-stream-overlay.png`.

### Out of scope (stays in Phase 5)

- Channel-point bets, the original-versus-evolved comparison, chat rollback voting and reward refunds.
- A second playable game: after all phases, by operator decision.
- The OBS certificate check on a real OBS.
- The Phase 1–4 Minor clean-up and the fresh-clone judge review.

### Exit criteria

- [ ] `/` opens the app shell with Home, Library, Go Live, Builds, Setup and Settings. Every former page is reachable in at most two clicks, old URLs still work, and `/overlay.html` is unchanged.
- [ ] Library lists every valid game, discovered only through manifests (no imports from `games/` in `engine/`), with validation and last smoke status.
  - **Start from a template** creates a game that passes its smoke test and appears in the library.
  - Importing an invalid or unsafe folder (bad manifest, symlink, oversized file) shows a readable error and changes nothing.
- [ ] **Make active** switches the running game, tested with a game made from the template. Afterwards the runner's prompt, mutation folder and smoke command come from the new manifest, with no edit to `package.json`.
- [ ] Setup reports every check with Ready, Needs action or Not available here.
  - On a machine without the elevated sandbox, **Run Codex sandbox setup** shows the Windows administrator prompt, and the probe passes afterwards.
  - Each known sandbox setup failure listed in C maps to its explanation and fix; a unit test uses recorded error texts. The phase report lists the failures that occurred on the operator's machine and how they were resolved.
  - No code path disables Defender, adds exclusions or changes security settings (source review and a test).
  - No secret value ever reaches the browser (test).
- [ ] Twitch credentials can be saved, replaced and removed from the Setup page, and the Twitch service uses them without a manual restart.
  - Tests show that a cross-origin or non-JSON save is refused, and that the client secret never appears in any HTTP response, runner event, log line or error message.
  - `.env` keeps its other lines.
- [ ] An operator who has never seen the app completes setup and a practice round in under 10 minutes using only the UI (timed manual check, recorded in the report).
- [ ] Arena Survivor has at least 8 sound events, a looping background track and the listed visual effects.
  - The master, music and effects volumes, mute and reduce-flashing settings persist across a restart, and the overlay plays no sound.
  - An automated check confirms that full-screen flashes never exceed 3 in any one second.
  - The five-second smoke test's frame-rate budget still holds with every effect active.
- [ ] A mutation can trigger manifest-declared sound and effect actions. A mutation that spams them is throttled rather than allowed to blast audio or flash continuously (test). The mutation API docs list the actions with examples.
- [ ] The overlay and Go Live show the pitch queue during the pitch window. Destructive actions need confirmation. A browser test with markup in names and pitches finds no HTML elements created from viewer text.
- [ ] Every asset is listed in `CREDITS.md` with its origin, how it was made and its licence, and AI-generated assets are labelled. None has an unclear origin, and no OpenArt concept image is in the repository.
- [ ] The full unit and browser tests, TypeScript build and dependency audit pass. The Phase 1–4 tests still pass unchanged, or any change is explained in the report.

**Reviewer focus:**
- the platform boundary for library discovery and game switching;
- setup actions that could weaken security;
- secrets never reaching the browser;
- new mutation actions keeping the sandbox and rate limits;
- flashing and motion accessibility;
- asset licensing;
- OBS URL stability;
- no regressions in rounds, runner or rollback.
