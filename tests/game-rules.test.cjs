const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../prototype/js/game-rules.js");

test("careful repair follows the complete closeout path", () => {
  const events = [
    "zone_secured",
    "locator_taken",
    "utility_marked",
    "tool_taken",
    "repair_careful",
    "flow_verified",
    "cleanup_complete",
    "order_closed"
  ];
  const states = ["cones"];
  for (const event of events) states.push(rules.nextJobStep(states.at(-1), event));
  assert.deepEqual(states, ["cones", "locator", "locate", "tool", "clear", "verify", "cleanup", "return", "done"]);
});

test("rushed repair skips verification but still requires cleanup and closeout", () => {
  assert.equal(rules.nextJobStep("clear", "repair_rushed"), "cleanup");
  assert.equal(rules.nextJobStep("cleanup", "cleanup_complete"), "return");
  assert.equal(rules.nextJobStep("return", "order_closed"), "done");
});

test("invalid events cannot advance the work order", () => {
  assert.equal(rules.nextJobStep("cones", "repair_careful"), "cones");
  assert.equal(rules.nextJobStep("done", "zone_secured"), "done");
  assert.equal(rules.nextJobStep("unknown", "anything"), "unknown");
});

test("weighted grade respects the 40/35/25 scoring decision", () => {
  assert.equal(rules.computeOverallScore({ safety: 100, service: 80, quality: 60 }), 83);
  assert.equal(rules.gradeLetter(83), "B");
  assert.equal(rules.gradeColor(83), "#71d49b");
});

test("penalties clamp at zero and do not mutate the prior score", () => {
  const before = { safety: 10, service: 100, quality: 100 };
  const after = rules.penalizeScore(before, "safety", 22);
  assert.equal(before.safety, 10);
  assert.equal(after.safety, 0);
});

test("history migration fills missing callback fields", () => {
  assert.deepEqual(rules.normalizeHistory({ shifts: 2, downstreamClog: true }), {
    shifts: 2,
    bestGrade: "—",
    downstreamClog: true,
    waterOutage: false,
    weakClamp: false,
    failedPatch: false,
    drainJobs: 0,
    waterJobs: 0,
    potholeJobs: 0,
    budget: 900,
    trust: 50,
    rackUpgrade: false,
    lastResult: "No prior work orders"
  });
  assert.equal(rules.createInitialScores({ downstreamClog: true, waterOutage: true }).service, 66);
});

test("persistent outcomes distinguish careful, rushed, and valve-outage results", () => {
  assert.deepEqual(rules.persistentOutcome({ success: true, rushed: false, waterValveClosed: false }), {
    downstreamClog: false,
    waterOutage: false,
    weakClamp: false,
    failedPatch: false,
    lastResult: "Drain cleared with no callback"
  });
  assert.equal(rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: false }).downstreamClog, true);
  const outage = rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: true });
  assert.equal(outage.downstreamClog, true);
  assert.equal(outage.waterOutage, true);
  const weakClamp = rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: false, jobType: "water" });
  assert.equal(weakClamp.downstreamClog, false);
  assert.equal(weakClamp.weakClamp, true);
});

test("water callbacks reduce opening quality without changing safety", () => {
  const scores = rules.createInitialScores({ weakClamp: true });
  assert.deepEqual(scores, { safety: 100, service: 100, quality: 82 });
});

test("best grade preserves the strongest recorded result", () => {
  assert.equal(rules.bestGrade("—", "C"), "C");
  assert.equal(rules.bestGrade("C", "A"), "A");
  assert.equal(rules.bestGrade("A", "D"), "A");
});

test("shift economy rewards quality and charges traffic incidents", () => {
  const clean = rules.shiftEconomy({ budget: 900, trust: 50 }, { success: true, score: 92, collisions: 0 });
  assert.deepEqual(clean, { budget: 1102, trust: 53, budgetDelta: 202, trustDelta: 3, incidentCost: 0 });
  const incident = rules.shiftEconomy({ budget: 900, trust: 50 }, { success: true, score: 70, collisions: 2 });
  assert.equal(incident.budgetDelta, 64);
  assert.equal(incident.incidentCost, 90);
  assert.equal(incident.trust, 51);
});

test("failed shifts cost budget and trust without going negative", () => {
  const failed = rules.shiftEconomy({ budget: 50, trust: 2 }, { success: false, score: 20, collisions: 1 });
  assert.equal(failed.budget, 0);
  assert.equal(failed.trust, 0);
  assert.equal(failed.budgetDelta, -165);
});

test("rushed pothole work creates a failed-patch callback", () => {
  const outcome = rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: false, jobType: "pothole" });
  assert.equal(outcome.failedPatch, true);
  assert.equal(outcome.downstreamClog, false);
});

test("shift modifiers are deterministic and job-specific", () => {
  assert.deepEqual(rules.shiftModifier("drain", 1), rules.shiftModifier("drain", 4));
  assert.equal(rules.shiftModifier("water", 1).id, "dinner_rush");
  assert.equal(rules.shiftModifier("pothole", 2).id, "saturated_base");
  assert.equal(rules.shiftModifier("drain", 0).rewardMultiplier, 1);
  assert.equal(rules.shiftModifier("water", 0).rewardMultiplier, 1.25);
  assert.equal(rules.shiftModifier("pothole", 0).rewardMultiplier, 1.2);
});

test("hazard pay scales successful work without multiplying incident costs", () => {
  const result = rules.shiftEconomy(
    { budget: 900, trust: 50 },
    { success: true, score: 100, collisions: 2, rewardMultiplier: 1.25 }
  );
  assert.equal(result.budgetDelta, 185);
  assert.equal(result.incidentCost, 90);
  assert.equal(result.budget, 1085);
});

test("consequence report explains the causal chain saved for tomorrow", () => {
  assert.deepEqual(rules.consequenceReport({ failedPatch: true }), {
    callback: true,
    title: "CALLBACK DISPATCHED",
    cause: "Dump-and-go patch",
    effect: "Pothole reopens"
  });
  assert.deepEqual(rules.consequenceReport({}), {
    callback: false,
    title: "NO CALLBACK CREATED",
    cause: "Repair verified",
    effect: "Town stays in service"
  });
});

test("a secured lower-lane taper smoothly diverts traffic around drain work", () => {
  assert.deepEqual(rules.trafficRoute("drain", { x: 350, y: 330 }, true), {
    drawY: 330,
    speedMultiplier: 1,
    diverted: false
  });
  const routed = rules.trafficRoute("drain", { x: 650, y: 330 }, true);
  assert.equal(routed.drawY, 294);
  assert.equal(routed.speedMultiplier, .48);
  assert.equal(routed.diverted, true);
  assert.equal(rules.trafficRoute("drain", { x: 650, y: 267 }, true).drawY, 267);
});

test("pothole taper diverts the upper lane and protects only the signed work area", () => {
  assert.equal(rules.trafficRoute("pothole", { x: 650, y: 267 }, true).drawY, 222);
  assert.equal(rules.trafficRoute("pothole", { x: 650, y: 330 }, true).drawY, 330);
  assert.equal(rules.isCrewProtected("pothole", { x: 690, y: 275 }, true), true);
  assert.equal(rules.isCrewProtected("pothole", { x: 480, y: 275 }, true), false);
  assert.equal(rules.isCrewProtected("drain", { x: 664, y: 404 }, false), false);
});

test("routed cars physically clear every cone in both lane-specific tapers", () => {
  for (const jobType of ["drain", "water", "pothole"]) {
    const baseY = jobType === "pothole" ? 267 : 330;
    for (const cone of rules.coneLayout(jobType)) {
      const car = rules.trafficRoute(jobType, { x: cone.x, y: baseY }, true);
      assert.ok(Math.abs(car.drawY - cone.y) >= 30, `${jobType} car overlaps cone at ${cone.x}`);
      assert.equal(car.diverted, true);
    }
  }
});

test("one deployed cone is enough to activate avoidance routing", () => {
  const withCone = rules.trafficRoute("drain", { x: 700, y: 330 }, true);
  const withoutCone = rules.trafficRoute("drain", { x: 700, y: 330 }, false);
  assert.equal(withCone.drawY, 294);
  assert.equal(withoutCone.drawY, 330);
});
