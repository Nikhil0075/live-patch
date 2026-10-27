# Phase 3: Codex mutation engine

## Goal

An approved idea becomes a working, tested mutation in the live game without a human writing code. Failed or unsafe output leaves the live game unchanged, and a shipped patch can be rolled back.

## Build

- Run Codex through the TypeScript SDK in a dedicated Git worktree with `workspace-write`, network disabled, and a three-minute timeout.
- Build the prompt from the active manifest's API docs and examples, the idea and author, and the active mutation list. Require one new module in that game's `mutationDir`.
- Gate generated changes by canonical path, file count, file size, the engine's source validator, and additional manifest restrictions.
- Run the manifest's smoke command with the new module and all active mutations. Give Codex one repair turn after a gate or smoke failure.
- On success, commit the patch in the worktree, then atomically publish only the checked module to the live mutation directory. On failure, mark the idea failed without changing the live game.
- Connect approved ideas and rollback requests to the runner. Rollback removes the most recent shipped module and restores its previous effects within five seconds.
- Publish run progress events for the Phase 4 overlay and persist the Codex thread ID, outcome, timing, and mutation identity.

## Exit criteria

- [ ] Ten varied simulator ideas run end to end; at least seven ship working mutations.
- [ ] Malicious requests to read local files or access websites are refused or blocked by the gates.
- [ ] A crashing mutation fails the smoke test and never reaches the live game.
- [ ] Rollback restores the previous game state in under five seconds.
- [ ] The phase report records the median idea-to-shipped time.
- [ ] Switching the runner to another valid game manifest changes its prompt, mutation path, and test command without an engine code change.

Reviewer focus: path and sandbox escape, complete gates, atomic publish, rollback, failure recovery, and prompt precision.
