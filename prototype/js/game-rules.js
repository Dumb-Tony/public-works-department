(function exposePublicWorksRules(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PublicWorksRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPublicWorksRules() {
  "use strict";

  const JOB_TRANSITIONS = Object.freeze({
    cones: Object.freeze({ zone_secured: "locator" }),
    locator: Object.freeze({ locator_taken: "locate" }),
    locate: Object.freeze({ utility_marked: "tool" }),
    tool: Object.freeze({ tool_taken: "clear" }),
    clear: Object.freeze({ repair_careful: "verify", repair_rushed: "cleanup" }),
    verify: Object.freeze({ flow_verified: "cleanup" }),
    cleanup: Object.freeze({ cleanup_complete: "return" }),
    return: Object.freeze({ order_closed: "done" }),
    done: Object.freeze({})
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function gradeLetter(score) {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 68) return "C";
    if (score >= 55) return "D";
    return "F";
  }

  function gradeColor(score) {
    if (score >= 80) return "#71d49b";
    if (score >= 60) return "#ffd252";
    return "#ff665d";
  }

  function computeOverallScore(scores) {
    return clamp(scores.safety * 0.4 + scores.service * 0.35 + scores.quality * 0.25, 0, 100);
  }

  function penalizeScore(scores, category, amount) {
    if (!Object.hasOwn(scores, category)) return { ...scores };
    return { ...scores, [category]: clamp(scores[category] - amount, 0, 100) };
  }

  function normalizeHistory(value) {
    const history = value && typeof value === "object" ? value : {};
    return {
      shifts: Number.isFinite(history.shifts) ? Math.max(0, Math.floor(history.shifts)) : 0,
      bestGrade: typeof history.bestGrade === "string" ? history.bestGrade : "—",
      downstreamClog: Boolean(history.downstreamClog),
      waterOutage: Boolean(history.waterOutage),
      weakClamp: Boolean(history.weakClamp),
      drainJobs: Number.isFinite(history.drainJobs) ? Math.max(0, Math.floor(history.drainJobs)) : 0,
      waterJobs: Number.isFinite(history.waterJobs) ? Math.max(0, Math.floor(history.waterJobs)) : 0,
      lastResult: typeof history.lastResult === "string" ? history.lastResult : "No prior work orders"
    };
  }

  function createInitialScores(historyValue) {
    const history = normalizeHistory(historyValue);
    return {
      safety: 100,
      service: clamp(100 - (history.downstreamClog ? 16 : 0) - (history.waterOutage ? 18 : 0), 0, 100),
      quality: history.weakClamp ? 82 : 100
    };
  }

  function nextJobStep(step, event) {
    return JOB_TRANSITIONS[step]?.[event] || step;
  }

  function persistentOutcome({ success, rushed, waterValveClosed, jobType = "drain" }) {
    if (!success) {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: false,
        lastResult: "Flood response missed"
      };
    }
    if (waterValveClosed) {
      return {
        downstreamClog: Boolean(rushed),
        waterOutage: true,
        weakClamp: jobType === "water" && Boolean(rushed),
        lastResult: jobType === "water" ? "Water main clamped; Maple Diner outage pending" : "Drain open; Maple Diner water outage pending"
      };
    }
    if (rushed && jobType === "water") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: true,
        lastResult: "Water restored; temporary clamp callback pending"
      };
    }
    if (rushed) {
      return {
        downstreamClog: true,
        waterOutage: false,
        weakClamp: false,
        lastResult: "Drain open; downstream blockage pending"
      };
    }
    return {
      downstreamClog: false,
      waterOutage: false,
      weakClamp: false,
      lastResult: jobType === "water" ? "Water main clamped and pressure verified" : "Drain cleared with no callback"
    };
  }

  function bestGrade(current, candidate) {
    if (current === "—") return candidate;
    return candidate < current ? candidate : current;
  }

  return Object.freeze({
    JOB_TRANSITIONS,
    bestGrade,
    clamp,
    computeOverallScore,
    createInitialScores,
    gradeColor,
    gradeLetter,
    nextJobStep,
    normalizeHistory,
    penalizeScore,
    persistentOutcome
  });
});
