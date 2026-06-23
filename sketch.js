// Sinestesia Digital · Ver el sonido
// Repositorio: https://github.com/eeminionn/PulsoDeEstadioSinestesico
// Hecho por eeminionn

let mic = null;
let fft = null;
let micReady = false;
let audioDenied = false;
let legendVisible = false;
let demoMode = false;

let ui = {};
let game = null;
let ballPanels = [];
let particles = [];
let sonicWaves = [];
let dust = [];

let simulatedBand = { bass: 0, mid: 0, treble: 0 };
let audioState = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  zone: "silencio"
};

const GAME_TITLE = "Mundial Infinito";
const TARGET_TOUCHES = 11;
const MATCH_SECONDS = 45;

const C = {
  cream: [246, 240, 218],
  ink: [8, 12, 10],
  gold: [229, 184, 91],
  bass: [238, 159, 65],
  mid: [88, 211, 165],
  treble: [109, 177, 255],
  red: [242, 91, 67]
};

const WORLD_SKINS = [
  {
    name: "Mexico 70",
    pitch: [5, 31, 22],
    stripe: [8, 51, 35],
    accent: [229, 184, 91],
    glow: [242, 91, 67]
  },
  {
    name: "Italia 90",
    pitch: [8, 26, 44],
    stripe: [10, 42, 66],
    accent: [92, 196, 173],
    glow: [99, 161, 255]
  },
  {
    name: "Brasil 2014",
    pitch: [8, 42, 29],
    stripe: [12, 63, 40],
    accent: [245, 197, 67],
    glow: [67, 190, 217]
  },
  {
    name: "Norteamerica 2026",
    pitch: [21, 22, 38],
    stripe: [29, 35, 61],
    accent: [242, 91, 67],
    glow: [109, 177, 255]
  }
];

let skinIndex = 0;
let rotation = 0;
let rotationImpulse = 0;
let tilt = 0;

const params = {
  micAmp: 1.8,
  bassGate: 0.12,
  midGate: 0.1,
  trebleGate: 0.1,
  deformation: 1.15,
  gravity: 1,
  bassEnabled: true,
  midEnabled: true,
  trebleEnabled: true
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  textFont("DM Sans");
  makeBallPanels();
  makeDust();
  game = new InfiniteWorldCupGame();
  makeUI();
}

function draw() {
  readControls();
  updateAudioState();
  game.update(audioState);
  updateMotion();

  drawStadium();
  drawFloodlights();
  drawCrowd();
  drawLivingBall();
  drawEffects();
  drawGameRail();
  drawLegend();
  drawInfo();
  drawMicPrompt();
}

class InfiniteWorldCupGame {
  constructor() {
    this.restart();
  }

  restart() {
    this.state = "ready";
    this.touches = 0;
    this.combo = 0;
    this.expected = "bass";
    this.timeLeft = MATCH_SECONDS;
    this.crowd = 0;
    this.ballOffset = 60;
    this.ballVelocity = 0;
    this.flash = 0;
    this.wrongFlash = 0;
    this.lastHitFrame = -100;
    this.bassWasOpen = false;
    this.trebleWasOpen = false;
    this.message = "Alterna graves y agudos para mantener el balon en juego";
    particles = [];
    sonicWaves = [];
  }

  start() {
    if (this.state !== "ready") return;
    this.state = "playing";
    this.message = "Primer toque: activa los paneles negros con graves";
  }

  update(audio) {
    this.flash *= 0.9;
    this.wrongFlash *= 0.9;

    const bassOpen = params.bassEnabled && audio.bass > params.bassGate;
    const trebleOpen = params.trebleEnabled && audio.treble > params.trebleGate;
    const midPower = params.midEnabled ? normalizedBand(audio.mid, params.midGate, 0.52) : 0;
    const bassRise = bassOpen && !this.bassWasOpen;
    const trebleRise = trebleOpen && !this.trebleWasOpen;

    if (this.state === "ready" && (bassRise || trebleRise || midPower > 0.1)) this.start();

    if (this.state === "playing") {
      const dt = min(0.05, deltaTime / 1000);
      this.crowd = constrain(this.crowd + midPower * 0.009 - 0.0012, 0, 1);
      this.timeLeft = max(0, this.timeLeft - dt * (1 - this.crowd * 0.28));

      this.ballVelocity += 0.055 * params.gravity;
      this.ballOffset += this.ballVelocity * params.gravity;
      const floor = ballRadius() * 0.42;
      const ceiling = -ballRadius() * 0.34;
      if (this.ballOffset < ceiling) {
        this.ballOffset = ceiling;
        this.ballVelocity = max(1.2, abs(this.ballVelocity) * 0.28);
      }
      if (this.ballOffset > floor) {
        this.ballOffset = floor;
        this.ballVelocity = -1.4;
        this.combo = 0;
      }

      if (frameCount - this.lastHitFrame > 12) {
        if (this.expected === "bass" && bassRise) this.correctTouch("bass");
        else if (this.expected === "treble" && trebleRise) this.correctTouch("treble");
        else if (this.expected === "bass" && trebleRise) this.wrongTouch("bass");
        else if (this.expected === "treble" && bassRise) this.wrongTouch("treble");
      }

      if (this.timeLeft <= 0 && this.touches < TARGET_TOUCHES) {
        this.state = "lost";
        this.message = "El tiempo termino. Respira y juega otro Mundial";
      }
    } else if (this.state === "won") {
      this.ballOffset = lerp(this.ballOffset, -25, 0.05);
      this.crowd = lerp(this.crowd, 1, 0.03);
    }

    this.bassWasOpen = bassOpen;
    this.trebleWasOpen = trebleOpen;
  }

  correctTouch(band) {
    this.touches++;
    this.combo++;
    this.expected = band === "bass" ? "treble" : "bass";
    this.lastHitFrame = frameCount;
    const heightFactor = constrain(map(this.ballOffset, -ballRadius() * 0.34, ballRadius() * 0.42, 0, 1), 0, 1);
    this.ballVelocity = lerp(-2.1, -5.4, heightFactor) - min(0.8, this.combo * 0.05);
    this.ballOffset = constrain(this.ballOffset, -ballRadius() * 0.34, ballRadius() * 0.3);
    this.flash = 1;
    rotationImpulse += band === "bass" ? -0.045 : 0.055;

    const tone = band === "bass" ? C.bass : C.treble;
    sonicWaves.push(new SonicWave(tone, 1 + this.combo * 0.04));
    launchTouchParticles(tone, 18 + this.combo * 2);

    if (this.touches >= TARGET_TOUCHES) {
      this.win();
    } else {
      this.message = this.expected === "bass"
        ? `Toque ${this.touches}: ahora busca un sonido grave`
        : `Toque ${this.touches}: ahora busca un sonido agudo`;
    }
  }

  wrongTouch(expectedBand) {
    this.combo = 0;
    this.lastHitFrame = frameCount;
    this.wrongFlash = 1;
    this.message = expectedBand === "bass"
      ? "Ese fue agudo. Los paneles negros esperan un grave"
      : "Ese fue grave. Los paneles blancos esperan un agudo";
  }

  win() {
    this.state = "won";
    this.message = "Once toques. Tu sonido completo la seleccion";
    this.flash = 1;
    launchChampionship();
    sonicWaves.push(new SonicWave(C.gold, 1.8));
  }

  expectedLabel() {
    if (this.state === "won") return "COPA CONQUISTADA";
    if (this.state === "lost") return "FIN DEL PARTIDO";
    return this.expected === "bass" ? "PANEL NEGRO · GRAVE" : "PANEL BLANCO · AGUDO";
  }
}

class BallPanel {
  constructor(kind, angle, distance, size, phase) {
    this.kind = kind;
    this.angle = angle;
    this.distance = distance;
    this.size = size;
    this.phase = phase;
    this.energy = 0;
    this.x = 0;
    this.y = 0;
  }

  update(audio) {
    const target = this.kind === "black" ? audio.bass : audio.treble;
    this.energy = lerp(this.energy, target, this.kind === "black" ? 0.16 : 0.23);
  }

  position(cx, cy, radius) {
    const a = this.angle + rotation * (0.8 + this.distance * 0.35);
    const squash = 0.88 + cos(a + tilt) * 0.06;
    const push = this.kind === "black" ? this.energy * radius * 0.045 : 0;
    this.x = cx + cos(a) * (this.distance * radius + push);
    this.y = cy + sin(a) * this.distance * radius * squash;
    return { x: this.x, y: this.y };
  }

  draw(cx, cy, radius) {
    this.update(audioState);
    const p = this.position(cx, cy, radius);
    const sides = this.kind === "black" ? 5 : 6;
    const baseSize = radius * this.size;
    const scalePulse = this.kind === "black"
      ? 1 + this.energy * 0.46 * params.deformation
      : 1 + this.energy * 0.2 * params.deformation;

    push();
    translate(p.x, p.y);
    rotate(this.phase + rotation * (this.kind === "black" ? -0.65 : 0.9));

    drawingContext.shadowBlur = this.energy * 34;
    drawingContext.shadowColor = this.kind === "black"
      ? `rgba(${C.bass.join(",")},0.8)`
      : `rgba(${C.treble.join(",")},0.75)`;

    if (this.kind === "black") {
      fill(C.ink[0], C.ink[1], C.ink[2], 245);
      stroke(C.bass[0], C.bass[1], C.bass[2], 80 + this.energy * 175);
    } else {
      fill(C.cream[0], C.cream[1], C.cream[2], 245);
      stroke(C.treble[0], C.treble[1], C.treble[2], 45 + this.energy * 195);
    }
    strokeWeight(1.2 + this.energy * 2.2);

    beginShape();
    for (let i = 0; i < sides; i++) {
      const a = -HALF_PI + i * TWO_PI / sides;
      let pointScale = scalePulse;
      if (this.kind === "white") {
        pointScale += max(0, sin(frameCount * 0.08 + i * 2.1 + this.phase)) * this.energy * 0.48 * params.deformation;
      } else {
        pointScale += sin(frameCount * 0.045 + i + this.phase) * this.energy * 0.08;
      }
      vertex(cos(a) * baseSize * pointScale, sin(a) * baseSize * pointScale);
    }
    endShape(CLOSE);

    drawingContext.shadowBlur = 0;
    if (this.energy > 0.08) {
      noFill();
      stroke(this.kind === "black" ? C.bass[0] : C.treble[0], this.kind === "black" ? C.bass[1] : C.treble[1], this.kind === "black" ? C.bass[2] : C.treble[2], this.energy * 95);
      strokeWeight(1);
      circle(0, 0, baseSize * (2.8 + this.energy));
    }
    pop();
  }
}

class TouchParticle {
  constructor(tone, championship = false) {
    this.tone = tone;
    this.x = ballX() + random(-ballRadius() * 0.55, ballRadius() * 0.55);
    this.y = ballY() + random(-ballRadius() * 0.3, ballRadius() * 0.3);
    this.vx = random(-5, 5) * (championship ? 1.5 : 1);
    this.vy = random(championship ? -12 : -7, -2);
    this.gravity = random(0.08, 0.2);
    this.life = 1;
    this.decay = random(0.008, 0.02);
    this.size = random(3, championship ? 11 : 7);
    this.spin = random(TWO_PI);
    this.spinSpeed = random(-0.2, 0.2);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.life -= this.decay;
    this.spin += this.spinSpeed;
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.spin);
    noStroke();
    fill(this.tone[0], this.tone[1], this.tone[2], 235 * max(0, this.life));
    rectMode(CENTER);
    rect(0, 0, this.size * 0.45, this.size, 1);
    pop();
  }
}

class SonicWave {
  constructor(tone, strength) {
    this.tone = tone;
    this.strength = strength;
    this.radius = ballRadius() * 0.35;
    this.life = 1;
  }

  update() {
    this.radius += 8 + this.strength * 4;
    this.life *= 0.94;
  }

  draw() {
    noFill();
    stroke(this.tone[0], this.tone[1], this.tone[2], 150 * this.life);
    strokeWeight(1 + this.life * 3);
    ellipse(ballX(), ballY(), this.radius * 2, this.radius * 1.72);
  }
}

function makeBallPanels() {
  ballPanels = [];
  ballPanels.push(new BallPanel("black", 0, 0, 0.17, 0));

  for (let i = 0; i < 5; i++) {
    const a = -HALF_PI + i * TWO_PI / 5;
    ballPanels.push(new BallPanel("black", a, 0.48, 0.13, a + 0.25));
  }

  for (let i = 0; i < 10; i++) {
    const a = -HALF_PI + PI / 10 + i * TWO_PI / 10;
    const distance = i % 2 === 0 ? 0.3 : 0.7;
    const size = i % 2 === 0 ? 0.13 : 0.105;
    ballPanels.push(new BallPanel("white", a, distance, size, a));
  }
}

function updateMotion() {
  const mouseInfluence = map(constrain(mouseX, 0, width), 0, width, -0.25, 0.25);
  tilt = lerp(tilt, mouseInfluence, 0.04);
  rotationImpulse *= 0.965;
  rotation += 0.0025 + audioState.mid * 0.025 + rotationImpulse;
}

function drawStadium() {
  const skin = WORLD_SKINS[skinIndex];
  background(skin.pitch[0], skin.pitch[1], skin.pitch[2]);

  const stripeW = width / 14;
  noStroke();
  for (let x = 0; x < width + stripeW; x += stripeW) {
    if (floor(x / stripeW) % 2 === 0) {
      fill(skin.stripe[0], skin.stripe[1], skin.stripe[2], 82 + audioState.level * 45);
      rect(x, 0, stripeW, height);
    }
  }

  for (const dustPoint of dust) {
    stroke(C.cream[0], C.cream[1], C.cream[2], dustPoint.alpha);
    dustPoint.x += sin(frameCount * 0.003 + dustPoint.phase) * 0.02;
    point(dustPoint.x, dustPoint.y);
  }

  const cx = ballX();
  const cy = stageY();
  const rx = ballRadius() * 1.52;
  const ry = ballRadius() * 0.64;

  noFill();
  for (let i = 0; i < 5; i++) {
    stroke(C.cream[0], C.cream[1], C.cream[2], 18 + audioState.mid * 24 - i * 2);
    strokeWeight(1);
    ellipse(cx, cy + ballRadius() * 0.48, rx * (1 + i * 0.18), ry * (1 + i * 0.17));
  }

  stroke(C.cream[0], C.cream[1], C.cream[2], 45);
  line(width * 0.3, height * 0.84, width * 0.74, height * 0.84);
  drawingContext.setLineDash([5, 11]);
  line(width * 0.5, height * 0.14, width * 0.5, height * 0.9);
  drawingContext.setLineDash([]);

  const vignette = drawingContext.createRadialGradient(width / 2, height / 2, min(width, height) * 0.18, width / 2, height / 2, max(width, height) * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.72)");
  drawingContext.fillStyle = vignette;
  drawingContext.fillRect(0, 0, width, height);
}

function drawFloodlights() {
  const skin = WORLD_SKINS[skinIndex];
  drawFloodlight(width * 0.22, 0, skin.accent, audioState.bass * 0.8 + game.flash * 0.5);
  drawFloodlight(width * 0.78, 0, skin.glow, audioState.treble * 0.8 + game.flash * 0.5);
}

function drawFloodlight(x, y, tone, strength) {
  if (strength < 0.01) return;
  const gradient = drawingContext.createRadialGradient(x, y, 0, x, y, height * 0.72);
  gradient.addColorStop(0, `rgba(${tone.join(",")},${0.08 + strength * 0.2})`);
  gradient.addColorStop(1, `rgba(${tone.join(",")},0)`);
  drawingContext.fillStyle = gradient;
  drawingContext.fillRect(0, 0, width, height);
}

function drawCrowd() {
  const skin = WORLD_SKINS[skinIndex];
  const cx = ballX();
  const cy = stageY() + ballRadius() * 0.46;
  const crowdPower = max(game.crowd, audioState.mid * 0.7);

  noStroke();
  for (let i = 0; i < 150; i++) {
    const a = i * 2.39996;
    const ring = 1 + (i % 6) * 0.12;
    const x = cx + cos(a) * ballRadius() * 1.05 * ring;
    const y = cy + sin(a) * ballRadius() * 0.38 * ring;
    const flicker = 0.45 + sin(frameCount * 0.05 + i * 1.8) * 0.35;
    const tone = i % 4 === 0 ? skin.accent : i % 7 === 0 ? skin.glow : C.cream;
    fill(tone[0], tone[1], tone[2], 14 + crowdPower * 145 * flicker);
    circle(x, y, 1.5 + crowdPower * 4);
  }
}

function drawLivingBall() {
  const cx = ballX();
  const cy = ballY();
  const radius = ballRadius();
  const skin = WORLD_SKINS[skinIndex];

  noStroke();
  fill(0, 0, 0, 95);
  ellipse(cx + 12, stageY() + radius * 1.02, radius * 1.48, radius * 0.28);

  for (let i = 4; i >= 0; i--) {
    noFill();
    stroke(skin.accent[0], skin.accent[1], skin.accent[2], 12 + audioState.level * 24);
    strokeWeight(1);
    circle(cx, cy, radius * 2.08 + i * 26 + sin(frameCount * 0.04 + i) * audioState.level * 18);
  }

  drawingContext.shadowBlur = 36 + audioState.level * 45;
  drawingContext.shadowColor = `rgba(${skin.accent.join(",")},0.32)`;
  fill(C.cream[0], C.cream[1], C.cream[2]);
  stroke(C.ink[0], C.ink[1], C.ink[2], 190);
  strokeWeight(2);

  beginShape();
  const vertices = 120;
  for (let i = 0; i < vertices; i++) {
    const a = i * TWO_PI / vertices;
    const lowWave = sin(a * 5 + frameCount * 0.025) * audioState.bass * 0.1;
    const highWave = max(0, sin(a * 14 - frameCount * 0.07)) * audioState.treble * 0.09;
    const midWave = sin(a * 3 + rotation * 2) * audioState.mid * 0.035;
    const idleBreath = sin(frameCount * 0.018 + a * 2) * 0.008;
    const deform = (lowWave + highWave + midWave) * params.deformation + idleBreath;
    const r = radius * (1 + deform);
    vertex(cx + cos(a) * r, cy + sin(a) * r);
  }
  endShape(CLOSE);
  drawingContext.shadowBlur = 0;

  drawSeams(cx, cy, radius);
  for (const panel of ballPanels) panel.draw(cx, cy, radius);

  noFill();
  stroke(C.cream[0], C.cream[1], C.cream[2], 90 + game.flash * 160);
  strokeWeight(2 + game.flash * 3);
  circle(cx, cy, radius * 2.02);

  if (game.state === "won") drawCupMark(cx, cy, radius * 0.68);
}

function drawSeams(cx, cy, radius) {
  stroke(C.ink[0], C.ink[1], C.ink[2], 65 + audioState.mid * 95);
  strokeWeight(1 + audioState.mid * 1.2);
  noFill();

  for (let i = 1; i < ballPanels.length; i++) {
    const panel = ballPanels[i];
    const p = panel.position(cx, cy, radius);
    const bend = audioState.mid * radius * 0.12;
    bezier(cx, cy, cx + sin(panel.angle) * bend, cy - cos(panel.angle) * bend, p.x * 0.82 + cx * 0.18, p.y * 0.82 + cy * 0.18, p.x, p.y);
  }
}

function drawCupMark(x, y, size) {
  push();
  translate(x, y);
  noStroke();
  fill(C.gold[0], C.gold[1], C.gold[2], 225);
  arc(0, -size * 0.08, size * 0.5, size * 0.54, 0, PI, CHORD);
  rect(-size * 0.07, size * 0.1, size * 0.14, size * 0.25, size * 0.03);
  rect(-size * 0.22, size * 0.31, size * 0.44, size * 0.09, size * 0.02);
  noFill();
  stroke(C.gold[0], C.gold[1], C.gold[2], 220);
  strokeWeight(size * 0.04);
  arc(-size * 0.25, -size * 0.03, size * 0.27, size * 0.28, HALF_PI, PI + HALF_PI);
  arc(size * 0.25, -size * 0.03, size * 0.27, size * 0.28, -HALF_PI, HALF_PI);
  pop();
}

function drawEffects() {
  for (const wave of sonicWaves) {
    wave.update();
    wave.draw();
  }
  sonicWaves = sonicWaves.filter(wave => wave.life > 0.025);

  for (const particle of particles) {
    particle.update();
    particle.draw();
  }
  particles = particles.filter(particle => particle.life > 0);

  if (game.flash > 0.01) {
    noStroke();
    fill(C.cream[0], C.cream[1], C.cream[2], game.flash * 28);
    rect(0, 0, width, height);
  }
  if (game.wrongFlash > 0.01) {
    noFill();
    stroke(C.red[0], C.red[1], C.red[2], game.wrongFlash * 150);
    strokeWeight(8);
    rect(4, 4, width - 8, height - 8, 18);
  }
}

function drawGameRail() {
  if (width < 850) return;
  const railW = min(580, width - 720);
  if (railW < 360) return;
  const x = width / 2 - railW / 2;
  const y = height - 74;
  const half = railW / 2;

  noStroke();
  fill(3, 12, 9, 220);
  rect(x, y, railW, 52, 17);

  const bassActive = game.expected === "bass" && game.state !== "won";
  const trebleActive = game.expected === "treble" && game.state !== "won";

  fill(C.ink[0], C.ink[1], C.ink[2], bassActive ? 255 : 160);
  rect(x + 5, y + 5, half - 8, 42, 13);
  fill(C.cream[0], C.cream[1], C.cream[2], trebleActive ? 245 : 105);
  rect(x + half + 3, y + 5, half - 8, 42, 13);

  textFont("Space Mono");
  textStyle(BOLD);
  textSize(9);
  textAlign(CENTER, CENTER);
  fill(C.cream[0], C.cream[1], C.cream[2], bassActive ? 255 : 120);
  text("PANEL NEGRO  ·  GRAVE", x + half / 2, y + 26);
  fill(C.ink[0], C.ink[1], C.ink[2], trebleActive ? 255 : 100);
  text("PANEL BLANCO  ·  AGUDO", x + half + half / 2, y + 26);
}

function drawLegend() {
  if (!legendVisible) return;
  const w = min(520, width - 60);
  const h = 210;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;

  noStroke();
  fill(3, 12, 9, 238);
  rect(x, y, w, h, 22);
  stroke(C.cream[0], C.cream[1], C.cream[2], 34);
  noFill();
  rect(x, y, w, h, 22);

  fill(C.cream[0], C.cream[1], C.cream[2]);
  textAlign(LEFT, TOP);
  textFont("Space Mono");
  textStyle(BOLD);
  textSize(10);
  text("CONCEPTO · L PARA CERRAR", x + 22, y + 20);
  textFont("Bodoni Moda");
  textSize(28);
  text(GAME_TITLE, x + 22, y + 42);
  textFont("DM Sans");
  textStyle(NORMAL);
  textSize(12);
  text("Un balon mundialista vivo que solo permanece en el aire cuando\nel jugador alterna frecuencias. Once toques forman una seleccion.", x + 22, y + 80);
  textFont("Space Mono");
  textStyle(BOLD);
  textSize(10);
  fill(C.bass[0], C.bass[1], C.bass[2]);
  text("GRAVES  → deforman negro / patean", x + 22, y + 126);
  fill(C.mid[0], C.mid[1], C.mid[2]);
  text("MEDIOS  → encienden hinchada / estabilizan", x + 22, y + 146);
  fill(C.treble[0], C.treble[1], C.treble[2]);
  text("AGUDOS  → estiran blanco / devuelven", x + 22, y + 166);
  fill(C.cream[0], C.cream[1], C.cream[2], 160);
  text("1/2/3 prueban bandas · R reinicia · F fullscreen", x + 22, y + 190);
}

function makeUI() {
  ui.panel = createDiv();
  ui.panel.position(22, 22);
  stylePanel(ui.panel, 326);

  const kicker = createDiv("JUEGO SONORO · 11 TOQUES").parent(ui.panel);
  styleKicker(kicker);

  const title = createElement("h1", GAME_TITLE).parent(ui.panel);
  styleMany(title, {
    margin: "13px 0 9px",
    "font-family": "Bodoni Moda, Georgia, serif",
    "font-size": "38px",
    "line-height": ".9",
    "letter-spacing": "-.045em",
    color: "rgb(246,240,218)"
  });

  const lead = createP("Mantén un balón monumental en el aire alternando graves y agudos. Los medios encienden la hinchada. Completa once toques y forma tu selección.").parent(ui.panel);
  styleMany(lead, {
    margin: "0 0 14px",
    "font-size": "12px",
    "line-height": "1.5",
    color: "rgba(246,240,218,.76)"
  });

  ui.micButton = controlButton("Entrar al Mundial", startMic, ui.panel);
  stylePrimaryButton(ui.micButton);

  ui.skinLabel = label("ATMOSFERA MUNDIAL");
  const skinButton = controlButton("Cambiar sede", cycleSkin, ui.panel);
  styleMany(skinButton, { margin: "6px 0 0", padding: "8px 10px" });

  ui.micLabel = label("SENSIBILIDAD MIC");
  ui.micSlider = slider(0.6, 4, params.micAmp, 0.05);
  ui.bassLabel = label("UMBRAL GRAVES");
  ui.bassSlider = slider(0.03, 0.35, params.bassGate, 0.01);
  ui.midLabel = label("UMBRAL MEDIOS");
  ui.midSlider = slider(0.03, 0.35, params.midGate, 0.01);
  ui.trebleLabel = label("UMBRAL AGUDOS");
  ui.trebleSlider = slider(0.03, 0.35, params.trebleGate, 0.01);
  ui.deformLabel = label("DEFORMACION");
  ui.deformSlider = slider(0.4, 2.2, params.deformation, 0.05);
  ui.gravityLabel = label("GRAVEDAD DEL BALON");
  ui.gravitySlider = slider(0.55, 1.65, params.gravity, 0.05);

  const bandTitle = createDiv("BANDAS ACTIVAS").parent(ui.panel);
  styleMany(bandTitle, {
    margin: "14px 0 7px",
    "font-family": "Space Mono, monospace",
    "font-size": "9px",
    "font-weight": "700",
    "letter-spacing": ".12em",
    color: "rgba(246,240,218,.55)"
  });

  const bandRow = createDiv().parent(ui.panel);
  styleMany(bandRow, { display: "grid", "grid-template-columns": "1fr 1fr 1fr", gap: "7px" });
  ui.bassCheck = bandToggle("Graves", C.bass, true, bandRow);
  ui.midCheck = bandToggle("Medios", C.mid, true, bandRow);
  ui.trebleCheck = bandToggle("Agudos", C.treble, true, bandRow);

  const row = createDiv().parent(ui.panel);
  styleMany(row, { display: "grid", "grid-template-columns": "1fr 1fr", gap: "8px", "margin-top": "12px" });
  const restartButton = controlButton("Nuevo partido", restartGame, row);
  const fullButton = controlButton("Fullscreen", () => fullscreen(!fullscreen()), row);
  styleMany(restartButton, { margin: "0", padding: "9px 7px" });
  styleMany(fullButton, { margin: "0", padding: "9px 7px" });

  const microcopy = createP("Prueba sin micro: 1 graves · 2 medios · 3 agudos. L muestra la leyenda. R reinicia.").parent(ui.panel);
  styleMany(microcopy, {
    margin: "12px 0 0",
    "font-size": "10px",
    "line-height": "1.5",
    color: "rgba(246,240,218,.52)"
  });

  ui.info = createDiv();
  ui.info.position(width - 350, 22);
  stylePanel(ui.info, 328);
  styleMany(ui.info, { "max-height": "none", "overflow-y": "visible" });
  updateLabels();
}

function stylePanel(element, panelWidth) {
  styleMany(element, {
    width: `${panelWidth}px`,
    padding: "20px",
    "border-radius": "22px",
    background: "linear-gradient(180deg, rgba(4,16,12,.95), rgba(7,25,18,.9))",
    border: "1px solid rgba(246,240,218,.14)",
    color: "rgb(246,240,218)",
    "box-shadow": "0 22px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.04)",
    "backdrop-filter": "blur(16px)",
    "box-sizing": "border-box",
    "max-height": "calc(100vh - 44px)",
    "overflow-y": "auto",
    "overscroll-behavior": "contain"
  });
}

function styleKicker(element) {
  styleMany(element, {
    "font-family": "Space Mono, monospace",
    "font-size": "10px",
    "font-weight": "700",
    "letter-spacing": ".15em",
    color: "rgba(246,240,218,.58)"
  });
}

function label(name) {
  const wrap = createDiv().parent(ui.panel);
  styleMany(wrap, { display: "flex", "justify-content": "space-between", "align-items": "center", "margin-top": "12px" });
  const left = createSpan(name).parent(wrap);
  styleMany(left, {
    "font-family": "Space Mono, monospace",
    "font-size": "9px",
    "font-weight": "700",
    "letter-spacing": ".1em",
    color: "rgba(246,240,218,.58)"
  });
  const right = createSpan("—").parent(wrap);
  styleMany(right, {
    "font-family": "Space Mono, monospace",
    "font-size": "13px",
    "font-weight": "700",
    color: "rgb(246,240,218)"
  });
  return right;
}

function slider(minValue, maxValue, value, step) {
  const element = createSlider(minValue, maxValue, value, step).parent(ui.panel);
  styleMany(element, { width: "100%", margin: "5px 0 0", "accent-color": "rgb(229,184,91)" });
  element.input(updateLabels);
  return element;
}

function controlButton(textValue, fn, parent) {
  const element = createButton(textValue).parent(parent);
  element.mousePressed(fn);
  styleMany(element, {
    width: "100%",
    margin: "10px 0 0",
    padding: "10px 11px",
    "border-radius": "12px",
    border: "1px solid rgba(246,240,218,.14)",
    background: "rgba(255,255,255,.05)",
    color: "rgb(246,240,218)",
    "font-family": "Space Mono, monospace",
    "font-size": "10px",
    "font-weight": "700",
    cursor: "pointer"
  });
  return element;
}

function stylePrimaryButton(element) {
  styleMany(element, {
    background: "linear-gradient(135deg, rgb(231,190,102), rgb(187,119,52))",
    color: "rgb(9,14,11)",
    border: "1px solid rgba(255,220,150,.35)",
    "box-shadow": "0 10px 24px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.24)"
  });
}

function bandToggle(name, tone, checked, parent) {
  const wrap = createDiv().parent(parent);
  styleMany(wrap, {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "9px 7px",
    "border-radius": "11px",
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(246,240,218,.09)"
  });
  const check = createCheckbox("", checked).parent(wrap);
  styleMany(check, { margin: "0", "accent-color": `rgb(${tone.join(",")})` });
  const textElement = createSpan(name).parent(wrap);
  styleMany(textElement, {
    "font-family": "Space Mono, monospace",
    "font-size": "8px",
    "font-weight": "700",
    color: "rgb(246,240,218)"
  });
  return check;
}

function styleMany(element, styles) {
  if (!element) return;
  for (const [key, value] of Object.entries(styles)) element.style(key, value);
}

function readControls() {
  if (!ui.micSlider) return;
  params.micAmp = Number(ui.micSlider.value());
  params.bassGate = Number(ui.bassSlider.value());
  params.midGate = Number(ui.midSlider.value());
  params.trebleGate = Number(ui.trebleSlider.value());
  params.deformation = Number(ui.deformSlider.value());
  params.gravity = Number(ui.gravitySlider.value());
  params.bassEnabled = ui.bassCheck.checked();
  params.midEnabled = ui.midCheck.checked();
  params.trebleEnabled = ui.trebleCheck.checked();
}

function updateLabels() {
  if (!ui.skinLabel) return;
  ui.skinLabel.html(WORLD_SKINS[skinIndex].name);
  ui.micLabel.html(nf(Number(ui.micSlider.value()), 1, 2) + "x");
  ui.bassLabel.html(nf(Number(ui.bassSlider.value()), 1, 2));
  ui.midLabel.html(nf(Number(ui.midSlider.value()), 1, 2));
  ui.trebleLabel.html(nf(Number(ui.trebleSlider.value()), 1, 2));
  ui.deformLabel.html(nf(Number(ui.deformSlider.value()), 1, 2) + "x");
  ui.gravityLabel.html(nf(Number(ui.gravitySlider.value()), 1, 2) + "x");

  if (micReady) ui.micButton.html("Microfono activo · juega");
  else if (audioDenied) ui.micButton.html("Reintentar microfono");
  else ui.micButton.html("Entrar al Mundial");
}

function drawInfo() {
  if (!ui.info || !game) return;
  const expectedTone = game.expected === "bass" ? C.bass : C.treble;
  const touchPct = game.touches / TARGET_TOUCHES * 100;
  const timeText = nf(ceil(game.timeLeft), 2);
  const stateTitle = game.state === "won" ? "CAMPEON" : game.state === "lost" ? "TIEMPO" : game.state === "ready" ? "EN ESPERA" : "EN JUEGO";

  ui.info.html(`
    <div style="font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:.14em;color:rgba(246,240,218,.5);">PARTIDO SONORO · ${stateTitle}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;">
      <div>
        <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:52px;font-weight:900;line-height:.82;color:rgb(246,240,218);">${game.touches}<span style="font-size:19px;color:rgba(246,240,218,.38);">/${TARGET_TOUCHES}</span></div>
        <div style="margin-top:8px;font-family:'Space Mono',monospace;font-size:9px;color:rgba(246,240,218,.52);">TOQUES · 11 JUGADORES</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:36px;font-weight:900;color:rgb(246,240,218);">0:${timeText}</div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;color:rgba(246,240,218,.5);">TIEMPO</div>
      </div>
    </div>
    <div style="height:7px;margin-top:15px;border-radius:999px;background:rgba(246,240,218,.1);overflow:hidden;">
      <span style="display:block;width:${touchPct}%;height:100%;border-radius:999px;background:rgb(${C.gold.join(",")});box-shadow:0 0 14px rgba(229,184,91,.38);"></span>
    </div>
    <div style="margin-top:15px;padding:14px;border-radius:15px;background:rgba(${expectedTone.join(",")},.08);border:1px solid rgba(${expectedTone.join(",")},.25);">
      <div style="font-family:'Space Mono',monospace;font-size:8px;font-weight:700;letter-spacing:.12em;color:rgba(246,240,218,.5);">PROXIMO TOQUE</div>
      <div style="margin-top:5px;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:rgb(${expectedTone.join(",")});">${game.expectedLabel()}</div>
      <div style="margin-top:7px;font-size:12px;line-height:1.45;color:rgba(246,240,218,.8);">${game.message}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px;">
      ${infoStat("RACHA", game.combo)}
      ${infoStat("SEDE", WORLD_SKINS[skinIndex].name)}
    </div>
    <div style="margin-top:14px;">
      ${meterRow("Negros · graves", audioState.bass, C.bass)}
      ${meterRow("Hinchada · medios", game.crowd, C.mid)}
      ${meterRow("Blancos · agudos", audioState.treble, C.treble)}
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(246,240,218,.1);font-size:10px;line-height:1.5;color:rgba(246,240,218,.5);">Alterna negro y blanco. Deja un pequeño silencio entre sonidos para que cada toque sea reconocido.</div>
  `);
}

function infoStat(labelText, value) {
  return `<div style="padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(246,240,218,.08);">
    <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:.1em;color:rgba(246,240,218,.46);">${labelText}</div>
    <div style="margin-top:4px;font-size:12px;font-weight:700;line-height:1.25;color:rgb(246,240,218);">${value}</div>
  </div>`;
}

function meterRow(labelText, value, tone) {
  const pct = constrain(value, 0, 1) * 100;
  return `<div style="display:grid;grid-template-columns:112px 1fr;gap:9px;align-items:center;margin-top:8px;">
    <div style="font-family:'Space Mono',monospace;font-size:8px;color:rgba(246,240,218,.56);">${labelText}</div>
    <div style="height:7px;border-radius:999px;background:rgba(246,240,218,.1);overflow:hidden;">
      <span style="display:block;width:${pct}%;height:100%;border-radius:999px;background:rgb(${tone.join(",")});"></span>
    </div>
  </div>`;
}

async function startMic() {
  try {
    await userStartAudio();
    mic = new p5.AudioIn();
    await mic.start();
    fft = new p5.FFT(0.78, 1024);
    fft.setInput(mic);
    micReady = true;
    audioDenied = false;
    game.start();
  } catch (error) {
    console.error(error);
    micReady = false;
    audioDenied = true;
  }
  updateLabels();
}

function updateAudioState() {
  simulatedBand.bass *= 0.84;
  simulatedBand.mid *= 0.84;
  simulatedBand.treble *= 0.84;

  const hasMic = micReady && mic && fft;
  let level = max(simulatedBand.bass, simulatedBand.mid, simulatedBand.treble) * 0.16;
  let bass = simulatedBand.bass;
  let mid = simulatedBand.mid;
  let treble = simulatedBand.treble;

  if (hasMic) {
    fft.analyze();
    level = max(level, mic.getLevel());
    const boost = map(params.micAmp, 0.6, 4, 0.7, 1.55);
    bass = max(bass, fft.getEnergy(20, 250) / 255 * boost);
    mid = max(mid, fft.getEnergy(250, 2000) / 255 * boost);
    treble = max(treble, fft.getEnergy(2000, 10000) / 255 * boost);
  }

  bass = params.bassEnabled ? constrain(bass, 0, 1) : 0;
  mid = params.midEnabled ? constrain(mid, 0, 1) : 0;
  treble = params.trebleEnabled ? constrain(treble, 0, 1) : 0;

  audioState.level = lerp(audioState.level, constrain(level * params.micAmp * 7, 0, 1.5), 0.18);
  audioState.bass = lerp(audioState.bass, bass, 0.22);
  audioState.mid = lerp(audioState.mid, mid, 0.2);
  audioState.treble = lerp(audioState.treble, treble, 0.24);

  if (audioState.bass > params.bassGate && audioState.treble > params.trebleGate) audioState.zone = "mixto";
  else if (audioState.bass > params.bassGate) audioState.zone = "grave";
  else if (audioState.treble > params.trebleGate) audioState.zone = "agudo";
  else if (audioState.mid > params.midGate) audioState.zone = "medio";
  else audioState.zone = "silencio";
}

function normalizedBand(value, gate, ceiling) {
  return constrain(map(value, gate, max(gate + 0.01, ceiling), 0, 1), 0, 1);
}

function launchTouchParticles(tone, count) {
  for (let i = 0; i < count; i++) particles.push(new TouchParticle(tone));
}

function launchChampionship() {
  const palette = [C.gold, C.bass, C.mid, C.treble, C.red, C.cream];
  for (let i = 0; i < 220; i++) particles.push(new TouchParticle(random(palette), true));
}

function cycleSkin() {
  skinIndex = (skinIndex + 1) % WORLD_SKINS.length;
  updateLabels();
  sonicWaves.push(new SonicWave(WORLD_SKINS[skinIndex].accent, 1.2));
}

function restartGame() {
  game.restart();
  rotationImpulse = 0;
}

function makeDust() {
  dust = [];
  for (let i = 0; i < width * height / 4200; i++) {
    dust.push({ x: random(width), y: random(height), alpha: random(5, 20), phase: random(TWO_PI) });
  }
}

function ballX() {
  return width < 980 ? width * 0.52 : width * 0.5;
}

function stageY() {
  return height * 0.5;
}

function ballY() {
  return stageY() + game.ballOffset;
}

function ballRadius() {
  const availableWidth = max(360, width - 760);
  return min(height * 0.34, availableWidth * 0.42);
}

function drawMicPrompt() {
  if (micReady || demoMode) return;
  const w = min(480, width - 80);
  const h = 116;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;

  noStroke();
  fill(3, 12, 9, 225);
  rect(x, y, w, h, 20);
  fill(C.cream[0], C.cream[1], C.cream[2]);
  textAlign(CENTER, CENTER);
  textFont("Bodoni Moda");
  textStyle(BOLD);
  textSize(26);
  text("El balon espera tu primer toque", width / 2, y + 37);
  textFont("DM Sans");
  textStyle(NORMAL);
  textSize(12);
  fill(C.cream[0], C.cream[1], C.cream[2], 175);
  text("Activa el microfono o prueba con 1, 2 y 3.", width / 2, y + 76);
}

function keyPressed() {
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
  if (key === "l" || key === "L") legendVisible = !legendVisible;
  if (key === "f" || key === "F") fullscreen(!fullscreen());
  if (key === "r" || key === "R") restartGame();
  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) cycleSkin();
}

function mousePressed() {
  if (overUI()) return;
  rotationImpulse += map(mouseX, 0, width, -0.04, 0.04);
}

function overUI() {
  return hitElement(ui.panel) || hitElement(ui.info);
}

function hitElement(element) {
  if (!element || !element.elt) return false;
  const bounds = element.elt.getBoundingClientRect();
  return mouseX >= bounds.left && mouseX <= bounds.right && mouseY >= bounds.top && mouseY <= bounds.bottom;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  makeDust();
  if (ui.info) ui.info.position(width - 350, 22);
}
