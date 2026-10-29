## Spec

### Goal

Make Live Patch feel at home to a Twitch streamer from the first minute:
- a studio that follows Twitch's design language and layout conventions, without copying Twitch's brand;
- a clear path for someone who has never seen the product;
- the game in its own window, the way a real game behaves: full screen, an Esc menu, its patches, its controls and its sound.

### Design principles

1. **Twitch-native, not a Twitch copy.**
   - Use the conventions streamers already know: a dark near-black canvas, one violet accent, dense panels, a left navigation list with status dots, a top bar with search and one primary action, dashboard-style panels with Quick actions and an Activity feed, and poll-style vote bars.
   - Never use the Twitch logo, the Glitch, Twitch's typeface files, or wording that implies Live Patch is a Twitch product or endorsed by Twitch.
   - For the account button, write "Connect Twitch account", or use Twitch's official connect assets only as Twitch's developer brand rules allow.
2. **The first visit decides everything.** Every screen answers three questions: what is this, what do I do now, and what happens next? There is one primary action per screen, and every empty state invites the next step.
3. **The game is a game.** It runs in its own window, full screen if wanted. The keyboard and Esc behave the way players expect. Pausing really pauses.
4. **The platform boundary holds.** The game window, menu, patch list and sound controls are engine features. A game only declares its controls and settings in its manifest.

### Build

**A. Design tokens and type**
- One token file that every studio page uses (values in Appendix 2):
  - background `#0E0E10`;
  - surfaces `#18181B` and `#1F1F23`;
  - borders `#2F2F35`;
  - text `#EFEFF1`, muted `#ADADB8`;
  - accent `#9146FF`, hover `#772CE8`;
  - live and danger `#EB0400`;
  - success and warning tones;
  - 4 px radii, an 8 px spacing grid, and Inter for all interface text.
- The game keeps its own mint, coral and gold art. Only the studio chrome switches to the violet system.
- All text and controls meet 4.5:1 contrast (3:1 for large text and icons). Focus rings are visible everywhere.

**B. Navigation and layout**
- **Top bar:**
  - the Live Patch mark;
  - a search box (patches, ideas, builds, settings; a command palette is a stretch goal);
  - connection chips (Twitch, Codex, OBS) with live state;
  - a clear **Practice / Live** mode switch;
  - **Play** (opens the game window);
  - a violet **Go Live**.
- **Left sidebar,** collapsible to icons, in journey order: Home, Practice, Go Live, Library, Builds. Then a **Setup** group (Codex, Twitch, OBS), each with a status dot. Settings sits at the bottom.
- Pages have one consistent header (title, short description, primary action) and one consistent panel style. There are no nested page headers.

**C. Game window (`/play`)**
- **Remove the game from Home.** Every Play button opens `/play` in a named window (`live-patch-play`), so repeated clicks reuse one window. Its tab title is stable (`Live Patch · <game name>`) so OBS Window Capture can find it.
- **Full screen:** a corner button and the **F** key use the Fullscreen API, always from a user action.
  - In Chromium-based browsers, use the Keyboard Lock API so **Esc opens the menu** in full screen; holding Esc leaves full screen.
  - Everywhere else, Esc leaves full screen as the browser requires, and **P** opens the menu. Show a one-time hint explaining this.
- **HUD:** score, lives and time as now.
  - Three corner icon buttons: Sound, Full screen, Menu. Each has a label and a tooltip.
  - A key-hint pill ("Esc Menu · F Full screen · M Mute") that fades after a few seconds.
  - Toasts for "Patch shipped — by @viewer", "Patch rolled back" and "Patch failed safely".
  - **Stream-clean:** the corner buttons and the key-hint pill hide after 3 seconds without mouse movement, as in a video player, and come back on mouse movement or a menu key (Esc, P, F, M or Tab). Movement and attack keys keep the capture clean.
  - **No overlap with the overlay:** the stream overlay is composited over this window. Publish one layout map (which screen regions belong to the HUD, toasts and overlay widgets at 1920×1080) and have both sides follow it. The concepts put the overlay's patch list where the HUD score sits; that's the collision to avoid.
- **Pause menu** (Esc, or P), with Resume focused by default. The game dims and blurs behind it, and it never traps the player. Sections:
  - **Resume.**
  - **Patches:** every active patch with its title, credited viewers, the one-line description from its `meta`, how long it has been active and its status. Failed or rolled-back patches show the reason in plain words.
  - **Controls:** read from a new optional manifest field, `controls` (for example `[{ "action": "Move", "keys": ["W","A","S","D","Arrow keys"] }]`). Arena Survivor declares Move, Attack (Space), Menu (Esc or P), Full screen (F) and Mute (M). Rebinding is a stretch goal; showing the map is required.
  - **Sound:** master, music and effects volume, plus mute. These use the same persisted settings as Studio Settings.
  - **Accessibility:** reduce flashing and shake, and HUD size.
  - **Back to studio.**
- **Pausing semantics:** pausing freezes game time, physics and mutation `onTick`/event delivery, and stops sounds; resume continues exactly where play stopped. The chat round keeps running (the stream goes on), and the menu says so. **M** mutes from anywhere.
- Saved-build play and the comparison view reuse the same window shell, with a "Play-only build" label.

**D. Home and the first visit**
- **First visit:** a short welcome (see `concepts/06-welcome.png`):
  - one sentence on what Live Patch is;
  - a three-step loop graphic (chat pitches → chat votes → Codex ships a patch live);
  - three choices: **Try it now (no accounts, about 2 minutes)** as the primary action, **Connect Twitch**, and **Enable AI building**;
  - a link: "What does Live Patch change on my PC?".
- **Home after that:**
  - a **Start here** checklist with a progress ring: Practice round, Twitch, Codex building, OBS;
  - the active game card with **Play in new window**;
  - a **Recently shipped patches** shelf;
  - the last saved build.
- Once the checklist is complete, it collapses into a slim status row.

**E. Practice that proves the loop**
- A chat-style practice panel (`concepts/08-practice.png`):
  - sample viewers post `!idea`, `!vote` and chatter;
  - one-click **Send sample pitch**, **Add 3 votes** and **Run a full round automatically**;
  - a step timeline (Pitch → Vote → Approve → Build → Ship) showing where the round is.
- **Demo patch:** when Codex or the sandbox isn't ready, approving in Practice offers **Ship a demo patch**. That publishes one of the game's prepared example patches, clearly labelled "Demo" in every UI and on the overlay, so a newcomer sees the full loop end to end. It is never available in a live Twitch round.
- A persistent banner reads "Practice mode — nothing is sent to Twitch".

**F. Go Live as a stream dashboard**
- A panel grid in the style of a creator dashboard (`concepts/02-go-live.png`). Each panel has a header with collapse, move and pop-out controls:
  - **Stream preview:** the overlay over a low-rate mirror of the real play window, sent from `/play` over `BroadcastChannel`. Never a second game instance.
  - **Round:** timer and ballot with poll-style bars, percentages and Approve.
  - **Chat:** live Twitch chat in Live mode, practice chat in Practice; read-only is acceptable.
  - **Quick actions:** square tiles for pause round, next stage, roll back (red), save build, open prediction and cancel build, with confirmation on destructive actions.
  - **Activity feed:** pitches, votes, redemptions, refunds, predictions, builds and rollbacks, with times.
  - **Codex at work:** a step timeline.
  - **Active patches:** with credits and roll back.
- At least two layout presets ("Default", "Chat focus"). Panels can be collapsed and reordered, and the layout persists per browser. Free resizing is a stretch goal.

**G. Library like a browse page**
- Tall 3:4 cover cards (`concepts/05-library.png`), filter chips (All, Ready to stream, Templates, Imported), sort, and a details side panel with **Play in new window**, **Make active for streams**, controls, hooks, actions, and sound and effects.
- The "Add your game" card stays in the grid.

**H. Stream overlay polish**
- Widgets viewers recognise (`concepts/07-overlay.png`):
  - a poll-style ballot card with big `!vote N` chips;
  - a compact "Codex is building" card;
  - patch chips with credits;
  - a pitch ticker ending "type !idea to pitch".
- Keep the Phase 4.5 minimum type sizes, leave the centre clear, keep a safe margin at the edges, and keep the overlay silent.

**I. Words and help**
- One plain-language glossary used everywhere: pitch, round, ballot, patch, build, rollback, practice, demo patch.
- "?" tips next to unfamiliar terms. Every error says what happened and what to do next. Verbs stay consistent: the same action always has the same name.

### Out of scope
- A second playable game (after all phases, as decided earlier).
- Free-form panel resizing and full key rebinding (both stretch goals).
- OBS statistics such as bitrate or dropped frames (that would need obs-websocket).

### Exit criteria

- [ ] The token file defines the colours, type, spacing and radii above, and every studio page uses it.
  - An automated check confirms that text and control colours meet the contrast minimums.
  - The repository contains no Twitch logo or Glitch artwork, and no Twitch font files.
- [ ] The top bar and sidebar match section B.
  - Every page is reachable in at most two clicks, and Practice comes before Go Live.
  - The setup status dots reflect the real check results.
- [ ] Home no longer embeds the game.
  - **Play in new window** opens `/play` in one named window with a stable title.
  - Full screen works from the button and from **F**.
- [ ] The pause menu opens with Esc outside full screen and, in Chromium, also inside full screen (Keyboard Lock), with **P** working in every browser.
  - Resume has focus first.
  - Patches shows each patch's credits, description, age and status (with reasons for failed ones); Controls comes from the manifest; Sound settings persist; Accessibility and Back to studio work.
  - Browser tests cover opening, navigating and closing it with the keyboard.
- [ ] Pausing freezes game time and mutation ticks, and resume continues. A test checks that frames and tick deliveries stop while paused and continue afterwards. Toasts appear for ship, rollback and safe failure.
- [ ] A first visit shows the welcome.
  - **Try it now** leads to Practice, where **Run a full round automatically** reaches the approval step without typing.
  - Without Codex, **Ship a demo patch** shows a labelled demo patch in the game window and on the overlay; it is never offered in Live mode. A browser test covers it.
- [ ] Go Live shows the panels in section F with at least two presets; collapse, reorder and the chosen preset persist; destructive quick actions ask for confirmation.
  - The Activity feed lists all the event kinds named in F.
  - The preview mirrors the real play window, and there is no second game instance (test).
- [ ] The Library and overlay match sections G and H, with the overlay's type sizes still at or above the Phase 4.5 minimums (test).
  - A 1920×1080 capture of the overlay over the play window, with the corner controls hidden, shows no widget covering the HUD or a toast. Keep it as a test, or attach the screenshot to the report.
- [ ] The studio and pause menu work with the keyboard alone. Icon-only buttons have accessible names, and "reduce flashing and shake" is respected.
- [ ] **First-time usability check:** at least two people who have never seen Live Patch each reach a shipped patch (demo or real) from a first visit **in under 5 minutes without help**. The report records their time, where they hesitated, and what was changed as a result.
- [ ] The core flows (a Practice pitch, one Go Live action, opening the play window) are tested against the **HTTPS/HTTP/2** dev server, not only the plain-HTTP test server. `npm test`, `npm run build` and `npm audit --audit-level=high` pass. The README is rewritten around this journey (see P5-R1-03).

**Reviewer focus:**
- a Twitch-native look without misusing Twitch's brand;
- the first-visit journey;
- full-screen and Esc handling across browsers;
- what pausing does and does not stop during a stream;
- no duplicate game instance;
- keyboard and contrast accessibility;
- regressions in rounds, runner, rollback and Twitch features;
- HTTP/2.
