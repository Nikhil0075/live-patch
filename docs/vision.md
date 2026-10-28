# Live Patch vision

The streamer starts with a deliberately plain game. Every few minutes chat pitches a mechanic, votes, and Codex writes it live. By the end of the stream the game has become something nobody planned, and each shipped rule carries a viewer's name.

The base game is a top-down arena survivor. The player moves, enemies chase, coins drop and the score rises. It reads at stream size and has natural hooks for movement, spawns, collisions, pickups, scoring and waves. Its simple beginning makes later changes visible.

## One cycle on stream

1. **Pitch, about 60 seconds.** A viewer sends `!idea <text>` or redeems a Pitch a mechanic reward. Immediate triage rejects explicit unsafe requests and merges exact duplicates. Optional AI triage proposes concise specifications and merge or reject decisions for operator review.
2. **Vote, about 45 seconds.** The three oldest pending ideas appear with live vote bars. Ideas that miss this ballot remain queued; losing candidates retire when the round ends.
3. **Approve.** A moderator or broadcaster selects the winner as the safety valve.
4. **Build, about one to three minutes.** The Codex at work panel shows the approved idea, credited contributors, the mutation file and smoke-test progress while the streamer keeps playing. An optional Twitch Channel Points Prediction lets viewers back Ships or Fails; Twitch settles it from the build result or returns points when canceled.
5. **Ship.** A passing patch changes the game mid-run without reloading. A failed build gets a visible failed result and does not affect the game.
6. **Repeat.** Patches stack and create interactions nobody planned.

The stream layout puts the game in the center, the Codex work panel at right, active author-named patches across the top, and the idea queue and vote bars below. Example mechanics include splitting enemies, periodically flipping gravity, coins that flee, a fire trail, chat speech bubbles over enemies, and enemies that merge when touching.

## Signature moments

After eight to ten patches, show the chaotic game beside its original version. Saved builds have an original-versus-evolved comparison view. Viewers can vote once to roll back a shipped patch; three votes in two minutes allow moderator confirmation, and the local operator retains an immediate rollback control. At stream end, save a playable build with patch notes crediting every contributor. Saved builds are play-only snapshots.

Codex has two roles: building this platform in the development thread, and acting as the live game developer during a stream. The submission video should show both roles within three minutes.

## Platform

Live Patch is an engine plus swappable games. A developer adds a manifest, a documented mutation API, a five-second smoke test and hot reload support. The engine reads the manifest to brief Codex, gate and test output, and reload the game. The engine never imports a specific game's source.

The mutation handle is a thin wrapper around Phaser for the example game. Mods approve patches for the demo; optional auto-approval with instant rollback can come later. Live Codex work is confined to a per-game mutation directory in its own worktree, with no network. Engine gates always apply, and manifests can only add restrictions. Viewer and game text is rendered as plain text.
