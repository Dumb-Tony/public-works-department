(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const ui = {
    startPanel: document.querySelector("#startPanel"),
    endPanel: document.querySelector("#endPanel"),
    startButton: document.querySelector("#startButton"),
    againButton: document.querySelector("#againButton"),
    resetButton: document.querySelector("#resetButton"),
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
    inlet: { x: 682, y: 395 }
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

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
        shifts: 0,
        bestGrade: "—",
        downstreamClog: false,
        lastResult: "No prior work orders"
      };
    } catch {
      return { shifts: 0, bestGrade: "—", downstreamClog: false, lastResult: "Storage unavailable" };
    }
  }

  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* local-only save is optional */ }
  }

  function freshGame() {
    return {
      mode: "title",
      paused: false,
      elapsed: 0,
      grade: history.downstreamClog ? 92 : 100,
      gradeReason: history.downstreamClog ? "Yesterday's shortcut made today's runoff worse." : "Call received. The clock is running.",
      flood: history.downstreamClog ? 34 : 18,
      work: 0,
      step: "cones",
      conesPlaced: [],
      coneStock: 4,
      carrying: null,
      nearMisses: 0,
      collisions: 0,
      rushed: false,
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
    ui.startPanel.hidden = true;
    ui.endPanel.hidden = true;
    canvas.focus();
    syncUI();
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

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
    game.grade = clamp(game.grade - timeDrain * dt * 10, 0, 100);
    game.flood = clamp(game.flood + (game.step === "clear" ? 0.65 : 1.05) * dt, 0, 100);

    if (game.flood >= 72 && game.step !== "done") {
      game.gradeReason = "Runoff has reached Birch Street storefronts.";
      game.grade = clamp(game.grade - 1.2 * dt, 0, 100);
    }

    handleInteraction(dt);

    if (game.grade <= 0 || game.flood >= 100) finish(false, "The intersection flooded before the drain was restored.");
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
        game.collisions += 1;
        game.grade = clamp(game.grade - 12, 0, 100);
        game.gradeReason = "Vehicle contact: work-zone incident reported.";
        game.player.hitCooldown = 1.5;
        game.player.y += car.y < 300 ? 42 : -42;
      } else if (hitX && Math.abs(game.player.y - car.drawY) < 46 && game.player.hitCooldown <= 0) {
        game.nearMisses += dt;
        if (game.nearMisses > 1) {
          game.grade = clamp(game.grade - 3, 0, 100);
          game.gradeReason = "Near miss: cones need to control approaching traffic.";
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
    game.prompt = "";

    if (game.step === "cones") {
      if (game.carrying === "cone") {
        game.prompt = "SPACE · Place traffic cone";
        if (justPressed.has("Space")) placeCone();
      } else if (atTruck) {
        game.prompt = "E · Take cone from Unit 12";
        if (justPressed.has("KeyE")) {
          game.carrying = "cone";
          game.coneStock -= 1;
          game.gradeReason = "Cone loaded. Mark the three striped positions.";
        }
      } else {
        game.prompt = "Return to Unit 12 for a traffic cone";
      }
    } else if (game.step === "tool") {
      if (atTruck) {
        game.prompt = "E · Take drain rake";
        if (justPressed.has("KeyE")) {
          game.carrying = "rake";
          game.step = "clear";
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
          if (game.work >= 100) finish(true, "The drain is flowing and the repair should hold through the next storm.");
        }
        if (justPressed.has("KeyR")) {
          game.rushed = true;
          game.work = 100;
          game.grade = clamp(game.grade - 8, 0, 100);
          finish(true, "The inlet is open—but the debris was pushed into the downstream line.");
        }
      }
    }
  }

  function placeCone() {
    const nearest = coneTargets
      .map((target, index) => ({ target, index, d: distance(game.player, target) }))
      .filter(({ index }) => !game.conesPlaced.includes(index))
      .sort((a, b) => a.d - b.d)[0];

    if (nearest && nearest.d < 52) {
      game.conesPlaced.push(nearest.index);
      game.carrying = null;
      game.gradeReason = `Work zone ${game.conesPlaced.length}/3 secured.`;
      if (game.conesPlaced.length === coneTargets.length) game.step = "tool";
    } else {
      game.grade = clamp(game.grade - 2, 0, 100);
      game.gradeReason = "Cone is outside the marked taper. Reposition it.";
    }
  }

  function finish(success, summary) {
    if (game.mode !== "playing") return;
    game.mode = "ended";
    game.result = success ? "complete" : "failed";
    game.step = "done";
    const letter = gradeLetter(game.grade);

    history.shifts += 1;
    history.downstreamClog = Boolean(success && game.rushed);
    history.lastResult = success
      ? (game.rushed ? "Drain open; downstream blockage pending" : "Drain cleared with no callback")
      : "Flood response missed";
    if (history.bestGrade === "—" || letter < history.bestGrade) history.bestGrade = letter;
    saveHistory();

    ui.endTitle.textContent = success ? `Service grade: ${letter}` : "Call failed";
    ui.endSummary.textContent = summary + (game.rushed ? " This consequence is now saved for the next shift." : "");
    ui.endStats.innerHTML = [
      ["Response", formatTime(game.elapsed)],
      ["Traffic incidents", String(game.collisions)],
      ["Callback risk", game.rushed ? "HIGH" : "LOW"]
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
      tool: "Fetch the drain rake from Unit 12",
      clear: "Clear the flooded storm drain",
      done: game.result === "complete" ? "Work order closed" : "Dispatch escalation required"
    }[game.step];

    const tasks = [
      ["Place three traffic cones", game.conesPlaced.length === 3],
      ["Retrieve drain rake", game.step === "clear" || game.step === "done"],
      ["Restore drainage", game.result === "complete"]
    ];
    ui.checklist.innerHTML = tasks.map(([label, done]) => `<li class="${done ? "done" : ""}">${label}</li>`).join("");
    ui.townState.innerHTML = `
      <span>Runoff level <strong>${Math.round(game.flood)}%</strong></span>
      <span>Traffic <strong>${game.conesPlaced.length >= 2 ? "Slowing" : "Live"}</strong></span>
      <span>Downstream line <strong>${history.downstreamClog ? "Restricted" : "Clear"}</strong></span>
      <span>Prior shifts <strong>${history.shifts}</strong></span>`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawGround();
    drawRoads();
    drawFlood();
    drawWorkZone();
    drawTruck();
    drawTraffic();
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
      if (!game.conesPlaced.includes(i)) {
        ctx.strokeStyle = "rgba(255,210,82,.8)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(target.x - 12, target.y - 9, 24, 18);
        ctx.setLineDash([]);
      } else drawCone(target.x, target.y);
    }

    ctx.fillStyle = "#161d1d";
    ctx.fillRect(world.drain.x - 22, world.drain.y - 7, 44, 14);
    ctx.strokeStyle = "#879394";
    for (let i = -16; i <= 16; i += 8) {
      ctx.beginPath(); ctx.moveTo(world.drain.x + i, world.drain.y - 6); ctx.lineTo(world.drain.x + i, world.drain.y + 6); ctx.stroke();
    }
    if (game.step === "clear") {
      ctx.strokeStyle = `rgba(255,210,82,${.55 + Math.sin(game.elapsed * 5) * .35})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(world.drain.x, world.drain.y, 32, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = "#1684aa";
    ctx.fillRect(world.hydrant.x - 8, world.hydrant.y - 15, 16, 28);
    ctx.fillStyle = "#d9e1d8";
    ctx.font = "700 10px sans-serif";
    ctx.fillText("WATER", world.hydrant.x - 17, world.hydrant.y + 28);
  }

  function drawCone(x, y) {
    ctx.fillStyle = "#1d2422";
    ctx.fillRect(x - 11, y + 7, 22, 5);
    ctx.fillStyle = "#ff7a22";
    ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x - 8, y + 8); ctx.lineTo(x + 8, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f4f0db";
    ctx.fillRect(x - 5, y, 10, 4);
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

    if (game.step === "clear" && game.work > 0) {
      ctx.fillStyle = "rgba(12,21,18,.9)";
      ctx.fillRect(W / 2 - 130, H - 70, 260, 42);
      ctx.fillStyle = "#f4f0db";
      ctx.font = "700 11px sans-serif";
      ctx.fillText("DRAIN CLEARANCE", W / 2 - 115, H - 52);
      ctx.fillStyle = "#71d49b";
      ctx.fillRect(W / 2 - 115, H - 44, 230 * (game.work / 100), 8);
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
    if (history.downstreamClog) {
      ui.historyNote.hidden = false;
      ui.historyNote.textContent = "CALLBACK: Last shift pushed debris downstream. Runoff starts higher today and your opening grade is reduced.";
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
    if (event.code === "KeyP" && game.mode === "playing") game.paused = !game.paused;
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => { keys.clear(); if (game.mode === "playing") game.paused = true; });

  ui.startButton.addEventListener("click", startGame);
  ui.againButton.addEventListener("click", () => {
    updateHistoryNote();
    ui.endPanel.hidden = true;
    ui.startPanel.hidden = false;
    game = freshGame();
    syncUI();
  });
  ui.resetButton.addEventListener("click", () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be disabled */ }
    history = loadHistory();
    game = freshGame();
    updateHistoryNote();
    syncUI();
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
  syncUI();
  requestAnimationFrame(frame);
})();
