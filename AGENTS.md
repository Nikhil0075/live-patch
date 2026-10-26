# AGENTS.md — Live Patch

Standing instructions for building this repository. Read this file at the start of every phase and every fix round.

## The project

**Live Patch** is a Twitch experience where chat co-designs a game live. The streamer plays a deliberately plain browser game. Viewers pitch new mechanics in chat, vote, a mod approves, and an AI coding agent (Codex, running headless) writes the change as a small module. The game hot-reloads on screen while the streamer keeps playing. By the end of a stream the game has evolved into something nobody planned, and patch notes credit every viewer whose idea shipped.

It is built as a **platform**: a game-agnostic engine plus swappable games. Any developer can plug in a browser game by adding a manifest (`live-patch.json`).

Full product description: `docs/vision.md`. Current structure: `docs/architecture.md`.

## Roles

- **You** build everything: code, tests, docs, phase reports, and fixes for review findings.
- **The operator** (the human running this project) starts each phase, supplies review findings in `reviews/`, runs manual checks, and decides when a phase is done. Only the operator tags `phase-N-done`.

## Repository layout

```
AGENTS.md
docs/
  vision.md
  architecture.md          # keep current whenever structure changes
  adding-a-game.md         # manifest reference + mutation-API checklist
  phases/
    phase-N.md             # spec and exit criteria for each phase
    phase-N-report.md      # written by you at the end of every build or fix round
reviews/
  phase-N-round-M.md       # review findings supplied by the operator (read-only for you)
engine/                    # game-agnostic; NEVER imports from games/
  twitch/                  # OAuth, EventSub, chat commands, chat simulator
  pipeline/                # idea triage, voting, approval, idea store
  runner/                  # Codex SDK runner, gates, playtest, rollback
  overlay/                 # OBS browser sources, control panel, patch notes
  manifest/                # manifest schema + loader
games/
  arena-survivor/
    live-patch.json        # the manifest
    docs/mutation-api.md
    mutations/             # the ONLY folder live-Codex may write to for this game
    tests/smoke/
builds/                    # saved per-stream builds + patch notes
```

## Stack and commands

- Node.js 20+, TypeScript (strict mode), Phaser for the game, Playwright for headless smoke tests, `@openai/codex-sdk` for the live runner.
- Keep these scripts working at all times and list any new ones in the README:
  - `npm run dev` — start the engine, the active game, overlays and the chat simulator
  - `npm test` — all unit tests plus the smoke tests
  - `npm run smoke -- --mutation <file>` — playtest one mutation for 5 seconds
  - `npm run setup` — first-time setup (added in Phase 5)

## Architecture rules (non-negotiable)

1. **Engine/game boundary.** Nothing in `engine/` imports from `games/`. The engine learns everything about a game (mutation folder, API docs, examples, test command, reload method, forbidden tokens) only from its `live-patch.json`. No hard-coded game paths in the engine.
2. **Mutation API.** A mutation is one module in the game's `mutationDir` exporting metadata (`id`, `title`, `author`, `description`) and hooks (`onStart`, `onTick`, `onSpawn`, `onHit`, `onCollide`, `onScore`, …). Modules receive a narrow `game` handle (spawn, set parameter, draw shape, show message). They never touch the DOM, network, storage, globals or timers outside the handle.
3. **Fault isolation.** A mutation that throws is disabled with an on-screen notice; the game keeps running.
4. **Live runner limits.** At runtime, Codex may write only inside the active game's `mutationDir`, in its own git worktree, with sandbox `workspace-write` and no network. The engine's gates (allowed paths, forbidden tokens, file-size limit) always apply on top of the manifest's rules. A manifest may add restrictions, never remove them.
5. **Nothing half-applied.** A patch either passes every gate and the smoke test and ships, or it is rejected and leaves no trace in the live game.

## Security rules

- Never commit secrets. Use `.env` and keep `.env.example` up to date with every variable name.
- **Viewer text and game text are never rendered as HTML.** Use `textContent` or an equivalent everywhere in overlays and the control panel. Treat this as a hard bug, not a style issue.
- Mod-only commands (`!approve`, `!reject`, `!rollback`) must check that the sender is a moderator or the broadcaster.
- Request only the Twitch OAuth scopes you need, and document each one in the README.

## How a phase works

1. The operator says which phase to start. Read this file, `docs/vision.md`, `docs/architecture.md` and `docs/phases/phase-N.md`.
2. **Reply with a short plan first:** the files you will create or change, and how you will verify each exit criterion. Wait for the operator's OK.
3. Implement the phase. Stay inside its scope; anything out of scope goes under "Deferred" in the report.
4. Write or extend tests for every exit criterion that can be automated.
5. Run the full test suite. It must pass before you finish.
6. Update `docs/architecture.md` if the structure changed.
7. Commit with the message `phase N: <summary>`.
8. Write `docs/phases/phase-N-report.md` using the format below.

### Phase report format

```markdown
# Phase N report

## Built
- ...

## How to run and test
- ...

## Exit criteria
- [x] Criterion — evidence (test name, command output, or manual step)
- [ ] Criterion — why not yet

## Deferred
- ...

## Known gaps / risks
- ...

## Review responses
(filled in during fix rounds)
```

## Fix rounds

When the operator points you to `reviews/phase-N-round-M.md`:

- Fix every **Blocker** and **Major**. Fix **Minor** items only if trivial; otherwise leave them for Phase 5. Ignore **Nits** under time pressure.
- For each finding ID (e.g. `P2-R1-03`), add one line under "Review responses" in the phase report: **Fixed** (what changed) / **Won't fix** (why) / **Deferred** (to which phase).
- If you disagree with a finding, say so with evidence. Do not comply blindly, and do not silently skip a finding.
- Do not undo anything listed in the review as working well.
- Run the full test suite, then commit `phase N: fixes for round M`.

## Code conventions

- Small modules with one job each; explicit types at module boundaries.
- Prefer clear names over comments; comment only the non-obvious *why*.
- Every bug fix comes with a test that would have caught it.
- No new dependency without a one-line reason in the phase report.
- Log with context (idea ID, run ID, Codex thread ID) so a live failure can be traced from the logs alone.

## Definition of done for any task

Tests pass, the app starts with `npm run dev`, docs match the code, no secrets in the diff, and the phase report is updated.