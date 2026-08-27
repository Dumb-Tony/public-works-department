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

  const CONE_LAYOUTS = Object.freeze({
    drain: Object.freeze([
      Object.freeze({ x: 700, y: 332 }),
      Object.freeze({ x: 655, y: 344 }),
      Object.freeze({ x: 610, y: 356 })
    ]),
    water: Object.freeze([
      Object.freeze({ x: 700, y: 332 }),
      Object.freeze({ x: 655, y: 344 }),
      Object.freeze({ x: 610, y: 356 })
    ]),
    pothole: Object.freeze([
      Object.freeze({ x: 590, y: 252 }),
      Object.freeze({ x: 640, y: 263 }),
      Object.freeze({ x: 690, y: 274 })
    ]),
    tree: Object.freeze([
      Object.freeze({ x: 575, y: 252 }),
      Object.freeze({ x: 625, y: 263 }),
      Object.freeze({ x: 675, y: 274 })
    ]),
    signal: Object.freeze([
      Object.freeze({ x: 610, y: 356 }),
      Object.freeze({ x: 655, y: 344 }),
      Object.freeze({ x: 700, y: 332 })
    ])
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
      hangingLimb: Boolean(history.hangingLimb),
      signalFault: Boolean(history.signalFault),
      drainJobs: Number.isFinite(history.drainJobs) ? Math.max(0, Math.floor(history.drainJobs)) : 0,
      waterJobs: Number.isFinite(history.waterJobs) ? Math.max(0, Math.floor(history.waterJobs)) : 0,
      potholeJobs: Number.isFinite(history.potholeJobs) ? Math.max(0, Math.floor(history.potholeJobs)) : 0,
      treeJobs: Number.isFinite(history.treeJobs) ? Math.max(0, Math.floor(history.treeJobs)) : 0,
      signalJobs: Number.isFinite(history.signalJobs) ? Math.max(0, Math.floor(history.signalJobs)) : 0,
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
      quality: history.weakClamp || history.failedPatch || history.hangingLimb || history.signalFault ? 82 : 100
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
        hangingLimb: false,
        signalFault: false,
        lastResult: "Flood response missed"
      };
    }
    if (waterValveClosed) {
      return {
        downstreamClog: Boolean(rushed),
        waterOutage: true,
        weakClamp: jobType === "water" && Boolean(rushed),
        failedPatch: jobType === "pothole" && Boolean(rushed),
        hangingLimb: jobType === "tree" && Boolean(rushed),
        signalFault: jobType === "signal" && Boolean(rushed),
        lastResult: jobType === "water"
          ? "Water main clamped; Maple Diner outage pending"
          : jobType === "pothole" ? "Road patched; Maple Diner outage pending"
            : jobType === "tree" ? "Tree cleared; Maple Diner outage pending"
              : jobType === "signal" ? "Signal restored; Maple Diner outage pending" : "Drain open; Maple Diner water outage pending"
      };
    }
    if (rushed && jobType === "water") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: true,
        failedPatch: false,
        hangingLimb: false,
        signalFault: false,
        lastResult: "Water restored; temporary clamp callback pending"
      };
    }
    if (rushed && jobType === "pothole") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: false,
        failedPatch: true,
        hangingLimb: false,
        signalFault: false,
        lastResult: "Road reopened; cold patch callback pending"
      };
    }
    if (rushed && jobType === "tree") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: false,
        failedPatch: false,
        hangingLimb: true,
        signalFault: false,
        lastResult: "Tree cleared; hanging limb callback pending"
      };
    }
    if (rushed && jobType === "signal") {
      return {
        downstreamClog: false,
        waterOutage: false,
        weakClamp: false,
        failedPatch: false,
        hangingLimb: false,
        signalFault: true,
        lastResult: "Signal running on bypass; intermittent fault pending"
      };
    }
    if (rushed) {
      return {
        downstreamClog: true,
        waterOutage: false,
        weakClamp: false,
        failedPatch: false,
        hangingLimb: false,
        signalFault: false,
        lastResult: "Drain open; downstream blockage pending"
      };
    }
    return {
      downstreamClog: false,
      waterOutage: false,
      weakClamp: false,
      failedPatch: false,
      hangingLimb: false,
      signalFault: false,
      lastResult: jobType === "water"
        ? "Water main clamped and pressure verified"
        : jobType === "pothole" ? "Pothole compacted and surface verified"
          : jobType === "tree" ? "Tree removed and overhead line verified"
            : jobType === "signal" ? "Signal relay replaced and full cycle verified" : "Drain cleared with no callback"
    };
  }

  function consequenceReport(outcomeValue) {
    const outcome = outcomeValue && typeof outcomeValue === "object" ? outcomeValue : {};
    const callbacks = [];
    if (outcome.downstreamClog) callbacks.push({ cause: "Rushed drain flush", effect: "Downstream flooding" });
    if (outcome.waterOutage) callbacks.push({ cause: "Valve left closed", effect: "Maple Diner outage" });
    if (outcome.weakClamp) callbacks.push({ cause: "Temporary clamp", effect: "Water-main callback" });
    if (outcome.failedPatch) callbacks.push({ cause: "Dump-and-go patch", effect: "Pothole reopens" });
    if (outcome.hangingLimb) callbacks.push({ cause: "Rushed tree pull", effect: "Hanging limb call" });
    if (outcome.signalFault) callbacks.push({ cause: "Controller bypass", effect: "Signal fails again" });
    if (callbacks.length === 0) {
      return {
        callback: false,
        title: "NO CALLBACK CREATED",
        cause: "Repair verified",
        effect: "Town stays in service"
      };
    }
    return {
      callback: true,
      title: callbacks.length > 1 ? `${callbacks.length} CALLBACKS DISPATCHED` : "CALLBACK DISPATCHED",
      cause: callbacks.map((item) => item.cause).join(" + "),
      effect: callbacks.map((item) => item.effect).join(" + ")
    };
  }

  function bestGrade(current, candidate) {
    if (current === "—") return candidate;
    return candidate < current ? candidate : current;
  }

  function shiftEconomy(historyValue, { success, score, collisions, rewardMultiplier = 1 }) {
    const history = normalizeHistory(historyValue);
    const safeMultiplier = clamp(Number(rewardMultiplier) || 1, 1, 1.5);
    const basePayout = success ? Math.max(75, Math.round(220 * clamp(score, 0, 100) / 100 * safeMultiplier)) : -120;
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
        { id: "steady_rain", label: "Steady rain", hazardRate: 1, trafficRate: 1, serviceRate: 1, rewardMultiplier: 1 },
        { id: "cloudburst", label: "Cloudburst", hazardRate: 1.28, trafficRate: .9, serviceRate: 1.12, rewardMultiplier: 1.25 },
        { id: "school_release", label: "School release traffic", hazardRate: 1, trafficRate: 1.28, serviceRate: 1.08, rewardMultiplier: 1.18 }
      ],
      water: [
        { id: "pressure_surge", label: "Pressure surge", hazardRate: 1.3, trafficRate: 1, serviceRate: 1.1, rewardMultiplier: 1.25 },
        { id: "dinner_rush", label: "Dinner rush", hazardRate: 1.05, trafficRate: 1.24, serviceRate: 1.08, rewardMultiplier: 1.18 },
        { id: "normal_pressure", label: "Normal pressure", hazardRate: 1, trafficRate: 1, serviceRate: 1, rewardMultiplier: 1 }
      ],
      pothole: [
        { id: "commuter_peak", label: "Commuter peak", hazardRate: 1.08, trafficRate: 1.3, serviceRate: 1.1, rewardMultiplier: 1.2 },
        { id: "dry_base", label: "Dry pavement", hazardRate: 1, trafficRate: 1, serviceRate: 1, rewardMultiplier: 1 },
        { id: "saturated_base", label: "Saturated road base", hazardRate: 1.25, trafficRate: .95, serviceRate: 1.12, rewardMultiplier: 1.22 }
      ],
      tree: [
        { id: "gusting_wind", label: "Gusting wind", hazardRate: 1.28, trafficRate: .92, serviceRate: 1.12, rewardMultiplier: 1.25 },
        { id: "school_bus_route", label: "School bus route", hazardRate: 1.05, trafficRate: 1.28, serviceRate: 1.08, rewardMultiplier: 1.18 },
        { id: "calm_cleanup", label: "Calm cleanup", hazardRate: 1, trafficRate: 1, serviceRate: 1, rewardMultiplier: 1 }
      ],
      signal: [
        { id: "power_fluctuation", label: "Power fluctuation", hazardRate: 1.25, trafficRate: 1.05, serviceRate: 1.12, rewardMultiplier: 1.25 },
        { id: "school_crossing", label: "School crossing rush", hazardRate: 1.08, trafficRate: 1.3, serviceRate: 1.1, rewardMultiplier: 1.2 },
        { id: "quiet_window", label: "Quiet repair window", hazardRate: 1, trafficRate: .92, serviceRate: 1, rewardMultiplier: 1 }
      ]
    };
    const list = variants[jobType] || variants.drain;
    return { ...list[Math.abs(Math.floor(shiftNumber)) % list.length] };
  }

  function coneLayout(jobType) {
    return (CONE_LAYOUTS[jobType] || CONE_LAYOUTS.drain).map((target) => ({ ...target }));
  }

  function trafficRoute(jobType, carValue, zoneSecured) {
    const car = carValue && typeof carValue === "object" ? carValue : {};
    const y = Number.isFinite(car.y) ? car.y : 300;
    const x = Number.isFinite(car.x) ? car.x : -100;
    if (!zoneSecured) return { drawY: y, speedMultiplier: 1, diverted: false };

    const upperLaneJob = jobType === "pothole" || jobType === "tree";
    const affectedLane = upperLaneJob ? y < 300 : y >= 300;
    if (!affectedLane) return { drawY: y, speedMultiplier: 1, diverted: false };

    const start = 520;
    const end = 810;
    const ramp = 120;
    let factor = 0;
    if (x >= start && x <= end) factor = 1;
    else if (x > start - ramp && x < start) {
      const t = (x - (start - ramp)) / ramp;
      factor = t * t * (3 - 2 * t);
    } else if (x > end && x < end + ramp) {
      const t = (end + ramp - x) / ramp;
      factor = t * t * (3 - 2 * t);
    }

    const routeY = upperLaneJob ? 222 : 294;
    return {
      drawY: y + (routeY - y) * factor,
      speedMultiplier: 1 - .52 * factor,
      diverted: factor > .05
    };
  }

  function isCrewProtected(jobType, positionValue, zoneSecured) {
    if (!zoneSecured) return false;
    const position = positionValue && typeof positionValue === "object" ? positionValue : {};
    const x = Number(position.x);
    const y = Number(position.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    return jobType === "pothole" || jobType === "tree"
      ? x >= 555 && x <= 805 && y >= 245 && y <= 312
      : x >= 555 && x <= 830 && y >= 310 && y <= 445;
  }

  return Object.freeze({
    JOB_TRANSITIONS,
    bestGrade,
    clamp,
    coneLayout,
    consequenceReport,
    computeOverallScore,
    createInitialScores,
    gradeColor,
    gradeLetter,
    nextJobStep,
    normalizeHistory,
    penalizeScore,
    persistentOutcome,
    shiftEconomy,
    shiftModifier,
    trafficRoute,
    isCrewProtected
  });
});
