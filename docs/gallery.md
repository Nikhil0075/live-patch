# Gallery

Titles, notes and yellow rings are added around real frames from the 2 November 2026 stream, the games and the repository.

## 01 — Live Patch

![Live Patch studio and game shown together](media/gallery/01-live-patch.png)

Live Patch turns a Twitch stream into a live game studio: chat designs the game, Codex builds it, and you keep playing.

## 02 — Same game, before and after chat

![Original Arena Survivor beside a saved version with viewer patches](media/gallery/02-before-and-after.png)

One saved build, side by side: the original game, and the version changed by patches pitched in Twitch chat.

## 03 — Viewers pitch from their phones

![Viewer pitch entered on a phone and shown in the stream overlay](media/gallery/03-viewers-pitch.png)

A real viewer pitches a mechanic with !idea or the Pitch channel-points reward, and it appears on the stream overlay.

## 04 — Chat votes, live on the overlay

![Three idea choices and vote bars displayed on the stream overlay](media/gallery/04-chat-votes.png)

The three oldest ideas go on a 45-second ballot. Votes typed in chat move the bars on the overlay.

## 05 — A moderator approves the winner

![Moderator approval in the Go Live dashboard](media/gallery/05-moderator-approves.png)

Nothing builds until a moderator approves the winner, from the Go Live dashboard or with !approve in chat.

## 06 — Codex builds while the game keeps running

![Codex build steps beside live Arena Survivor gameplay](media/gallery/06-codex-builds.png)

Codex writes the patch in its own offline Git worktree. The stream shows each step while the game keeps running.

## 07 — Viewers can bet on whether it ships

![Channel Points prediction on a viewer's Twitch app](media/gallery/07-viewers-bet.png)

The streamer can open a Channel Points prediction, and viewers bet from the Twitch app on whether the patch ships.

## 08 — Shipped, and credited to the viewer

![Patch shipped notice crediting the viewer on stream](media/gallery/08-credited.png)

A shipped patch is credited on stream to the viewer who pitched it, in the toast and the Live Patches list.

## 09 — Chat's ideas stack up

![Fleeing Coins and Bouncing Coins patches running together](media/gallery/09-patches-stack.png)

Patches stack: Fleeing Coins and Bouncing Coins, both pitched in chat, running together in one game.

## 10 — One command takes it back

![Moderator rollback command and confirmation on stream](media/gallery/10-rollback.png)

A moderator types !rollback and the latest patch comes out of the game, with confirmation in chat and on the overlay.

## 11 — A failed build never touches the game

![Sandbox check stops a build while the game continues](media/gallery/11-failed-safely.png)

This stream's first build stopped at the sandbox check. Nothing shipped, the game kept running, and bets were refunded.

## 12 — A platform, not one game

![Library showing Arena Survivor and Lantern Run as separate games](media/gallery/12-platform.png)

Each game is a folder with a manifest. Choose the active game in the Library, and the same pipeline patches it.

## 13 — Lantern Run: a second game, same engine

![Fox carrying a lantern through Lantern Run's twilight forest](media/gallery/13-lantern-run.png)

Lantern Run, a one-button fox runner, is the second game on the same engine, with its own hooks and actions.

## 14 — How it works: one clockwise loop

![Architecture loop from Twitch chat through build gates to the running game](media/gallery/14-architecture.png)

The full loop: Twitch chat, local server, sandboxed Codex build, gates and smoke test, then into the running game.

## 15 — Built with Codex, phase by phase

![Reviewed project phases and repository beside the Live Patch studio](media/gallery/15-built-with-codex.png)

Codex built the engine, both games and the tests in reviewed phases. Clone the repo and try Practice with no accounts.

[Back to the README](../README.md)
