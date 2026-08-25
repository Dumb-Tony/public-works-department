# Public Works Department — Living Game Design Document

**Document status:** Living draft 0.1  
**Prototype status:** First browser loop implemented  
**Last updated:** 2026-08-25  
**Design owner:** Project team  

> Change rule: when implementation contradicts this document, update the decision log and the affected section in the same change. Unresolved ideas belong under Open Questions, not inside committed scope.

## 1. High concept

### Premise

*Public Works Department* is a systemic 2–5 player co-op game about an underfunded municipal crew keeping the persistent small town of Bellwether functioning. Players drive battered fleet vehicles, establish work zones, diagnose infrastructure, operate physical tools, and make repairs under traffic, weather, and time pressure. Every shortcut is tempting. Every shortcut may become another dispatch call.

The comedy comes from understandable systems colliding: a poorly placed cone redirects a sedan into the asphalt delivery; the rushed trench crosses an unmarked cable; closing the wrong valve depressurizes the diner during lunch; leaves ignored on Monday turn Wednesday's storm into a downtown lake. The game never needs to announce a joke. Players author the story by trying to do ordinary work together.

### Player fantasy

“We are the exhausted, weirdly competent crew who can save this town with one truck, the wrong wrench, and a plan that changes every thirty seconds.”

Players should feel:

- useful because the town visibly depends on their work;
- mechanically engaged by tools, vehicles, materials, and physical spaces;
- clever when diagnosis and coordination prevent a cascade;
- responsible when a rushed choice creates a later callback;
- amused by legible, recoverable mistakes rather than random punishment.

## 2. Audience and session shape

### Target audience

- Co-op players who enjoy *Overcooked*, *Moving Out*, *PlateUp!*, *Lethal Company*, and systemic simulation games.
- Players interested in vehicles, trades, construction, civic systems, or “job game” authenticity without requiring expert knowledge.
- Friend groups that want funny 20–45 minute sessions with meaningful continuity.
- Solo players who value planning, optimization, and town progression.

Target rating is broadly teen-friendly. The tone is warm, dry, and civic-minded. Injuries are slapstick and non-graphic; residents are inconvenienced, not treated as disposable targets.

### Session shape

The long-term game uses a shift structure:

1. **Morning board (2–4 min):** review weather, callbacks, service complaints, crew, fleet condition, and available jobs.
2. **Field shift (18–35 min):** complete 2–5 jobs in an open district while new incidents and consequences emerge.
3. **Return and report (3–6 min):** park, unload, inspect work quality, receive resident/department feedback, and discover delayed consequences.
4. **Shop/town decisions (optional 3–8 min):** repair gear, buy upgrades, train crew, and prioritize tomorrow’s backlog.

The browser slice is one 3–6 minute dispatch call with immediate replay and a saved callback.

## 3. Design pillars

1. **Ordinary work, extraordinary interaction.** Familiar municipal jobs become spatial, physical, and cooperative; the verbs remain readable.
2. **Everything touches something else.** Roads, drainage, water, power, traffic, weather, residents, and budgets form a compact causal network.
3. **Mistakes teach before they punish.** Warning signs, visible flow, labels, sounds, and NPC reactions explain a cascade early enough to improvise.
4. **Good enough is a real choice.** A safe, durable repair costs time and supplies. A rushed repair may meet today’s clock but create tomorrow’s work.
5. **The town remembers.** Repairs, damage, closures, resident trust, budget decisions, and local details persist visibly.
6. **Coordination without rigid classes.** Players can specialize by habit and equipment, but anyone can pick up a cone, drive the truck, or close a valve.

## 4. Core gameplay loop

### Shift loop

**Read dispatch → plan loadout/route → travel → assess site → secure work zone → diagnose → fetch tools/materials → isolate affected system → perform repair → test and restore → clean up → file result → live with consequences.**

The important structure is **assess, isolate, repair, verify**. Skipping any phase saves time but raises a distinct risk:

- skip assessment: choose the wrong repair or strike an unknown utility;
- skip isolation: traffic or live pressure makes the job hazardous;
- rush repair: durability and callback risk suffer;
- skip verification/cleanup: hidden faults and public complaints remain.

### Moment-to-moment interactions

- Walk, jog, carry, drop, pass, and stack objects.
- Enter, drive, park, reverse, load, and unload fleet vehicles.
- Read work orders, utility maps, paint marks, gauges, and physical clues.
- Place cones, signs, barriers, lights, chocks, and temporary bypasses.
- Open compartments; select and carry tools/materials with limited hands.
- Use tools through short, legible physical actions: hold, align, rotate, pump, cut, shovel, compact, tighten, test.
- Communicate with pings, pointing, tool requests, and short contextual callouts.
- Observe traffic, water flow, pressure, weather, residents, and equipment state.
- Decide when a repair is sufficiently safe and durable to close the order.

No interaction should require obscure key combinations. Depth comes from where, when, and why a simple verb is used.

## 5. Systemic simulation

### Town network

Bellwether is represented as interconnected district graphs overlaid on the navigable 3D world:

- **Road/traffic graph:** lane direction, capacity, speed, closures, congestion, and emergency access.
- **Stormwater graph:** inlets, pipes, slopes, capacity, blockage, surface pooling, and downstream discharge.
- **Potable water graph:** mains, branches, valves, pressure zones, customers, leaks, and contamination risk.
- **Power/signal graph:** feeds, cabinets, traffic signals, streetlights, and outage zones.
- **Service graph:** homes, businesses, schools, emergency facilities, complaints, trust, and economic activity.

Simulation fidelity is selective. Each system exposes a few readable state variables and causal links, not engineering-grade calculations. A player must be able to say “that flooded because this inlet was blocked and the detour sent cars through the puddle.”

### Causal cascade model

An incident is a source, propagation path, affected assets, and visible symptoms. Example:

1. Leaves reduce Drain 14 capacity.
2. Heavy rain exceeds remaining capacity.
3. Water pools into the east lane.
4. Traffic slows and splashes the sidewalk.
5. Storefront access falls; complaints rise.
6. A rushed flush moves debris downstream.
7. Tomorrow, Drain 15 begins partly blocked.

Each cascade offers at least one prevention, one containment, and one repair response. Effects escalate in stages with audiovisual warning.

### Persistence

Persist at the asset level where consequences create future play:

- condition and repair quality;
- temporary patches and expected lifetime;
- blockages, leaks, closures, and service status;
- resident/business trust by district;
- fleet damage, fuel/charge, and loaded equipment;
- spent materials and departmental budget;
- scheduled callbacks and unresolved complaints;
- notable player-authored incidents for end-of-shift reports.

Do not persist clutter that only creates cleanup. Loose objects return to sensible storage after a shift unless their location is itself a meaningful consequence.

## 6. Tools and vehicles

### Tool interaction model

Tools use a common four-state grammar: **stored → carried → positioned → operating**. A tool communicates validity through pose, cursor/outline, sound, and resistance. Incorrect use may be inefficient or risky, but it should not be cryptic.

Initial tool families:

- Traffic safety: cones, folding signs, barriers, portable signals, flares/lights.
- Surface work: shovel, broom, rake, pry bar, asphalt saw, compactor, cold-patch bucket.
- Water/drainage: valve key, pipe wrench, pump, hose, drain rake, inspection camera.
- Utility locating: map tablet, paint wand, locator receiver, probe.
- Tree/debris: chainsaw, pole saw, winch, chipper, straps.
- Testing: pressure gauge, voltage tester, level, straightedge, dye tablet.

### Vehicles

- **Unit 12 utility pickup:** general response, limited storage, trailer hitch; browser slice anchor.
- **Dump truck:** carries debris, aggregate, salt, or asphalt; slow and difficult to place.
- **Mini excavator + trailer:** digging power with buried-utility risk and setup time.
- **Vacuum/jet truck:** fast drain and sewer clearing; expensive to dispatch and awkward in traffic.
- **Bucket truck:** signals, lights, limbs, and overhead work; requires outriggers and clearance.
- **Plow/salt truck:** snow response, route planning, material management.

Vehicles are mobile inventories and physical constraints, not merely traversal. Parking orientation, blocked compartments, reversing, load security, and fuel matter.

## 7. Job catalog

Each job combines a primary repair with site modifiers, network context, weather, traffic, resident needs, and prior town state.

- Pothole: clean, dry, fill, compact, mark; poor edges or wet mix creates a callback.
- Sign repair: identify correct sign, post depth/orientation, traffic exposure, sight lines.
- Traffic signal: secure lanes, isolate power, diagnose head/cabinet/feed, restore timing.
- Storm drain: identify inlet/path, control runoff, remove or move blockage, verify downstream flow.
- Water main: locate leak, mark utilities, excavate, isolate valves, clamp/replace, flush and restore.
- Sidewalk: barricade, demolish, form, pour, finish, cure; accessibility and pedestrian routing matter.
- Fallen tree: close road, assess tension and wires, cut sequence, winch/chip, reopen lanes.
- Road closure: choose endpoints, detour signage, resident access, bus/emergency routing.
- Weather response: stage resources, clear priority routes, pump flooding, salt/plow, triage calls.

## 8. Failure, chaos, and recovery

There is no single “health bar” for the crew. Failure is service degradation, safety incidents, asset damage, blown budget, missed priority calls, or public trust loss.

Chaos states include:

- live traffic entering the work zone;
- flooding spreading to structures;
- a utility strike or wrong-valve outage;
- equipment stuck, tipped, overheated, or out of material;
- blocked emergency access;
- contaminated water or an unsafe restoration;
- secondary incidents created by detours or weather.

Recovery should usually remain possible. Players can expand the closure, call for backup, install a temporary bypass, abandon a tool, tow a vehicle, notify affected customers, or convert the job into a controlled emergency. A clean “we contained it” outcome can be more satisfying than a binary loss.

## 9. Progression, economy, and unlocks

The department earns an operating budget, town trust, safety record, and crew expertise. Progression unlocks options, not raw immunity to mistakes.

- **Budget:** materials, repairs, rentals, overtime, and upgrades. Repeated callbacks consume it.
- **Department reputation:** unlocks discretionary funding, resident patience, mutual-aid support, and better equipment bids.
- **Crew certifications:** chainsaw, excavation, signal cabinet, confined-space support; provide information and efficiency, not exclusive fun.
- **Shop upgrades:** clearer compartment labels, better racks, backup camera, floodlights, radio repeater, improved maps.
- **Town projects:** replace a failing main, add a drain, redesign an intersection, or defer maintenance. Projects change future job generation.

Avoid grind-based stat inflation. Knowledge, preparation, equipment access, and town transformation are the meaningful progression.

## 10. Multiplayer roles and coordination

The target is 2–5 online co-op with solo support.

Emergent roles during a job:

- site lead/diagnosis;
- traffic control;
- operator/driver;
- tool and material runner;
- network control/map reader.

Roles are never locked. The strongest co-op interactions create dependencies without forced waiting: one player reads the valve map while another walks the line; a spotter guides a reversing truck; two players carry a barrier faster; one diverts traffic while another clears the inlet.

Solo mode provides quick-swap AI crew commands only where tasks truly require simultaneity. Initial solo design instead tunes traffic and action times so one player can establish safety, then repair. Long-term AI helpers follow high-level orders such as “hold traffic,” “bring the pump,” or “watch the gauge.”

## 11. Town and world design

Bellwether is a compact, persistent small town shared with other blue-collar game concepts. It should feel geographically coherent enough for players to learn shortcuts, weak infrastructure, and resident routines.

Initial districts:

- **Old Downtown:** brick storefronts, alleys, combined utilities, poor drainage, heavy pedestrians.
- **Birch Terrace:** postwar homes, mature trees, aging water mains.
- **River Works:** maintenance yard, light industry, culverts, rail crossing, floodplain.
- **North Hill:** school, water tower, steep roads, snow/pressure problems.
- **County Edge:** highway interchange, farms, long response distances, mutual-aid overlap.

Recurring residents, businesses, locations, signage, radio voices, municipal forms, and visual motifs should connect potential games in the shared universe. The town is affectionate and specific, not a generic “bad government” caricature.

## 12. Art direction

### Long-term 3D

Stylized, chunky realism: readable silhouettes, slightly compressed scale, worn municipal colors, reflective safety materials, and exaggerated but plausible tool motion. Surfaces communicate function—fresh patch, failing asphalt, wet leaf mass, utility paint, rust, and water depth must read instantly.

Palette: wet greens and slate asphalt, cream municipal paint, safety orange/yellow, faded fleet blue, warm storefront windows. UI draws from work orders, stencil type, fleet decals, reflective tape, and field notebooks.

Physics animation can wobble and collide, but critical state never depends on noisy physics alone. Use authored sockets, assists, and stable recovery.

### Browser slice

Top-down Canvas with flat, high-contrast shapes, chunky vehicles, reflective colors, labeled infrastructure, visible water spread, and rain. It is a systems sketch, not a promise of the final camera.

## 13. Audio direction

- Dense, readable world bed: rain intensity, tires on wet pavement, drain gurgle, radio static, truck idle, distant town activity.
- Tools have layered start/operate/load/finish sounds that indicate effectiveness.
- Infrastructure “speaks”: water hammer, pressure hiss, pump cavitation, signal relay clicks, pipe flow.
- Traffic horns and braking communicate risk spatially before impact.
- Dispatch radio is concise, procedural, and characterful without constant jokes.
- Music is sparse during field work; percussion and tempo may rise with cascading urgency, then recede when contained.

Comedy should not rely on novelty stingers. The wrong sound at the wrong time—a diner’s dishwasher dying after a valve turn—is funnier because it is causal.

## 14. UI, UX, and accessibility

### UI hierarchy

1. Immediate interaction prompt and hazard warning.
2. Current work-order step and local system state.
3. Service grade/time trend and consequences.
4. Inventory, map/network information, and optional detail.

The service grade is a forecast, not a mysterious final score. Whenever it changes, explain why in plain language. Color is reinforced by text, shape, motion, and sound.

### Accessibility commitments

- Full keyboard/controller remapping in the Unity product.
- Hold/toggle options for sustained tool use.
- Reduced motion, camera shake, flashing, and physics intensity controls.
- Color-vision-safe palettes plus symbols/patterns for utilities and hazards.
- Scalable text and high-contrast UI.
- Captions with direction/source labels for radio, tools, vehicles, and infrastructure sounds.
- Difficulty assists for traffic speed, timer pressure, tool alignment, and consequence severity.
- Solo pause whenever no live multiplayer session is active.
- Browser prototype supports keyboard, visible controls, focus indication, pause, and reduced-motion preference; touch controls are deferred.

## 15. Replayability and content generation

Replay comes from combining authored systems rather than generating arbitrary chores. A job seed selects:

- asset and fault;
- weather and time of day;
- traffic/pedestrian pattern;
- access constraints;
- neighboring network conditions;
- resident/service priority;
- equipment availability;
- one or two complications;
- prior repair history.

Rules reject combinations that are unreadable, impossible with the offered loadout, or redundant. Hand-authored landmark jobs introduce new mechanics; systemic variants make those mechanics reusable. Daily/weekly town conditions can give friend groups comparable stories without requiring live-service dependency.

## 16. First playable vertical slice

### The call: “Grand & Birch Is Flooding”

One rainy, top-down intersection. Unit 12 is parked on the verge. A blocked curb inlet is flooding an active traffic lane beside a buried water service. The player must:

1. walk to the truck and fetch one cone at a time;
2. place three cones on a marked taper;
3. observe cars slow and shift around the secured zone;
4. return for a utility locator and sweep the marked work area;
5. identify and visibly mark the buried water-service crossing;
6. return for the drain rake and approach the flooded inlet;
7. hold the work input to clear it carefully, or use the explicit rush input;
8. verify downstream flow after a careful repair;
9. recover all three cones as live traffic protection shrinks;
10. return to Unit 12 to close the work order;
11. receive Safety, Service, Quality, overall grade, and callback results;
12. refresh/start another shift and see the rushed consequence persist.

### System promise demonstrated

- Tool/vehicle fetching: Unit 12 functions as inventory and travel anchor.
- Work-zone safety: cone placement changes traffic and incident likelihood.
- Infrastructure: rain raises runoff; drain work lowers it; a locator sweep reveals the buried water-service crossing before steel tools are used.
- Time pressure: service grade trends downward and flood level rises.
- Closeout discipline: repair, verification, equipment recovery, and street reopening are separate steps; skipping verification is visible in the final checklist and quality score.
- Persistence: rushing clears today’s call but begins the next shift with a restricted downstream line, higher runoff, and lower grade.

### Explicit non-goals

No multiplayer networking, 3D, free driving, full utility-network propagation, NPC dialogue, procedural job generation, economy, touch controls, or multiple jobs in playable build 0.2. These are represented in architecture and documentation only where that preparation is cheap.

## 17. Browser technical approach

- Plain HTML/CSS/JavaScript with Canvas 2D; no dependencies, bundler, or build step.
- Fixed 960×600 simulation coordinates, CSS-scaled responsively.
- `requestAnimationFrame` loop with delta-time cap.
- Data-oriented runtime objects for player, traffic, rain, job state, and town history.
- Browser `localStorage` for a deliberately tiny versioned persistence record.
- DOM side panel for accessible, readable work order and state; Canvas for spatial play.
- Prototype source currently lives in `prototype/index.html`, `prototype/styles.css`, and `prototype/app.js`.

If prototype complexity grows beyond two jobs, split `app.js` according to the module plan in `BUILD_PREP.md` before adding content. Do not introduce a framework solely for organization.

## 18. Data and state architecture

Long-term design separates four layers:

1. **Definitions (immutable):** assets, tools, vehicles, jobs, hazards, districts, upgrades.
2. **Town state (persistent):** condition, repair records, service graph, trust, budget, fleet, scheduled incidents.
3. **Shift state (session):** crew/loadout, active jobs, weather, closures, spawned vehicles, used supplies.
4. **Interaction state (momentary):** held tool, tool pose/progress, prompts, current hazard contact.

Every consequence is an event with source, target, magnitude, tags, and time. Reducers/systems apply events to state. Saving a downstream clog should not require serializing the whole scene.

Recommended future data entities:

```text
TownState { version, day, districts, assets, fleet, budget, trust, scheduledCalls, incidentLog }
AssetState { definitionId, condition, service, faults[], repairs[], positionRef }
JobInstance { definitionId, targetAssetId, modifiers[], state, gradeFactors[], events[] }
RepairRecord { method, quality, crewIds[], materials[], completedAt, predictedLife, callbackRisk }
WorldEvent { id, type, sourceId, targetId, amount, tags[], occurredAt }
```

## 19. Unity migration considerations

- Preserve job/state definitions as JSON-shaped data that can map to ScriptableObjects plus serializable runtime records.
- Build tools around interfaces/capabilities (`ICarryable`, `IPositionable`, `IOperable`, `IServiceNode`) rather than scene-specific scripts.
- Use server/host authority for persistent town changes, traffic, physics-critical tool outcomes, and job scoring.
- Prefer deterministic state transitions over synchronizing every physics contact. Network tool intent and confirmed outcome; use interpolation for presentation.
- Isolate game rules from Unity `MonoBehaviour` presentation so browser findings remain portable.
- Use additive district scenes and stable asset IDs; never use scene object instance IDs in saves.
- Plan for Steam lobbies, invite/join, reconnect, host migration decision, and save ownership early.
- Prototype interaction latency and object ownership with two players before scaling content.
- Treat vehicle physics and carried objects as high-risk network surfaces; use assisted placement and limited authoritative rigidbodies.
- Maintain a save version/migration pipeline from the first persistent Unity build.

## 20. Milestone summary

- **M0 — Design proof (current):** one browser call, causal traffic/drain systems, grade, saved consequence, living documentation.
- **M1 — Browser vertical slice:** polish and validate the call, add audio/accessibility options, deterministic QA hooks, and better consequence feedback.
- **M2 — Systems testbed:** second job on the same intersection, utility valve interaction, job definitions separated from engine, basic generated modifiers.
- **M3 — Unity graybox:** 3D intersection, one vehicle, tool grammar, solo job parity.
- **M4 — Two-player network proof:** host/join, shared objects, traffic control + repair coordination, reconnect and outcome persistence.
- **M5 — Steam demo slice:** one district, 4–6 jobs, shop/shift loop, progression, 2–5 players, performance/accessibility pass.

Detailed gates are in `BUILD_PREP.md`.

## 21. Risks and mitigations

| Risk | Why it matters | Mitigation now |
|---|---|---|
| Physics comedy becomes random frustration | Players cannot learn causality | Use placement assists, staged warnings, stable recovery, and explicit score reasons |
| Municipal simulation becomes unreadable | Depth turns into invisible math | Expose only actionable variables; animate flow and service links |
| Scope explodes across job types | Every trade can become its own game | Standardize assess/isolate/repair/verify and shared tool grammar |
| Solo feels like chores | Co-op dependencies become repeated walking | Tune carry limits and action times; add high-level helpers only when needed |
| Co-op networking fights physics | Carried tools and vehicles desync | Network intent/outcomes; limit authoritative rigidbodies; prototype early |
| Persistence feels punitive | Old mistakes permanently poison a save | Consequences create repair opportunities and decay/containment paths |
| Authenticity conflicts with readability | Real procedure is complex | Keep causal truth and recognizable order, compress specialist detail |
| Grade encourages speed over safety | Players ignore the fantasy | Weight safety, service restoration, quality, cleanup, and time separately |

## 22. Decisions and open questions

### Committed decisions

| ID | Decision | Rationale | Date |
|---|---|---|---|
| D-001 | The first browser call is a storm-drain response at one intersection. | Demonstrates weather, traffic, tools, infrastructure, time, and persistence compactly. | 2026-08-25 |
| D-002 | Prototype 0.1 is dependency-free Canvas and DOM. | Fastest path to a standalone, inspectable build. | 2026-08-25 |
| D-003 | A careful/rush choice creates the first persistent consequence. | Makes the headline promise explicit within one replay. | 2026-08-25 |
| D-004 | Traffic response is simplified but causal: two cones slow/shift cars. | Gives cone placement mechanical meaning without pathfinding. | 2026-08-25 |
| D-005 | Long-term roles are emergent, not fixed classes. | Supports flexible 2–5 player coordination and solo. | 2026-08-25 |
| D-006 | Bellwether is affectionate, persistent, and suitable for a shared game universe. | Recurring places and people strengthen consequence and identity. | 2026-08-25 |
| D-007 | The canonical checkout is `C:\Dev\public-works-department`, versioned publicly on GitHub with `main` as the primary branch. | Keeps design, planning, and implementation in one durable source of truth. | 2026-08-25 |
| D-008 | The standalone prototype is deployed to GitHub Pages from the repository root, with no build step. | Friends need a simple public playtest URL and deployment should remain reproducible. | 2026-08-25 |
| D-009 | A completed field repair does not immediately end the call; verification, equipment recovery, and return-to-truck closeout are required. | Makes safety and quality procedural rather than an end-screen abstraction. | 2026-08-25 |
| D-010 | The overall grade is weighted from Safety (40%), Service (35%), and Quality (25%). | Players can understand the tradeoff between traffic control, response time, and durable work. | 2026-08-25 |
| D-011 | Browser build 0.2.1 uses lightweight synthesized cues and a generated rain bed with a persistent mute setting. | Adds causal audio feedback without introducing licensed assets or a build pipeline; authored effects remain a later replacement. | 2026-08-25 |

### Open questions

1. Is the final camera fixed/isometric, third-person, or switchable for driving and close tool work? Prototype the interaction cost before deciding.
2. Does town persistence belong to the host, a shared crew profile, or a dedicated “town save”? This affects Steam co-op ownership and reconnect.
3. How forgiving should traffic contact be in the final tone? Test knockdown, tool loss, and service penalties without graphic injury.
4. Should players freely improvise closures anywhere or use assisted legal patterns? Likely a hybrid with snapable taper suggestions.
5. How much procedural job generation can retain memorable local character? Start with authored assets and generated modifiers.
6. Does the grade remain letter-based, or become separate Safety/Service/Quality/Budget dimensions with a summary rating? M1 should test this.
7. What is the minimum satisfying solo helper system? Do not build AI until a job proves simultaneity is required.
8. Which other proposed games/departments share Bellwether, and what canonical locations/lore must be reserved?
