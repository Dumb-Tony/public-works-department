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
- `tests/` — automated scoring, persistence, and work-order state tests

## Validate the rules

Run `npm test` from the project root. There are no runtime dependencies and the playable build still opens directly without a build step.

## Current slice

Choose between three dispatched calls at the same compact intersection:

- **Storm drain flooding:** establish traffic control, locate the buried water service, clear or rush-flush the inlet, verify downstream flow, and avoid creating tomorrow’s blockage.
- **Water main leak:** establish traffic control, locate the break, retrieve a valve key and clamp kit, isolate customer service, fit a permanent or temporary clamp, restore the valve, and pressure-test the repair.
- **Pothole collapse:** establish traffic control, inspect the failed pavement and shallow utilities, retrieve cold patch and compactor, prepare and compact in lifts or dump-and-go, then verify crown and compaction.

All calls include equipment fetching, live traffic, escalating site conditions, cone recovery, return-to-truck closeout, separate Safety/Service/Quality scores, job counts, and persistent civic callbacks. Each shift deterministically rotates through job-specific weather, pressure, pavement, and traffic modifiers. Dispatch previews the risks before you choose; harder conditions award up to 25% hazard pay, but traffic incident costs are never discounted.

The shift report closes the causal loop with a visible **Today → Next Shift** consequence card. A verified repair shows the town remaining in service; rushed work names the exact callback it saves into the next shift.

Build 1.1 replaces the original flat systems-sketch presentation with a cohesive stylized Bellwether diorama: dimensional wet streets, raised curbs, foliage, an illuminated diner, expressive crew animation, detailed fleet and civilian vehicles, weather particles, water reflections, work lights, atmospheric grading, and a modern glass-and-enamel dispatch UI. It remains dependency-free Canvas code so the public prototype still loads instantly.

Successful shifts earn department budget and town trust; incidents and failed calls cost both. Persistent drain, water, and road completions raise crew rank, and the title screen offers a $500 quick-load rack upgrade that improves field movement and reduces time-pressure loss.

## Canonical repository and deployment policy

- The canonical local checkout is `C:\Dev\public-works-department`.
- `main` is the primary branch and the living GDD remains version controlled at `docs/GDD.md`.
- The public GitHub repository is named `public-works-department`.
- The browser prototype is published from `main` through GitHub Pages. The root `index.html` forwards playtesters to `prototype/`, so deployment remains dependency-free and reproducible.
- Secrets, credentials, machine-local settings, generated dependencies, temporary work, and build output must not be committed.
