(() => {
  "use strict";

  const rules = window.PublicWorksRules;
  if (!rules) throw new Error("Public Works rules module failed to load.");
  const {
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
  } = rules;

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    startPanel: document.querySelector("#startPanel"),
    endPanel: document.querySelector("#endPanel"),
    startButton: document.querySelector("#startButton"),
    againButton: document.querySelector("#againButton"),
    resetButton: document.querySelector("#resetButton"),
    restartButton: document.querySelector("#restartButton"),
    muteButton: document.querySelector("#muteButton"),
    historyNote: document.querySelector("#historyNote"),
    grade: document.querySelector("#grade"),
    gradeMeter: document.querySelector("#gradeMeter"),
    gradeReason: document.querySelector("#gradeReason"),
    objective: document.querySelector("#objective"),
    checklist: document.querySelector("#checklist"),
    townState: document.querySelector("#townState"),
    endTitle: document.querySelector("#endTitle"),
    endSummary: document.querySelector("#endSummary"),
    endStats: document.querySelector("#endStats")
  };

  const STORAGE_KEY = "pwd-first-shift-v1";
  const AUDIO_KEY = "pwd-audio-muted-v1";
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
    valve: { x: 792, y: 448 }
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

  function freshGame() {
    const scores = createInitialScores(history);
    return {
      mode: "title",
      paused: false,
      elapsed: 0,
      grade: computeOverallScore(scores),
      gradeReason: history.downstreamClog || history.waterOutage ? "Yesterday's callback has reduced today's opening service score." : "Call received. The clock is running.",
      flood: history.downstreamClog ? 34 : 18,
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
      player: { x: 295, y: 492, radius: 13, speed: 168, hitCooldown: 0 },
      cars: trafficTemplate.map((car) => ({ ...car, width: 58, height: 28 })),
      rain: Array.from({ length: 90 }, (_, i) => ({
        x: (i * 83) % W,
        y: (i * 47) % H,
        speed: 280 + (i % 5) * 28
      }))
    };
  }

  function startGame() {
    game = freshGame();
    game.mode = "playing";
    keys.clear();
    justPressed.clear();
    ui.startPanel.hidden = true;
    ui.endPanel.hidden = true;
    ui.restartButton.hidden = false;
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
    const timeDrain = secured ? 0.018 : 0.034;
    game.scores.service = clamp(game.scores.service - timeDrain * dt * 10, 0, 100);
    if (game.step === "verify") {
      game.flood = clamp(game.flood - 3.5 * dt, 0, 100);
    } else if (game.step === "cleanup" || game.step === "return") {
      game.flood = clamp(game.flood - (game.rushed ? 2 : 7) * dt, 0, 100);
    } else {
      game.flood = clamp(game.flood + (game.step === "clear" ? 0.65 : 1.05) * dt, 0, 100);
    }

    if (game.flood >= 72 && game.step !== "done") {
      game.gradeReason = "Runoff has reached Birch Street storefronts.";
      game.scores.service = clamp(game.scores.service - 1.2 * dt, 0, 100);
    }

    handleInteraction(dt);
    recomputeGrade();

    const repairRestored = game.step === "verify" || game.step === "cleanup" || game.step === "return";
    if ((!repairRestored && game.flood >= 100) || game.grade <= 20) {
      finish(false, "The intersection flooded before the drain was restored.");
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
      let speed = car.speed;
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
    const atDrain = distance(game.player, world.drain) < 52;
    const atUtility = distance(game.player, world.utility) < 56;
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
          game.gradeReason = "Locate the blue water service before using a steel rake.";
        }
      } else {
        game.prompt = "Return to Unit 12 for the utility locator";
      }
    } else if (game.step === "locate") {
      if (!atUtility) {
        game.prompt = "Bring the locator to the pulsing utility mark";
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
            game.gradeReason = "Water service marked in blue. Steel tools may stay west of the line.";
          }
        }
      }
    } else if (game.step === "tool") {
      if (atTruck) {
        game.prompt = "E · Take drain rake";
        if (justPressed.has("KeyE")) {
          game.carrying = "rake";
          cue("pickup");
          game.toolRetrieved = true;
          advanceJob("tool_taken");
          game.gradeReason = "Work zone secured. Clear the inlet before it overtops.";
        }
      } else {
        game.prompt = "Return to Unit 12 for the drain rake";
      }
    } else if (game.step === "clear") {
      if (!atDrain) {
        game.prompt = "Bring the drain rake to the flashing inlet";
      } else {
        game.prompt = "Hold E · Clear carefully   |   R · Rush flush";
        if (keys.has("KeyE")) {
          game.work = clamp(game.work + 23 * dt, 0, 100);
          game.flood = clamp(game.flood - 5.5 * dt, 0, 100);
          game.gradeReason = `Clearing debris carefully… ${Math.floor(game.work)}%`;
          if (game.work >= 100) completeRepair(false);
        }
        if (justPressed.has("KeyR")) {
          game.work = 100;
          completeRepair(true);
        }
      }
    } else if (game.step === "verify") {
      if (!atDrain) {
        game.prompt = "Return to the inlet and verify downstream flow";
      } else {
        game.prompt = "Hold E · Verify flow and rake bars";
        if (keys.has("KeyE")) {
          game.verifyWork = clamp(game.verifyWork + 42 * dt, 0, 100);
          game.flood = clamp(game.flood - 11 * dt, 0, 100);
          game.gradeReason = `Testing drainage flow… ${Math.floor(game.verifyWork)}%`;
          if (game.verifyWork >= 100) {
            cue("verify");
            game.flowVerified = true;
            game.carrying = null;
            advanceJob("flow_verified");
            game.gradeReason = "Flow verified. Recover all cones before reopening Grand Avenue.";
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
          finish(true, game.rushed
            ? "The street reopened, but the unverified rush flush lodged debris downstream."
            : "The drain is flowing, utilities are intact, and Grand Avenue is safely reopened.");
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
      penalize("service", 12, "Wrong valve closed: Maple Diner has lost water service.");
    } else {
      cue("verify");
      game.gradeReason = "Maple Diner water restored. The outage remains on the incident report.";
    }
  }

  function completeRepair(rushed) {
    game.rushed = rushed;
    game.repairRestored = true;
    game.carrying = null;
    if (rushed) {
      cue("alert");
      penalize("quality", 36, "Rush flush used: debris moved downstream without a flow test.");
      advanceJob("repair_rushed");
    } else {
      cue("repair");
      advanceJob("repair_careful");
      game.gradeReason = "Blockage removed. Verify flow before reopening the street.";
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

    const outcome = persistentOutcome({ success, rushed: game.rushed, waterValveClosed: game.waterValveClosed });
    history.shifts += 1;
    history.downstreamClog = outcome.downstreamClog;
    history.waterOutage = outcome.waterOutage;
    history.lastResult = outcome.lastResult;
    history.bestGrade = bestGrade(history.bestGrade, letter);
    saveHistory();

    ui.endTitle.textContent = success ? `Service grade: ${letter}` : "Call failed";
    const callbackSaved = game.rushed || game.waterValveClosed;
    ui.endSummary.textContent = `${summary} Response ${formatTime(game.elapsed)}; ${game.collisions} traffic incident${game.collisions === 1 ? "" : "s"}.` + (callbackSaved ? " This callback is saved for the next shift." : "");
    ui.endStats.innerHTML = [
      ["Safety", Math.round(game.scores.safety)],
      ["Service", Math.round(game.scores.service)],
      ["Quality", Math.round(game.scores.quality)]
    ].map(([label, value]) => `<div>${label}<strong>${value}</strong></div>`).join("");
    ui.endPanel.hidden = false;
    syncUI();
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  }

  function syncUI() {
    const score = Math.round(game.grade);
    const color = gradeColor(score);
    ui.grade.textContent = gradeLetter(score);
    ui.grade.style.color = color;
    ui.gradeMeter.style.width = `${score}%`;
    ui.gradeMeter.style.backgroundColor = color;
    ui.gradeReason.textContent = game.paused ? "Shift paused." : game.gradeReason;
    ui.objective.textContent = {
      cones: game.carrying === "cone" ? "Place the cone on a striped marker" : "Build a three-cone traffic taper",
      locator: "Fetch the utility locator from Unit 12",
      locate: "Mark the buried water service",
      tool: "Fetch the drain rake from Unit 12",
      clear: "Clear the flooded storm drain",
      verify: "Verify downstream drainage flow",
      cleanup: "Recover the traffic-control equipment",
      return: "Return to Unit 12 and close the order",
      done: game.result === "complete" ? "Work order closed" : "Dispatch escalation required"
    }[game.step];

    const tasks = [
      ["Place three traffic cones", game.zoneSecured],
      ["Locate buried water service", game.utilityMarked],
      ["Retrieve drain rake", game.toolRetrieved],
      ["Restore drainage", game.repairRestored],
      ["Verify flow", game.flowVerified],
      ["Reopen street", game.result === "complete"]
    ];
    ui.checklist.innerHTML = tasks.map(([label, done]) => `<li class="${done ? "done" : ""}">${label}</li>`).join("");
    ui.townState.innerHTML = `
      <span>Runoff level <strong>${Math.round(game.flood)}%</strong></span>
      <span>Traffic <strong>${game.conesPlaced.length >= 2 ? "Slowing" : "Live"}</strong></span>
      <span>Water service <strong>${!game.utilityMarked ? "Unknown" : game.waterValveClosed ? "OFF" : "Marked · ON"}</strong></span>
      <span>Safety / Service / Quality <strong>${Math.round(game.scores.safety)} / ${Math.round(game.scores.service)} / ${Math.round(game.scores.quality)}</strong></span>
      <span>Downstream line <strong>${history.downstreamClog ? "Restricted" : "Clear"}</strong></span>
      <span>Prior shifts <strong>${history.shifts}</strong></span>`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawServiceCustomer();
    drawRoads();
    drawFlood();
    drawWorkZone();
    drawTruck();
    drawTraffic();
    drawObjectiveMarker();
    drawPlayer();
    drawRain();
    drawHUD();
    if (game.paused && game.mode === "playing") drawPause();
  }

  function drawGround() {
    ctx.fillStyle = "#365141";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#496554";
    for (let i = 0; i < 65; i++) ctx.fillRect((i * 97) % W, (i * 61) % H, 2, 2);
    ctx.fillStyle = "#8d8979";
    ctx.fillRect(0, 190, W, 26);
    ctx.fillRect(0, 384, W, 28);
    ctx.fillRect(374, 0, 26, H);
    ctx.fillRect(560, 0, 27, H);
    ctx.fillStyle = "#c8be9e";
    ctx.font = "700 15px sans-serif";
    ctx.fillText("GRAND AVE", 24, 210);
    ctx.save();
    ctx.translate(392, 130);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("BIRCH ST", 0, 0);
    ctx.restore();
  }

  function drawServiceCustomer() {
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(791, 71, 148, 92);
    ctx.fillStyle = game.waterValveClosed ? "#4b3a35" : "#d5c49a";
    ctx.fillRect(784, 64, 148, 92);
    ctx.fillStyle = "#b64e3c";
    ctx.fillRect(774, 52, 168, 22);
    ctx.fillStyle = "#fff2cf";
    ctx.font = "900 13px sans-serif";
    ctx.fillText("MAPLE DINER", 806, 68);
    ctx.fillStyle = game.waterValveClosed ? "#ff665d" : "#274f57";
    ctx.fillRect(802, 91, 112, 38);
    ctx.fillStyle = "#f4f0db";
    ctx.font = "800 11px sans-serif";
    ctx.fillText(game.waterValveClosed ? "NO WATER" : "OPEN · WATER ON", 812, 114);
  }

  function drawRoads() {
    ctx.fillStyle = "#333b3d";
    ctx.fillRect(0, 216, W, 168);
    ctx.fillRect(400, 0, 160, H);
    ctx.strokeStyle = "#dbc75a";
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.beginPath(); ctx.moveTo(0, 300); ctx.lineTo(W, 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(480, H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 5;
    for (let x = 405; x < 560; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 226); ctx.lineTo(x, 249); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, 351); ctx.lineTo(x, 374); ctx.stroke();
    }
  }

  function drawFlood() {
    const radius = 38 + game.flood * 1.25;
    const gradient = ctx.createRadialGradient(world.inlet.x, world.inlet.y, 5, world.inlet.x, world.inlet.y, radius);
    gradient.addColorStop(0, "rgba(74,160,196,.72)");
    gradient.addColorStop(1, "rgba(74,160,196,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(world.inlet.x, world.inlet.y, radius * 1.2, radius * .55, -.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(170,225,245,.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(world.inlet.x, world.inlet.y, 20 + ((game.elapsed * 18 + i * 25) % Math.max(30, radius)), 0, Math.PI * 1.4);
      ctx.stroke();
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
      ctx.moveTo(world.utility.x, 340);
      ctx.lineTo(world.utility.x, 480);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#259cdc";
      ctx.font = "800 10px sans-serif";
      ctx.fillText("W", world.utility.x - 4, 385);
    }

    if (game.step === "locate") {
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(world.utility.x, world.utility.y, 34, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = "#161d1d";
    ctx.fillRect(world.drain.x - 22, world.drain.y - 7, 44, 14);
    ctx.strokeStyle = "#879394";
    for (let i = -16; i <= 16; i += 8) {
      ctx.beginPath(); ctx.moveTo(world.drain.x + i, world.drain.y - 6); ctx.lineTo(world.drain.x + i, world.drain.y + 6); ctx.stroke();
    }
    if (game.step === "clear" || game.step === "verify") {
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(world.drain.x, world.drain.y, 32, 0, Math.PI * 2); ctx.stroke();
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
    ctx.fillStyle = "#1d2422";
    ctx.fillRect(x - 11, y + 7, 22, 5);
    ctx.fillStyle = "#ff7a22";
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 8, y + 8); ctx.lineTo(x + 8, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4f0db";
    ctx.fillRect(x - 5, y, 10, 4);
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
    if (game.step === "locate") return { ...world.utility, label: "UTILITY SWEEP" };
    if (game.step === "clear" || game.step === "verify") return { ...world.drain, label: "STORM INLET" };
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

    ctx.strokeStyle = "rgba(255,210,82,.92)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "800 10px sans-serif";
    const labelWidth = ctx.measureText(target.label).width + 12;
    ctx.fillStyle = "rgba(12,21,18,.84)";
    ctx.fillRect(target.x - labelWidth / 2, target.y - pulse - 21, labelWidth, 16);
    ctx.fillStyle = "#ffd252";
    ctx.fillText(target.label, target.x - labelWidth / 2 + 6, target.y - pulse - 9);
  }

  function drawTruck() {
    const t = world.truck;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(t.x + 8, t.y + 12, t.w, t.h);
    ctx.fillStyle = "#e7e0be";
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = "#d27c24";
    ctx.fillRect(t.x, t.y, t.w, 12);
    ctx.fillStyle = "#274f57";
    ctx.fillRect(t.x + 104, t.y + 18, 36, 24);
    ctx.fillStyle = "#202827";
    ctx.beginPath(); ctx.arc(t.x + 30, t.y + t.h, 14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(t.x + 118, t.y + t.h, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a2825";
    ctx.font = "900 14px sans-serif";
    ctx.fillText("PUBLIC WORKS", t.x + 11, t.y + 39);
    ctx.font = "700 11px sans-serif";
    ctx.fillText("UNIT 12", t.x + 11, t.y + 56);
  }

  function drawTraffic() {
    for (const car of game.cars) {
      ctx.save();
      ctx.translate(car.x, car.drawY || car.y);
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(-car.width / 2 + 4, -car.height / 2 + 5, car.width, car.height);
      ctx.fillStyle = car.color;
      ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
      ctx.fillStyle = "#23333a";
      ctx.fillRect(-13, -car.height / 2 + 3, 26, car.height - 6);
      ctx.fillStyle = "#fff2b3";
      ctx.fillRect(car.dir > 0 ? 24 : -28, -9, 4, 6);
      ctx.fillRect(car.dir > 0 ? 24 : -28, 3, 4, 6);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const p = game.player;
    if (p.hitCooldown > 0 && Math.floor(p.hitCooldown * 10) % 2 === 0) return;
    ctx.fillStyle = "rgba(0,0,0,.3)";
    ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 10, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4c19d";
    ctx.beginPath(); ctx.arc(p.x, p.y - 9, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd252";
    ctx.fillRect(p.x - 10, p.y - 2, 20, 22);
    ctx.fillStyle = "#c66f24";
    ctx.fillRect(p.x - 10, p.y + 7, 20, 5);
    ctx.fillStyle = "#1e4560";
    ctx.fillRect(p.x - 9, p.y + 20, 7, 11);
    ctx.fillRect(p.x + 2, p.y + 20, 7, 11);
    if (game.carrying === "cone") drawCone(p.x + 17, p.y + 2);
    if (game.carrying === "rake") {
      ctx.strokeStyle = "#d9c39b"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x + 10, p.y - 10); ctx.lineTo(p.x + 28, p.y + 28); ctx.stroke();
      ctx.strokeStyle = "#303938"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(p.x + 18, p.y + 27); ctx.lineTo(p.x + 38, p.y + 19); ctx.stroke();
    }
    if (game.carrying === "locator") {
      ctx.fillStyle = "#e8b62e";
      ctx.fillRect(p.x + 12, p.y - 5, 12, 19);
      ctx.strokeStyle = "#232b29";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x + 18, p.y + 13); ctx.lineTo(p.x + 29, p.y + 30); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x + 31, p.y + 32, 7, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawRain() {
    ctx.strokeStyle = "rgba(170,220,238,.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of game.rain) {
      ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x - 5, drop.y + 15);
    }
    ctx.stroke();
  }

  function drawHUD() {
    if (game.mode !== "playing") return;
    ctx.fillStyle = "rgba(12,21,18,.88)";
    ctx.fillRect(18, 18, 214, 54);
    ctx.fillStyle = "#ffd252";
    ctx.font = "800 12px sans-serif";
    ctx.fillText(`RUNOFF ${Math.round(game.flood)}%`, 31, 40);
    ctx.fillStyle = "#7ec8e3";
    ctx.fillRect(31, 49, 186 * (game.flood / 100), 8);
    ctx.strokeStyle = "#60746c";
    ctx.strokeRect(31, 49, 186, 8);

    const progress = {
      locate: ["UTILITY LOCATE", game.locateWork],
      clear: ["DRAIN CLEARANCE", game.work],
      verify: ["FLOW VERIFICATION", game.verifyWork]
    }[game.step];
    if (progress && progress[1] > 0) {
      ctx.fillStyle = "rgba(12,21,18,.9)";
      ctx.fillRect(W / 2 - 130, H - 70, 260, 42);
      ctx.fillStyle = "#f4f0db";
      ctx.font = "700 11px sans-serif";
      ctx.fillText(progress[0], W / 2 - 115, H - 52);
      ctx.fillStyle = "#71d49b";
      ctx.fillRect(W / 2 - 115, H - 44, 230 * (progress[1] / 100), 8);
    }

    if (game.prompt) {
      ctx.font = "800 15px sans-serif";
      const width = ctx.measureText(game.prompt).width + 34;
      ctx.fillStyle = "rgba(12,21,18,.9)";
      ctx.fillRect(W / 2 - width / 2, 20, width, 38);
      ctx.fillStyle = "#f4f0db";
      ctx.fillText(game.prompt, W / 2 - width / 2 + 17, 45);
    }
  }

  function drawPause() {
    ctx.fillStyle = "rgba(8,14,12,.68)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#f4f0db";
    ctx.textAlign = "center";
    ctx.font = "900 48px Impact, sans-serif";
    ctx.fillText("SHIFT PAUSED", W / 2, H / 2);
    ctx.font = "500 16px sans-serif";
    ctx.fillText("Press P to return to work", W / 2, H / 2 + 30);
    ctx.textAlign = "left";
  }

  function updateHistoryNote() {
    if (history.downstreamClog || history.waterOutage) {
      ui.historyNote.hidden = false;
      const callbacks = [];
      if (history.downstreamClog) callbacks.push("debris was pushed into the downstream drain");
      if (history.waterOutage) callbacks.push("Maple Diner was left without water service");
      ui.historyNote.textContent = `CALLBACK: Last shift ${callbacks.join(" and ")}. Today's opening service score is reduced.`;
    } else if (history.shifts > 0) {
      ui.historyNote.hidden = false;
      ui.historyNote.textContent = `Town record: ${history.lastResult}. Best recorded grade: ${history.bestGrade}.`;
    } else {
      ui.historyNote.hidden = true;
    }
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

  ui.startButton.addEventListener("click", startGame);
  ui.restartButton.addEventListener("click", startGame);
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
