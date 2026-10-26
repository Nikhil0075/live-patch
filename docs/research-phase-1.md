# Phase 1 research and decisions

## Submission constraints

The [official Codex x TwitchCon Hackathon page](https://twitchcon-codex.devpost.com/) and its [FAQ](https://twitchcon-codex.devpost.com/resources) require a project that connects to Twitch, a repository with runnable instructions, a public YouTube demo under three minutes showing both the Twitch experience and Codex use, a description, and the Codex session ID for the thread where most work happened. The deadline is November 2, 2026 at 2:00 PM Pacific Time, or November 3 at 3:30 AM IST. Phase 1 is the game foundation; the Twitch connection is explicitly scheduled for Phase 2. Keep building in this Codex thread for the session ID requirement.

## Game and runtime

The [Phaser Scene guide](https://docs.phaser.io/phaser/concepts/scenes) confirms that a scene's `update()` runs each game step, so the arena drives movement, spawn pacing and collision events there. The [Phaser 3.90 scale manager](https://docs.phaser.io/api-documentation/3.90.0/class/scale-scalemanager) supports `FIT` and centering for the stream-sized canvas. We use simple vector entities drawn by one graphics object to keep the base game readable and the mutation surface small.

The [Vite plugin API](https://vite.dev/guide/api-plugin.html) supports extending the development server. The server watches the manifest's mutation directory and sends the complete file list over the manifest's WebSocket endpoint after add, change or removal. Sending complete state lets the client reconcile deletions as well as additions. Recreating each frame on a change tears down its local state and timers.

## Isolation and fault handling

[MDN's iframe sandbox reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) warns against combining `allow-scripts` and `allow-same-origin` for same-origin content. The mutation frame uses `allow-scripts` alone, giving it an opaque origin. [MDN's `connect-src` reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src) lists fetch, XHR, WebSocket and EventSource among the interfaces restricted by `connect-src 'none'`; the frame also has `default-src 'none'`. Mutation source passes a size and forbidden-token gate before entering the frame. The main page accepts only known action types and bounded values. Hook errors remove the frame and show a notice.

These browser controls do not replace Phase 3's process sandbox, path gate and smoke test for AI-written files. Static token filtering is a guardrail, not a JavaScript parser or proof of safety. The production site should keep the development server off public networks until those gates exist.

## Verification

[Playwright's assertions guide](https://playwright.dev/docs/test-assertions) documents `expect.poll`, which we use to wait for five seconds of simulated game time instead of assuming wall time equals game time in headless browsers. The smoke test checks each example module separately, watches browser errors, frame progress, finite game state, module status and fault isolation. A live reload test measures add and remove latency and confirms the page navigation count stays constant.
