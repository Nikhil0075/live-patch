# Asset credits

All game art is generated at runtime by `src/art.ts` with Canvas shapes and gradients. All sound and music is synthesized at runtime by `src/audio.ts`.

`cover-generated.png` is original vector art drawn by `assets/generate-cover.mjs` and rasterized locally with the already-installed Playwright browser. Its moon, owl, fox, trees and fireflies are new geometry and were not copied from the concept art. Re-run `node games/lantern-run/assets/generate-cover.mjs` to regenerate it. No third-party assets are bundled.
