// Sinestesia Digital · Ver el sonido
// Repositorio: https://github.com/eeminionn/PulsoDeEstadioSinestesico
// Hecho por eeminionn

let Tm, Tg, Tt;
let Tlive;
let tournaments = [];
let matches = [];
let goals = [];
let years = [];
let matchOrbs = [];
let goalsByMatch = new Map();

let selectedYear = 2022;
let yearIndex = 0;
let selectedTournament = null;

let hovered = null;
let pinned = null;
let dragging = false;
let dragged = false;
let lastX = 0;
let lastY = 0;

let rot = 0;
let targetRot = 0;
let zoom = 1;
let targetZoom = 1;

let grass = [];
let ui = {};
let legendVisible = false;
let demoMode = false;
let soundGame = null;
let celebrationParticles = [];
let sonicWaves = [];
let simulatedBand = { bass: 0, mid: 0, treble: 0 };

let mic = null;
let fft = null;
let micReady = false;
let audioDenied = false;

let audioState = {
  rawLevel: 0,
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  pulse: 0,
  zone: "pasivo"
};
let liveStatus = {
  year: 2026,
  finishedMatches: 0,
  totalMatches: 0
};

const MAX_MIN = 130;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CONCEPT = "La Copa Resonante";
const GAME_TITLE = "La Copa Resonante";
const GOALS_TO_WIN = 5;
const DATA_BASE_URL = "https://raw.githubusercontent.com/eeminionn/PulsoDeEstadioSinestesico/main";
const LIVE_JSON_REMOTE = "https://raw.githubusercontent.com/eeminionn/PulsoDeEstadioSinestesico/main/live_worldcup_2026.json";

const C = {
  pitch: [6, 25, 18],
  pitchAlt: [10, 46, 32],
  line: [236, 230, 206],
  fog: [117, 212, 178],
  fogHot: [255, 109, 71],
  bass: [255, 198, 92],
  mid: [117, 212, 178],
  treble: [118, 165, 255],
  core: [245, 241, 226],
  ink: [18, 20, 18],
  shadow: [0, 0, 0]
};

function preload() {
  Tm = loadTable(`${DATA_BASE_URL}/matches_clean.csv`, "csv", "header");
  Tg = loadTable(`${DATA_BASE_URL}/goals_clean.csv`, "csv", "header");
  Tt = loadTable(`${DATA_BASE_URL}/tournaments_clean.csv`, "csv", "header");
  Tlive = {};
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  textFont("DM Sans");
  parseCSV();
  makeTexture();
  makeUI();
  setYear(years.length - 1);
  soundGame = new ResonantCupGame();
  loadRemoteLiveData();
}

function draw() {
  readControls();
  updateAudioState();
  if (soundGame) soundGame.update(audioState);
  updateCamera();
  drawField();
  drawAtmosphere();
  drawMap();
  drawGameCore();
  drawCelebration();
  drawGuideGrid();
  drawLegend();
  drawInfo();
  drawMicPrompt();
}

function parseCSV() {
  for (let r = 0; r < Tt.getRowCount(); r++) {
    const row = Tt.getRow(r);
    tournaments.push({
      year: num(row, "year"),
      host: txt(row, "host_country"),
      winner: txt(row, "winner"),
      matches: num(row, "total_matches"),
      goals: num(row, "total_goals")
    });
  }

  tournaments.sort((a, b) => a.year - b.year);
  years = tournaments.map(t => t.year);

  for (let r = 0; r < Tm.getRowCount(); r++) {
    const row = Tm.getRow(r);
    matches.push({
      year: num(row, "year"),
      id: txt(row, "match_id"),
      date: txt(row, "match_date"),
      stage: txt(row, "stage_name"),
      city: txt(row, "city_name"),
      country: txt(row, "country_name"),
      home: txt(row, "home_team_name"),
      away: txt(row, "away_team_name"),
      hCode: txt(row, "home_team_code"),
      aCode: txt(row, "away_team_code"),
      hScore: num(row, "home_team_score"),
      aScore: num(row, "away_team_score"),
      totalGoals: num(row, "total_goals"),
      margin: max(1, num(row, "goal_margin", 1)),
      extra: num(row, "extra_time"),
      pens: num(row, "penalty_shootout"),
      final: num(row, "is_final"),
      semi: num(row, "is_semifinal"),
      ko: num(row, "knockout_stage"),
      champion: num(row, "champion_in_match"),
      hostTeam: num(row, "host_in_match")
    });
  }

  for (let r = 0; r < Tg.getRowCount(); r++) {
    const row = Tg.getRow(r);
    const g = {
      year: num(row, "year"),
      matchId: txt(row, "match_id"),
      minute: num(row, "actual_minute"),
      label: txt(row, "minute_label"),
      team: txt(row, "team_code"),
      player: `${txt(row, "given_name")} ${txt(row, "family_name")}`.trim()
    };

    goals.push(g);
    if (!goalsByMatch.has(g.matchId)) goalsByMatch.set(g.matchId, []);
    goalsByMatch.get(g.matchId).push(g);
  }

  mergeLiveWorldCupData(Tlive);
  tournaments.sort((a, b) => a.year - b.year);
  years = [...new Set(tournaments.map(t => t.year))].sort((a, b) => a - b);
}

function mergeLiveWorldCupData(liveData) {
  if (!liveData || !Array.isArray(liveData.matches) || !liveData.matches.length) return;

  const year = Number(liveData.year || 2026);
  const playedMatches = liveData.matches.filter(match => match.finished || match.totalGoals > 0);
  if (!playedMatches.length) return;
  const existingTournament = tournaments.find(t => t.year === year);
  const summary = liveData.summary || {};
  liveStatus.year = year;
  liveStatus.finishedMatches = Number(summary.finishedMatches || playedMatches.length);
  liveStatus.totalMatches = Number(summary.totalMatches || liveData.matches.length);

  if (!existingTournament) {
    tournaments.push({
      year,
      host: liveData.host || "United States / Mexico / Canada",
      winner: summary.currentLeader || "En juego",
      matches: Number(summary.finishedMatches || playedMatches.length),
      goals: Number(summary.totalGoals || 0)
    });
  } else {
    existingTournament.host = liveData.host || existingTournament.host;
    existingTournament.winner = summary.currentLeader || existingTournament.winner;
    existingTournament.matches = Number(summary.finishedMatches || existingTournament.matches);
    existingTournament.goals = Number(summary.totalGoals || existingTournament.goals);
  }

  for (const match of playedMatches) {
    matches.push({
      year,
      id: String(match.id),
      date: String(match.date || ""),
      stage: String(match.stage || ""),
      city: String(match.city || ""),
      country: String(match.country || ""),
      home: String(match.home || ""),
      away: String(match.away || ""),
      hCode: String(match.hCode || "TBD"),
      aCode: String(match.aCode || "TBD"),
      hScore: Number(match.hScore || 0),
      aScore: Number(match.aScore || 0),
      totalGoals: Number(match.totalGoals || 0),
      margin: max(1, Number(match.margin || 1)),
      extra: Number(match.extra || 0),
      pens: Number(match.pens || 0),
      final: Number(match.final || 0),
      semi: Number(match.semi || 0),
      ko: Number(match.ko || 0),
      champion: Number(match.champion || 0),
      hostTeam: Number(match.hostTeam || 0)
    });

    if (!goalsByMatch.has(match.id)) goalsByMatch.set(match.id, []);
    const liveGoals = Array.isArray(match.goals) ? match.goals : [];
    for (const goal of liveGoals) {
      const g = {
        year,
        matchId: String(match.id),
        minute: Number(goal.minute || 0),
        label: String(goal.label || ""),
        team: String(goal.team || ""),
        player: String(goal.player || "")
      };

      goals.push(g);
      goalsByMatch.get(match.id).push(g);
    }
  }
}

function loadRemoteLiveData() {
  fetch(LIVE_JSON_REMOTE)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      Tlive = data;
      replaceLiveWorldCupData(data);
    })
    .catch(error => {
      console.warn("No se pudo cargar el JSON remoto del Mundial 2026.", error);
      loadJSON("live_worldcup_2026.json", data => {
        Tlive = data;
        replaceLiveWorldCupData(data);
      });
    });
}

function replaceLiveWorldCupData(liveData) {
  const liveYear = Number((liveData && liveData.year) || 2026);
  const selectedWasLatest = years.length > 0 && selectedYear === max(years);

  matches = matches.filter(match => !(match.year === liveYear && String(match.id).startsWith("LIVE-2026-")));
  goals = goals.filter(goal => !(goal.year === liveYear && String(goal.matchId).startsWith("LIVE-2026-")));

  for (const key of Array.from(goalsByMatch.keys())) {
    if (String(key).startsWith("LIVE-2026-")) goalsByMatch.delete(key);
  }

  tournaments = tournaments.filter(tournament => tournament.year !== liveYear);
  mergeLiveWorldCupData(liveData);
  tournaments.sort((a, b) => a.year - b.year);
  years = [...new Set(tournaments.map(t => t.year))].sort((a, b) => a - b);
  refreshYearSlider();

  const preferredYear = selectedWasLatest && years.includes(liveYear) ? liveYear : selectedYear;
  const idx = years.indexOf(preferredYear);
  if (idx >= 0) setYear(idx);
  else setYear(years.length - 1);
}

function refreshYearSlider() {
  if (!ui.yearSliderMount) return;
  createYearSlider();
  updateLabels();
}

function txt(row, key, def = "") {
  const v = row.get(key);
  return v === undefined || v === null ? def : String(v);
}

function num(row, key, def = 0) {
  const v = Number(row.get(key));
  return isNaN(v) ? def : v;
}

function setYear(i) {
  yearIndex = constrain(i, 0, years.length - 1);
  selectedYear = years[yearIndex];
  selectedTournament = tournaments.find(t => t.year === selectedYear);
  pinned = null;

  const selected = matches.filter(m => m.year === selectedYear);
  matchOrbs = selected.map((m, idx) => new MatchOrb(m, goalsByMatch.get(m.id) || [], idx, selected.length));

  if (soundGame) soundGame.changeWorldCup();

  if (ui.yearSlider) ui.yearSlider.value(yearIndex);
  updateLabels();
}

function stagePower(m) {
  const s = m.stage.toLowerCase();
  if (m.final || (s.includes("final") && !s.includes("semi") && !s.includes("third"))) return 1;
  if (m.semi || s.includes("semi")) return 0.82;
  if (s.includes("quarter")) return 0.66;
  if (s.includes("round of 16")) return 0.5;
  if (m.ko) return 0.42;
  return 0.18;
}

class MatchOrb {
  constructor(match, goalList, index, total) {
    this.m = match;
    this.gs = goalList;
    this.index = index;
    this.total = total;
    this.power = stagePower(match);
    this.seed = random(1000);
    this.spin = random(TWO_PI);
    this.variant = index % 3;
    this.evenGoals = goalList.filter((_, i) => (i + 1) % 2 === 0);
    this.oddGoals = goalList.filter((_, i) => (i + 1) % 2 !== 0);
    this.primaryBand = this.evenGoals.length >= this.oddGoals.length ? "bass" : "treble";
    this.baseSize = 10 + match.totalGoals * 1.75 + this.power * 11;
    this.glowEven = 0;
    this.glowOdd = 0;
    this.presence = 0;
    this.memoryGlow = 0;
    this.memoryLabel = "";

    const radius = map(this.power, 0, 1, min(width, height) * 0.34, min(width, height) * 0.08);
    const angle = index * GOLDEN + selectedYear * 0.024;
    const jitter = sin(index * 1.7 + selectedYear * 0.11) * 26;
    this.baseX = cos(angle) * (radius + jitter) * 1.18;
    this.baseY = sin(angle) * (radius + jitter) * 0.74;
    this.x = this.baseX;
    this.y = this.baseY;
  }

  update(audio) {
    const bassGain = this.evenGoals.length / max(1, this.gs.length);
    const trebleGain = this.oddGoals.length / max(1, this.gs.length);
    const activeBass = max(0, audio.bass - params.bassGate) * params.micAmp * 2.6;
    const activeTreble = max(0, audio.treble - params.trebleGate) * params.micAmp * 2.8;
    const midDrift = max(0, audio.mid - params.midGate) * params.speed * (1.2 + this.power * 1.8);

    this.glowEven = lerp(this.glowEven, constrain(activeBass * bassGain, 0, 2.2), 0.16);
    this.glowOdd = lerp(this.glowOdd, constrain(activeTreble * trebleGain, 0, 2.2), 0.18);
    this.presence = lerp(this.presence, constrain(audio.level * 2.4 + this.glowEven + this.glowOdd, 0, 3), 0.12);
    this.memoryGlow *= 0.975;

    this.x = this.baseX + (noise(this.seed, frameCount * 0.006 * params.speed) - 0.5) * 26 * (1 + midDrift);
    this.y = this.baseY + (noise(this.seed + 13, frameCount * 0.006 * params.speed) - 0.5) * 26 * (1 + midDrift * 0.8);
    this.spin += 0.006 + midDrift * 0.055 + this.glowOdd * 0.02;
  }

  ignite(labelText) {
    this.memoryGlow = 1;
    this.memoryLabel = labelText || "Memoria del Mundial";
  }

  draw() {
    const active = this === hovered || this === pinned;
    const size = this.baseSize * params.auraScale * (1 + this.presence * 0.08);

    this.drawShadow(size);
    this.drawBassHalos(size);
    this.drawTrebleHalos(size);
    this.drawMemoryBeacon(size);
    this.drawCore(size, active);

    if (active) this.drawTag(size);
  }

  drawMemoryBeacon(size) {
    if (this.memoryGlow < 0.01) return;

    const glow = easeOutCubic(this.memoryGlow);
    noFill();
    stroke(C.core[0], C.core[1], C.core[2], 90 * glow);
    strokeWeight((1 + glow * 2) / zoom);
    circle(this.x, this.y, size * (2.4 + (1 - this.memoryGlow) * 4));
    stroke(C.bass[0], C.bass[1], C.bass[2], 150 * glow);
    line(this.x, this.y - size, this.x, this.y - size * (2.6 + glow * 2));
  }

  drawShadow(size) {
    noStroke();
    fill(C.shadow[0], C.shadow[1], C.shadow[2], 58);
    ellipse(this.x + 4 / zoom, this.y + 7 / zoom, size * 1.28, size * 0.44);
  }

  drawBassHalos(size) {
    if (this.evenGoals.length === 0) return;

    const strength = this.glowEven;
    if (strength < 0.015) return;

    const count = constrain(this.evenGoals.length, 1, 5);
    const bassCol = colorShift(C.bass, strength * 0.4);

    for (let i = 0; i < count; i++) {
      const t = i / max(1, count - 1);
      const ring = size * (1.7 + t * 1.55 + strength * 0.55);
      noFill();
      stroke(red(bassCol), green(bassCol), blue(bassCol), 82 - i * 10 + strength * 34);
      strokeWeight((1.2 + strength * 2.4 - i * 0.08) / zoom);

      if (this.variant === 0) {
        circle(this.x, this.y, ring);
      } else if (this.variant === 1) {
        ellipse(this.x, this.y, ring * 1.08, ring * 0.72);
      } else {
        arc(this.x, this.y, ring, ring, this.spin + t, this.spin + PI + t * 0.6);
        arc(this.x, this.y, ring * 0.92, ring * 0.92, this.spin + PI * 1.1, this.spin + TWO_PI - 0.4);
      }
    }
  }

  drawTrebleHalos(size) {
    if (this.oddGoals.length === 0) return;

    const strength = this.glowOdd;
    if (strength < 0.015) return;

    const count = constrain(this.oddGoals.length, 1, 6);
    const trebCol = colorShift(C.treble, strength * 0.55);
    const spikeCol = lerpColor(trebCol, color(C.fogHot[0], C.fogHot[1], C.fogHot[2]), 0.3 + params.colorFlux * 0.35);

    push();
    translate(this.x, this.y);
    rotate(this.spin);
    noFill();
    stroke(red(spikeCol), green(spikeCol), blue(spikeCol), 86 + strength * 40);
    strokeWeight((1 + strength * 2.2) / zoom);

    for (let i = 0; i < count; i++) {
      const ang = i * TWO_PI / count + strength * 0.2;
      const inner = size * (0.9 + strength * 0.3);
      const outer = size * (1.5 + i * 0.18 + strength * 1.05);
      line(cos(ang) * inner, sin(ang) * inner, cos(ang) * outer, sin(ang) * outer);

      if (this.variant === 2) {
        line(cos(ang + 0.12) * inner * 0.8, sin(ang + 0.12) * inner * 0.8, cos(ang + 0.2) * outer * 0.9, sin(ang + 0.2) * outer * 0.9);
      }
    }

    pop();
  }

  drawCore(size, active) {
    const col = this.coreColor();

    noStroke();
    fill(red(col), green(col), blue(col), active ? 55 : 30);
    circle(this.x, this.y, size * 2.08);

    push();
    translate(this.x, this.y);
    rotate(this.spin * 0.65);

    stroke(C.ink[0], C.ink[1], C.ink[2], active ? 240 : 190);
    strokeWeight(max(0.75, 1 / zoom));
    fill(C.core[0], C.core[1], C.core[2]);
    circle(0, 0, size);

    fill(C.ink[0], C.ink[1], C.ink[2]);
    noStroke();
    poly(0, 0, size * 0.15, 5);

    stroke(C.ink[0], C.ink[1], C.ink[2], 150);
    strokeWeight(max(0.65, 0.85 / zoom));
    noFill();

    for (let i = 0; i < 5; i++) {
      const ang = -HALF_PI + i * TWO_PI / 5;
      line(cos(ang) * size * 0.15, sin(ang) * size * 0.15, cos(ang) * size * 0.45, sin(ang) * size * 0.45);
      push();
      translate(cos(ang) * size * 0.33, sin(ang) * size * 0.33);
      rotate(ang + PI / 5);
      poly(0, 0, size * 0.08, 5);
      pop();
    }

    noStroke();
    fill(red(col), green(col), blue(col), 205);
    circle(size * 0.18, -size * 0.18, max(4 / zoom, size * 0.16));
    pop();

    if (this.m.final) {
      noFill();
      stroke(C.line[0], C.line[1], C.line[2], 210);
      strokeWeight(1.5 / zoom);
      circle(this.x, this.y, size + 16 / zoom);
    }
  }

  drawTag(size) {
    push();
    rotate(-rot);
    noStroke();
    fill(C.line[0], C.line[1], C.line[2], 240);
    textAlign(CENTER);
    textFont("Space Mono");
    textSize(10 / zoom);
    textStyle(BOLD);
    text(`${this.m.hCode} ${this.m.hScore}-${this.m.aScore} ${this.m.aCode}`, this.x, this.y - size * 0.9);
    pop();
  }

  coreColor() {
    if (this.glowOdd > this.glowEven) return colorShift(C.treble, this.glowOdd * 0.45);
    if (this.glowEven > 0.04) return colorShift(C.bass, this.glowEven * 0.4);
    if (this.m.champion) return color(C.bass[0], C.bass[1], C.bass[2]);
    if (this.m.hostTeam) return color(C.mid[0], C.mid[1], C.mid[2]);
    return color(C.line[0], C.line[1], C.line[2]);
  }
}

class ResonantCupGame {
  constructor() {
    this.score = 0;
    this.streak = 0;
    this.phase = "carga";
    this.bassCharge = 0;
    this.midCharge = 0;
    this.goalFlash = 0;
    this.shotT = 0;
    this.celebrateFrames = 0;
    this.readyAt = 0;
    this.previousTreble = 0;
    this.lastMemory = null;
    this.feedback = "Haz vibrar la tribuna con un sonido grave";
  }

  update(audio) {
    this.goalFlash *= 0.92;

    if (this.celebrateFrames > 0) {
      this.celebrateFrames--;
      this.shotT = min(1, this.shotT + 0.065);
      if (this.celebrateFrames === 0 && this.phase === "gol") this.resetRound();
      this.previousTreble = audio.treble;
      return;
    }

    if (this.phase === "campeon") {
      this.previousTreble = audio.treble;
      return;
    }

    const bassSignal = normalizedBand(audio.bass, params.bassGate, 0.48);
    const midSignal = normalizedBand(audio.mid, params.midGate, 0.42);
    const trebleSignal = normalizedBand(audio.treble, params.trebleGate, 0.5);

    if (this.phase === "carga") {
      this.bassCharge = constrain(this.bassCharge + bassSignal * 0.018 * params.speed, 0, 1);
      this.feedback = bassSignal > 0.04
        ? "La tribuna esta cargando el pulso"
        : "Haz un sonido grave: voz baja, golpe o bombo";

      if (this.bassCharge >= 0.995) {
        this.phase = "jugada";
        this.feedback = "Sostiene un tono medio para construir la jugada";
        addSonicWave(C.bass, 0.75);
      }
    } else if (this.phase === "jugada") {
      this.midCharge = constrain(this.midCharge + midSignal * 0.019 * params.speed, 0, 1);
      this.feedback = midSignal > 0.04
        ? "La pelota avanza con tu voz"
        : "Ahora usa medios: canta, habla o tararea";

      if (this.midCharge >= 0.995) {
        this.phase = "remate";
        this.readyAt = frameCount;
        this.feedback = "Remata con un aplauso, silbido o sonido agudo";
        addSonicWave(C.mid, 0.85);
      }
    } else if (this.phase === "remate") {
      this.feedback = trebleSignal > 0.05 ? "El remate esta saliendo" : "Agudo fuerte para marcar";
      const risingTreble = audio.treble > params.trebleGate && this.previousTreble <= params.trebleGate;
      const clearPeak = frameCount - this.readyAt > 10 && trebleSignal > 0.22;
      if (risingTreble || clearPeak) this.scoreGoal();
    }

    this.previousTreble = audio.treble;
  }

  scoreGoal() {
    this.score++;
    this.streak++;
    this.goalFlash = 1;
    this.shotT = 0;
    this.celebrateFrames = this.score >= GOALS_TO_WIN ? 260 : 150;
    this.phase = this.score >= GOALS_TO_WIN ? "campeon" : "gol";
    this.feedback = this.score >= GOALS_TO_WIN ? "La Copa responde a tu voz" : "GOL SONORO";
    this.activateWorldCupMemory();
    launchCelebration();

    addSonicWave(C.treble, 1.25);
    addSonicWave(C.bass, 1);
    addSonicWave(C.core, 0.85);
  }

  activateWorldCupMemory() {
    const candidates = matchOrbs.filter(orb => orb.gs.length > 0);
    if (!candidates.length) {
      this.lastMemory = null;
      return;
    }

    const orb = candidates[(this.score * 7 + floor(random(candidates.length))) % candidates.length];
    const goal = orb.gs[(this.score - 1) % orb.gs.length];
    const player = goal.player || "Gol historico";
    this.lastMemory = {
      score: `${orb.m.hCode} ${orb.m.hScore}-${orb.m.aScore} ${orb.m.aCode}`,
      player,
      minute: goal.label || `${goal.minute}'`,
      stage: orb.m.stage
    };
    orb.ignite(`${player} · ${goal.label}`);
    pinned = orb;
  }

  resetRound() {
    this.phase = "carga";
    this.bassCharge = 0;
    this.midCharge = 0;
    this.readyAt = 0;
    this.feedback = "Nuevo ataque: carga la tribuna con graves";
  }

  restart() {
    this.score = 0;
    this.streak = 0;
    this.lastMemory = null;
    this.celebrateFrames = 0;
    this.goalFlash = 0;
    this.shotT = 0;
    pinned = null;
    this.resetRound();
  }

  changeWorldCup() {
    this.restart();
    this.feedback = `El Mundial ${selectedYear} espera tu primer pulso`;
  }

  phaseProgress() {
    if (this.phase === "carga") return this.bassCharge;
    if (this.phase === "jugada") return this.midCharge;
    if (this.phase === "remate" || this.phase === "gol" || this.phase === "campeon") return 1;
    return 0;
  }
}

class CelebrationParticle {
  constructor() {
    const palette = [C.bass, C.mid, C.treble, C.core, C.fogHot];
    this.col = random(palette);
    this.x = fieldX() + random(-fieldW() * 0.3, fieldW() * 0.3);
    this.y = fieldY() + random(-30, 20);
    this.vx = random(-5.5, 5.5);
    this.vy = random(-11, -3.5);
    this.gravity = random(0.12, 0.24);
    this.life = 1;
    this.decay = random(0.008, 0.018);
    this.size = random(3, 9);
    this.spin = random(TWO_PI);
    this.spinSpeed = random(-0.2, 0.2);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= 0.995;
    this.life -= this.decay;
    this.spin += this.spinSpeed;
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.spin);
    noStroke();
    fill(this.col[0], this.col[1], this.col[2], 230 * max(0, this.life));
    rectMode(CENTER);
    rect(0, 0, this.size * 0.45, this.size, 1);
    pop();
  }
}

class SonicWave {
  constructor(tone, strength) {
    this.tone = tone;
    this.strength = strength;
    this.radius = 24;
    this.life = 1;
  }

  update() {
    this.radius += 7 + this.strength * 4;
    this.life *= 0.94;
  }

  draw() {
    noFill();
    stroke(this.tone[0], this.tone[1], this.tone[2], 150 * this.life);
    strokeWeight(1 + this.life * 3);
    ellipse(fieldX(), fieldY(), this.radius * 2.1, this.radius * 1.1);
  }
}

const params = {
  micAmp: 1.8,
  bassGate: 0.11,
  midGate: 0.09,
  trebleGate: 0.09,
  auraScale: 1.2,
  speed: 1.2,
  colorFlux: 0.45,
  bassEnabled: true,
  midEnabled: true,
  trebleEnabled: true
};

function makeUI() {
  ui.panel = createDiv();
  ui.panel.position(22, 22);
  styleMany(ui.panel, {
    width: "344px",
    padding: "20px 20px 18px 20px",
    "border-radius": "22px",
    background: "linear-gradient(180deg, rgba(6,18,14,.94) 0%, rgba(8,28,21,.88) 100%)",
    border: "1px solid rgba(236,230,206,.16)",
    color: "rgb(236,230,206)",
    "box-shadow": "0 22px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.04)",
    "backdrop-filter": "blur(16px)",
    "box-sizing": "border-box",
    "max-height": "calc(100vh - 44px)",
    "overflow-y": "auto",
    "overscroll-behavior": "contain"
  });

  const kicker = createDiv("MUNDIALES · INSTRUMENTO AUDIOVISUAL").parent(ui.panel);
  styleMany(kicker, {
    "font-family": "Space Mono, monospace",
    "font-size": "11px",
    "font-weight": "900",
    "letter-spacing": ".16em",
    "text-transform": "uppercase",
    color: "rgba(236,230,206,.66)"
  });

  const title = createElement("h1", GAME_TITLE).parent(ui.panel);
  styleMany(title, {
    margin: "14px 0 10px",
    "font-family": "Bodoni Moda, Georgia, serif",
    "font-size": "36px",
    "line-height": ".94",
    "letter-spacing": "-.05em",
    color: "rgb(247,242,226)"
  });

  const lead = createP("Juega un ataque con tu voz: carga la tribuna, construye la jugada y remata. Cada gol despierta una memoria real del Mundial elegido.");
  lead.parent(ui.panel);
  styleMany(lead, {
    margin: "0 0 14px",
    "font-size": "13px",
    "line-height": "1.55",
    color: "rgba(236,230,206,.84)"
  });

  ui.micButton = button("Entrar al estadio", startMic, ui.panel);
  stylePrimaryButton(ui.micButton);

  ui.yearLabel = label("MUNDIAL");
  ui.yearSliderMount = createDiv().parent(ui.panel);
  styleMany(ui.yearSliderMount, {
    width: "100%"
  });
  createYearSlider();

  ui.micLabel = label("SENSIBILIDAD MIC");
  ui.micSlider = slider(0.6, 4, params.micAmp, 0.05, updateLabels);

  ui.bassLabel = label("UMBRAL GRAVES");
  ui.bassSlider = slider(0.03, 0.35, params.bassGate, 0.01, updateLabels);

  ui.midLabel = label("UMBRAL MEDIOS");
  ui.midSlider = slider(0.03, 0.35, params.midGate, 0.01, updateLabels);

  ui.trebleLabel = label("UMBRAL AGUDOS");
  ui.trebleSlider = slider(0.03, 0.35, params.trebleGate, 0.01, updateLabels);

  ui.auraLabel = label("RESPUESTA VISUAL");
  ui.auraSlider = slider(0.7, 2.5, params.auraScale, 0.05, updateLabels);

  ui.speedLabel = label("RITMO DE JUEGO");
  ui.speedSlider = slider(0.5, 3, params.speed, 0.05, updateLabels);

  ui.colorLabel = label("MEZCLA DE COLOR");
  ui.colorSlider = slider(0, 1, params.colorFlux, 0.01, updateLabels);

  const bandTitle = createDiv("BANDAS ACTIVAS").parent(ui.panel);
  styleMany(bandTitle, {
    margin: "16px 0 8px",
    "font-family": "Space Mono, monospace",
    "font-size": "10px",
    "font-weight": "900",
    "letter-spacing": ".12em",
    "text-transform": "uppercase",
    color: "rgba(236,230,206,.62)"
  });

  const bandRow = createDiv().parent(ui.panel);
  styleMany(bandRow, {
    display: "grid",
    "grid-template-columns": "1fr 1fr 1fr",
    gap: "8px"
  });

  ui.bassCheck = bandToggle("Graves", C.bass, params.bassEnabled, bandRow, updateLabels);
  ui.midCheck = bandToggle("Medios", C.mid, params.midEnabled, bandRow, updateLabels);
  ui.trebleCheck = bandToggle("Agudos", C.treble, params.trebleEnabled, bandRow, updateLabels);

  const row = createDiv().parent(ui.panel);
  styleMany(row, {
    display: "grid",
    "grid-template-columns": "1fr 1fr 1fr",
    gap: "8px",
    "margin-top": "14px"
  });
  const randomBtn = button("Random", () => setYear(floor(random(years.length))), row);
  const resetBtn = button("Nueva copa", restartGame, row);
  const fullBtn = button("Fullscreen", () => fullscreen(!fullscreen()), row);
  styleMany(randomBtn, { margin: "0", padding: "10px 8px" });
  styleMany(resetBtn, { margin: "0", padding: "10px 8px" });
  styleMany(fullBtn, { margin: "0", padding: "10px 8px" });

  const microcopy = createP("Audio: graves → carga · medios → jugada · agudos → remate. Mouse apunta y explora. Teclas 1/2/3 prueban las bandas; L muestra la ayuda.").parent(ui.panel);
  styleMany(microcopy, {
    margin: "14px 0 0",
    "font-size": "11px",
    "line-height": "1.5",
    color: "rgba(236,230,206,.68)"
  });

  ui.info = createDiv();
  ui.info.position(width - 366, 22);
  styleMany(ui.info, {
    width: "344px",
    padding: "20px",
    "border-radius": "22px",
    background: "linear-gradient(180deg, rgba(7,17,13,.94) 0%, rgba(9,25,19,.9) 100%)",
    border: "1px solid rgba(236,230,206,.14)",
    color: "rgb(236,230,206)",
    "box-shadow": "0 22px 60px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)",
    "backdrop-filter": "blur(16px)",
    "box-sizing": "border-box"
  });
}

function label(name) {
  const wrap = createDiv().parent(ui.panel);
  styleMany(wrap, {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    "margin-top": "14px"
  });

  const left = createSpan(name).parent(wrap);
  styleMany(left, {
    "font-family": "Space Mono, monospace",
    "font-size": "10px",
    "font-weight": "900",
    "letter-spacing": ".12em",
    "text-transform": "uppercase",
    color: "rgba(236,230,206,.68)"
  });

  const right = createSpan("—").parent(wrap);
  styleMany(right, {
    "font-family": "Space Mono, monospace",
    "font-size": "15px",
    "font-weight": "900",
    color: "rgb(247,242,226)"
  });

  return right;
}

function slider(a, b, c, step, fn) {
  const s = createSlider(a, b, c, step).parent(ui.panel);
  styleMany(s, {
    width: "100%",
    margin: "6px 0 2px",
    "accent-color": "rgb(220,176,90)"
  });
  s.input(fn);
  return s;
}

function createYearSlider() {
  if (!ui.yearSliderMount) return;
  if (ui.yearSlider) ui.yearSlider.remove();

  ui.yearSlider = createSlider(
    0,
    years.length - 1,
    constrain(yearIndex, 0, years.length - 1),
    1
  ).parent(ui.yearSliderMount);

  styleMany(ui.yearSlider, {
    width: "100%",
    margin: "6px 0 2px",
    "accent-color": "rgb(220,176,90)"
  });

  ui.yearSlider.input(() => setYear(int(ui.yearSlider.value())));
}

function button(textValue, fn, parent) {
  const b = createButton(textValue).parent(parent);
  b.mousePressed(fn);
  styleMany(b, {
    width: "100%",
    margin: "12px 0 0",
    padding: "11px 12px",
    "border-radius": "12px",
    border: "1px solid rgba(236,230,206,.14)",
    background: "rgba(255,255,255,.05)",
    color: "rgb(236,230,206)",
    "font-family": "Space Mono, monospace",
    "font-size": "11px",
    "font-weight": "900",
    "letter-spacing": ".06em",
    cursor: "pointer",
    "box-shadow": "inset 0 1px 0 rgba(255,255,255,.05)"
  });
  return b;
}

function bandToggle(name, tone, checked, parent, fn) {
  const wrap = createDiv().parent(parent);
  styleMany(wrap, {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "10px 10px",
    "border-radius": "12px",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(236,230,206,.1)"
  });

  const check = createCheckbox("", checked).parent(wrap);
  styleMany(check, {
    margin: "0",
    transform: "scale(1.05)",
    "accent-color": `rgb(${tone[0]},${tone[1]},${tone[2]})`
  });
  check.changed(fn);

  const labelText = createSpan(name).parent(wrap);
  styleMany(labelText, {
    "font-family": "Space Mono, monospace",
    "font-size": "10px",
    "font-weight": "900",
    "letter-spacing": ".08em",
    "text-transform": "uppercase",
    color: "rgb(236,230,206)"
  });

  return check;
}

function stylePrimaryButton(el) {
  styleMany(el, {
    background: "linear-gradient(135deg, rgb(214,171,88) 0%, rgb(177,116,56) 100%)",
    color: "rgb(16,20,16)",
    border: "1px solid rgba(255,214,130,.34)",
    "box-shadow": "0 10px 24px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.22)"
  });
}

function styleMany(el, styles) {
  if (!el) return;
  for (const [key, value] of Object.entries(styles)) {
    el.style(key, value);
  }
}

function readControls() {
  if (!ui.micSlider) return;

  params.micAmp = Number(ui.micSlider.value());
  params.bassGate = Number(ui.bassSlider.value());
  params.midGate = Number(ui.midSlider.value());
  params.trebleGate = Number(ui.trebleSlider.value());
  params.auraScale = Number(ui.auraSlider.value());
  params.speed = Number(ui.speedSlider.value());
  params.colorFlux = Number(ui.colorSlider.value());
  params.bassEnabled = ui.bassCheck.checked();
  params.midEnabled = ui.midCheck.checked();
  params.trebleEnabled = ui.trebleCheck.checked();
}

function updateLabels() {
  if (!ui.yearLabel) return;
  ui.yearLabel.html(selectedYear);
  ui.micLabel.html(nf(params.micAmp, 1, 2) + "x");
  ui.bassLabel.html(nf(params.bassGate, 1, 2));
  ui.midLabel.html(nf(params.midGate, 1, 2));
  ui.trebleLabel.html(nf(params.trebleGate, 1, 2));
  ui.auraLabel.html(nf(params.auraScale, 1, 2) + "x");
  ui.speedLabel.html(nf(params.speed, 1, 2) + "x");
  ui.colorLabel.html(nf(params.colorFlux, 1, 2));

  if (!ui.micButton) return;
  if (micReady) {
    ui.micButton.html("Microfono activo · juega con tu voz");
    stylePrimaryButton(ui.micButton);
  } else if (audioDenied) {
    ui.micButton.html("Reintentar permiso de microfono");
    styleMany(ui.micButton, {
      background: "linear-gradient(135deg, rgb(197,92,65) 0%, rgb(155,54,45) 100%)",
      color: "rgb(247,242,226)",
      border: "1px solid rgba(255,180,160,.24)"
    });
  } else {
    ui.micButton.html("Entrar al estadio");
    stylePrimaryButton(ui.micButton);
  }
}

async function startMic() {
  try {
    await userStartAudio();
    mic = new p5.AudioIn();
    await mic.start();
    fft = new p5.FFT(0.82, 1024);
    fft.setInput(mic);
    micReady = true;
    audioDenied = false;
    fullscreen(true);
  } catch (err) {
    console.error(err);
    micReady = false;
    audioDenied = true;
  }

  updateLabels();
}

function updateAudioState() {
  simulatedBand.bass *= 0.9;
  simulatedBand.mid *= 0.9;
  simulatedBand.treble *= 0.9;

  const hasMic = micReady && mic && fft;
  const hasSimulation = max(simulatedBand.bass, simulatedBand.mid, simulatedBand.treble) > 0.01;

  if (!hasMic && !hasSimulation) {
    audioState.rawLevel = 0;
    audioState.level = lerp(audioState.level, 0, 0.08);
    audioState.bass = lerp(audioState.bass, 0, 0.08);
    audioState.mid = lerp(audioState.mid, 0, 0.08);
    audioState.treble = lerp(audioState.treble, 0, 0.08);
    audioState.pulse = lerp(audioState.pulse, 0, 0.08);
    audioState.zone = "pasivo";
    return;
  }

  let level = hasSimulation ? max(simulatedBand.bass, simulatedBand.mid, simulatedBand.treble) * 0.12 : 0;
  let bass = simulatedBand.bass;
  let mid = simulatedBand.mid;
  let treble = simulatedBand.treble;

  if (hasMic) {
    fft.analyze();
    level = max(level, mic.getLevel());
    const bandBoost = map(params.micAmp, 0.6, 4, 0.72, 1.5);
    bass = max(bass, fft.getEnergy("bass") / 255 * bandBoost);
    mid = max(mid, fft.getEnergy("mid") / 255 * bandBoost);
    treble = max(treble, fft.getEnergy("treble") / 255 * bandBoost);
  }

  bass = params.bassEnabled ? constrain(bass, 0, 1) : 0;
  mid = params.midEnabled ? constrain(mid, 0, 1) : 0;
  treble = params.trebleEnabled ? constrain(treble, 0, 1) : 0;

  audioState.rawLevel = level;
  const activeBand = params.bassEnabled || params.midEnabled || params.trebleEnabled;
  audioState.level = lerp(audioState.level, activeBand ? constrain(level * params.micAmp * 8, 0, 1.8) : 0, 0.18);
  audioState.bass = lerp(audioState.bass, bass, 0.2);
  audioState.mid = lerp(audioState.mid, mid, 0.2);
  audioState.treble = lerp(audioState.treble, treble, 0.2);
  audioState.pulse = constrain(audioState.level + max(audioState.bass, audioState.treble) * 0.8, 0, 2.2);

  const bassOpen = audioState.bass > params.bassGate;
  const midOpen = audioState.mid > params.midGate;
  const trebleOpen = audioState.treble > params.trebleGate;

  if (!activeBand) audioState.zone = "silenciado";
  else if (bassOpen && trebleOpen) audioState.zone = "mixto";
  else if (bassOpen) audioState.zone = "graves";
  else if (trebleOpen) audioState.zone = "agudos";
  else if (midOpen) audioState.zone = "medios";
  else audioState.zone = "pasivo";
}

function updateCamera() {
  rot = lerp(rot, targetRot, 0.08);
  zoom = lerp(zoom, targetZoom, 0.1);
  targetRot += 0.00065 * params.speed * (0.4 + audioState.mid);
  hovered = findHover();

  for (const orb of matchOrbs) orb.update(audioState);
}

function drawField() {
  background(C.pitch[0], C.pitch[1], C.pitch[2]);

  const stripe = width / 16;
  noStroke();
  for (let x = 0; x < width + stripe; x += stripe) {
    const phase = floor(x / stripe) % 2;
    const pulse = audioState.level * 24;
    const col = phase ? C.pitch : C.pitchAlt;
    fill(col[0] + pulse * 0.1, col[1] + pulse * 0.2, col[2] + pulse * 0.12, 240);
    rect(x, 0, stripe, height);
  }

  for (const p of grass) {
    stroke(C.line[0], C.line[1], C.line[2], p.a);
    point(p.x, p.y);
  }

  const cx = fieldX();
  const cy = fieldY();
  const fw = fieldW();
  const fh = fieldH();
  const left = cx - fw / 2;
  const top = cy - fh / 2;
  const pulse = audioState.pulse;

  noFill();
  stroke(C.line[0], C.line[1], C.line[2], 110 + pulse * 26);
  strokeWeight(2);
  rect(left, top, fw, fh, 10);
  line(cx, top, cx, top + fh);
  circle(cx, cy, fh * 0.28 + pulse * 10);
  circle(cx, cy, 7 + pulse * 1.5);

  const bw = fw * 0.18;
  const bh = fh * 0.54;
  rect(left, cy - bh / 2, bw, bh);
  rect(left + fw - bw, cy - bh / 2, bw, bh);

  stroke(C.line[0], C.line[1], C.line[2], 26 + pulse * 18);
  drawingContext.setLineDash([7, 12]);
  for (let i = 1; i < 5; i++) line(left + fw * i / 5, top, left + fw * i / 5, top + fh);
  for (let i = 1; i < 4; i++) line(left, top + fh * i / 4, left + fw, top + fh * i / 4);
  drawingContext.setLineDash([]);

  noStroke();
  fill(C.line[0], C.line[1], C.line[2], 28);
  textAlign(CENTER);
  textStyle(BOLD);
  textSize(min(92, width * 0.072));
  text(selectedYear, cx, height - 76);
}

function drawAtmosphere() {
  const bassA = audioState.bass * 80;
  const trebleA = audioState.treble * 92;

  drawFloodlight(width * 0.13, 0, C.bass, audioState.bass);
  drawFloodlight(width * 0.87, 0, C.treble, audioState.treble);

  push();
  translate(fieldX(), fieldY());
  noFill();
  for (let ring = 0; ring < 4; ring++) {
    const ringPulse = audioState.bass * (12 + ring * 9);
    stroke(C.line[0], C.line[1], C.line[2], 20 - ring * 3 + audioState.level * 18);
    strokeWeight(1 + audioState.bass * 1.4);
    ellipse(0, 0, fieldW() * (0.72 + ring * 0.13) + ringPulse, fieldH() * (0.58 + ring * 0.1) + ringPulse * 0.4);
  }

  const crowdCount = min(180, max(72, matchOrbs.length * 2));
  for (let i = 0; i < crowdCount; i++) {
    const a = i * GOLDEN;
    const band = i % 3;
    const rx = fieldW() * (0.4 + (i % 5) * 0.014);
    const ry = fieldH() * (0.34 + (i % 7) * 0.009);
    const signal = band === 0 ? audioState.bass : band === 1 ? audioState.mid : audioState.treble;
    const tone = band === 0 ? C.bass : band === 1 ? C.mid : C.treble;
    const flicker = 0.45 + 0.55 * sin(frameCount * 0.04 + i * 1.7);
    noStroke();
    fill(tone[0], tone[1], tone[2], 20 + signal * 155 * flicker);
    circle(cos(a) * rx, sin(a) * ry, 2 + signal * 5);
  }
  pop();

  noStroke();
  fill(C.bass[0], C.bass[1], C.bass[2], bassA);
  ellipse(width * 0.26, height * 0.18, width * (0.2 + audioState.bass * 0.16), height * 0.18);

  fill(C.treble[0], C.treble[1], C.treble[2], trebleA);
  ellipse(width * 0.78, height * 0.22, width * (0.18 + audioState.treble * 0.14), height * 0.16);

  fill(C.fog[0], C.fog[1], C.fog[2], audioState.mid * 54);
  ellipse(width * 0.52, height * 0.75, width * 0.42, height * (0.12 + audioState.mid * 0.16));

  const vignette = drawingContext.createRadialGradient(width / 2, height / 2, min(width, height) * 0.2, width / 2, height / 2, max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.68)");
  drawingContext.fillStyle = vignette;
  drawingContext.fillRect(0, 0, width, height);
}

function drawFloodlight(x, y, tone, signal) {
  if (signal < 0.015) return;
  const ctx = drawingContext;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, height * 0.68);
  gradient.addColorStop(0, `rgba(${tone[0]},${tone[1]},${tone[2]},${0.12 + signal * 0.22})`);
  gradient.addColorStop(1, `rgba(${tone[0]},${tone[1]},${tone[2]},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function drawMap() {
  push();
  translate(fieldX(), fieldY());
  scale(zoom);
  rotate(rot);

  drawZones();
  drawRoutes();
  for (const orb of matchOrbs) orb.draw();

  pop();
}

function drawGameCore() {
  if (!soundGame) return;

  const cx = fieldX();
  const cy = fieldY();
  const fw = fieldW();
  const fh = fieldH();
  const goalX = cx + fw * 0.37;
  const aimY = constrain(map(mouseY, 0, height, cy - fh * 0.2, cy + fh * 0.2), cy - fh * 0.2, cy + fh * 0.2);
  let ballX = cx - fw * 0.28;
  let ballY = cy;

  if (soundGame.phase === "jugada") {
    ballX = lerp(cx - fw * 0.28, cx + fw * 0.05, easeInOutCubic(soundGame.midCharge));
    ballY = lerp(cy, aimY, soundGame.midCharge * 0.7);
  } else if (soundGame.phase === "remate") {
    ballX = cx + fw * 0.05;
    ballY = aimY;
  } else if (soundGame.phase === "gol" || soundGame.phase === "campeon") {
    ballX = lerp(cx + fw * 0.05, goalX, easeOutCubic(soundGame.shotT));
    ballY = lerp(aimY, cy + sin(soundGame.score * 2.1) * fh * 0.12, easeOutCubic(soundGame.shotT));
  }

  drawGoalFrame(goalX, cy, fw, fh);

  noFill();
  const routeTone = soundGame.phase === "carga" ? C.bass : soundGame.phase === "jugada" ? C.mid : C.treble;
  stroke(routeTone[0], routeTone[1], routeTone[2], 65 + soundGame.phaseProgress() * 120);
  strokeWeight(1.4 + audioState.level * 1.8);
  drawingContext.setLineDash([4, 9]);
  bezier(ballX, ballY, lerp(ballX, goalX, 0.35), ballY - fh * 0.18, lerp(ballX, goalX, 0.72), aimY + fh * 0.12, goalX, aimY);
  drawingContext.setLineDash([]);

  const aura = 42 * params.auraScale + audioState.pulse * 24;
  for (let i = 3; i >= 0; i--) {
    noFill();
    stroke(routeTone[0], routeTone[1], routeTone[2], 22 + audioState.pulse * 18);
    strokeWeight(1);
    circle(ballX, ballY, aura * (1 + i * 0.48) + sin(frameCount * 0.05 + i) * 5);
  }

  drawResonantBall(ballX, ballY, 29 + audioState.level * 9);

  if (soundGame.phase === "campeon") drawTrophy(cx, cy - fh * 0.05, min(fw, fh) * 0.42);
}

function drawGoalFrame(x, y, fw, fh) {
  const gw = fw * 0.1;
  const gh = fh * 0.32;
  const ripple = soundGame ? soundGame.goalFlash * 12 : 0;
  push();
  noFill();
  stroke(C.line[0], C.line[1], C.line[2], 125 + (soundGame ? soundGame.goalFlash * 120 : 0));
  strokeWeight(2.2);
  rect(x - gw / 2, y - gh / 2, gw, gh + ripple, 3);
  strokeWeight(0.7);
  for (let i = 1; i < 5; i++) line(x - gw / 2, y - gh / 2 + i * gh / 5, x + gw / 2, y - gh / 2 + i * gh / 5 + ripple);
  for (let i = 1; i < 4; i++) line(x - gw / 2 + i * gw / 4, y - gh / 2, x - gw / 2 + i * gw / 4, y + gh / 2 + ripple);
  pop();
}

function drawResonantBall(x, y, size) {
  push();
  translate(x, y);
  rotate(frameCount * 0.015 + audioState.mid * 0.4);
  stroke(C.ink[0], C.ink[1], C.ink[2], 210);
  strokeWeight(1.2);
  fill(C.core[0], C.core[1], C.core[2]);
  circle(0, 0, size);
  fill(C.ink[0], C.ink[1], C.ink[2]);
  noStroke();
  poly(0, 0, size * 0.16, 5);
  for (let i = 0; i < 5; i++) {
    const a = -HALF_PI + i * TWO_PI / 5;
    poly(cos(a) * size * 0.32, sin(a) * size * 0.32, size * 0.07, 5);
  }
  pop();
}

function drawTrophy(x, y, size) {
  const pulse = 1 + sin(frameCount * 0.055) * 0.03;
  push();
  translate(x, y);
  scale(pulse);
  noStroke();
  fill(3, 12, 8, 180);
  ellipse(0, size * 0.35, size * 0.62, size * 0.16);
  fill(C.bass[0], C.bass[1], C.bass[2], 210);
  arc(0, -size * 0.08, size * 0.48, size * 0.55, 0, PI, CHORD);
  rect(-size * 0.07, size * 0.12, size * 0.14, size * 0.25, size * 0.03);
  rect(-size * 0.22, size * 0.32, size * 0.44, size * 0.08, size * 0.02);
  noFill();
  stroke(C.bass[0], C.bass[1], C.bass[2], 200);
  strokeWeight(size * 0.04);
  arc(-size * 0.25, -size * 0.03, size * 0.28, size * 0.28, HALF_PI, PI + HALF_PI);
  arc(size * 0.25, -size * 0.03, size * 0.28, size * 0.28, -HALF_PI, HALF_PI);
  pop();
}

function drawCelebration() {
  for (const wave of sonicWaves) {
    wave.update();
    wave.draw();
  }
  sonicWaves = sonicWaves.filter(wave => wave.life > 0.025);

  for (const particle of celebrationParticles) {
    particle.update();
    particle.draw();
  }
  celebrationParticles = celebrationParticles.filter(particle => particle.life > 0);

  if (!soundGame || soundGame.goalFlash < 0.01) return;
  noStroke();
  fill(C.core[0], C.core[1], C.core[2], soundGame.goalFlash * 42);
  rect(0, 0, width, height);
}

function drawZones() {
  const rs = [
    min(width, height) * 0.08,
    min(width, height) * 0.16,
    min(width, height) * 0.25,
    min(width, height) * 0.34
  ];

  noFill();
  for (let i = 0; i < rs.length; i++) {
    stroke(C.line[0], C.line[1], C.line[2], i === 0 ? 82 : 28);
    strokeWeight(1 / zoom);
    ellipse(0, 0, rs[i] * (2.3 + audioState.bass * 0.12), rs[i] * (1.52 + audioState.mid * 0.08));
  }
}

function drawRoutes() {
  for (let i = 0; i < matchOrbs.length; i++) {
    const a = matchOrbs[i];
    if (!a.m.champion && !a.m.hostTeam && !a.m.final) continue;

    for (let j = i + 1; j < matchOrbs.length; j++) {
      const b = matchOrbs[j];
      let col = null;

      if (a.m.champion && b.m.champion) col = C.bass;
      else if (a.m.hostTeam && b.m.hostTeam) col = C.mid;
      else if (a.m.final && b.m.final) col = C.treble;
      else continue;

      stroke(col[0], col[1], col[2], 18 + audioState.mid * 52);
      strokeWeight((0.8 + audioState.level * 1.1) / zoom);
      bezier(a.x, a.y, a.x * 0.55, a.y * 0.12, b.x * 0.55, b.y * 0.12, b.x, b.y);
    }
  }
}

function drawGuideGrid() {
  if (!soundGame || width < 760) return;
  const left = width < 1180 ? 28 : 390;
  const right = width < 1180 ? 28 : 390;
  const railW = width - left - right;
  const y = height - 86;
  if (railW < 360) return;

  noStroke();
  fill(4, 14, 10, 215);
  rect(left, y, railW, 62, 18);

  const steps = [
    { id: "carga", index: "01", name: "CARGA", action: "GRAVES", value: soundGame.bassCharge, signal: audioState.bass, col: C.bass },
    { id: "jugada", index: "02", name: "CONSTRUYE", action: "MEDIOS", value: soundGame.midCharge, signal: audioState.mid, col: C.mid },
    { id: "remate", index: "03", name: "REMATA", action: "AGUDOS", value: soundGame.phase === "remate" || soundGame.phase === "gol" || soundGame.phase === "campeon" ? 1 : 0, signal: audioState.treble, col: C.treble }
  ];
  const cellW = railW / 3;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const x = left + i * cellW;
    const passed = soundGame.phase === "gol" || soundGame.phase === "campeon" || (i === 0 && soundGame.phase !== "carga") || (i === 1 && ["remate", "gol", "campeon"].includes(soundGame.phase));
    const active = soundGame.phase === step.id;
    const alpha = active || passed ? 235 : 88;

    if (i > 0) {
      stroke(C.line[0], C.line[1], C.line[2], 24);
      line(x, y + 13, x, y + 49);
    }
    noStroke();
    fill(step.col[0], step.col[1], step.col[2], active ? 28 + step.signal * 45 : 0);
    rect(x + 5, y + 5, cellW - 10, 52, 13);
    fill(C.line[0], C.line[1], C.line[2], alpha);
    textFont("Space Mono");
    textStyle(BOLD);
    textSize(9);
    textAlign(LEFT, TOP);
    text(`${step.index}  ${step.name}`, x + 15, y + 13);
    fill(step.col[0], step.col[1], step.col[2], alpha);
    textSize(11);
    text(step.action, x + 15, y + 29);
    fill(255, 255, 255, 20);
    rect(x + 15, y + 47, cellW - 30, 4, 2);
    fill(step.col[0], step.col[1], step.col[2], 220);
    rect(x + 15, y + 47, (cellW - 30) * constrain(max(step.value, step.signal * 0.35), 0, 1), 4, 2);
  }
}

function drawLegend() {
  if (!legendVisible) return;

  const w = 330;
  const h = 214;
  const x = width - w - 22;
  const y = height - h - 22;

  noStroke();
  fill(5, 15, 11, 204);
  rect(x, y, w, h, 18);

  fill(C.line[0], C.line[1], C.line[2]);
  textAlign(LEFT, TOP);
  textFont("Space Mono");
  textStyle(BOLD);
  textSize(11);
  text("LEYENDA · L PARA CERRAR", x + 16, y + 16);

  textFont("Bodoni Moda");
  textSize(22);
  textStyle(BOLD);
  text(GAME_TITLE, x + 16, y + 34);

  textFont("DM Sans");
  textStyle(NORMAL);
  textSize(11);
  text("Concepto: el estadio es un instrumento colectivo.\nCompleta el ataque en orden y marca 5 goles\npara despertar la Copa del Mundial seleccionado.", x + 16, y + 66);

  textFont("Space Mono");
  textStyle(BOLD);
  textSize(10);
  fill(C.bass[0], C.bass[1], C.bass[2]);
  text("GRAVES  → cargar la tribuna", x + 16, y + 124);
  fill(C.mid[0], C.mid[1], C.mid[2]);
  text("MEDIOS  → conducir la pelota", x + 16, y + 142);
  fill(C.treble[0], C.treble[1], C.treble[2]);
  text("AGUDOS  → rematar y celebrar", x + 16, y + 160);
  fill(C.line[0], C.line[1], C.line[2], 180);
  text("1/2/3: probar bandas  ·  F: fullscreen", x + 16, y + 186);
  text("Mouse: apuntar / explorar  ·  Flechas: Mundial", x + 16, y + 202);
}

function drawInfo() {
  if (!ui.info) return;
  const t = selectedTournament;
  if (!t || !soundGame) return;

  const phaseTone = soundGame.phase === "carga" ? C.bass : soundGame.phase === "jugada" ? C.mid : C.treble;
  const phaseLabel = gamePhaseLabel(soundGame.phase);
  let goalsHtml = "";
  for (let i = 0; i < GOALS_TO_WIN; i++) {
    const active = i < soundGame.score;
    goalsHtml += `<span style="display:block;width:100%;height:7px;border-radius:999px;background:${active ? `rgb(${C.bass.join(",")})` : "rgba(236,230,206,.12)"};box-shadow:${active ? "0 0 14px rgba(255,198,92,.34)" : "none"};"></span>`;
  }

  let html = `
    <div style="font-family:'Space Mono',monospace;font-size:10px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:rgba(236,230,206,.58);">Mundial ${selectedYear} · ritual del gol</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;gap:16px;">
      <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:52px;font-weight:900;line-height:.82;color:rgb(247,242,226);">${soundGame.score}<span style="font-size:21px;color:rgba(236,230,206,.42);">/${GOALS_TO_WIN}</span></div>
      <div style="font-family:'Space Mono',monospace;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgb(${phaseTone.join(",")});text-align:right;">${phaseLabel}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${GOALS_TO_WIN},1fr);gap:6px;margin-top:15px;">${goalsHtml}</div>
    <div style="margin-top:15px;padding:14px;border-radius:15px;background:rgba(${phaseTone.join(",")},.08);border:1px solid rgba(${phaseTone.join(",")},.24);">
      <div style="font-family:'Space Mono',monospace;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(236,230,206,.52);">Siguiente gesto</div>
      <div style="margin-top:5px;font-size:14px;font-weight:800;line-height:1.35;color:rgb(247,242,226);">${soundGame.feedback}</div>
    </div>
    <div style="margin-top:14px;">
      ${meterRow("Graves", audioState.bass, C.bass)}
      ${meterRow("Medios", audioState.mid, C.mid)}
      ${meterRow("Agudos", audioState.treble, C.treble)}
    </div>
    <div style="margin:17px 0 13px;border-top:1px solid rgba(236,230,206,.12);"></div>
    <div style="font-family:'Space Mono',monospace;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:rgba(236,230,206,.5);">Archivo vivo del Mundial</div>
    <div style="margin-top:6px;font-size:20px;font-family:'Bodoni Moda',Georgia,serif;font-weight:900;color:rgb(247,242,226);">${t.winner || "En juego"}</div>
    <div style="margin-top:4px;font-size:11px;line-height:1.4;color:rgba(236,230,206,.62);">${t.host} · ${matchOrbs.length} memorias disponibles</div>
  `;

  if (soundGame.lastMemory) {
    const memory = soundGame.lastMemory;
    html += `
      <div style="margin-top:14px;padding:14px;border-radius:15px;background:linear-gradient(135deg,rgba(255,198,92,.13),rgba(118,165,255,.08));border:1px solid rgba(255,198,92,.24);">
        <div style="font-family:'Space Mono',monospace;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgb(226,186,98);">Memoria despertada</div>
        <div style="margin-top:7px;font-size:19px;font-weight:900;color:rgb(247,242,226);">${memory.score}</div>
        <div style="margin-top:4px;font-size:12px;line-height:1.45;color:rgba(236,230,206,.78);">${memory.minute} · ${memory.player}<br>${memory.stage}</div>
      </div>
    `;
  } else {
    html += `<div style="margin-top:14px;font-size:11px;line-height:1.5;color:rgba(236,230,206,.55);">Cada gol sonoro ilumina un partido y rescata un goleador real de este Mundial.</div>`;
  }

  if (selectedYear === liveStatus.year && liveStatus.totalMatches > 0) {
    html += `<div style="margin-top:10px;font-family:'Space Mono',monospace;font-size:9px;color:rgba(236,230,206,.5);">2026 EN VIVO · ${liveStatus.finishedMatches}/${liveStatus.totalMatches} PARTIDOS</div>`;
  }

  ui.info.html(html);
}

function statBox(labelText, valueText) {
  return `<div style="padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(236,230,206,.08);">
    <div style="font-family:'Space Mono',monospace;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(236,230,206,.52);">${labelText}</div>
    <div style="margin-top:4px;font-size:14px;font-weight:800;color:rgb(247,242,226);line-height:1.28;white-space:normal;overflow-wrap:anywhere;word-break:break-word;">${valueText}</div>
  </div>`;
}

function meterRow(labelText, value, tone = C.mid) {
  const pct = constrain(value, 0, 1) * 100;
  return `<div style="display:grid;grid-template-columns:70px 1fr;gap:10px;align-items:center;margin-top:9px;">
    <div style="font-family:'Space Mono',monospace;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:rgba(236,230,206,.6);">${labelText}</div>
    <div style="height:9px;border-radius:999px;background:rgba(236,230,206,.1);overflow:hidden;">
      <span style="display:block;height:100%;width:${pct}%;border-radius:999px;background:rgb(${tone.join(",")});box-shadow:0 0 12px rgba(${tone.join(",")},.3);"></span>
    </div>
  </div>`;
}

function drawMicPrompt() {
  if (micReady || demoMode) return;

  const w = min(520, width - 120);
  const h = 130;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;

  noStroke();
  fill(5, 15, 11, 210);
  rect(x, y, w, h, 22);

  fill(C.line[0], C.line[1], C.line[2]);
  textAlign(CENTER, CENTER);
  textFont("Bodoni Moda");
  textStyle(BOLD);
  textSize(28);
  text("Tu voz pone la Copa en juego", width / 2, y + 38);

  textFont("DM Sans");
  textStyle(NORMAL);
  textSize(13);
  text("Activa el microfono o prueba el ritual con las teclas 1, 2 y 3.", width / 2, y + 78);
}

function findHover() {
  if (overUI()) return null;

  let best = null;
  let bestDist = Infinity;

  for (const orb of matchOrbs) {
    const p = toScreen(orb.x, orb.y);
    const d = dist(mouseX, mouseY, p.x, p.y);
    const size = orb.baseSize * params.auraScale * zoom * 0.65;

    if (d < max(13, size) && d < bestDist) {
      best = orb;
      bestDist = d;
    }
  }

  return best;
}

function toScreen(x, y) {
  const rx = x * cos(rot) - y * sin(rot);
  const ry = x * sin(rot) + y * cos(rot);
  return { x: fieldX() + rx * zoom, y: fieldY() + ry * zoom };
}

function mousePressed() {
  if (overUI()) return;
  dragging = true;
  dragged = false;
  lastX = mouseX;
  lastY = mouseY;
}

function mouseDragged() {
  if (!dragging) return;
  targetRot += (mouseX - lastX) * 0.006;
  targetZoom = constrain(targetZoom + (mouseY - lastY) * -0.0013, 0.6, 2.35);
  lastX = mouseX;
  lastY = mouseY;
  dragged = true;
}

function mouseReleased() {
  if (!dragged && hovered) pinned = hovered;
  else if (!dragged && !hovered) pinned = null;
  dragging = false;
}

function mouseWheel(e) {
  if (overUI()) return false;
  targetZoom = constrain(targetZoom - e.delta * 0.001, 0.6, 2.45);
  return false;
}

function keyPressed() {
  if (key === "l" || key === "L") legendVisible = !legendVisible;
  if (key === "f" || key === "F") fullscreen(!fullscreen());
  if (key === "r" || key === "R") restartGame();
  if (key === "a" || key === "A") ui.speedSlider.value(min(3, Number(ui.speedSlider.value()) + 0.1));
  if (key === "z" || key === "Z") ui.speedSlider.value(max(0.5, Number(ui.speedSlider.value()) - 0.1));
  if (key === "1") {
    demoMode = true;
    simulatedBand.bass = 1;
  }
  if (key === "2") {
    demoMode = true;
    simulatedBand.mid = 1;
  }
  if (key === "3") {
    demoMode = true;
    simulatedBand.treble = 1;
  }
  if (keyCode === RIGHT_ARROW) setYear(yearIndex + 1);
  if (keyCode === LEFT_ARROW) setYear(yearIndex - 1);
  updateLabels();
}

function resetView() {
  targetRot = rot = 0;
  targetZoom = zoom = 1;
  pinned = null;
  updateLabels();
}

function restartGame() {
  resetView();
  if (soundGame) soundGame.restart();
  celebrationParticles = [];
  sonicWaves = [];
}

function fieldX() {
  return width < 920 ? width * 0.56 : width * 0.58;
}

function fieldY() {
  return height * 0.52;
}

function fieldW() {
  return min(width * 0.58, height * 1.15);
}

function fieldH() {
  return min(height * 0.72, width * 0.48);
}

function overUI() {
  return hitElement(ui.panel) || hitElement(ui.info);
}

function hitElement(el) {
  if (!el || !el.elt) return false;
  const rect = el.elt.getBoundingClientRect();
  return mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
}

function makeTexture() {
  grass = [];
  for (let i = 0; i < width * height / 5200; i++) {
    grass.push({ x: random(width), y: random(height), a: random(8, 22) });
  }
}

function normalizedBand(value, gate, ceiling) {
  return constrain(map(value, gate, max(gate + 0.01, ceiling), 0, 1), 0, 1);
}

function addSonicWave(tone, strength) {
  sonicWaves.push(new SonicWave(tone, strength));
}

function launchCelebration() {
  for (let i = 0; i < 110; i++) celebrationParticles.push(new CelebrationParticle());
}

function gamePhaseLabel(phase) {
  if (phase === "carga") return "01 · Carga la tribuna";
  if (phase === "jugada") return "02 · Construye la jugada";
  if (phase === "remate") return "03 · Remata";
  if (phase === "gol") return "Gol sonoro";
  if (phase === "campeon") return "Copa conquistada";
  return "En espera";
}

function easeInOutCubic(t) {
  const v = constrain(t, 0, 1);
  return v < 0.5 ? 4 * v * v * v : 1 - pow(-2 * v + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - pow(1 - constrain(t, 0, 1), 3);
}

function colorShift(base, amt) {
  const bassMix = lerpColor(color(base[0], base[1], base[2]), color(C.fogHot[0], C.fogHot[1], C.fogHot[2]), constrain(params.colorFlux * 0.5 + amt * 0.18, 0, 1));
  return lerpColor(bassMix, color(255, 255, 255), constrain(amt * 0.14, 0, 0.35));
}

function poly(x, y, r, sides) {
  beginShape();
  for (let i = 0; i < sides; i++) {
    const a = -HALF_PI + i * TWO_PI / sides;
    vertex(x + cos(a) * r, y + sin(a) * r);
  }
  endShape(CLOSE);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeTexture();
  if (ui.info) ui.info.position(width - 366, 22);
  setYear(yearIndex);
}
