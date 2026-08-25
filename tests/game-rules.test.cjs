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
    lastResult: "No prior work orders"
  });
  assert.equal(rules.createInitialScores({ downstreamClog: true, waterOutage: true }).service, 66);
});

test("persistent outcomes distinguish careful, rushed, and valve-outage results", () => {
  assert.deepEqual(rules.persistentOutcome({ success: true, rushed: false, waterValveClosed: false }), {
    downstreamClog: false,
    waterOutage: false,
    lastResult: "Drain cleared with no callback"
  });
  assert.equal(rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: false }).downstreamClog, true);
  const outage = rules.persistentOutcome({ success: true, rushed: true, waterValveClosed: true });
  assert.equal(outage.downstreamClog, true);
  assert.equal(outage.waterOutage, true);
});

test("best grade preserves the strongest recorded result", () => {
  assert.equal(rules.bestGrade("—", "C"), "C");
  assert.equal(rules.bestGrade("C", "A"), "A");
  assert.equal(rules.bestGrade("A", "D"), "A");
});
