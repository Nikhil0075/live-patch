# Phase 4: stream presentation and voting

## Goal

Make the pitch, vote, approval, build and ship cycle visible and operable during a stream, with an OBS-safe display and saved patch notes.

## Build

- Run timed pitch and vote rounds: 60 seconds for pitches, 45 seconds for votes, then hold the top three candidates for moderator approval. Keep round state across a dev-server restart.
- Triage incoming ideas for explicit unsafe requests and duplicates; prepare concise candidate text and keep contributor credit. Use Codex for optional semantic triage when available, with a bounded fallback so chat ingestion stays responsive.
- Serve a read-only OBS layout with the game, active patches, the current round, vote bars and Codex progress. Render viewer text as plain text.
- Serve a local operator control panel for round timing, approval, rejection and rollback. Preserve moderator/broadcaster checks for Twitch chat commands.
- Save a per-stream build snapshot and patch notes with idea authors after a round of shipped mutations.

## Exit criteria

- [ ] A pitch round transitions to a 45-second vote round with no more than three fixed candidates; one vote per viewer remains enforced.
- [ ] Moderator approval launches the runner and a rejected candidate never builds; round state survives a server restart.
- [ ] OBS display and control panel show the same round, vote totals, active patch list and redacted runner progress. Viewer-supplied text is never parsed as HTML.
- [ ] An operator can pause, resume and advance a round locally, and an unauthorized cross-origin request cannot invoke controls.
- [ ] A saved build contains only manifest-selected game content, shipped mutations and patch notes crediting their contributors.
- [ ] Full unit and browser tests, TypeScript build and dependency audit pass.

Reviewer focus: timing and restart recovery, control authorization, plain-text rendering, accurate vote slots and saved-build integrity.
