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
      failedPatch: Boolean(history.failedPatch),
      drainJobs: Number.isFinite(history.drainJobs) ? Math.max(0, Math.floor(history.drainJobs)) : 0,
      waterJobs: Number.isFinite(history.waterJobs) ? Math.max(0, Math.floor(history.waterJobs)) : 0,
      potholeJobs: Number.isFinite(history.potholeJobs) ? Math.max(0, Math.floor(history.potholeJobs)) : 0,
      budget: Number.isFinite(history.budget) ? Math.max(0, Math.round(history.budget)) : 900,
      trust: Number.isFinite(history.trust) ? clamp(Math.round(history.trust), 0, 100) : 50,
      rackUpgrade: Boolean(history.rackUpgrade),
      lastResult: typeof history.lastResult === "string" ? history.lastResult : "No prior work orders"
    };
  }

  function createInitialScores(historyValue) {
    const history = normalizeHistory(historyValue);
    return {
      safety: 100,
      service: clamp(100 - (history.downstreamClog ? 16 : 0) - (history.waterOutage ? 18 : 0), 0, 100),
      quality: history.weakClamp || history.failedPatch ? 82 : 100
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
        failedPatch: false,
        lastResult: "Flood response missed"
      };
    }
    if (waterValveClosed) {
      return {
        downstreamClog: Boolean(rushed),
        waterOutage: true,
        weakClamp: jobType === "water" && Boolean(rushed),
        failedPatch: jobType === "pothole" && Boolean(rushed),
        lastResult: jobType === "water"
          ? "Water main clamped; Maple Diner outage pending"
          : jobType === "pothole" ? "Road patched; Maple Diner outage pending" : "Drain open; Maple Diner water outage pending"
      };
    }
    if (rushed && jobType === "water") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: true,
        failedPatch: false,
        lastResult: "Water restored; temporary clamp callback pending"
      };
    }
    if (rushed && jobType === "pothole") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: false,
        failedPatch: true,
        lastResult: "Road reopened; cold patch callback pending"
      };
    }
    if (rushed) {
      return {
        downstreamClog: true,
        waterOutage: false,
        weakClamp: false,
        failedPatch: false,
        lastResult: "Drain open; downstream blockage pending"
      };
    }
    return {
      downstreamClog: false,
      waterOutage: false,
      weakClamp: false,
      failedPatch: false,
      lastResult: jobType === "water"
        ? "Water main clamped and pressure verified"
        : jobType === "pothole" ? "Pothole compacted and surface verified" : "Drain cleared with no callback"
    };
  }

  function bestGrade(current, candidate) {
    if (current === "—") return candidate;
    return candidate < current ? candidate : current;
  }

  function shiftEconomy(historyValue, { success, score, collisions }) {
    const history = normalizeHistory(historyValue);
    const basePayout = success ? Math.max(75, Math.round(220 * clamp(score, 0, 100) / 100)) : -120;
    const incidentCost = Math.max(0, Math.floor(collisions)) * 45;
    const budgetDelta = basePayout - incidentCost;
    const trustDelta = success
      ? (score >= 90 ? 3 : score >= 80 ? 2 : score >= 68 ? 1 : score >= 55 ? -1 : -3)
      : -4;
    return {
      budget: Math.max(0, history.budget + budgetDelta),
      trust: clamp(history.trust + trustDelta, 0, 100),
      budgetDelta,
      trustDelta,
      incidentCost
    };
  }

  function shiftModifier(jobType, shiftNumber) {
    const variants = {
      drain: [
        { id: "steady_rain", label: "Steady rain", hazardRate: 1, trafficRate: 1, serviceRate: 1 },
        { id: "cloudburst", label: "Cloudburst", hazardRate: 1.28, trafficRate: .9, serviceRate: 1.12 },
        { id: "school_release", label: "School release traffic", hazardRate: 1, trafficRate: 1.28, serviceRate: 1.08 }
      ],
      water: [
        { id: "normal_pressure", label: "Normal pressure", hazardRate: 1, trafficRate: 1, serviceRate: 1 },
        { id: "pressure_surge", label: "Pressure surge", hazardRate: 1.3, trafficRate: 1, serviceRate: 1.1 },
        { id: "dinner_rush", label: "Dinner rush", hazardRate: 1.05, trafficRate: 1.24, serviceRate: 1.08 }
      ],
      pothole: [
        { id: "dry_base", label: "Dry pavement", hazardRate: 1, trafficRate: 1, serviceRate: 1 },
        { id: "saturated_base", label: "Saturated road base", hazardRate: 1.25, trafficRate: .95, serviceRate: 1.12 },
        { id: "commuter_peak", label: "Commuter peak", hazardRate: 1.08, trafficRate: 1.3, serviceRate: 1.1 }
      ]
    };
    const list = variants[jobType] || variants.drain;
    return { ...list[Math.abs(Math.floor(shiftNumber)) % list.length] };
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
    persistentOutcome,
    shiftEconomy,
    shiftModifier
  });
});
