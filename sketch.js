// Sinestesia Digital · Ver el sonido
// Concepto: Pulso de estadio sinestesico

let Tm, Tg, Tt, Tteams;
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
let legendVisible = true;

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

const MAX_MIN = 130;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const CONCEPT = "Pulso de estadio sinestesico";

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
  Tm = loadTable("matches_clean.csv", "csv", "header");
  Tg = loadTable("goals_clean.csv", "csv", "header");
  Tt = loadTable("tournaments_clean.csv", "csv", "header");
  Tteams = loadTable("teams_clean.csv", "csv", "header");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  textFont("Georgia");
  parseCSV();
  makeTexture();
  makeUI();
  setYear(years.length - 1);
}

function draw() {
  readControls();
  updateAudioState();
  updateCamera();
  drawField();
  drawAtmosphere();
  drawMap();
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
    const midDrift = audio.mid * params.speed * (0.4 + this.power * 0.9);

    this.glowEven = lerp(this.glowEven, constrain(activeBass * bassGain, 0, 2.2), 0.16);
    this.glowOdd = lerp(this.glowOdd, constrain(activeTreble * trebleGain, 0, 2.2), 0.18);
    this.presence = lerp(this.presence, constrain(audio.level * 2.4 + this.glowEven + this.glowOdd, 0, 3), 0.12);

    this.x = this.baseX + (noise(this.seed, frameCount * 0.006 * params.speed) - 0.5) * 26 * (1 + midDrift);
    this.y = this.baseY + (noise(this.seed + 13, frameCount * 0.006 * params.speed) - 0.5) * 26 * (1 + midDrift * 0.8);
    this.spin += 0.006 + midDrift * 0.01 + this.glowOdd * 0.015;
  }

  draw() {
    const active = this === hovered || this === pinned;
    const size = this.baseSize * params.auraScale * (1 + this.presence * 0.08);

    this.drawShadow(size);
    this.drawBassHalos(size);
    this.drawTrebleHalos(size);
    this.drawCore(size, active);

    if (active) this.drawTag(size);
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
    textFont("monospace");
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

const params = {
  micAmp: 1.8,
  bassGate: 0.11,
  trebleGate: 0.09,
  auraScale: 1.2,
  speed: 1.2,
  colorFlux: 0.45
};

function makeUI() {
  ui.panel = createDiv();
  ui.panel.position(22, 22);
  ui.panel.class("control-panel");
  ui.panel.style("width", "348px");
  ui.panel.style("padding", "18px");

  createDiv("SINIESTESIA DIGITAL · VER EL SONIDO").parent(ui.panel).class("kicker");
  createElement("h1", "Pulso de estadio").parent(ui.panel).class("title");
  createP("Cada partido es un organismo visual. Las aureolas ya no siguen la linea de tiempo: los goles pares despiertan con graves y los impares con agudos del microfono.").parent(ui.panel).class("lead");

  ui.micButton = button("Activar micro + fullscreen", startMic, ui.panel);
  ui.micButton.class("primary-button");

  ui.yearLabel = label("MUNDIAL");
  ui.yearSlider = slider(0, years.length - 1, years.length - 1, 1, () => setYear(int(ui.yearSlider.value())));

  ui.micLabel = label("SENSIBILIDAD MIC");
  ui.micSlider = slider(0.6, 4, params.micAmp, 0.05, updateLabels);

  ui.bassLabel = label("UMBRAL GRAVES");
  ui.bassSlider = slider(0.03, 0.35, params.bassGate, 0.01, updateLabels);

  ui.trebleLabel = label("UMBRAL AGUDOS");
  ui.trebleSlider = slider(0.03, 0.35, params.trebleGate, 0.01, updateLabels);

  ui.auraLabel = label("ESCALA AUREOLA");
  ui.auraSlider = slider(0.7, 2.5, params.auraScale, 0.05, updateLabels);

  ui.speedLabel = label("VELOCIDAD");
  ui.speedSlider = slider(0.5, 3, params.speed, 0.05, updateLabels);

  ui.colorLabel = label("FLUJO DE COLOR");
  ui.colorSlider = slider(0, 1, params.colorFlux, 0.01, updateLabels);

  const row = createDiv().parent(ui.panel);
  row.class("button-row");
  button("Random", () => setYear(floor(random(years.length))), row);
  button("Reset", resetView, row);
  button("Fullscreen", () => fullscreen(!fullscreen()), row);

  createP("Inputs: mouse para orbitar y fijar partidos, rueda para zoom, teclas A/Z velocidad, L leyenda, F fullscreen, flechas cambian mundial.").parent(ui.panel).class("microcopy");

  ui.info = createDiv();
  ui.info.position(width - 342, 22);
  ui.info.class("info-panel");
}

function label(name) {
  const wrap = createDiv().parent(ui.panel);
  wrap.class("label-row");
  createSpan(name).parent(wrap).class("label-name");
  return createSpan("—").parent(wrap).class("label-value");
}

function slider(a, b, c, step, fn) {
  const s = createSlider(a, b, c, step).parent(ui.panel);
  s.class("control-slider");
  s.input(fn);
  return s;
}

function button(textValue, fn, parent) {
  const b = createButton(textValue).parent(parent);
  b.mousePressed(fn);
  b.class("control-button");
  return b;
}

function readControls() {
  if (!ui.micSlider) return;

  params.micAmp = Number(ui.micSlider.value());
  params.bassGate = Number(ui.bassSlider.value());
  params.trebleGate = Number(ui.trebleSlider.value());
  params.auraScale = Number(ui.auraSlider.value());
  params.speed = Number(ui.speedSlider.value());
  params.colorFlux = Number(ui.colorSlider.value());
}

function updateLabels() {
  if (!ui.yearLabel) return;
  ui.yearLabel.html(selectedYear);
  ui.micLabel.html(nf(params.micAmp, 1, 2) + "x");
  ui.bassLabel.html(nf(params.bassGate, 1, 2));
  ui.trebleLabel.html(nf(params.trebleGate, 1, 2));
  ui.auraLabel.html(nf(params.auraScale, 1, 2) + "x");
  ui.speedLabel.html(nf(params.speed, 1, 2) + "x");
  ui.colorLabel.html(nf(params.colorFlux, 1, 2));

  if (!ui.micButton) return;
  if (micReady) ui.micButton.html("Microfono activo");
  else if (audioDenied) ui.micButton.html("Reintentar permiso de microfono");
  else ui.micButton.html("Activar micro + fullscreen");
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
  if (!micReady || !mic || !fft) {
    audioState.rawLevel = 0;
    audioState.level = lerp(audioState.level, 0, 0.08);
    audioState.bass = lerp(audioState.bass, 0, 0.08);
    audioState.mid = lerp(audioState.mid, 0, 0.08);
    audioState.treble = lerp(audioState.treble, 0, 0.08);
    audioState.pulse = lerp(audioState.pulse, 0, 0.08);
    audioState.zone = "pasivo";
    return;
  }

  fft.analyze();

  const level = mic.getLevel();
  const bass = fft.getEnergy("bass") / 255;
  const mid = fft.getEnergy("mid") / 255;
  const treble = fft.getEnergy("treble") / 255;

  audioState.rawLevel = level;
  audioState.level = lerp(audioState.level, constrain(level * params.micAmp * 8, 0, 1.8), 0.18);
  audioState.bass = lerp(audioState.bass, bass, 0.2);
  audioState.mid = lerp(audioState.mid, mid, 0.2);
  audioState.treble = lerp(audioState.treble, treble, 0.2);
  audioState.pulse = constrain(audioState.level + max(audioState.bass, audioState.treble) * 0.8, 0, 2.2);

  const bassOpen = audioState.bass > params.bassGate;
  const trebleOpen = audioState.treble > params.trebleGate;

  if (bassOpen && trebleOpen) audioState.zone = "mixto";
  else if (bassOpen) audioState.zone = "graves";
  else if (trebleOpen) audioState.zone = "agudos";
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

  noStroke();
  fill(C.bass[0], C.bass[1], C.bass[2], bassA);
  ellipse(width * 0.26, height * 0.18, width * (0.2 + audioState.bass * 0.16), height * 0.18);

  fill(C.treble[0], C.treble[1], C.treble[2], trebleA);
  ellipse(width * 0.78, height * 0.22, width * (0.18 + audioState.treble * 0.14), height * 0.16);

  fill(C.fog[0], C.fog[1], C.fog[2], audioState.mid * 54);
  ellipse(width * 0.52, height * 0.75, width * 0.42, height * (0.12 + audioState.mid * 0.16));
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
  const meterX = 430;
  const meterY = height - 52;
  const meterW = max(180, width - 820);

  if (meterW < 120) return;

  noStroke();
  fill(5, 15, 11, 135);
  rect(meterX - 18, meterY - 28, meterW + 36, 54, 16);

  const bands = [
    { name: "GRAVES = GOLES PARES", value: audioState.bass, col: C.bass },
    { name: "MEDIOS = DERIVA", value: audioState.mid, col: C.mid },
    { name: "AGUDOS = GOLES IMPARES", value: audioState.treble, col: C.treble }
  ];

  textFont("monospace");
  textStyle(BOLD);
  textSize(10);
  textAlign(LEFT, CENTER);

  for (let i = 0; i < bands.length; i++) {
    const y = meterY - 10 + i * 16;
    fill(C.line[0], C.line[1], C.line[2], 210);
    text(bands[i].name, meterX, y);

    fill(255, 255, 255, 22);
    rect(meterX + 132, y - 5, meterW - 150, 8, 4);
    fill(bands[i].col[0], bands[i].col[1], bands[i].col[2], 205);
    rect(meterX + 132, y - 5, (meterW - 150) * constrain(bands[i].value, 0, 1), 8, 4);
  }
}

function drawLegend() {
  if (!legendVisible) return;

  const x = width - 366;
  const y = height - 230;
  const w = 330;
  const h = 192;

  noStroke();
  fill(5, 15, 11, 204);
  rect(x, y, w, h, 18);

  fill(C.line[0], C.line[1], C.line[2]);
  textAlign(LEFT, TOP);
  textFont("monospace");
  textStyle(BOLD);
  textSize(11);
  text("LEYENDA / CONCEPTO", x + 16, y + 16);

  textFont("Georgia");
  textSize(22);
  textStyle(BOLD);
  text(CONCEPT, x + 16, y + 34);

  textFont("Arial");
  textStyle(NORMAL);
  textSize(11);
  text("Graves del microfono activan aureolas de goles pares.\nAgudos del microfono activan aureolas de goles impares.\nMedios deforman la deriva, la rotacion y las conexiones.", x + 16, y + 66);

  textFont("monospace");
  textStyle(BOLD);
  textSize(10);
  text("L: mostrar/ocultar leyenda", x + 16, y + 126);
  text("F: fullscreen  |  A/Z: velocidad", x + 16, y + 144);
  text("Mouse: arrastrar / click fijar / rueda zoom", x + 16, y + 162);
  text("Sliders: sensibilidad, umbrales, escala, color", x + 16, y + 180);
}

function drawInfo() {
  if (!ui.info) return;

  const orb = pinned || hovered;
  const t = selectedTournament;
  if (!t) return;

  let html = `
    <div class="kicker">MONITOR SINIESTESICO</div>
    <div class="info-year">${selectedYear}</div>
    <div class="stats-grid">
      ${statBox("Concepto", "Pulso de estadio")}
      ${statBox("Zona sonora", audioState.zone)}
      ${statBox("Campeon", t.winner)}
      ${statBox("Sede", t.host)}
    </div>
    <div class="meter-stack">
      ${meterRow("Volumen", audioState.level)}
      ${meterRow("Graves", audioState.bass)}
      ${meterRow("Medios", audioState.mid)}
      ${meterRow("Agudos", audioState.treble)}
    </div>
  `;

  if (orb) {
    const oddNames = orb.oddGoals.slice(0, 3).map(g => `${g.label} · ${g.team} · ${g.player || "Gol"}`).join("<br>");
    const evenNames = orb.evenGoals.slice(0, 3).map(g => `${g.label} · ${g.team} · ${g.player || "Gol"}`).join("<br>");

    html += `
      <div class="divider"></div>
      <div class="pin-state">${pinned ? "PARTIDO FIJADO" : "PARTIDO EXPLORADO"}</div>
      <div class="match-score">${orb.m.hCode} ${orb.m.hScore}-${orb.m.aScore} ${orb.m.aCode}</div>
      <div class="match-sub">${orb.m.home} vs ${orb.m.away}</div>
      <div class="match-meta">${orb.m.stage}<br>${orb.m.city}, ${orb.m.country}<br>${orb.m.date}</div>
      <div class="match-meta"><strong>Pares:</strong> ${orb.evenGoals.length} goles<br>${evenNames || "Sin goles pares."}</div>
      <div class="match-meta"><strong>Impares:</strong> ${orb.oddGoals.length} goles<br>${oddNames || "Sin goles impares."}</div>
    `;
  } else {
    html += `
      <div class="divider"></div>
      <div class="match-meta">Pasa el mouse sobre una pelota para leer el partido. Con click lo fijas, y con el microfono abierto puedes ver como cambian sus aureolas segun graves y agudos.</div>
    `;
  }

  ui.info.html(html);
}

function statBox(labelText, valueText) {
  return `<div class="stat-box">
    <div class="stat-label">${labelText}</div>
    <div class="stat-value">${valueText}</div>
  </div>`;
}

function meterRow(labelText, value) {
  const pct = constrain(value, 0, 1) * 100;
  return `<div class="meter-row">
    <div class="meter-label">${labelText}</div>
    <div class="meter-bar"><span style="width:${pct}%"></span></div>
  </div>`;
}

function drawMicPrompt() {
  if (micReady) return;

  const w = min(520, width - 120);
  const h = 130;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;

  noStroke();
  fill(5, 15, 11, 210);
  rect(x, y, w, h, 22);

  fill(C.line[0], C.line[1], C.line[2]);
  textAlign(CENTER, CENTER);
  textFont("Georgia");
  textStyle(BOLD);
  textSize(28);
  text("Activa el microfono para ver el sonido", width / 2, y + 38);

  textFont("Arial");
  textStyle(NORMAL);
  textSize(13);
  text("Usa el boton del panel izquierdo. Sin permiso de microfono la pieza queda en estado pasivo.", width / 2, y + 78);
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
  if (key === "r" || key === "R") resetView();
  if (key === "a" || key === "A") ui.speedSlider.value(min(3, Number(ui.speedSlider.value()) + 0.1));
  if (key === "z" || key === "Z") ui.speedSlider.value(max(0.5, Number(ui.speedSlider.value()) - 0.1));
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
  if (ui.info) ui.info.position(width - 342, 22);
  setYear(yearIndex);
}
