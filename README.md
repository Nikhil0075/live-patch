# Live Patch

Live Patch is a browser arena game that gains new rules from small JavaScript mutation modules while play continues. Phase 1 provides the game and isolated mutation loader. Phase 2 adds Twitch chat, custom reward input, bot replies, an idea store and a local chat simulator. Phase 3 turns approved ideas into gated, smoke-tested Codex mutations.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npx playwright install chromium
npm run dev
```

Open https://localhost:5173. The development server uses a self-signed local certificate, so your browser may ask you to proceed past a certificate warning once. Move with WASD or arrow keys, use Space to attack, collect coins and watch the active patches at right. Add, edit or delete a `.js` file in `games/arena-survivor/mutations/` while the game runs; its module updates without page navigation.

Open https://localhost:5173/simulator.html to try chat commands or reward redemptions without Twitch. The simulator sends typed events to the same command pipeline as EventSub. Ideas and rollback requests persist in `.live-patch/ideas.json`; runner results in `.live-patch/runs.json`; OAuth tokens in `.live-patch/tokens.json`. These files are ignored by Git and denied by the development server. Viewer text is rendered with `textContent` in the simulator and Phaser text in the game.

```sh
npm test
npm run smoke -- --mutation 01-quick-feet.js
npm run build
npm run dev -- --game games/arena-survivor
```

`npm test` runs manifest, pipeline, runner and boundary checks plus five second browser smoke checks, fault isolation, live reload and simulator integration. `npm run smoke` focuses on one mutation. Both commands copy the game to a temporary folder and use free ports, so they work while `npm run dev` is still running and never put test mutations into the live game. Set `LIVE_PATCH_GAME=path/to/game` to test another game. The `--game` path starts another game folder with a valid manifest; `package.json` → `livePatch.defaultGame` selects the default folder. `npm run build` checks TypeScript and bundles the browser client.

## Build and roll back a live patch

Sign in to the local Codex CLI with ChatGPT before running the server; the runner uses the [Codex TypeScript SDK](https://learn.chatgpt.com/docs/codex-sdk) and that local sign-in. In the simulator, submit `!idea <text>`, switch to Moderator or Broadcaster, then send `!approve 1`. The idea moves to `building`; the Codex runs list and `GET /api/runs` show its thread ID, result and time. A passing mutation appears in the live game without a page reload. Send `!rollback` as a moderator or broadcaster to remove the most recently shipped patch. The Phase 4 overlay will consume the `live-patch:runner` progress event.

Each run has a dedicated Git worktree and branch. Builder `AGENTS.md` files and project `.codex` settings are removed from that worktree before Codex starts. The SDK pins `workspace-write`, the native Windows elevated sandbox, no extra writable roots, no tool network access, no shell tool, no apps or plugins, disabled web search and no approvals. The runner enumerates configured MCP servers, disables all of them for the Codex thread, and verifies the effective list before starting. A startup probe must confirm that the sandbox can write inside its worktree and cannot write in the main repository. The runner passes a restricted environment without Twitch credentials. It accepts exactly one new file in the active manifest's mutation folder, applies engine and manifest source gates, runs the manifest smoke command with the candidate and all active patches, and publishes only after a pass. One repair turn is allowed; the whole run times out after three minutes. Failed runs' branches are removed; shipped branches remain for rollback. `runs.json` keeps branch and commit details locally, while `/api/runs` exposes only a redacted summary. Do not put secrets in a game manifest or mutation API document because Codex reads those as its coding brief.

`!rollback` interrupts an in-progress build and removes the latest shipped module without waiting for the build queue. Any approvals already queued before rollback are cancelled. A restart marks interrupted builds failed, removes any half-published candidate and cleans their worktrees. Rollback removes a module's owned entities, drawings, messages and parameter writes; it does not reverse edits that module made to another module's entities or erase score already earned.

## Connect a Twitch test channel

1. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps), register a **Confidential** application. Add the exact OAuth redirect URL `https://localhost:5173/api/twitch/auth/callback`. Keep the app's client secret private. The OAuth redirect registered with Twitch must exactly match the URL sent by this app; `localhost` and `127.0.0.1` are different hosts. After changing the registration, begin a new connection from the HTTPS simulator rather than retrying an old Twitch authorization page.
2. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. If the development port changes, update both `TWITCH_REDIRECT_URI` and the redirect registered with Twitch. Restart `npm run dev` after any `.env` change; the running process keeps its previous environment values. On Windows, make sure the file is named `.env`, not `.env.txt`. Never commit either file or `.live-patch/`.
3. Start `npm run dev` and open the simulator page. Click **Connect broadcaster**, sign in with the channel owner and authorize `channel:read:redemptions`. Then click **Connect bot**, choose a **different** account and authorize `user:read:chat` and `user:write:chat`. Twitch will show its authorization screen each time. The page shows the account names and EventSub state. The broadcaster connection is used for reward events; the bot connection reads chat and sends replies.
4. After Twitch enables Channel Points for the channel, create a custom reward such as “Pitch a mechanic” and turn on **Require Viewer to Enter Text**. Open `https://localhost:5173/api/twitch/rewards` to find its ID and confirm `requiresInput: true`, set `TWITCH_PITCH_REWARD_ID` in `.env`, then restart the development server. Twitch requires separate EventSub WebSocket sessions for the bot's chat subscription and broadcaster's reward subscription. Chat stays connected if the reward subscription fails, and the simulator reports the reward failure. **Reward refunds are not implemented yet:** a rejected redemption can still spend points, so do not enable a paid reward for viewers until Phase 5 resolves reward ownership and cancellation.
5. From a second account, send `!idea <text>` in the channel, or redeem the configured custom reward. Check the simulator idea list or `GET /api/ideas`; a new idea should appear promptly. Send `!vote 1` to vote for the newest pending idea. A moderator or the broadcaster can send `!approve 1`, `!reject 1`, or `!rollback`. Phase 3 builds approved ideas and executes rollback.

Idea text is limited to 200 characters and each viewer can submit one idea every three minutes across chat and reward input. The latest three pending ideas are numbered 1–3 for voting and moderation. Denied mod commands do not trigger bot replies; other error replies are limited to one per viewer every 30 seconds. EventSub reconnects and resubscribes after a dropped connection. Twitch may redeliver a notification, so message IDs are deduplicated. Tokens are validated at startup and hourly, transient validation failures retry, and a refreshed access and refresh token pair is stored locally. Rejected EventSub subscriptions stop retrying until the app restarts with new configuration or an account is reauthorized; temporary failures continue retrying. The simulator can be disabled with `LIVE_PATCH_SIMULATOR_ENABLED=0`.

The simulator shows a Twitch chat delivery warning if Twitch accepts a Send Chat Message API request but reports that the bot's message was dropped. EventSub can remain connected while bot replies fail, so check this warning during the real-channel test.

Scopes are limited to `channel:read:redemptions` for the broadcaster and `user:read:chat` plus `user:write:chat` for the bot. See Twitch's [EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/), [Send Chat Message API](https://dev.twitch.tv/docs/api/reference/#send-chat-message), [OAuth code grant](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), and [token validation guidance](https://dev.twitch.tv/docs/authentication/validate-tokens/). No Twitch credentials are needed for the simulator or automated tests.

## Add a game or mutation

Read [the game contract](docs/adding-a-game.md) and [the Arena Survivor mutation API](games/arena-survivor/docs/mutation-api.md). Each mutation exports metadata and optional hooks. The loader rejects files over 120 lines or 12,000 bytes and direct use of forbidden APIs. It runs accepted modules in dedicated Workers inside sandboxed, opaque-origin frames with a restrictive Content Security Policy. Load and hook deadlines stop loops without freezing the game. Each module can only request bounded game actions; failures disable that module and leave the game running.

## Research used for Phase 1

- [Phaser Scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes) establishes the scene update loop used by the game.
- [Vite plugin API](https://vite.dev/guide/api-plugin.html) supports watching mutation files from the development server.
- [MDN iframe sandbox guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) explains why the mutation frame uses `allow-scripts` without `allow-same-origin`.
- [Playwright web server and browser setup](https://playwright.dev/docs/test-webserver) informs the browser smoke test setup.

The browser frame is one layer of isolation for the local app. The Phase 3 runner adds a worktree, SDK sandbox settings, path and source gates, and a browser smoke test before publishing generated modules.
