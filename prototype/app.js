(() => {
  "use strict";

  const rules = window.PublicWorksRules;
  if (!rules) throw new Error("Public Works rules module failed to load.");
  const {
    bestGrade,
    clamp,
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
    shiftModifier
  } = rules;

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    startPanel: document.querySelector("#startPanel"),
    endPanel: document.querySelector("#endPanel"),
    startButton: document.querySelector("#startButton"),
    waterButton: document.querySelector("#waterButton"),
    potholeButton: document.querySelector("#potholeButton"),
    upgradeButton: document.querySelector("#upgradeButton"),
    againButton: document.querySelector("#againButton"),
    resetButton: document.querySelector("#resetButton"),
    restartButton: document.querySelector("#restartButton"),
    muteButton: document.querySelector("#muteButton"),
    shiftChip: document.querySelector("#shiftChip"),
    historyNote: document.querySelector("#historyNote"),
    grade: document.querySelector("#grade"),
    gradeMeter: document.querySelector("#gradeMeter"),
    gradeReason: document.querySelector("#gradeReason"),
    objective: document.querySelector("#objective"),
    checklist: document.querySelector("#checklist"),
    townState: document.querySelector("#townState"),
    endTitle: document.querySelector("#endTitle"),
    endSummary: document.querySelector("#endSummary"),
    endStats: document.querySelector("#endStats"),
    endConsequence: document.querySelector("#endConsequence")
  };

  const STORAGE_KEY = "pwd-first-shift-v1";
  const AUDIO_KEY = "pwd-audio-muted-v1";
  const RACK_COST = 500;
  const JOB_BOARD = {
    drain: { number: "14-07", name: "Storm drain flooding" },
    water: { number: "14-08", name: "Water main leak" },
    pothole: { number: "14-09", name: "Pothole collapse" }
  };
  const W = canvas.width;
  const H = canvas.height;
  const keys = new Set();
  const justPressed = new Set();
  const coneTargets = [
    { x: 607, y: 368 },
    { x: 651, y: 368 },
    { x: 695, y: 368 }
  ];

  const world = {
    truck: { x: 110, y: 480, w: 150, h: 72 },
    drain: { x: 664, y: 404 },
    hydrant: { x: 754, y: 416 },
    inlet: { x: 682, y: 395 },
    utility: { x: 724, y: 405 },
    valve: { x: 792, y: 448 },
    waterLeak: { x: 794, y: 348 },
    pothole: { x: 690, y: 275 }
  };

  const trafficTemplate = [
    { x: -40, y: 267, dir: 1, speed: 76, color: "#d9d2b6" },
    { x: 340, y: 267, dir: 1, speed: 68, color: "#eaa64b" },
    { x: 980, y: 330, dir: -1, speed: 72, color: "#5ea2b8" },
    { x: 610, y: 330, dir: -1, speed: 62, color: "#d26b61" }
  ];

  let history = loadHistory();
  let game = freshGame();
  let lastTime = performance.now();
  let audioMuted = loadMuted();
  let audioContext = null;
  let rainSource = null;
  let rainGain = null;
  let resetArmed = false;
  let resetTimer = null;

  function loadHistory() {
    try {
      return normalizeHistory(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return normalizeHistory({ lastResult: "Storage unavailable" });
    }
  }

  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* local-only save is optional */ }
  }

  function loadMuted() {
    try { return localStorage.getItem(AUDIO_KEY) === "true"; } catch { return false; }
  }

  function syncMuteButton() {
    ui.muteButton.textContent = audioMuted ? "Sound off" : "Sound on";
    ui.muteButton.setAttribute("aria-pressed", String(audioMuted));
  }

  function ensureAudio() {
    if (audioMuted) return null;
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function startRain() {
    const audio = ensureAudio();
    if (!audio || rainSource) return;
    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    rainSource = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    rainGain = audio.createGain();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 1300;
    rainGain.gain.value = 0.025;
    rainSource.connect(filter).connect(rainGain).connect(audio.destination);
    rainSource.start();
  }

  function stopRain() {
    if (!rainSource) return;
    try { rainSource.stop(); } catch { /* source may already be stopped */ }
    rainSource.disconnect();
    rainSource = null;
    rainGain = null;
  }

  function cue(name) {
    const audio = ensureAudio();
    if (!audio) return;
    const cues = {
      dispatch: [520, 0.12, 0.045],
      pickup: [330, 0.07, 0.035],
      place: [680, 0.09, 0.04],
      locate: [920, 0.18, 0.035],
      repair: [240, 0.12, 0.045],
      verify: [760, 0.22, 0.04],
      alert: [150, 0.18, 0.055],
      impact: [82, 0.25, 0.08],
      complete: [610, 0.35, 0.05],
      fail: [105, 0.42, 0.065]
    };
    const [frequency, duration, volume] = cues[name] || cues.pickup;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = name === "impact" || name === "fail" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function freshGame(jobType = "drain") {
    const scores = createInitialScores(history);
    const waterJob = jobType === "water";
    const potholeJob = jobType === "pothole";
    const callbackActive = waterJob
      ? history.weakClamp || history.waterOutage
      : potholeJob ? history.failedPatch || history.waterOutage : history.downstreamClog || history.waterOutage;
    const modifier = shiftModifier(jobType, history.shifts);
    return {
      jobType,
      modifier,
      mode: "title",
      paused: false,
      elapsed: 0,
      grade: computeOverallScore(scores),
      gradeReason: callbackActive ? "Yesterday's callback has weakened today's opening position." : "Call received. The clock is running.",
      flood: waterJob
        ? (history.weakClamp ? 38 : 20)
        : potholeJob ? (history.failedPatch ? 35 : 16) : (history.downstreamClog ? 34 : 18),
      work: 0,
      locateWork: 0,
      verifyWork: 0,
      step: "cones",
      conesPlaced: [],
      conesCollected: 0,
      coneStock: 4,
      carrying: null,
      nearMisses: 0,
      collisions: 0,
      rushed: false,
      waterValveClosed: false,
      valveOperations: 0,
      zoneSecured: false,
      toolRetrieved: false,
      repairRestored: false,
      utilityMarked: false,
      flowVerified: false,
      scores,
      result: null,
      prompt: "",
      player: { x: 295, y: 492, radius: 13, speed: history.rackUpgrade ? 188 : 168, hitCooldown: 0 },
      cars: trafficTemplate.map((car) => ({ ...car, width: 58, height: 28 })),
      rain: Array.from({ length: 90 }, (_, i) => ({
        x: (i * 83) % W,
        y: (i * 47) % H,
        speed: 280 + (i % 5) * 28
      }))
    };
  }

  function startGame(jobType = "drain") {
    game = freshGame(jobType);
    game.mode = "playing";
    keys.clear();
    justPressed.clear();
    ui.startPanel.hidden = true;
    ui.endPanel.hidden = true;
    ui.restartButton.hidden = false;
    ui.shiftChip.innerHTML = `<span class="rain-dot"></span> ${game.modifier.label} · ${hazardPayLabel(game.modifier)}`;
    startRain();
    cue("dispatch");
    canvas.focus();
    syncUI();
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function recomputeGrade() {
    game.grade = computeOverallScore(game.scores);
  }

  function penalize(category, amount, reason) {
    game.scores = penalizeScore(game.scores, category, amount);
    game.gradeReason = reason;
    recomputeGrade();
  }

  function advanceJob(event) {
    const next = nextJobStep(game.step, event);
    if (next === game.step) return false;
    game.step = next;
    return true;
  }

  function update(dt) {
    if (game.mode !== "playing") return;
    if (game.paused) {
      syncUI();
      return;
    }

    game.elapsed += dt;
    game.player.hitCooldown = Math.max(0, game.player.hitCooldown - dt);
    updatePlayer(dt);
    updateTraffic(dt);
    updateRain(dt);

    const secured = game.conesPlaced.length === coneTargets.length;
    const timeDrain = (secured ? 0.018 : 0.034) * (history.rackUpgrade ? 0.82 : 1) * game.modifier.serviceRate;
    game.scores.service = clamp(game.scores.service - timeDrain * dt * 10, 0, 100);
    if (game.step === "verify") {
      game.flood = clamp(game.flood - 3.5 * dt, 0, 100);
    } else if (game.step === "cleanup" || game.step === "return") {
      game.flood = clamp(game.flood - (game.rushed ? 2 : 7) * dt, 0, 100);
    } else if (game.jobType === "water" && game.step === "clear" && game.waterValveClosed) {
      game.flood = clamp(game.flood - 2.5 * dt, 0, 100);
    } else {
      game.flood = clamp(game.flood + (game.step === "clear" ? 0.65 : 1.05) * game.modifier.hazardRate * dt, 0, 100);
    }

    if (game.flood >= 72 && game.step !== "done") {
      game.gradeReason = "Runoff has reached Birch Street storefronts.";
      game.scores.service = clamp(game.scores.service - 1.2 * dt, 0, 100);
    }

    handleInteraction(dt);
    recomputeGrade();

    const repairRestored = game.step === "verify" || game.step === "cleanup" || game.step === "return";
    if ((!repairRestored && game.flood >= 100) || game.grade <= 20) {
      finish(false, game.jobType === "water"
        ? "The main break flooded Grand Avenue before the crew restored control."
        : game.jobType === "pothole" ? "Traffic enlarged the pavement failure before the crew stabilized it." : "The intersection flooded before the drain was restored.");
    }
    syncUI();
  }

  function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) dx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) dy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) dy += 1;
    if (dx || dy) {
      const length = Math.hypot(dx, dy);
      game.player.x = clamp(game.player.x + (dx / length) * game.player.speed * dt, 18, W - 18);
      game.player.y = clamp(game.player.y + (dy / length) * game.player.speed * dt, 18, H - 18);
    }
  }

  function updateTraffic(dt) {
    const protectedZone = game.conesPlaced.length >= 2;
    for (const car of game.cars) {
      let speed = car.speed * game.modifier.trafficRate;
      const approaching = car.dir > 0 ? car.x > 500 && car.x < 770 : car.x < 800 && car.x > 520;
      if (protectedZone && approaching) speed *= 0.48;
      car.x += car.dir * speed * dt;
      const laneShift = protectedZone && car.x > 540 && car.x < 770 ? (car.y < 300 ? -18 : 18) : 0;
      car.drawY = car.y + laneShift;
      if (car.dir > 0 && car.x > W + 90) car.x = -90;
      if (car.dir < 0 && car.x < -90) car.x = W + 90;

      const hitX = Math.abs(game.player.x - car.x) < car.width * 0.48 + game.player.radius;
      const hitY = Math.abs(game.player.y - car.drawY) < car.height * 0.48 + game.player.radius;
      if (hitX && hitY && game.player.hitCooldown <= 0) {
        cue("impact");
        game.collisions += 1;
        penalize("safety", 22, "Vehicle contact: work-zone incident reported.");
        game.player.hitCooldown = 1.5;
        game.player.y += car.y < 300 ? 42 : -42;
      } else if (hitX && Math.abs(game.player.y - car.drawY) < 46 && game.player.hitCooldown <= 0) {
        game.nearMisses += dt;
        if (game.nearMisses > 1) {
          cue("alert");
          penalize("safety", 6, "Near miss: cones need to control approaching traffic.");
          game.nearMisses = 0;
          game.player.hitCooldown = 1;
        }
      }
    }
  }

  function updateRain(dt) {
    for (const drop of game.rain) {
      drop.x -= drop.speed * 0.25 * dt;
      drop.y += drop.speed * dt;
      if (drop.y > H) { drop.y = -12; drop.x = (drop.x + 317) % W; }
    }
  }

  function handleInteraction(dt) {
    const atTruck = distance(game.player, { x: 188, y: 474 }) < 94;
    const waterJob = game.jobType === "water";
    const potholeJob = game.jobType === "pothole";
    const repairTarget = waterJob ? world.waterLeak : potholeJob ? world.pothole : world.drain;
    const locateTarget = waterJob ? world.waterLeak : potholeJob ? world.pothole : world.utility;
    const atRepair = distance(game.player, repairTarget) < 52;
    const atLocate = distance(game.player, locateTarget) < 56;
    const atValve = distance(game.player, world.valve) < 46;
    game.prompt = "";

    if (game.step === "cones") {
      if (game.carrying === "cone") {
        game.prompt = "SPACE · Place traffic cone";
        if (justPressed.has("Space")) placeCone();
      } else if (atTruck) {
        game.prompt = "E · Take cone from Unit 12";
        if (justPressed.has("KeyE")) {
          game.carrying = "cone";
          cue("pickup");
          game.coneStock -= 1;
          game.gradeReason = "Cone loaded. Mark the three striped positions.";
        }
      } else {
        game.prompt = "Return to Unit 12 for a traffic cone";
      }
    } else if (game.step === "locator") {
      if (atTruck) {
        game.prompt = "E · Take utility locator";
        if (justPressed.has("KeyE")) {
          game.carrying = "locator";
          cue("pickup");
          advanceJob("locator_taken");
          game.gradeReason = waterJob
            ? "Trace the leaking main before isolating or clamping it."
            : potholeJob ? "Inspect the failed pavement and check the shallow utility map." : "Locate the blue water service before using a steel rake.";
        }
      } else {
        game.prompt = "Return to Unit 12 for the utility locator";
      }
    } else if (game.step === "locate") {
      if (!atLocate) {
        game.prompt = waterJob ? "Bring the locator to the bubbling pavement" : potholeJob ? "Bring the inspection wand to the collapsed pavement" : "Bring the locator to the pulsing utility mark";
      } else {
        game.prompt = "Hold E · Sweep for buried service";
        if (keys.has("KeyE")) {
          game.locateWork = clamp(game.locateWork + 34 * dt, 0, 100);
          game.gradeReason = `Tracing buried water service… ${Math.floor(game.locateWork)}%`;
          if (game.locateWork >= 100) {
            cue("locate");
            game.utilityMarked = true;
            game.carrying = null;
            advanceJob("utility_marked");
            game.gradeReason = waterJob
              ? "Leak and main marked. Retrieve the valve key and clamp kit."
              : potholeJob ? "Failed edges and shallow water service marked. Retrieve patch and compactor." : "Water service marked in blue. Steel tools may stay west of the line.";
          }
        }
      }
    } else if (game.step === "tool") {
      if (atTruck) {
        game.prompt = waterJob ? "E · Take valve key and clamp kit" : potholeJob ? "E · Take cold patch and compactor" : "E · Take drain rake";
        if (justPressed.has("KeyE")) {
          game.carrying = waterJob ? "clamp" : potholeJob ? "patch" : "rake";
          cue("pickup");
          game.toolRetrieved = true;
          advanceJob("tool_taken");
          game.gradeReason = waterJob
            ? "Close the marked valve, then clamp the leaking main."
            : potholeJob ? "Clean the failed edges, place patch, and compact it in lifts." : "Work zone secured. Clear the inlet before it overtops.";
        }
      } else {
        game.prompt = waterJob ? "Return to Unit 12 for the clamp kit" : potholeJob ? "Return to Unit 12 for patch and compactor" : "Return to Unit 12 for the drain rake";
      }
    } else if (game.step === "clear") {
      if (waterJob && !game.waterValveClosed) {
        game.prompt = "Isolate the main at the blue valve box before clamping";
      } else if (!atRepair) {
        game.prompt = waterJob ? "Bring the clamp kit to the bubbling pavement" : potholeJob ? "Bring patch and compactor to the marked failure" : "Bring the drain rake to the flashing inlet";
      } else {
        game.prompt = waterJob ? "Hold E · Fit permanent clamp   |   R · Temporary patch" : potholeJob ? "Hold E · Layer and compact   |   R · Dump-and-go patch" : "Hold E · Clear carefully   |   R · Rush flush";
        if (keys.has("KeyE")) {
          game.work = clamp(game.work + (waterJob ? 18 : potholeJob ? 20 : 23) * dt, 0, 100);
          game.flood = clamp(game.flood - (waterJob ? 7.5 : 5.5) * dt, 0, 100);
          game.gradeReason = waterJob
            ? `Aligning and tightening permanent clamp… ${Math.floor(game.work)}%`
            : potholeJob ? `Layering and compacting cold patch… ${Math.floor(game.work)}%` : `Clearing debris carefully… ${Math.floor(game.work)}%`;
          if (game.work >= 100) completeRepair(false);
        }
        if (justPressed.has("KeyR")) {
          game.work = 100;
          completeRepair(true);
        }
      }
    } else if (game.step === "verify") {
      if (waterJob && game.waterValveClosed) {
        game.prompt = "Reopen the water valve before pressure testing";
      } else if (!atRepair) {
        game.prompt = waterJob ? "Return to the clamp and pressure-test the repair" : potholeJob ? "Return with the straightedge and verify the surface" : "Return to the inlet and verify downstream flow";
      } else {
        game.prompt = waterJob ? "Hold E · Pressure-test clamp" : potholeJob ? "Hold E · Check crown and compaction" : "Hold E · Verify flow and rake bars";
        if (keys.has("KeyE")) {
          game.verifyWork = clamp(game.verifyWork + 42 * dt, 0, 100);
          game.flood = clamp(game.flood - 11 * dt, 0, 100);
          game.gradeReason = waterJob
            ? `Pressure-testing repaired main… ${Math.floor(game.verifyWork)}%`
            : potholeJob ? `Checking surface crown and compaction… ${Math.floor(game.verifyWork)}%` : `Testing drainage flow… ${Math.floor(game.verifyWork)}%`;
          if (game.verifyWork >= 100) {
            cue("verify");
            game.flowVerified = true;
            game.carrying = null;
            advanceJob("flow_verified");
            game.gradeReason = waterJob
              ? "Pressure stable and service restored. Recover cones before reopening Grand Avenue."
              : potholeJob ? "Patch is level and compacted. Recover cones before reopening Grand Avenue." : "Flow verified. Recover all cones before reopening Grand Avenue.";
          }
        }
      }
    } else if (game.step === "cleanup") {
      const nearestCone = nearestPlacedCone();
      if (nearestCone && nearestCone.d < 52) {
        game.prompt = "E · Recover traffic cone";
        if (justPressed.has("KeyE")) {
          cue("pickup");
          game.conesPlaced = game.conesPlaced.filter((index) => index !== nearestCone.index);
          game.conesCollected += 1;
          game.gradeReason = `${game.conesCollected}/3 cones recovered. Traffic protection is shrinking.`;
          if (game.conesCollected === coneTargets.length) advanceJob("cleanup_complete");
        }
      } else {
        game.prompt = "Recover the three flashing traffic cones";
      }
    } else if (game.step === "return") {
      if (atTruck) {
        game.prompt = "E · Close work order at Unit 12";
        if (justPressed.has("KeyE")) {
          const summary = waterJob
            ? (game.rushed
              ? "The street reopened on a temporary clamp that may not survive the next pressure cycle."
              : "The main is clamped, pressure is stable, and customer service is restored.")
            : potholeJob
              ? (game.rushed ? "The street reopened over an untested dump-and-go patch." : "The pothole is layered, compacted, level, and ready for traffic.")
            : (game.rushed
              ? "The street reopened, but the unverified rush flush lodged debris downstream."
              : "The drain is flowing, utilities are intact, and Grand Avenue is safely reopened.");
          finish(true, summary);
        }
      } else {
        game.prompt = "Return to Unit 12 to close the work order";
      }
    }

    if (game.utilityMarked && atValve && game.mode === "playing") {
      const valveAction = game.waterValveClosed ? "Open" : "Close";
      game.prompt = `${game.prompt ? `${game.prompt}   |   ` : ""}V · ${valveAction} water valve`;
      if (justPressed.has("KeyV")) toggleWaterValve();
    }
  }

  function toggleWaterValve() {
    game.waterValveClosed = !game.waterValveClosed;
    game.valveOperations += 1;
    if (game.waterValveClosed) {
      cue("alert");
      const plannedIsolation = game.jobType === "water" && game.step === "clear";
      penalize("service", plannedIsolation ? 4 : 12, plannedIsolation
        ? "Main isolated: Maple Diner water service is temporarily offline."
        : "Wrong valve closed: Maple Diner has lost water service.");
    } else {
      cue("verify");
      game.gradeReason = game.jobType === "water"
        ? "Water service restored. Pressure-test the clamp before reopening."
        : "Maple Diner water restored. The outage remains on the incident report.";
    }
  }

  function completeRepair(rushed) {
    game.rushed = rushed;
    game.repairRestored = true;
    game.carrying = null;
    if (rushed) {
      cue("alert");
      penalize("quality", 36, game.jobType === "water"
        ? "Temporary clamp used: repair skipped torque and pressure verification."
        : game.jobType === "pothole" ? "Dump-and-go patch skipped edge prep, lifts, and compaction." : "Rush flush used: debris moved downstream without a flow test.");
      advanceJob("repair_rushed");
    } else {
      cue("repair");
      advanceJob("repair_careful");
      game.gradeReason = game.jobType === "water"
        ? "Clamp installed. Reopen the valve and pressure-test before cleanup."
        : game.jobType === "pothole" ? "Patch placed. Verify crown and compaction before cleanup." : "Blockage removed. Verify flow before reopening the street.";
    }
  }

  function nearestPlacedCone() {
    return game.conesPlaced
      .map((index) => ({ index, d: distance(game.player, coneTargets[index]) }))
      .sort((a, b) => a.d - b.d)[0];
  }

  function placeCone() {
    const nearest = coneTargets
      .map((target, index) => ({ target, index, d: distance(game.player, target) }))
      .filter(({ index }) => !game.conesPlaced.includes(index))
      .sort((a, b) => a.d - b.d)[0];

    if (nearest && nearest.d < 52) {
      cue("place");
      game.conesPlaced.push(nearest.index);
      game.carrying = null;
      game.gradeReason = `Work zone ${game.conesPlaced.length}/3 secured.`;
      if (game.conesPlaced.length === coneTargets.length) {
        game.zoneSecured = true;
        advanceJob("zone_secured");
      }
    } else {
      penalize("safety", 4, "Cone is outside the marked taper. Reposition it.");
    }
  }

  function finish(success, summary) {
    if (game.mode !== "playing") return;
    game.mode = "ended";
    game.result = success ? "complete" : "failed";
    if (!success || !advanceJob("order_closed")) game.step = "done";
    ui.restartButton.hidden = true;
    if (success && game.waterValveClosed) {
      penalize("service", 18, "Work order closed with an active customer water outage.");
    }
    cue(success ? "complete" : "fail");
    stopRain();
    const letter = gradeLetter(game.grade);

    const outcome = persistentOutcome({ success, rushed: game.rushed, waterValveClosed: game.waterValveClosed, jobType: game.jobType });
    const economy = shiftEconomy(history, {
      success,
      score: game.grade,
      collisions: game.collisions,
      rewardMultiplier: game.modifier.rewardMultiplier
    });
    history.shifts += 1;
    history.downstreamClog = outcome.downstreamClog;
    history.waterOutage = outcome.waterOutage;
    history.weakClamp = outcome.weakClamp;
    history.failedPatch = outcome.failedPatch;
    if (success && game.jobType === "water") history.waterJobs += 1;
    if (success && game.jobType === "drain") history.drainJobs += 1;
    if (success && game.jobType === "pothole") history.potholeJobs += 1;
    history.lastResult = outcome.lastResult;
    history.bestGrade = bestGrade(history.bestGrade, letter);
    history.budget = economy.budget;
    history.trust = economy.trust;
    saveHistory();

    ui.endTitle.textContent = success ? `Service grade: ${letter}` : "Call failed";
    const callbackSaved = outcome.downstreamClog || outcome.waterOutage || outcome.weakClamp || outcome.failedPatch;
    const consequence = consequenceReport(outcome);
    ui.endSummary.textContent = `${summary} Response ${formatTime(game.elapsed)}; ${game.collisions} traffic incident${game.collisions === 1 ? "" : "s"}.` + (callbackSaved ? " This callback is saved for the next shift." : "");
    ui.endConsequence.classList.toggle("callback", consequence.callback);
    ui.endConsequence.innerHTML = `
      <p>${consequence.title}</p>
      <div><span><small>TODAY</small>${consequence.cause}</span><b aria-hidden="true">→</b><span><small>NEXT SHIFT</small>${consequence.effect}</span></div>`;
    ui.endStats.innerHTML = [
      ["Safety", Math.round(game.scores.safety)],
      ["Service", Math.round(game.scores.service)],
      ["Quality", Math.round(game.scores.quality)],
      ["Call multiplier", `×${game.modifier.rewardMultiplier.toFixed(2)}`],
      ["Budget", `${economy.budgetDelta >= 0 ? "+" : ""}$${economy.budgetDelta}`],
      ["Town trust", `${history.trust}/100`]
    ].map(([label, value]) => `<div>${label}<strong>${value}</strong></div>`).join("");
    ui.endPanel.hidden = false;
    syncUI();
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function syncUI() {
    const waterJob = game.jobType === "water";
    const potholeJob = game.jobType === "pothole";
    const score = Math.round(game.grade);
    const color = gradeColor(score);
    ui.grade.textContent = gradeLetter(score);
    ui.grade.style.color = color;
    ui.gradeMeter.style.width = `${score}%`;
    ui.gradeMeter.style.backgroundColor = color;
    ui.gradeReason.textContent = game.paused ? "Shift paused." : game.gradeReason;
    const objective = {
      cones: game.carrying === "cone" ? "Place the cone on a striped marker" : "Build a three-cone traffic taper",
      locator: "Fetch the utility locator from Unit 12",
      locate: waterJob ? "Locate the leaking water main" : potholeJob ? "Inspect and mark the pavement failure" : "Mark the buried water service",
      tool: waterJob ? "Fetch the clamp kit from Unit 12" : potholeJob ? "Fetch patch and compactor" : "Fetch the drain rake from Unit 12",
      clear: waterJob ? "Isolate and clamp the water main" : potholeJob ? "Prepare, fill, and compact the pothole" : "Clear the flooded storm drain",
      verify: waterJob ? "Restore service and pressure-test" : potholeJob ? "Verify crown and compaction" : "Verify downstream drainage flow",
      cleanup: "Recover the traffic-control equipment",
      return: "Return to Unit 12 and close the order",
      done: game.result === "complete" ? "Work order closed" : "Dispatch escalation required"
    };
    ui.objective.textContent = objective[game.step];

    const tasks = [
      ["Place three traffic cones", game.zoneSecured],
      [waterJob ? "Locate leaking water main" : potholeJob ? "Inspect pavement failure" : "Locate buried water service", game.utilityMarked],
      [waterJob ? "Retrieve clamp kit" : potholeJob ? "Retrieve patch and compactor" : "Retrieve drain rake", game.toolRetrieved],
      [waterJob ? "Clamp main" : potholeJob ? "Fill and compact pothole" : "Restore drainage", game.repairRestored],
      [waterJob ? "Restore and pressure-test" : potholeJob ? "Verify surface" : "Verify flow", game.flowVerified],
      ["Reopen street", game.result === "complete"]
    ];
    ui.checklist.innerHTML = tasks.map(([label, done]) => `<li class="${done ? "done" : ""}">${label}</li>`).join("");
    ui.townState.innerHTML = `
      <span>Runoff level <strong>${Math.round(game.flood)}%</strong></span>
      <span>Traffic <strong>${game.conesPlaced.length >= 2 ? "Slowing" : "Live"}</strong></span>
      <span>Water service <strong>${!game.utilityMarked ? "Unknown" : game.waterValveClosed ? "OFF" : "Marked · ON"}</strong></span>
      <span>Safety / Service / Quality <strong>${Math.round(game.scores.safety)} / ${Math.round(game.scores.service)} / ${Math.round(game.scores.quality)}</strong></span>
      <span>Downstream line <strong>${history.downstreamClog ? "Restricted" : "Clear"}</strong></span>
      <span>Shift condition <strong>${game.modifier.label}</strong></span>
      <span>Hazard pay <strong>${hazardPayLabel(game.modifier)}</strong></span>
      <span>Department budget <strong>$${history.budget}</strong></span>
      <span>Town trust / Crew rank <strong>${history.trust} / ${1 + Math.floor((history.drainJobs + history.waterJobs + history.potholeJobs) / 3)}</strong></span>
      <span>Quick-load rack <strong>${history.rackUpgrade ? "Installed" : "Stock"}</strong></span>
      <span>Completed drain / water / road calls <strong>${history.drainJobs} / ${history.waterJobs} / ${history.potholeJobs}</strong></span>
      <span>Prior shifts <strong>${history.shifts}</strong></span>`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawRoads();
    drawServiceCustomer();
    drawFlood();
    drawWorkZone();
    drawTruck();
    drawTraffic();
    drawObjectiveMarker();
    drawPlayer();
    drawRain();
    drawAtmosphere();
    drawHUD();
    if (game.paused && game.mode === "playing") drawPause();
  }

  function fillRoundRect(x, y, width, height, radius, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function drawTree(x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(4,12,13,.34)";
    ctx.beginPath(); ctx.ellipse(8, 13, 25, 12, -.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#47392b";
    fillRoundRect(-4, 4, 8, 23, 3, "#47392b");
    const crown = ctx.createRadialGradient(-7, -9, 3, 0, 0, 30);
    crown.addColorStop(0, "#55a56f");
    crown.addColorStop(.55, "#23714f");
    crown.addColorStop(1, "#123f37");
    ctx.fillStyle = crown;
    ctx.beginPath(); ctx.arc(-10, -4, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -9, 21, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, 8, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(166,235,176,.22)";
    ctx.beginPath(); ctx.ellipse(-1, -17, 15, 7, -.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    const grass = ctx.createLinearGradient(0, 0, W, H);
    grass.addColorStop(0, "#174b3d");
    grass.addColorStop(.5, "#225944");
    grass.addColorStop(1, "#103c36");
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(116,184,120,.13)";
    for (let i = 0; i < 110; i++) {
      const x = (i * 83 + 29) % W;
      const y = (i * 47 + 11) % H;
      ctx.beginPath(); ctx.ellipse(x, y, 2 + (i % 3), 1, (i % 5) * .3, 0, Math.PI * 2); ctx.fill();
    }

    // Raised sidewalks and curbs give the intersection a toy-diorama silhouette.
    ctx.fillStyle = "rgba(7,16,17,.35)";
    ctx.fillRect(0, 194, W, 30);
    ctx.fillRect(0, 384, W, 33);
    ctx.fillRect(370, 0, 34, H);
    ctx.fillRect(557, 0, 35, H);
    const walk = ctx.createLinearGradient(0, 190, 0, 416);
    walk.addColorStop(0, "#b8b4a8");
    walk.addColorStop(1, "#7f827d");
    ctx.fillStyle = walk;
    ctx.fillRect(0, 188, W, 27);
    ctx.fillRect(0, 384, W, 29);
    ctx.fillRect(374, 0, 27, H);
    ctx.fillRect(560, 0, 28, H);
    ctx.fillStyle = "rgba(234,237,224,.24)";
    ctx.fillRect(0, 189, W, 3);
    ctx.fillRect(375, 0, 3, H);
    ctx.strokeStyle = "rgba(52,58,57,.38)";
    ctx.lineWidth = 1;
    for (let x = 22; x < W; x += 58) {
      ctx.beginPath(); ctx.moveTo(x, 189); ctx.lineTo(x, 214); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 25, 385); ctx.lineTo(x + 25, 412); ctx.stroke();
    }
    for (let y = 18; y < H; y += 54) {
      ctx.beginPath(); ctx.moveTo(375, y); ctx.lineTo(400, y + 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(561, y + 12); ctx.lineTo(587, y + 5); ctx.stroke();
    }

    drawTree(67, 91, 1.2);
    drawTree(292, 95, .95);
    drawTree(655, 103, 1.08);
    drawTree(902, 520, 1.25);
    drawTree(318, 531, .85);
  }

  function drawServiceCustomer() {
    ctx.save();
    ctx.shadowColor = "rgba(2,8,10,.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    fillRoundRect(778, 50, 164, 111, 7, game.waterValveClosed ? "#453c3b" : "#f0d29b");
    ctx.shadowColor = "transparent";
    ctx.fillStyle = game.waterValveClosed ? "#815047" : "#e45c47";
    ctx.beginPath();
    ctx.moveTo(768, 58); ctx.lineTo(951, 58); ctx.lineTo(938, 37); ctx.lineTo(785, 37); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffefbf";
    for (let x = 786; x < 944; x += 28) ctx.fillRect(x, 58, 14, 14);
    ctx.fillStyle = "#d54d3c";
    for (let x = 800; x < 944; x += 28) ctx.fillRect(x, 58, 14, 14);
    fillRoundRect(796, 83, 66, 50, 4, game.waterValveClosed ? "#1d2728" : "#174a55");
    fillRoundRect(875, 83, 48, 68, 4, "#25464c");
    ctx.fillStyle = game.waterValveClosed ? "#592f31" : "rgba(114,220,238,.4)";
    ctx.fillRect(802, 89, 54, 29);
    ctx.fillStyle = "rgba(250,222,133,.5)";
    ctx.fillRect(881, 90, 36, 52);
    ctx.fillStyle = "#fff3cf";
    ctx.font = "900 13px ui-sans-serif, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = game.waterValveClosed ? "#ff665d" : "#ffb34f";
    ctx.shadowBlur = 7;
    ctx.fillText("MAPLE DINER", 860, 52);
    ctx.shadowBlur = 0;
    fillRoundRect(801, 137, 121, 19, 4, game.waterValveClosed ? "#8d3434" : "#1d6f67");
    ctx.fillStyle = "#f8f0d7";
    ctx.font = "800 9px ui-sans-serif, sans-serif";
    ctx.fillText(game.waterValveClosed ? "SERVICE INTERRUPTED" : "OPEN · WATER ON", 861, 150);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawRoads() {
    const asphalt = ctx.createLinearGradient(0, 216, 0, 384);
    asphalt.addColorStop(0, "#34434a");
    asphalt.addColorStop(.48, "#202f36");
    asphalt.addColorStop(1, "#16272e");
    ctx.fillStyle = asphalt;
    ctx.fillRect(0, 216, W, 168);
    const vertical = ctx.createLinearGradient(400, 0, 560, 0);
    vertical.addColorStop(0, "#17272e");
    vertical.addColorStop(.5, "#2d3d43");
    vertical.addColorStop(1, "#14252c");
    ctx.fillStyle = vertical;
    ctx.fillRect(400, 0, 160, H);

    // Wet-road reflections and patched asphalt break up the broad flat planes.
    const sheen = ctx.createLinearGradient(0, 235, W, 350);
    sheen.addColorStop(0, "rgba(90,153,166,0)");
    sheen.addColorStop(.48, "rgba(120,186,194,.12)");
    sheen.addColorStop(.65, "rgba(255,179,71,.08)");
    sheen.addColorStop(1, "rgba(90,153,166,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 224, W, 150);
    ctx.fillStyle = "rgba(8,18,23,.18)";
    for (let i = 0; i < 28; i++) {
      const x = (i * 109 + 17) % W;
      const y = 230 + (i * 37) % 138;
      ctx.beginPath(); ctx.ellipse(x, y, 16 + i % 11, 2 + i % 3, -.12, 0, Math.PI * 2); ctx.fill();
    }

    ctx.strokeStyle = "#f1c84b";
    ctx.lineWidth = 4;
    ctx.setLineDash([24, 20]);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(W, 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(480, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,246,219,.72)";
    ctx.lineWidth = 6;
    for (let x = 407; x < 557; x += 22) {
      ctx.beginPath(); ctx.moveTo(x, 224); ctx.lineTo(x, 250); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 350); ctx.lineTo(x, 376); ctx.stroke();
    }
    ctx.fillStyle = "rgba(236,226,193,.78)";
    ctx.font = "900 12px ui-sans-serif, sans-serif";
    ctx.fillText("GRAND AVE", 24, 207);
    ctx.save(); ctx.translate(393, 130); ctx.rotate(-Math.PI / 2); ctx.fillText("BIRCH ST", 0, 0); ctx.restore();

    // Cast-iron details anchor the utilities in the street.
    ctx.fillStyle = "#111d22";
    ctx.beginPath(); ctx.arc(520, 335, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#627077";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(520, 335, 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(511, 335); ctx.lineTo(529, 335); ctx.stroke();
  }

  function drawFlood() {
    if (game.jobType === "pothole") {
      const size = 17 + game.flood * .32;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.65)";
      ctx.shadowBlur = 13;
      const hole = ctx.createRadialGradient(world.pothole.x - 6, world.pothole.y - 5, 3, world.pothole.x, world.pothole.y, size);
      hole.addColorStop(0, game.repairRestored ? "#56636a" : "#091318");
      hole.addColorStop(.72, game.repairRestored ? "#36464c" : "#111a1d");
      hole.addColorStop(1, "#667077");
      ctx.fillStyle = hole;
      ctx.beginPath(); ctx.ellipse(world.pothole.x, world.pothole.y, size, size * .62, .15, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(143,158,162,.72)";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 5; i++) {
        const angle = i * 1.28 + .2;
        ctx.beginPath();
        ctx.moveTo(world.pothole.x + Math.cos(angle) * size * .7, world.pothole.y + Math.sin(angle) * size * .4);
        ctx.lineTo(world.pothole.x + Math.cos(angle) * size * 1.45, world.pothole.y + Math.sin(angle) * size * .9);
        ctx.stroke();
      }
      if (!game.repairRestored) {
        ctx.fillStyle = "rgba(105,171,190,.2)";
        ctx.beginPath(); ctx.ellipse(world.pothole.x - 3, world.pothole.y - 2, size * .62, size * .24, .15, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return;
    }
    const source = game.jobType === "water" ? world.waterLeak : world.inlet;
    const radius = 38 + game.flood * 1.25;
    const gradient = ctx.createRadialGradient(source.x - 10, source.y - 8, 5, source.x, source.y, radius);
    gradient.addColorStop(0, "rgba(128,225,244,.78)");
    gradient.addColorStop(.38, "rgba(41,145,184,.58)");
    gradient.addColorStop(1, "rgba(20,91,132,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(source.x, source.y, radius * 1.2, radius * .55, -.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(202,246,255,.46)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(source.x, source.y, 20 + ((game.elapsed * 18 + i * 25) % Math.max(30, radius)), 0, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(218,250,255,.42)";
    for (let i = 0; i < 7; i++) {
      const angle = game.elapsed * .9 + i * 1.7;
      const d = 12 + (i * 19) % Math.max(25, radius * .7);
      ctx.beginPath(); ctx.arc(source.x + Math.cos(angle) * d, source.y + Math.sin(angle) * d * .35, 2 + i % 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWorkZone() {
    for (let i = 0; i < coneTargets.length; i++) {
      const target = coneTargets[i];
      if (!game.conesPlaced.includes(i) && game.step === "cones") {
        ctx.strokeStyle = "rgba(255,210,82,.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(target.x - 12, target.y - 9, 24, 18);
        ctx.setLineDash([]);
      } else if (game.conesPlaced.includes(i)) {
        if (game.step === "cleanup") {
          ctx.strokeStyle = `rgba(255,210,82,${.5 + Math.sin(game.elapsed * 6 + i) * .35})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(target.x, target.y, 20, 0, Math.PI * 2); ctx.stroke();
        }
        drawCone(target.x, target.y);
      }
    }

    if (game.utilityMarked || game.step === "locate") {
      ctx.strokeStyle = game.utilityMarked ? "rgba(38,156,220,.9)" : "rgba(38,156,220,.38)";
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      if (game.jobType === "water") {
        ctx.moveTo(world.waterLeak.x, world.waterLeak.y);
        ctx.lineTo(world.valve.x, world.valve.y);
      } else {
        ctx.moveTo(world.utility.x, 340);
        ctx.lineTo(world.utility.x, 480);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#259cdc";
      ctx.font = "800 10px sans-serif";
      ctx.fillText("W", game.jobType === "water" ? world.waterLeak.x - 4 : world.utility.x - 4, game.jobType === "water" ? world.waterLeak.y - 18 : 385);
    }

    if (game.step === "locate") {
      const locateTarget = game.jobType === "water" ? world.waterLeak : game.jobType === "pothole" ? world.pothole : world.utility;
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(locateTarget.x, locateTarget.y, 34, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = "#161d1d";
    ctx.fillRect(world.drain.x - 22, world.drain.y - 7, 44, 14);
    ctx.strokeStyle = "#879394";
    for (let i = -16; i <= 16; i += 8) {
      ctx.beginPath(); ctx.moveTo(world.drain.x + i, world.drain.y - 6); ctx.lineTo(world.drain.x + i, world.drain.y + 6); ctx.stroke();
    }
    if (game.jobType === "drain" && (game.step === "clear" || game.step === "verify")) {
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(world.drain.x, world.drain.y, 32, 0, Math.PI * 2); ctx.stroke();
    }

    if (game.jobType === "water") {
      ctx.strokeStyle = "#182427";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(world.waterLeak.x - 20, world.waterLeak.y - 12);
      ctx.lineTo(world.waterLeak.x - 7, world.waterLeak.y - 2);
      ctx.lineTo(world.waterLeak.x + 4, world.waterLeak.y - 9);
      ctx.lineTo(world.waterLeak.x + 19, world.waterLeak.y + 10);
      ctx.stroke();
      if (!game.repairRestored) {
        ctx.strokeStyle = "rgba(150,225,255,.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(world.waterLeak.x, world.waterLeak.y - 4);
        ctx.lineTo(world.waterLeak.x + Math.sin(game.elapsed * 9) * 5, world.waterLeak.y - 42);
        ctx.stroke();
      }
      if (game.step === "clear" || game.step === "verify") {
        ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(world.waterLeak.x, world.waterLeak.y, 34, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (game.jobType === "pothole" && (game.step === "clear" || game.step === "verify")) {
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(world.pothole.x, world.pothole.y, 36, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = "#1684aa";
    ctx.fillRect(world.hydrant.x - 8, world.hydrant.y - 15, 16, 28);
    ctx.fillStyle = "#d9e1d8";
    ctx.font = "700 10px sans-serif";
    ctx.fillText("WATER", world.hydrant.x - 17, world.hydrant.y + 28);

    ctx.fillStyle = game.waterValveClosed ? "#ff665d" : "#238ebc";
    ctx.beginPath(); ctx.arc(world.valve.x, world.valve.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e7e0be";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(world.valve.x - 7, world.valve.y); ctx.lineTo(world.valve.x + 7, world.valve.y);
    ctx.moveTo(world.valve.x, world.valve.y - 7); ctx.lineTo(world.valve.x, world.valve.y + 7);
    ctx.stroke();
    ctx.fillStyle = "#d9e1d8";
    ctx.font = "700 9px sans-serif";
    ctx.fillText("VALVE", world.valve.x - 15, world.valve.y + 28);
  }

  function drawCone(x, y) {
    ctx.save();
    ctx.fillStyle = "rgba(3,9,12,.4)";
    ctx.beginPath(); ctx.ellipse(x + 3, y + 11, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    fillRoundRect(x - 12, y + 6, 24, 6, 2, "#202b2d");
    const cone = ctx.createLinearGradient(x - 8, y, x + 9, y);
    cone.addColorStop(0, "#d74619"); cone.addColorStop(.5, "#ff8d2e"); cone.addColorStop(1, "#b83215");
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(x, y - 17); ctx.lineTo(x - 8, y + 7); ctx.lineTo(x + 8, y + 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff1ce";
    ctx.beginPath(); ctx.moveTo(x - 6, y - 1); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x + 7, y + 3); ctx.lineTo(x - 7, y + 3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function currentObjectiveTarget() {
    if (game.mode !== "playing" || game.step === "done") return null;
    if (game.step === "cones") {
      if (!game.carrying) return { x: 188, y: 474, label: "UNIT 12" };
      const openTarget = coneTargets
        .map((target, index) => ({ ...target, index, d: distance(game.player, target) }))
        .filter((target) => !game.conesPlaced.includes(target.index))
        .sort((a, b) => a.d - b.d)[0];
      return openTarget ? { x: openTarget.x, y: openTarget.y, label: "CONE MARKER" } : null;
    }
    if (["locator", "tool", "return"].includes(game.step)) return { x: 188, y: 474, label: "UNIT 12" };
    if (game.step === "locate") return game.jobType === "water"
      ? { ...world.waterLeak, label: "LOCATE LEAK" }
      : game.jobType === "pothole" ? { ...world.pothole, label: "INSPECT FAILURE" } : { ...world.utility, label: "UTILITY SWEEP" };
    if (game.step === "clear") {
      if (game.jobType === "water" && !game.waterValveClosed) return { ...world.valve, label: "ISOLATE VALVE" };
      return game.jobType === "water" ? { ...world.waterLeak, label: "CLAMP MAIN" } : game.jobType === "pothole" ? { ...world.pothole, label: "COMPACT PATCH" } : { ...world.drain, label: "STORM INLET" };
    }
    if (game.step === "verify") {
      if (game.jobType === "water" && game.waterValveClosed) return { ...world.valve, label: "RESTORE VALVE" };
      return game.jobType === "water" ? { ...world.waterLeak, label: "PRESSURE TEST" } : game.jobType === "pothole" ? { ...world.pothole, label: "CHECK SURFACE" } : { ...world.drain, label: "STORM INLET" };
    }
    if (game.step === "cleanup") {
      const nearest = nearestPlacedCone();
      return nearest ? { ...coneTargets[nearest.index], label: "RECOVER CONE" } : { x: 188, y: 474, label: "UNIT 12" };
    }
    return null;
  }

  function drawObjectiveMarker() {
    const target = currentObjectiveTarget();
    if (!target) return;
    const targetDistance = distance(game.player, target);
    const pulse = 22 + Math.sin(game.elapsed * 5) * 4;

    if (targetDistance > 90) {
      ctx.strokeStyle = "rgba(255,210,82,.28)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 9]);
      ctx.beginPath();
      ctx.moveTo(game.player.x, game.player.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const glow = ctx.createRadialGradient(target.x, target.y, 2, target.x, target.y, pulse + 12);
    glow.addColorStop(0, "rgba(255,224,104,.22)"); glow.addColorStop(1, "rgba(255,205,55,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(target.x, target.y, pulse + 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,220,82,.95)";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(target.x, target.y, pulse, game.elapsed, game.elapsed + Math.PI * 1.65); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffd452";
    ctx.beginPath();
    ctx.moveTo(target.x, target.y - pulse - 6); ctx.lineTo(target.x - 6, target.y - pulse - 15); ctx.lineTo(target.x + 6, target.y - pulse - 15); ctx.closePath(); ctx.fill();
    ctx.font = "900 10px ui-sans-serif, sans-serif";
    const labelWidth = ctx.measureText(target.label).width + 12;
    fillRoundRect(target.x - labelWidth / 2, target.y - pulse - 39, labelWidth, 18, 6, "rgba(8,17,22,.91)");
    ctx.fillStyle = "#ffd252";
    ctx.fillText(target.label, target.x - labelWidth / 2 + 6, target.y - pulse - 26);
  }

  function drawTruck() {
    const t = world.truck;
    ctx.save();
    ctx.shadowColor = "rgba(2,8,10,.56)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 10;
    fillRoundRect(t.x, t.y + 4, t.w, t.h - 4, 13, "#d9d3bd");
    ctx.shadowColor = "transparent";
    const body = ctx.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
    body.addColorStop(0, "#fff4d5"); body.addColorStop(.62, "#d7d0b7"); body.addColorStop(1, "#a8a58f");
    fillRoundRect(t.x, t.y, t.w, t.h - 7, 12, body);
    ctx.fillStyle = "#df6a25";
    ctx.beginPath(); ctx.roundRect(t.x, t.y, t.w, 15, [12, 12, 0, 0]); ctx.fill();
    ctx.fillStyle = "#34464c";
    ctx.beginPath(); ctx.roundRect(t.x + 101, t.y + 16, 42, 29, [5, 9, 4, 4]); ctx.fill();
    ctx.fillStyle = "rgba(119,205,224,.45)";
    ctx.beginPath(); ctx.roundRect(t.x + 106, t.y + 20, 31, 19, 3); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.48)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(t.x + 108, t.y + 22); ctx.lineTo(t.x + 125, t.y + 38); ctx.stroke();
    ctx.fillStyle = "#17252a";
    for (const wheelX of [t.x + 31, t.x + 119]) {
      ctx.beginPath(); ctx.arc(wheelX, t.y + t.h - 2, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#778185"; ctx.beginPath(); ctx.arc(wheelX, t.y + t.h - 2, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#17252a";
    }
    ctx.fillStyle = "#15282b";
    ctx.font = "900 14px ui-sans-serif, sans-serif";
    ctx.fillText("PUBLIC WORKS", t.x + 12, t.y + 38);
    ctx.fillStyle = "#a44f1f";
    ctx.font = "900 10px ui-sans-serif, sans-serif";
    ctx.fillText("BELLWETHER · UNIT 12", t.x + 12, t.y + 54);
    // Animated amber beacon and loaded equipment silhouette.
    const flash = .45 + Math.sin(game.elapsed * 8) * .4;
    ctx.fillStyle = `rgba(255,177,52,${flash})`;
    ctx.shadowColor = "#ffad32"; ctx.shadowBlur = 12;
    fillRoundRect(t.x + 72, t.y - 8, 17, 9, 4, `rgba(255,177,52,${flash})`);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#253338"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(t.x + 21, t.y + 18); ctx.lineTo(t.x + 85, t.y + 18); ctx.stroke();
    ctx.restore();
  }

  function drawTraffic() {
    for (const car of game.cars) {
      ctx.save();
      ctx.translate(car.x, car.drawY || car.y);
      ctx.fillStyle = "rgba(1,7,10,.44)";
      ctx.beginPath(); ctx.ellipse(4, 6, car.width * .56, car.height * .56, 0, 0, Math.PI * 2); ctx.fill();
      const paint = ctx.createLinearGradient(0, -car.height / 2, 0, car.height / 2);
      paint.addColorStop(0, "rgba(255,255,255,.42)"); paint.addColorStop(.2, car.color); paint.addColorStop(1, "#26343a");
      fillRoundRect(-car.width / 2, -car.height / 2, car.width, car.height, 9, paint);
      fillRoundRect(-14, -car.height / 2 + 4, 29, car.height - 8, 6, "#18313d");
      ctx.fillStyle = "rgba(128,209,225,.35)";
      ctx.beginPath(); ctx.roundRect(-10, -car.height / 2 + 6, 20, car.height - 12, 4); ctx.fill();
      ctx.fillStyle = "#fff2ad";
      ctx.shadowColor = "#ffe985"; ctx.shadowBlur = 8;
      const nose = car.dir > 0 ? 24 : -28;
      fillRoundRect(nose, -9, 5, 6, 2, "#fff2ad");
      fillRoundRect(nose, 3, 5, 6, 2, "#fff2ad");
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#111d22";
      ctx.fillRect(-17, -car.height / 2 - 2, 10, 4); ctx.fillRect(10, -car.height / 2 - 2, 10, 4);
      ctx.fillRect(-17, car.height / 2 - 2, 10, 4); ctx.fillRect(10, car.height / 2 - 2, 10, 4);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (p.hitCooldown > 0 && Math.floor(p.hitCooldown * 10) % 2 === 0) return;
    const moving = keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD") || keys.has("ArrowUp") || keys.has("ArrowDown") || keys.has("ArrowLeft") || keys.has("ArrowRight");
    const bob = moving ? Math.sin(game.elapsed * 13) * 1.8 : Math.sin(game.elapsed * 3) * .7;
    const stride = moving ? Math.sin(game.elapsed * 13) * 4 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = "rgba(1,7,10,.46)";
    ctx.beginPath(); ctx.ellipse(4, 18, 17, 8, -.1, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#173448"; ctx.lineWidth = 7; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(-6 + stride, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 12); ctx.lineTo(6 - stride, 28); ctx.stroke();
    ctx.strokeStyle = "#101c21"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10 + stride, 28); ctx.lineTo(-3 + stride, 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2 - stride, 28); ctx.lineTo(10 - stride, 28); ctx.stroke();
    const vest = ctx.createLinearGradient(-11, -3, 11, 17);
    vest.addColorStop(0, "#ffe45d"); vest.addColorStop(.55, "#f7ad2e"); vest.addColorStop(1, "#d96a20");
    fillRoundRect(-11, -4, 22, 23, 6, vest);
    ctx.fillStyle = "#fff7bd";
    ctx.fillRect(-9, 5, 18, 3); ctx.fillRect(-1, -3, 3, 21);
    ctx.strokeStyle = "#db9d79"; ctx.lineWidth = 6; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-10, 1); ctx.lineTo(-15, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 1); ctx.lineTo(15, 12); ctx.stroke();
    ctx.fillStyle = "#d9a27f";
    ctx.beginPath(); ctx.arc(0, -12, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#17242a";
    ctx.beginPath(); ctx.arc(-3, -13, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -13, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#693d31"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -10, 3, .15, Math.PI - .15); ctx.stroke();
    ctx.fillStyle = "#ffd34f";
    ctx.beginPath(); ctx.arc(0, -18, 10, Math.PI, Math.PI * 2); ctx.fill();
    fillRoundRect(-12, -19, 24, 4, 2, "#e6a124");
    if (game.carrying === "cone") drawCone(20, 1);
    if (game.carrying === "rake") {
      ctx.strokeStyle = "#d9c39b"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(28, 28); ctx.stroke();
      ctx.strokeStyle = "#303938"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(18, 27); ctx.lineTo(38, 19); ctx.stroke();
    }
    if (game.carrying === "clamp") {
      ctx.fillStyle = "#d6a52b";
      ctx.fillRect(12, -5, 27, 22);
      ctx.fillStyle = "#2a3432";
      ctx.fillRect(16, -1, 19, 4);
      ctx.strokeStyle = "#b9c2bd";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(26, 22, 10, .2, Math.PI * 1.7); ctx.stroke();
    }
    if (game.carrying === "patch") {
      ctx.fillStyle = "#282f30";
      ctx.fillRect(12, -4, 28, 24);
      ctx.fillStyle = "#e6d45b";
      ctx.fillRect(15, 0, 22, 5);
      ctx.fillStyle = "#8e9693";
      ctx.beginPath(); ctx.arc(28, 24, 9, 0, Math.PI * 2); ctx.fill();
    }
    if (game.carrying === "locator") {
      ctx.fillStyle = "#e8b62e";
      ctx.fillRect(12, -5, 12, 19);
      ctx.strokeStyle = "#232b29";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(18, 13); ctx.lineTo(29, 30); ctx.stroke();
      ctx.beginPath(); ctx.arc(31, 32, 7, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawRain() {
    ctx.strokeStyle = "rgba(184,230,245,.38)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    for (const drop of game.rain) {
      ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x - 7, drop.y + 19);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(192,235,247,.22)";
    for (let i = 0; i < 14; i++) {
      const x = (i * 127 + game.elapsed * 31) % W;
      const y = 216 + (i * 43) % 168;
      ctx.beginPath(); ctx.ellipse(x, y, 7, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawAtmosphere() {
    const dusk = ctx.createLinearGradient(0, 0, 0, H);
    dusk.addColorStop(0, "rgba(13,44,53,.16)");
    dusk.addColorStop(.55, "rgba(9,27,33,0)");
    dusk.addColorStop(1, "rgba(3,12,16,.22)");
    ctx.fillStyle = dusk;
    ctx.fillRect(0, 0, W, H);

    // Warm work-light pool around Unit 12.
    const workLight = ctx.createRadialGradient(200, 484, 10, 200, 484, 145);
    workLight.addColorStop(0, "rgba(255,190,75,.18)");
    workLight.addColorStop(1, "rgba(255,176,56,0)");
    ctx.fillStyle = workLight;
    ctx.fillRect(45, 360, 310, 220);

    const vignette = ctx.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, W * .7);
    vignette.addColorStop(.58, "rgba(3,10,14,0)");
    vignette.addColorStop(1, "rgba(3,10,14,.43)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHUD() {
    if (game.mode !== "playing") return;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = 15;
    fillRoundRect(18, 18, 226, 62, 12, "rgba(8,23,28,.87)");
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(124,185,190,.35)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(18.5, 18.5, 225, 61, 12); ctx.stroke();
    ctx.fillStyle = "#8dd5e1";
    ctx.font = "900 10px ui-sans-serif, sans-serif";
    ctx.fillText("SITE CONDITION", 32, 38);
    ctx.fillStyle = "#f8edcf";
    ctx.font = "900 17px ui-sans-serif, sans-serif";
    ctx.fillText(`${game.jobType === "pothole" ? "FAILURE" : "RUNOFF"} ${Math.round(game.flood)}%`, 32, 59);
    fillRoundRect(32, 66, 196, 5, 3, "rgba(105,133,139,.34)");
    const hazardColor = game.flood > 70 ? "#ff6a5e" : game.flood > 45 ? "#ffc24d" : "#55d9d0";
    fillRoundRect(32, 66, 196 * (game.flood / 100), 5, 3, hazardColor);

    const progress = {
      locate: [game.jobType === "water" ? "LEAK LOCATION" : game.jobType === "pothole" ? "SURFACE INSPECTION" : "UTILITY LOCATE", game.locateWork],
      clear: [game.jobType === "water" ? "CLAMP INSTALLATION" : game.jobType === "pothole" ? "PATCH COMPACTION" : "DRAIN CLEARANCE", game.work],
      verify: [game.jobType === "water" ? "PRESSURE TEST" : game.jobType === "pothole" ? "SURFACE TEST" : "FLOW VERIFICATION", game.verifyWork]
    }[game.step];
    if (progress && progress[1] > 0) {
      fillRoundRect(W / 2 - 150, H - 78, 300, 52, 13, "rgba(7,20,25,.92)");
      ctx.strokeStyle = "rgba(255,203,76,.42)";
      ctx.beginPath(); ctx.roundRect(W / 2 - 149.5, H - 77.5, 299, 51, 13); ctx.stroke();
      ctx.fillStyle = "#f8edcf";
      ctx.font = "900 11px ui-sans-serif, sans-serif";
      ctx.fillText(progress[0], W / 2 - 132, H - 57);
      fillRoundRect(W / 2 - 132, H - 46, 264, 8, 4, "rgba(93,113,118,.4)");
      fillRoundRect(W / 2 - 132, H - 46, 264 * (progress[1] / 100), 8, 4, "#58dbc2");
    }

    if (game.prompt) {
      ctx.font = "900 14px ui-sans-serif, sans-serif";
      const width = Math.min(520, ctx.measureText(game.prompt).width + 66);
      fillRoundRect(W / 2 - width / 2, 20, width, 42, 12, "rgba(7,20,25,.94)");
      fillRoundRect(W / 2 - width / 2 + 10, 29, 25, 24, 7, "#f2a832");
      ctx.fillStyle = "#142229"; ctx.fillText("!", W / 2 - width / 2 + 20, 46);
      ctx.fillStyle = "#f8edcf";
      ctx.fillText(game.prompt, W / 2 - width / 2 + 44, 46);
    }
    ctx.restore();
  }

  function drawPause() {
    ctx.fillStyle = "rgba(3,12,16,.78)";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 220);
    glow.addColorStop(0, "rgba(240,164,47,.15)"); glow.addColorStop(1, "rgba(240,164,47,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f8edcf";
    ctx.textAlign = "center";
    ctx.font = "900 46px ui-sans-serif, sans-serif";
    ctx.fillText("SHIFT PAUSED", W / 2, H / 2);
    ctx.fillStyle = "#9fb4b7";
    ctx.font = "700 14px ui-sans-serif, sans-serif";
    ctx.fillText("Press P to return to work", W / 2, H / 2 + 30);
    ctx.textAlign = "left";
  }

  function updateHistoryNote() {
    if (history.downstreamClog || history.waterOutage || history.weakClamp || history.failedPatch) {
      ui.historyNote.hidden = false;
      const callbacks = [];
      if (history.downstreamClog) callbacks.push("debris was pushed into the downstream drain");
      if (history.waterOutage) callbacks.push("Maple Diner was left without water service");
      if (history.weakClamp) callbacks.push("a temporary water-main clamp needs follow-up");
      if (history.failedPatch) callbacks.push("a rushed cold patch has begun failing");
      ui.historyNote.textContent = `CALLBACK: Last shift ${callbacks.join(" and ")}. Today's opening service score is reduced.`;
    } else if (history.shifts > 0) {
      ui.historyNote.hidden = false;
      ui.historyNote.textContent = `Town record: ${history.lastResult}. Best recorded grade: ${history.bestGrade}.`;
    } else {
      ui.historyNote.hidden = true;
    }
    syncUpgradeButton();
    syncDispatchBoard();
  }

  function hazardPayLabel(modifier) {
    const bonus = Math.round((modifier.rewardMultiplier - 1) * 100);
    return bonus > 0 ? `+${bonus}%` : "standard rate";
  }

  function syncDispatchBoard() {
    const buttons = { drain: ui.startButton, water: ui.waterButton, pothole: ui.potholeButton };
    Object.entries(buttons).forEach(([jobType, button]) => {
      const job = JOB_BOARD[jobType];
      const modifier = shiftModifier(jobType, history.shifts);
      button.textContent = `${job.number} · ${job.name} · ${modifier.label} · ${hazardPayLabel(modifier)}`;
    });
    ui.shiftChip.innerHTML = '<span class="rain-dot"></span> Three calls waiting · 4:18 PM';
  }

  function syncUpgradeButton() {
    if (history.rackUpgrade) {
      ui.upgradeButton.textContent = "Quick-load rack installed · +12% field speed";
      ui.upgradeButton.disabled = true;
      return;
    }
    const shortfall = Math.max(0, RACK_COST - history.budget);
    ui.upgradeButton.textContent = shortfall > 0
      ? `Quick-load rack · need $${shortfall} more`
      : `Buy quick-load rack · $${RACK_COST}`;
    ui.upgradeButton.disabled = shortfall > 0;
  }

  function purchaseRackUpgrade() {
    if (history.rackUpgrade || history.budget < RACK_COST) return;
    history.budget -= RACK_COST;
    history.rackUpgrade = true;
    history.lastResult = "Quick-load rack installed on Unit 12";
    saveHistory();
    game = freshGame();
    updateHistoryNote();
    syncUI();
    cue("complete");
  }

  window.addEventListener("keydown", (event) => {
    const controlled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
    if (controlled.includes(event.code)) event.preventDefault();
    if (!keys.has(event.code)) justPressed.add(event.code);
    keys.add(event.code);
    if (event.code === "KeyP" && game.mode === "playing") {
      game.paused = !game.paused;
      cue("pickup");
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => { keys.clear(); if (game.mode === "playing") game.paused = true; });

  ui.startButton.addEventListener("click", () => startGame("drain"));
  ui.waterButton.addEventListener("click", () => startGame("water"));
  ui.potholeButton.addEventListener("click", () => startGame("pothole"));
  ui.upgradeButton.addEventListener("click", purchaseRackUpgrade);
  ui.restartButton.addEventListener("click", () => startGame(game.jobType));
  ui.muteButton.addEventListener("click", () => {
    audioMuted = !audioMuted;
    try { localStorage.setItem(AUDIO_KEY, String(audioMuted)); } catch { /* preference stays in memory */ }
    if (audioMuted) {
      stopRain();
    } else {
      ensureAudio();
      if (game.mode === "playing") startRain();
      cue("pickup");
    }
    syncMuteButton();
  });
  ui.againButton.addEventListener("click", () => {
    updateHistoryNote();
    ui.endPanel.hidden = true;
    ui.startPanel.hidden = false;
    ui.restartButton.hidden = true;
    game = freshGame();
    syncUI();
  });
  ui.resetButton.addEventListener("click", () => {
    if (!resetArmed) {
      resetArmed = true;
      ui.resetButton.textContent = "Click again to erase town history";
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetArmed = false;
        ui.resetButton.textContent = "Reset town history";
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    ui.resetButton.textContent = "Reset town history";
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
    history = loadHistory();
    game = freshGame();
    updateHistoryNote();
    syncUI();
  });

  document.querySelectorAll(".touch-key").forEach((button) => {
    const code = button.dataset.key;
    const release = () => {
      keys.delete(code);
      button.classList.remove("is-held");
    };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (code === "KeyP") {
        if (game.mode === "playing") {
          game.paused = !game.paused;
          cue("pickup");
        }
        return;
      }
      if (!keys.has(code)) justPressed.add(code);
      keys.add(code);
      button.classList.add("is-held");
      canvas.focus();
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    draw();
    justPressed.clear();
    requestAnimationFrame(frame);
  }

  updateHistoryNote();
  syncMuteButton();
  syncUI();
  requestAnimationFrame(frame);
})();
