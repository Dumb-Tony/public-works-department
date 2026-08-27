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

Choose between five dispatched calls at the same compact intersection:

- **Storm drain flooding:** establish traffic control, locate the buried water service, clear or rush-flush the inlet, verify downstream flow, and avoid creating tomorrow’s blockage.
- **Water main leak:** establish traffic control, locate the break, retrieve a valve key and clamp kit, isolate customer service, fit a permanent or temporary clamp, restore the valve, and pressure-test the repair.
- **Pothole collapse:** establish traffic control, inspect the failed pavement and shallow utilities, retrieve cold patch and compactor, prepare and compact in lifts or dump-and-go, then verify crown and compaction.
- **Fallen tree & wire:** establish an upper-lane taper, test and isolate the streetlight wire, mark trunk tension, retrieve chainsaw and winch, section the crown under control or yank-and-drag, then verify overhead and lane clearance.
- **Traffic signal fault:** protect the controller cabinet, meter the live feed, identify the failed phase relay, retrieve an insulated relay kit, replace the relay or install a risky bypass, then observe a complete red-yellow-green cycle.

All calls include equipment fetching, live traffic, escalating site conditions, cone recovery, return-to-truck closeout, separate Safety/Service/Quality scores, job counts, and persistent civic callbacks. Each shift deterministically rotates through job-specific weather, pressure, pavement, and traffic modifiers. Dispatch previews the risks before you choose; harder conditions award up to 25% hazard pay, but traffic incident costs are never discounted.

The shift report closes the causal loop with a visible **Today → Next Shift** consequence card. A verified repair shows the town remaining in service; rushed work names the exact callback it saves into the next shift.

Build 1.1 replaces the original flat systems-sketch presentation with a cohesive stylized Bellwether diorama: dimensional wet streets, raised curbs, foliage, an illuminated diner, expressive crew animation, detailed fleet and civilian vehicles, weather particles, water reflections, work lights, atmospheric grading, and a modern glass-and-enamel dispatch UI. It remains dependency-free Canvas code so the public prototype still loads instantly.

Build 1.2 makes traffic control physically meaningful. Each job has a deliberate, sequential three-cone taper on the affected lane. Completing it creates a visible merge path: approaching cars slow, smoothly change lanes around the signed work area, then merge back. Crew members inside the properly protected work zone cannot be struck by the diverted traffic; stepping outside it remains dangerous.

Build 1.3 closes the remaining setup gap: the first placed cone activates avoidance immediately, so vehicles never drive through a deployed cone while the rest of the taper is being assembled. Cone layouts and routing share one tested data source, with at least 30 Canvas units of vehicle/cone clearance. A deterministic `?qaTraffic=drain`, `water`, or `pothole` runtime scenario exposes pass, collision, safety, and minimum-clearance telemetry for repeatable browser playtesting; `&qaCones=1` or `2` validates incomplete setup states.

Build 1.4 adds the fallen-tree dispatch as a fourth complete systemic call. The tree and live-looking overhead wire are visible physical hazards; controlled cutting progressively removes the crown and moves logs to the shoulder. Rushing creates a saved hanging-limb callback that weakens the next tree shift. The traffic QA scenario now also accepts `?qaTraffic=tree`.

Build 1.5 adds electrical infrastructure through a fifth traffic-signal dispatch. Two dimensional signal heads visibly flash red while the controller is faulted and resume a full animated cycle after repair. A careful relay replacement requires cycle verification; the controller-bypass shortcut reopens sooner but persists an intermittent-signal callback. Traffic QA now accepts `?qaTraffic=signal`.

Successful shifts earn department budget and town trust; incidents and failed calls cost both. Persistent drain, water, road, tree, and signal completions raise crew rank, and the title screen offers a $500 quick-load rack upgrade that improves field movement and reduces time-pressure loss.

## Canonical repository and deployment policy

- The canonical local checkout is `C:\Dev\public-works-department`.
- `main` is the primary branch and the living GDD remains version controlled at `docs/GDD.md`.
- The public GitHub repository is named `public-works-department`.
- The browser prototype is published from `main` through GitHub Pages. The root `index.html` forwards playtesters to `prototype/`, so deployment remains dependency-free and reproducible.
- Secrets, credentials, machine-local settings, generated dependencies, temporary work, and build output must not be committed.
