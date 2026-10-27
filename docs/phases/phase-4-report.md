# Phase 4 report

## Built

- A persistent round coordinator runs 60-second pitch and 45-second vote windows, fixes up to three candidate IDs for voting, and waits for moderator approval. The local control page can pause, resume and advance rounds.
- Immediate triage rejects explicit unsafe requests, merges exact duplicates and keeps contributor credit. Optional operator-triggered Codex triage refines, rejects or merges pitches with a 20-second deadline; returned IDs are checked before applying decisions.
- A transparent 1920×1080 OBS overlay shows author-named active patches, the round and vote bars, and redacted Codex progress. A separate local control page shows the same state, runs and saved builds. Viewer content is inserted with `textContent`.
- A saved-build action copies the selected game, excludes hidden/local data and unshipped generated patches, and writes patch notes crediting contributors. The snapshot can be reopened with `npm run dev -- --game builds/<id>/game`.
- The Phase 3 MCP test was made deterministic for the default suite; its real CLI/configuration variant is opt-in with a timeout matching the production calls.

No new dependency was added.

## How to run and test

- Run `npm run dev`. Play at `/`, open `/control.html` for round controls, and add `/overlay.html` as an OBS Browser Source above a capture of the game window.
- Use the simulator or Twitch chat to send `!idea` and `!vote 1`–`!vote 3`; a moderator or broadcaster approves a candidate. The control page also offers AI triage during the pitch window and **Save build and patch notes**.
- `npm test` covers timing, restart recovery, vote slots, triage, saved builds, cross-origin control rejection and safe browser rendering. `LIVE_PATCH_REAL_TRIAGE=1 npx vitest run tests/phase4-real.test.ts` checks the signed-in Codex triage path separately.
- On 28 October 2026, `npm test` passed 35 unit tests and 29 browser tests (four opt-in Codex tests skipped by default). `npm run build` passed and `npm audit --audit-level=high` found zero vulnerabilities. The signed-in triage check passed. A saved build was reopened on port 5190 and loaded Arena Survivor with its three example mutations.

## Exit criteria

- [x] Pitch transitions to a 45-second vote with at most three fixed candidates; one vote per viewer remains enforced — fake-clock unit test and pipeline vote test.
- [x] Moderator approval launches the runner, rejection does not build, and round state survives restart — shared pipeline control callback, round persistence test and existing moderator-permission tests.
- [x] OBS and control pages show round, votes, active patches and redacted runs using plain text — browser test, source review and 1920×1080 visual inspection; the overlay center has alpha 0.
- [x] Local pause, resume and advance controls work, and cross-origin requests cannot invoke them — unit tests and browser POST rejection test.
- [x] Saved build contains selected game content, shipped mutations and credited patch notes — unit test excludes `.env` and unshipped patch; a live snapshot reopened successfully with `npm run dev -- --game`.
- [x] Full unit and browser tests, TypeScript build and dependency audit pass — commands above.

## Deferred

- Phase 2's live Channel Points redemption check still needs a short stream.
- Phase 5: OBS certificate validation, reward refunds, game-state rollback of edits to other entities or earned score, synchronous Git/MCP-list call latency, and repair-variable cleanup. The Phase 3 MCP test's machine-dependent timeout (P3-R3-01) was fixed in this phase.

## Known gaps / risks

- The OBS browser source has not been tested inside OBS itself; the browser check verifies transparency and page rendering. The operator must verify the local HTTPS certificate in OBS before a real stream.
- AI triage is an optional operator action. Its model output may be imperfect; the operator still approves the winning patch. If Codex is unavailable or triage times out, immediate safety and duplicate checks leave the round usable.
- Saved builds are playable from this repository's dev server. They are source snapshots, not standalone static exports.

## Review responses

No Phase 4 review yet.
