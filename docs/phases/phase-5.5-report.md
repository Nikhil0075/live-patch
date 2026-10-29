# Phase 5.5 report

## Built

- Studio design tokens and self-hosted Inter. The font package is included so the interface does not depend on an external font service.
- Separate `/play` window, keyboard pause menu, manifest controls, persistent sound and accessibility settings, and game/mutation pause handling.
- First-visit welcome and Practice quick actions. A manifest-declared, validated Demo patch ships only for a Practice pitch and can be rolled back.

## How to run and test

- `npm run dev` — open the studio and its Play window.
- `npm test` — unit, browser and HTTPS regression checks.
- `npm run build` — TypeScript and Vite build.
- `npm audit --audit-level=high` — dependency audit.

## Exit criteria

See `phase-5.5.md`. Evidence and any remaining operator checks will be recorded here as the phase is built.

## Deferred

- Two-person first-time usability study requires two new human participants.

## Known gaps / risks

- In progress.

## Review responses

Pending review.
