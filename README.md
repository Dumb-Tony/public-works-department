# Public Works Department

A living design package and standalone browser vertical slice for a systemic municipal co-op game.

## Play online

**[Play the latest browser build](https://dumb-tony.github.io/public-works-department/)**

## Play the prototype

Open `prototype/index.html` in a modern browser. No install, server, or build step is required.

- Move: `WASD` or arrow keys
- Interact / hold to work: `E`
- Place a carried cone: `Space`
- Rush the repair: `R` (fast, but creates a persistent civic consequence)
- Pause: `P`

The prototype saves town consequences and the best service grade in browser storage. Use **Reset town history** on the title screen to clear that state.

## Project map

- `docs/GDD.md` — living game design document and decision log
- `docs/BUILD_PREP.md` — prioritized backlog, milestones, acceptance criteria, state machines, QA, and next tasks
- `prototype/` — dependency-free Canvas prototype

## Current slice

Respond to a clogged storm drain at a compact intersection. Fetch and place cones, use a utility locator to mark the buried water service, retrieve the drain rake, work around moving traffic, and decide whether to perform a careful repair or rush it. A complete shift now includes flow verification, cone recovery, return-to-truck closeout, separate Safety/Service/Quality scores, and a persistent callback that affects the next shift.

## Canonical repository and deployment policy

- The canonical local checkout is `C:\Dev\public-works-department`.
- `main` is the primary branch and the living GDD remains version controlled at `docs/GDD.md`.
- The public GitHub repository is named `public-works-department`.
- The browser prototype is published from `main` through GitHub Pages. The root `index.html` forwards playtesters to `prototype/`, so deployment remains dependency-free and reproducible.
- Secrets, credentials, machine-local settings, generated dependencies, temporary work, and build output must not be committed.
