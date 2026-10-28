# Phase 4: stream presentation and voting

## Goal

Make the pitch, vote, approval, build and ship cycle visible and operable during a stream, with an OBS-safe display and saved patch notes.

## Build

- Run timed pitch and vote rounds: 60 seconds for pitches, 45 seconds for votes, then hold the three oldest pending candidates for moderator approval. Begin each ballot at zero votes, retire losing candidates and carry unselected pitches into the next round. Keep round state across a dev-server restart.
- Triage incoming ideas for explicit unsafe requests and duplicates; prepare concise candidate text and keep contributor credit. Use Codex for optional semantic triage when available; preview its proposals before the operator applies them.
- Serve a read-only OBS layout with the game, active patches, the current round, vote bars and Codex progress showing the approved idea, contributors, mutation file and smoke-test step. Render viewer text as plain text.
- Serve a local operator control panel for round timing, approval, rejection and rollback. Preserve moderator/broadcaster checks for Twitch chat commands.
- Save a play-only per-stream build snapshot and patch notes with all idea contributors after a round of shipped mutations.

## Vision items scheduled after Phase 4

- Phase 5: channel-point bets on build outcomes, after the live redemption and refund checks.
- Phase 5: a comparison view with the evolved game beside the original version.
- Phase 5: a chat vote for rollback with vote limits and moderator review. Direct moderator and operator rollback is available now.

## Exit criteria

- [ ] A pitch round transitions to a 45-second vote round with no more than three fixed candidates; one vote per viewer remains enforced.
- [ ] Moderator approval launches the runner and a rejected candidate never builds; round state survives a server restart.
- [ ] OBS display and control panel show the same round, vote totals, active patch list and redacted runner progress. Viewer-supplied text is never parsed as HTML.
- [ ] An operator can pause, resume and advance a round locally, and an unauthorized cross-origin request cannot invoke controls.
- [ ] A saved build contains only manifest-selected game content, shipped mutations and patch notes crediting their contributors.
- [ ] Full unit and browser tests, TypeScript build and dependency audit pass.

Reviewer focus: timing and restart recovery, control authorization, plain-text rendering, accurate vote slots and saved-build integrity.
