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
- Restart the active shift: use **Restart shift** in the header
- Touch devices: use the on-screen movement pad and WORK / PLACE / R buttons
- Operate a marked water valve: `V` or the on-screen **VALVE** button

The prototype saves town consequences and the best service grade in browser storage. Use the two-step **Reset town history** control on the title screen to clear that state without accidental deletion.

## Project map

- `docs/GDD.md` — living game design document and decision log
- `docs/BUILD_PREP.md` — prioritized backlog, milestones, acceptance criteria, state machines, QA, and next tasks
- `prototype/` — dependency-free Canvas prototype

## Current slice

Respond to a clogged storm drain at a compact intersection. Fetch and place cones, use a utility locator to mark the buried water service, retrieve the drain rake, work around moving traffic, and decide whether to perform a careful repair or rush it. The adjacent water valve is live: operating the wrong valve visibly cuts service to Maple Diner, harms the Service score, can be restored during the call, and becomes a persistent callback if left closed. A complete shift includes flow verification, cone recovery, return-to-truck closeout, separate Safety/Service/Quality scores, and persistent civic consequences.

## Canonical repository and deployment policy

- The canonical local checkout is `C:\Dev\public-works-department`.
- `main` is the primary branch and the living GDD remains version controlled at `docs/GDD.md`.
- The public GitHub repository is named `public-works-department`.
- The browser prototype is published from `main` through GitHub Pages. The root `index.html` forwards playtesters to `prototype/`, so deployment remains dependency-free and reproducible.
- Secrets, credentials, machine-local settings, generated dependencies, temporary work, and build output must not be committed.
