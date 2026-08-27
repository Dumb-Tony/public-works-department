# Public Works Department — Build Preparation Package

**Companion to:** `GDD.md`  
**Current target:** Browser build 1.4 → four-call playtest tuning and accessibility pass
**Scope rule:** Do not add a second location before the first call satisfies every P0 acceptance criterion.

## 1. Prioritized prototype backlog

### P0 — prove the game promise

- [x] Standalone page opens without install or build.
- [x] Fixed top-down intersection, rain, runoff, Unit 12, player, and moving traffic.
- [x] Keyboard movement, pause, interaction, carry, and placement inputs.
- [x] Fetch and place three cones one at a time.
- [x] Cone completion visibly slows/shifts traffic.
- [x] Fetch a distinct repair tool from the vehicle.
- [x] Hold to clear the storm drain.
- [x] Explicit rush action trades time for a saved downstream blockage.
- [x] Live service grade, reason text, runoff level, checklist, and end report.
- [x] Persistence survives refresh and affects the next shift.
- [x] Locate and visibly mark a buried water-service crossing before repair.
- [x] Verify flow, recover equipment, return to the truck, and explicitly close the work order.
- [x] Report separate Safety, Service, and Quality scores with a weighted overall grade.
- [ ] Complete a hands-on playtest and tune travel/action times to a 3–6 minute first attempt.
- [ ] Verify every vertical-slice acceptance criterion below in two browsers.

### P1 — make the proof legible and robust

- [x] Add a pulsing spatial objective beacon and route line for the active truck, tool, utility, repair, or cleanup target.
- [ ] Add an optional short first-run control card and contextual input icons.
- [x] Add synthesized prototype audio: rain bed, collision, pickup/place, locate, repair, verification, and completion cues.
- [ ] Replace/expand prototype cues with authored approaching-vehicle, drain-flow, tool-load, and dispatch-radio audio.
- [x] Add a persistent mute control.
- [ ] Add separate critical-cue captions for approaching traffic and infrastructure audio.
- [ ] Add screen-shake and rain-density toggles; default to OS reduced-motion preference.
- [ ] Explain the saved downstream consequence with a simple drain-network diagram between shifts.
- [x] Extract scoring, persistence, and work-order transitions into a browser/Node-compatible rules module; renderer and simulation split remains.
- [ ] Move job parameters into data definitions; support deterministic seed/debug presets.
- [x] Add an in-shift restart option and two-step confirmation for town-history reset.
- [x] Add responsive on-screen movement, work, placement, rush, and pause controls for touch devices.
- [x] Add automated tests for careful/rushed paths, invalid transitions, weighted scoring, score clamping, history migration, callbacks, and best-grade persistence.

### P2 — deepen the same intersection

- [x] Add a buried water service crossing and locator sweep.
- [x] Add an interactable labeled valve box, visible customer outage, recovery, score penalty, and persistent wrong-valve callback.
- [x] Add a selectable “water bubbling through pavement” dispatch using the same intersection, traffic, locator, valve, clamp, verification, and callback systems.
- [x] Add a selectable pothole-collapse dispatch with surface inspection, shallow-utility marking, patch/compactor workflow, durable/rushed outcomes, verification, and callbacks.
- [x] Add a selectable fallen-tree dispatch with wire/tension inspection, chainsaw/winch workflow, controlled/rushed outcomes, overhead verification, and a persistent hanging-limb callback.
- [x] Add deterministic job-specific shift modifiers for rainfall, pressure, road base, traffic, hazard escalation, and service pressure.
- [x] Preview each call's next deterministic condition on dispatch and scale successful payout with visible hazard-pay multipliers.
- [x] Show a causal Today → Next Shift consequence card on every completed shift report, including clean no-callback outcomes.
- [ ] Expand locator clues into a utility-map overlay; wrong-valve service outage is implemented.
- [ ] Add pedestrian route and accessible detour requirements.
- [ ] Add movable truck with parking/compartment-access consequences.
- [x] Add cleanup/reopen phase: verify flow, retrieve cones, and close the order at Unit 12.
- [x] Add Safety, Service, and Quality score breakdown; response time remains in the closeout report.
- [x] Add persistent department budget, town trust, job counts, crew rank, shift payouts/costs, and a purchasable quick-load rack upgrade.

### Deferred to Unity investigation

- 3D character/vehicle physics, multiplayer networking, Steam integration, voice, AI crew, large town streaming, full economy, progression, and procedural district generation.

## 2. Milestone plan and exit gates

### M0 — Design proof (current)

**Outcome:** A person can open the game, finish one drain call, understand why their grade changed, and cause/observe a callback.

Build 0.6 exceeds the original M0 content target with a second water-main call and automated rules coverage; hands-on duration and comprehension gates remain open.

Exit gate:

- All implemented P0 items run without console errors.
- Careful and rushed completion paths both work.
- Saved consequence visibly affects a replay.
- GDD and build-prep package reflect implementation.

### M1 — Validated browser vertical slice

**Target:** 1–2 focused weeks.

Exit gate:

- All acceptance criteria below pass.
- Five fresh players finish without verbal instruction; at least four can explain one causal chain.
- Median first attempt is 3–6 minutes.
- No critical keyboard trap, unreadable essential text, or color-only status.
- Audio and critical captions are present.
- Runtime logic is modularized and job tuning is data-driven.
- At least one automated test covers each job-state transition.

### M2 — Intersection systems testbed

**Target:** 2–4 focused weeks after M1 evidence.

Exit gate:

- Drain and water-main calls reuse the same interaction/tool/state framework.
- Wrong-valve outage propagates to at least one visible customer and can be recovered.
- Seeded modifiers produce at least six valid, meaningfully distinct variants.
- Town save is versioned and migrates one prior schema.
- Performance holds 60 FPS on agreed baseline laptop hardware.

### M3 — Unity solo graybox

**Target:** 6–10 focused weeks after tool/network spike.

Exit gate:

- One 3D intersection and drain call reaches browser feature parity.
- Character, pickup, placement, tool operation, traffic, and one driveable vehicle are stable.
- Rules/state are separate from presentation and use stable asset IDs.
- Controller and keyboard flows are usable.
- Save/load preserves the callback.

### M4 — Two-player network proof

Exit gate:

- Host/join via development lobby; two players can complete the call.
- Cone, tool, vehicle, traffic, scoring, and town result agree on both clients.
- Rejoin after disconnect returns to a safe authoritative state.
- 150 ms simulated latency does not make core tool use fail or duplicate outcomes.
- A playtest demonstrates meaningful division of work rather than duplicate solo labor.

### M5 — Steam demo slice

Exit gate:

- One district, 4–6 polished job families, 2–5 player sessions, solo support, shift/shop loop, progression, save recovery, full options/accessibility baseline, performance target, and Steam lobby/invite flow.

## 3. Vertical-slice acceptance criteria

### Start and controls

- [ ] Opening `prototype/index.html` directly shows a readable dispatch card and recognizable game scene.
- [ ] “Answer the call” starts play and focuses the game.
- [ ] WASD and arrow keys move the worker; diagonal movement is not faster.
- [ ] E, Space, R, and P perform only the actions shown in the interface.
- [ ] Losing window focus pauses the active shift.

### Work order

- [ ] Player must visit Unit 12 and carry each cone to the work zone.
- [ ] A cone outside a striped marker does not count and produces immediate feedback.
- [ ] Three valid cones visibly alter approaching traffic behavior.
- [ ] The rake cannot be taken as the active tool until the work zone is secured.
- [ ] Drain work requires proximity and sustained input.
- [ ] Runoff rises over time and falls during careful clearing.

### Safety and failure

- [ ] Vehicle contact is detectable, visually communicated, and penalizes the grade without graphic harm.
- [ ] Before the taper is established, the work zone is meaningfully more dangerous.
- [ ] Flooding or grade depletion can fail the call.
- [ ] Every major grade loss updates reason text within one frame.

### Persistence and consequence

- [ ] Careful repair closes the call with low callback risk.
- [ ] Rush repair completes faster, costs grade, and records a downstream blockage.
- [ ] Starting the next shift after a rushed repair displays the callback, raises initial runoff, lowers opening grade, and marks the downstream line restricted.
- [ ] A later careful repair clears the stored restriction for subsequent shifts.
- [ ] Reset town history removes saved results and returns first-run state.

### Presentation and accessibility

- [ ] Essential state is available as DOM text, not Canvas color alone.
- [ ] Interface is readable at 1280×720 and 1920×1080.
- [ ] At narrow widths, the game and dispatch panel remain usable without horizontal page scrolling.
- [ ] Keyboard focus is visible.
- [ ] Pause stops the simulation clock, runoff, traffic, and repair progress.
- [ ] Reduced-motion OS setting removes nonessential UI transitions.

## 4. Initial controls specification

| Action | Keyboard | Gamepad target | State/conditions | Result |
|---|---|---|---|---|
| Move | WASD / arrows | Left stick | Playing, not paused | Move worker; normalized diagonal speed |
| Context interact | E | South face button | Near valid source/target | Take next required item or interact |
| Operate tool | Hold E | Hold south face | Correct tool positioned at drain | Increase work progress; reduce runoff |
| Place carried item | Space | West face button | Carrying cone | Validate against nearest open marker |
| Rush repair | R | North face button | At drain with rake | Complete immediately; grade loss + callback |
| Pause | P | Menu | Active shift | Freeze simulation; P resumes |

Input rules:

- A prompt must name every context action before it is accepted.
- Edge-triggered actions use “just pressed”; sustained tool operation uses held state.
- Invalid action never silently mutates job state.
- Unity mapping should use named Input System actions rather than hard-coded keys.
- Final product adds rebinding, hold/toggle, and gamepad glyph detection.

## 5. State-machine specifications

### Game flow

```text
TITLE
  └─ Answer call → PLAYING
PLAYING
  ├─ P / focus lost → PAUSED ── P → PLAYING
  ├─ flood >= 100 or grade <= 0 → ENDED_FAILED
  └─ repair complete → ENDED_COMPLETE
ENDED_*
  └─ Start next shift → TITLE (rehydrate persistent town state)
```

Invariant: state-mutating simulation updates run only in `PLAYING` while not paused.

### Work order

```text
SECURE_ZONE
  ├─ at truck + E → carrying cone
  ├─ carrying cone + Space near open marker → cone placed
  └─ placed cones == 3 → FETCH_TOOL
FETCH_TOOL
  └─ at truck + E → carrying rake; CLEAR_DRAIN
CLEAR_DRAIN
  ├─ at drain + hold E → careful progress; at 100 → COMPLETE_CAREFUL
  └─ at drain + R → COMPLETE_RUSHED
```

Invariants:

- Only one carried item at a time.
- A cone marker accepts at most one cone.
- `FETCH_TOOL` cannot occur before all three cones are valid.
- Rush path is only available with the rake at the drain.
- Completion commits exactly one persistent outcome.

### Carryable item

```text
STORED → CARRIED → PLACED
           └──────→ OPERATING (tools only)
```

Future extension adds `DROPPED`, `PASSED`, `LOADED`, `DAMAGED`. Every carryable has one authority/owner in multiplayer.

### Traffic vehicle

```text
CRUISE → APPROACH_ZONE
APPROACH_ZONE + taper active → SLOW_AND_SHIFT → CRUISE
APPROACH_ZONE + obstruction/player → CONTACT or NEAR_MISS → CRUISE
```

Prototype traffic is lane-loop logic, not pathfinding. Unity traffic should consume road-graph closures and local work-zone modifiers.

### Persistent consequence

```text
CLEAR
  └─ rush repair → DOWNSTREAM_RESTRICTED
DOWNSTREAM_RESTRICTED
  ├─ next shift: +initial runoff, -opening grade, callback message
  └─ careful completion → CLEAR
```

## 6. Suggested folder and module structure

### Current, intentionally small

```text
public-works-department/
├─ README.md
├─ docs/
│  ├─ GDD.md
│  └─ BUILD_PREP.md
└─ prototype/
   ├─ index.html
   ├─ styles.css
   └─ app.js
```

### Split when M1 work begins

```text
prototype/
├─ index.html
├─ styles/
│  └─ game.css
├─ js/
│  ├─ main.js               # lifecycle and animation loop
│  ├─ config.js             # tuning constants and feature flags
│  ├─ input.js              # named actions, held/pressed state
│  ├─ renderer.js           # Canvas presentation only
│  ├─ ui.js                 # DOM readouts and overlays
│  ├─ storage.js            # versioned local persistence/migrations
│  ├─ state/
│  │  ├─ create-state.js
│  │  ├─ job-reducer.js
│  │  └─ consequence-reducer.js
│  ├─ systems/
│  │  ├─ player-system.js
│  │  ├─ traffic-system.js
│  │  ├─ drainage-system.js
│  │  ├─ interaction-system.js
│  │  └─ scoring-system.js
│  └─ data/
│     ├─ jobs.js
│     ├─ tools.js
│     └─ intersection.js
└─ tests/
   ├─ job-state.test.html
   └─ persistence.test.html
```

Keep rules independent of Canvas and DOM. Systems accept state + input + delta and emit events. The renderer never decides outcomes.

### Unity target sketch

```text
Assets/PublicWorks/
├─ Core/                   # pure C# state, events, save versioning
├─ Definitions/            # ScriptableObjects + IDs
├─ Interaction/            # carry/position/operate framework
├─ Systems/                # traffic, drainage, water, scoring
├─ Networking/             # authority, replication, reconnect
├─ Vehicles/
├─ Jobs/
├─ World/Bellwether/
├─ UI/
├─ Audio/
├─ Art/
└─ Tests/EditMode, PlayMode
```

## 7. Test and QA checklist

### Smoke test

- [ ] Load from a clean browser profile; no console error.
- [ ] Start, pause/resume, complete careful path, start next shift.
- [ ] Complete rushed path, refresh page, confirm callback state.
- [ ] Reset history and confirm clean state.
- [ ] Fail once by flooding; restart successfully.

### Interaction edge cases

- [ ] Press actions from too far away; state does not advance.
- [ ] Place cone away from all markers; it remains carried and penalty happens once per press.
- [ ] Place markers in reverse order.
- [ ] Hold E at truck; only one item is taken per press.
- [ ] Press R away from drain or before rake; no effect.
- [ ] Hold E at drain, walk away, return; progress behavior matches decision (currently preserves progress).
- [ ] Pause during tool operation and verify no progress.
- [ ] Collide with overlapping traffic; cooldown prevents repeated frame-by-frame penalties.

### Persistence

- [ ] Corrupt storage JSON manually; prototype falls back safely.
- [ ] Block storage; current shift remains playable.
- [ ] Complete multiple rushed/careful cycles; `shifts` increments once per result.
- [ ] Verify best-grade update logic for A through F.
- [ ] Introduce future schema version and test migration before M2.

### Layout/input matrix

- [ ] Chromium current, Firefox current, Safari current before external release.
- [ ] 1280×720, 1366×768, 1920×1080.
- [ ] 200% browser zoom.
- [ ] Keyboard-only navigation and visible focus.
- [ ] OS reduced motion.
- [ ] Low-power integrated graphics baseline.

### Playtest questions

Ask after play without leading:

1. What was the job and what made it urgent?
2. What did the cones change?
3. Why did your grade rise/fall?
4. What did the rush choice do?
5. What would you expect on the next call?
6. Where were you confused or waiting?
7. What was your funniest moment, and what systems caused it?

Success: four of five fresh players accurately answer questions 1, 2, 4, and 5.

## 8. Initial tuning targets

| Variable | Prototype 0.1 | Target experience |
|---|---:|---|
| Worker speed | 168 px/s | Truck-to-zone trip feels costly but not tedious |
| Required cones | 3 | Teaches repeated fetching and taper |
| Careful repair time | ~4.35 s held | Long enough to feel exposed, short enough for first slice |
| Initial runoff | 18%; 34% on callback | Consequence visible immediately |
| Traffic collision grade cost | 12 | Serious but recoverable |
| Rush grade cost | 8 + callback | Tempting under pressure |
| Failure runoff | 100% | Allows mistakes without long unwinnable tail |

Tune with playtest observation, not preference. Record changed values and reason in the GDD decision log when they alter intended behavior.

## 9. Explicit next implementation tasks

Take these in order:

1. **Manual two-path validation:** play careful and rushed runs; verify callback after refresh, pause behavior, and failure. Fix blockers only.
2. **Tune first-attempt duration:** time three clean runs and one novice run; adjust worker speed/runoff/traffic so novice median lands at 3–6 minutes without idle waiting.
3. **Add audio/captions:** source or create compact original effects; implement mute and textual critical cues.
4. **Modularize before expanding:** split input, state transitions, traffic, persistence, renderer, and UI as proposed. Preserve zero-build direct opening.
5. **Add deterministic test hooks:** seed traffic positions and expose a debug scenario selector behind a URL query.
6. **Automate reducers/state tests:** careful, rushed, flood failure, invalid placement, collision cooldown, and persistence rehydrate.
7. **Run five-person comprehension test:** capture completion time, incident count, rush choice, causal explanations, and confusion points.
8. **Decide M2 gate:** only after acceptance criteria pass, add the buried water-service/valve call on the same intersection.

Do not begin Unity production before the browser slice has demonstrated that cone placement, diagnosis/repair, grading, and persistence create an understandable story. A short Unity spike for networked carry/placement is valid after M1; content production is not.
