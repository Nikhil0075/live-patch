# Live Patch

Live Patch is a browser arena game that gains new rules from small JavaScript mutation modules while play continues. Phase 1 provides the game and isolated mutation loader. Phase 2 adds Twitch chat, custom reward input, bot replies, an idea store and a local chat simulator. The live Codex runner is Phase 3.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:5173. Move with WASD or arrow keys, use Space to attack, collect coins and watch the active patches at right. Add, edit or delete a `.js` file in `games/arena-survivor/mutations/` while the game runs; its module updates without page navigation.

Open http://127.0.0.1:5173/simulator.html to try chat commands or reward redemptions without Twitch. The simulator sends typed events to the same command pipeline as EventSub. Ideas and rollback requests persist in `.live-patch/ideas.json`; OAuth tokens persist in `.live-patch/tokens.json`. Both are ignored by Git. Viewer text is rendered with `textContent` in the simulator and Phaser text in the game.

```sh
npm test
npm run smoke -- --mutation 01-quick-feet.js
npm run build
npm run dev -- --game games/arena-survivor
```

`npm test` runs manifest, pipeline and boundary checks plus five second browser smoke checks, fault isolation, live reload and simulator integration. `npm run smoke` focuses on one mutation. Both commands copy the game to a temporary folder and use free ports, so they work while `npm run dev` is still running and never put test mutations into the live game. Set `LIVE_PATCH_GAME=path/to/game` to test another game. The `--game` path starts another game folder with a valid manifest; `package.json` → `livePatch.defaultGame` selects the default folder. `npm run build` checks TypeScript and bundles the browser client.

## Connect a Twitch test channel

1. In the [Twitch Developer Console](https://dev.twitch.tv/console/apps), register a **Confidential** application. Add the exact OAuth redirect URL `http://localhost:5173/api/twitch/auth/callback`. Twitch's [OAuth guide](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/) uses HTTP with literal `localhost`; its [developer forum](https://discuss.dev.twitch.com/t/unable-to-add-oauth-redirect-url/37152) clarifies that other HTTP hosts are rejected. Keep the app's client secret private. If the console still shows an HTTPS error, check for an extra empty redirect field before saving.
2. Copy `.env.example` to `.env`. Set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. If the development port changes, update both `TWITCH_REDIRECT_URI` and the redirect registered with Twitch. Restart `npm run dev` after any `.env` change; the running process keeps its previous environment values. On Windows, make sure the file is named `.env`, not `.env.txt`. Never commit either file or `.live-patch/`.
3. Start `npm run dev` and open the simulator page. Click **Connect broadcaster**, sign in with the channel owner and authorize `channel:read:redemptions`. Then click **Connect bot**, sign in with a **different** account and authorize `user:read:chat` and `user:write:chat`. The page shows the account names and EventSub state. The broadcaster connection is used for reward events; the bot connection reads chat and sends replies.
4. In Twitch, create a custom channel-points reward that requires viewer text, such as “Pitch a mechanic.” Open `http://localhost:5173/api/twitch/rewards` to find its ID, set `TWITCH_PITCH_REWARD_ID` in `.env`, then restart the development server. Twitch's custom reward API is available to eligible Affiliate and Partner channels.
5. From a second account, send `!idea <text>` in the channel, or redeem the configured custom reward. Check the simulator idea list or `GET /api/ideas`; a new idea should appear promptly. Send `!vote 1` to vote for the newest pending idea. A moderator or the broadcaster can send `!approve 1`, `!reject 1`, or `!rollback`. Rollback is recorded now and executed by the Phase 3 runner.

Idea text is limited to 200 characters and each viewer can submit one idea every three minutes across chat and reward input. The latest three pending ideas are numbered 1–3 for voting and moderation. EventSub reconnects and resubscribes after a dropped connection. Twitch may redeliver a notification, so message IDs are deduplicated. Tokens are validated at startup and hourly, and a refreshed access and refresh token pair is stored locally. The simulator can be disabled with `LIVE_PATCH_SIMULATOR_ENABLED=0`.

Scopes are limited to `channel:read:redemptions` for the broadcaster and `user:read:chat` plus `user:write:chat` for the bot. See Twitch's [EventSub subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/), [Send Chat Message API](https://dev.twitch.tv/docs/api/reference/#send-chat-message), [OAuth code grant](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/), and [token validation guidance](https://dev.twitch.tv/docs/authentication/validate-tokens/). No Twitch credentials are needed for the simulator or automated tests.

## Add a game or mutation

Read [the game contract](docs/adding-a-game.md) and [the Arena Survivor mutation API](games/arena-survivor/docs/mutation-api.md). Each mutation exports metadata and optional hooks. The loader rejects files over 120 lines or 12,000 bytes and direct use of forbidden APIs. It runs accepted modules in dedicated Workers inside sandboxed, opaque-origin frames with a restrictive Content Security Policy. Load and hook deadlines stop loops without freezing the game. Each module can only request bounded game actions; failures disable that module and leave the game running.

## Research used for Phase 1

- [Phaser Scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes) establishes the scene update loop used by the game.
- [Vite plugin API](https://vite.dev/guide/api-plugin.html) supports watching mutation files from the development server.
- [MDN iframe sandbox guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) explains why the mutation frame uses `allow-scripts` without `allow-same-origin`.
- [Playwright web server and browser setup](https://playwright.dev/docs/test-webserver) informs the browser smoke test setup.

The browser frame is one layer of isolation for the local Phase 1 app. Phase 3 must additionally isolate the code-writing process and apply filesystem and test gates before any generated module is accepted.
