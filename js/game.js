(() => {
const uniq = s => [...new Set(s.trim().split(/\s+/))];
const WORDS = {
  common: uniq("time year people way day man thing woman life child world school state family student group country problem hand part place case week company system program question work government number night point home water room mother area money story fact month lot right study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art garden history party result change morning reason research girl guy moment air teacher force education foot boy age policy music market sense nation plan college interest dream experience effect class control care field development role effort rate heart show leader light voice wife police mind price report decision son view relationship town road arm difference value building action model season society tax director position player record paper space ground form event official matter center couple site project activity star table need court oil situation cost industry figure street image phone data picture practice piece land product doctor wall patient worker news test movie north love support technology step baby computer type attention film tree source organization hair window evidence population truth"),
  code: uniq("const let var function return class import export async await promise object array string number boolean null undefined typeof instanceof switch case break continue default while for loop map filter reduce push splice slice length index keys values entries json parse stringify fetch request response header status error throw catch finally try module package install build deploy commit branch merge rebase pull clone stash diff patch test assert mock spec render props state hook effect context reducer component element node event listener query select insert update delete join table schema cursor stack queue heap tree graph hash binary search sort lambda closure scope prototype inherit interface type generic enum tuple struct pointer thread mutex socket server client router proxy cache token session cookie regex buffer stream yield debug lint format refactor"),
  home: uniq("as ad add all ask asks sad dad lad lads had has gas lag fad fads ads flask flasks flag flags glass salad salads salsa alas fall falls hall halls dash flash shall half hash sash glad lass gala alfalfa")
};
const SETS = [
  { id: "common", label: "Common words" },
  { id: "code", label: "Code words" },
  { id: "home", label: "Home row" }
];
const PACES = [
  { id: "calm", mul: 0.7, label: "Calm pace" },
  { id: "normal", mul: 1, label: "Normal pace" },
  { id: "fast", mul: 1.4, label: "Fast pace" }
];
const FLOOR = 64;
const BANNER = 2.2;
const TAU = Math.PI * 2;

const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d"), stage = $("stage"), typer = $("typer");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue("--" + n).trim();
const C = {
  cream: tok("cream"), floor: tok("floor"), card: tok("card"), ink: tok("ink"), ink2: tok("ink-2"),
  hair: tok("hair"), dust: tok("dust"), blue: tok("blue"), orange: tok("orange"), red: tok("red"), shadow: tok("shadow-ink")
};
const FONT_TEXT = tok("font-text"), FONT_DISPLAY = tok("font-display");
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const INK = rgb(C.ink), RED = rgb(C.red);
const mix = (a, b, t) => "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",") + ")";
const rgba = (c, a) => "rgba(" + c.join(",") + "," + a + ")";

function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { /* storage unavailable; play continues without it */ }
  return null;
}

let setIdx = Math.max(0, SETS.findIndex(s => s.id === store("keyfall-set")));
let paceIdx = PACES.findIndex(p => p.id === store("keyfall-pace"));
if (paceIdx < 0) paceIdx = 1;

let G = null, W = 0, H = 0;
const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, p: Math.random() * TAU }));
const wordFont = () => `600 ${W < 520 ? 17 : 20}px ${FONT_TEXT}`;
const turret = () => ({ x: W / 2, y: H - 33 });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = stage.clientWidth; H = stage.clientHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (G) {
    ctx.font = wordFont();
    for (const w of G.words) {
      w.half = ctx.measureText(w.text).width / 2;
      w.x = Math.min(Math.max(w.x, w.half + 28), Math.max(w.half + 28, W - w.half - 28));
    }
  }
}
new ResizeObserver(resize).observe(stage);
resize();

/* ---------- Sound ---------- */
/* Every sound is made in the browser with the Web Audio API, so there are no sound files.
   The numbers are tuned to match the sounds in Keyfall's demo video. */
const LEVEL = 0.36;
let soundOn = store("keyfall-sound") !== "off";
let ac = null, sfx = null;
const lastSound = {};

function makeSounds() {
  const sr = ac.sampleRate;
  const rand = (a, b) => a + Math.random() * (b - a);
  const out = ac.createGain(), bus = ac.createGain(), drive = ac.createGain(), shaper = ac.createWaveShaper();
  const send = ac.createGain(), room = ac.createConvolver();

  /* Gentle saturation: quiet sounds pass unchanged and loud peaks are rounded off instead of clipped. */
  const curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1) * 2 - 1) * 2);
  shaper.curve = curve;
  shaper.oversample = "2x";
  drive.gain.value = 0.5;

  /* A small stereo room: decaying noise, different in each ear. */
  const ir = ac.createBuffer(2, Math.round(sr * 0.7), sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / sr / 0.11);
  }
  room.buffer = ir;
  send.gain.value = 1.1;

  const noise = ac.createBuffer(1, sr, sr), nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  bus.connect(drive).connect(shaper).connect(out);
  bus.connect(send).connect(room).connect(out);
  out.gain.value = LEVEL;
  out.connect(ac.destination);

  const env = (g, at, peak, attack, tau, hold = 0) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + attack);
    g.gain.setTargetAtTime(0, at + attack + hold, tau);
    return at + attack + hold + tau * 8;
  };
  const filter = (node, [type, freq, q = 0.707]) => {
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    node.connect(f);
    return f;
  };
  const tone = ({ at, freq, to, glide = 0.05, type = "sine", peak, attack = 0.002, hold = 0, tau, lowpass }) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (to) o.frequency.exponentialRampToValueAtTime(to, at + glide);
    const end = env(g, at, peak, attack, tau, hold);
    (lowpass ? filter(o, ["lowpass", lowpass]) : o).connect(g).connect(bus);
    o.start(at); o.stop(end);
  };
  const hiss = ({ at, peak, attack = 0.0005, tau, shape }) => {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = noise;
    const end = env(g, at, peak, attack, tau);
    filter(s, shape).connect(g).connect(bus);
    s.start(at, Math.random() * 0.5); s.stop(end);
  };

  return {
    out,
    /* A 150 Hz thump, a tick whose pitch changes on every press, and a snap of high noise. */
    click: at => {
      const tick = rand(1700, 2300);
      tone({ at, freq: 150, peak: 0.36, attack: 0.0005, hold: 0.005, tau: 0.015 });
      tone({ at, freq: tick, to: tick * 0.95, glide: 0.03, peak: 0.22, attack: 0.001, tau: 0.007 });
      hiss({ at, peak: 0.65, tau: 0.0025, shape: ["highpass", 2500] });
    },
    /* Built like the click, but low and dull with a quick downward bend. */
    wrong: at => {
      tone({ at, freq: 240, to: 150, glide: 0.09, type: "triangle", peak: 0.3, attack: 0.003, tau: 0.04, lowpass: 1000 });
      tone({ at, freq: 110, peak: 0.28, tau: 0.025 });
      hiss({ at, peak: 0.09, tau: 0.003, shape: ["lowpass", 1500] });
    },
    /* A rising pop with a small sparkle on two notes of the chime. */
    pop: at => {
      const k = rand(0.97, 1.03);
      tone({ at, freq: 420 * k, to: 1100 * k, glide: 0.035, peak: 0.6, attack: 0.001, tau: 0.02 });
      hiss({ at, peak: 0.42, tau: 0.003, shape: ["bandpass", 3000 * k, 1] });
      tone({ at: at + 0.015, freq: 1567.98, peak: 0.14, tau: 0.08 });
      tone({ at: at + 0.015, freq: 2349.32, peak: 0.1, tau: 0.07 });
    },
    /* A soft tone falling an octave over a low thud. */
    lifeLost: at => {
      tone({ at, freq: 440, to: 220, glide: 0.4, type: "triangle", peak: 0.21, attack: 0.01, hold: 0.1, tau: 0.15, lowpass: 1400 });
      tone({ at, freq: 95, to: 55, glide: 0.15, peak: 0.31, attack: 0.003, tau: 0.06 });
      hiss({ at, peak: 0.1, tau: 0.03, shape: ["lowpass", 400] });
    },
    /* C5 E5 G5 D6, each a pair of tones 2.8 Hz apart whose beating makes the shimmer. */
    newBest: at => {
      for (const f of [523.25, 659.26, 783.99, 1174.66]) for (const d of [-1.4, 1.4]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f + d;
        g.gain.setValueAtTime(0, at);
        g.gain.setTargetAtTime(0.186, at, 0.01);
        g.gain.setTargetAtTime(0, at + 0.045, 0.42);
        g.gain.setValueAtTime(0.186 * Math.exp(-(1.2 - 0.045) / 0.42), at + 1.2);
        g.gain.linearRampToValueAtTime(0, at + 1.55);
        o.connect(g).connect(bus);
        o.start(at); o.stop(at + 1.6);
      }
    }
  };
}

/* Browsers only allow audio after a click or key press, so the audio context is made on first use. */
function audio() {
  if (sfx === null) {
    try {
      ac = new AudioContext();
      sfx = makeSounds();
    } catch (e) {
      sfx = false; /* no Web Audio in this browser; the game plays silently */
    }
  }
  if (sfx && ac.state !== "running") ac.resume().catch(() => { /* still blocked; the next click or key press tries again */ });
  return sfx;
}

function sound(name, delay = 0) {
  if (!soundOn || !audio()) return;
  /* Keys pressed together play once. This uses the real clock: the audio clock stands still for a moment after it starts or resumes. */
  const now = performance.now();
  if (name in lastSound && now - lastSound[name] < 30) return;
  lastSound[name] = now;
  sfx[name](ac.currentTime + delay);
}

function pauseSound(paused) {
  if (!ac) return;
  if (paused) ac.suspend().catch(() => { /* sound keeps running; the game itself is still paused */ });
  else if (soundOn) ac.resume().catch(() => { /* the next sound tries again */ });
}

function renderSound() {
  for (const b of [$("optSound"), $("pauseSound")]) {
    b.firstElementChild.textContent = soundOn ? "Sound on" : "Sound off";
    b.setAttribute("aria-label", `Sound: ${soundOn ? "on" : "off"}. Activate to change.`);
  }
}

function setSound(on) {
  soundOn = on;
  store("keyfall-sound", on ? "on" : "off");
  renderSound();
  if (sfx) {
    const g = sfx.out.gain, t = ac.currentTime;
    g.cancelScheduledValues(t);
    if (on) g.setValueAtTime(LEVEL, t);
    else g.setTargetAtTime(0, t, 0.015);
  }
  if (on) sound("click");
}

/* ---------- Start screen options ---------- */
function renderOpts() {
  const s = SETS[setIdx], p = PACES[paceIdx];
  $("optSet").firstElementChild.textContent = s.label;
  $("optPace").firstElementChild.textContent = p.label;
  $("optSet").setAttribute("aria-label", `Word set: ${s.label}. Activate to change.`);
  $("optPace").setAttribute("aria-label", `Pace: ${p.label}. Activate to change.`);
  renderSound();
  const best = parseInt(store("keyfall-best-" + s.id) || "0", 10);
  const el = $("bestLine");
  el.hidden = !best;
  el.textContent = best ? `Best score ${best.toLocaleString()}` : "";
}
$("optSet").onclick = () => { setIdx = (setIdx + 1) % SETS.length; store("keyfall-set", SETS[setIdx].id); renderOpts(); };
$("optPace").onclick = () => { paceIdx = (paceIdx + 1) % PACES.length; store("keyfall-pace", PACES[paceIdx].id); renderOpts(); };
$("optSound").onclick = $("pauseSound").onclick = () => setSound(!soundOn);
renderOpts();

/* ---------- Game flow ---------- */
function newGame() {
  G = {
    set: SETS[setIdx].id, pace: PACES[paceIdx].mul,
    words: [], bullets: [], parts: [], rings: [], pops: [], recent: [],
    target: null, wave: 0, waveTotal: 0, toSpawn: 0, spawnT: 0, banner: 0,
    score: 0, lives: 3, correct: 0, wrong: 0, cleared: 0, activeTime: 0,
    state: "play", shake: 0, flash: 0, hurt: 0, recoil: 0, turretErr: 0,
    ringFlash: [0, 0, 0], angle: -Math.PI / 2, overAt: 0
  };
  nextWave();
  $("start").hidden = true; $("over").hidden = true; $("pause").hidden = true; $("hud").hidden = false;
  updateHud();
  if (soundOn) audio();
  typer.focus({ preventScroll: true });
}

function nextWave() {
  G.wave++;
  G.waveTotal = G.toSpawn = 5 + G.wave * 2;
  G.spawnT = 1.4;
  G.banner = BANNER;
}

function setPaused(p) {
  if (!G || G.state === "over") return;
  G.state = p ? "paused" : "play";
  $("pause").hidden = !p;
  pauseSound(p);
  if (!p) typer.focus({ preventScroll: true });
}

function toStart() {
  G = null;
  $("over").hidden = true; $("pause").hidden = true; $("hud").hidden = true; $("start").hidden = false;
  typer.blur();
  renderOpts();
}

function gameOver() {
  G.state = "over"; G.overAt = performance.now(); G.target = null;
  const st = stats();
  $("rWpm").textContent = st.wpm;
  $("rAcc").textContent = st.acc + "%";
  $("rScore").textContent = G.score.toLocaleString();
  $("rWords").textContent = G.cleared;
  $("rSub").textContent = `You made it to wave ${G.wave}.`;
  const key = "keyfall-best-" + G.set;
  const prev = parseInt(store(key) || "0", 10);
  const el = $("rBest");
  el.hidden = !prev && !G.score;
  if (G.score > prev) { store(key, String(G.score)); el.className = "badge"; el.textContent = "New best score"; sound("newBest", 0.6); }
  else { el.className = "note"; el.textContent = `Your best: ${prev.toLocaleString()}`; }
  $("over").hidden = false;
  typer.blur();
}

/* ---------- Words ---------- */
function pickWord() {
  const list = WORDS[G.set], maxLen = 4 + G.wave;
  const firsts = new Set(G.words.filter(w => !w.doomed).map(w => w.text[0]));
  let pick = null;
  for (let i = 0; i < 40 && !pick; i++) {
    const t = list[Math.random() * list.length | 0];
    if (t.length <= maxLen && !firsts.has(t[0]) && !G.recent.includes(t)) pick = t;
  }
  if (!pick) {
    const short = list.filter(t => t.length <= maxLen);
    pick = short[Math.random() * short.length | 0] || list[0];
  }
  G.recent.push(pick);
  if (G.recent.length > 15) G.recent.shift();
  return pick;
}

function spawnWord() {
  const text = pickWord();
  ctx.font = wordFont();
  const half = ctx.measureText(text).width / 2;
  let x = W / 2, bestGap = -1;
  for (let i = 0; i < 8; i++) {
    const cx = half + 28 + Math.random() * Math.max(1, W - 2 * (half + 28));
    const gap = G.words.filter(w => w.y < 90).reduce((m, w) => Math.min(m, Math.abs(w.x - cx)), 1e9);
    if (gap > bestGap) { bestGap = gap; x = cx; }
  }
  const scale = Math.max(.75, H / 720);
  const base = (16 + G.wave * 3.2) * G.pace * scale;
  G.words.push({ text, typed: 0, x, y: -16, half, vy: base * (.85 + Math.random() * .3), pending: 0, doomed: false, kick: 0, err: 0, pts: 0 });
}

/* ---------- Input ---------- */
function handleChar(raw) {
  if (!G || G.state !== "play") return;
  const ch = raw.toLowerCase();
  if (ch.length !== 1 || ch < "a" || ch > "z") return;
  let t = G.target;
  if (!t) {
    const cands = G.words.filter(w => !w.doomed && w.text[w.typed] === ch);
    if (!cands.length) return miss(null);
    t = G.target = cands.reduce((a, b) => (b.y > a.y ? b : a));
  }
  if (t.text[t.typed] !== ch) return miss(t);
  t.typed++; t.pending++; G.correct++;
  fire(t);
  sound("click");
  if (t.typed === t.text.length) {
    t.doomed = true; G.target = null;
    t.pts = t.text.length * 10 * G.wave;
    G.score += t.pts;
  }
  updateHud();
}

function miss(t) {
  G.wrong++; G.flash = .3;
  if (t) t.err = .35; else G.turretErr = .35;
  if (!reduceMotion) G.shake = 4;
  sound("wrong");
  updateHud();
}

function fire(w) {
  const s = turret();
  G.angle = Math.atan2(w.y - s.y, w.x - s.x);
  G.recoil = 1;
  const ux = Math.cos(G.angle), uy = Math.sin(G.angle);
  G.bullets.push({ x: s.x + ux * 30, y: s.y + uy * 30, ux, uy, w });
}

/* ---------- Effects ---------- */
function burst(x, y, colors, n, speed = 190) {
  if (reduceMotion) n = Math.min(n, 6);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = speed * (.25 + Math.random() * .75);
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .45 + Math.random() * .4, r: 1.4 + Math.random() * 1.8, color: colors[i % colors.length] });
  }
}

function explode(w) {
  if (w.dead) return;
  w.dead = true; G.cleared++;
  sound("pop");
  burst(w.x, w.y, [C.orange, C.orange, C.blue], 28);
  G.rings.push({ x: w.x, y: w.y, r0: 8, r1: 70, life: .5, max: .5, color: C.blue });
  if (w.pts) G.pops.push({ x: w.x, y: w.y - 24, text: "+" + w.pts, life: .9, max: .9 });
}

/* ---------- Simulation ---------- */
function step(dt) {
  if (G.state !== "play") return;
  G.activeTime += dt;
  G.banner = Math.max(0, G.banner - dt);
  G.shake = Math.max(0, G.shake - dt * 40);
  G.flash = Math.max(0, G.flash - dt);
  G.hurt = Math.max(0, G.hurt - dt);
  G.recoil = Math.max(0, G.recoil - dt * 9);
  G.turretErr = Math.max(0, G.turretErr - dt);
  G.ringFlash = G.ringFlash.map(v => Math.max(0, v - dt));

  if (G.toSpawn > 0) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      spawnWord(); G.toSpawn--;
      G.spawnT = Math.max(.55, 2.4 - G.wave * .15) * (.7 + Math.random() * .6) / Math.sqrt(G.pace);
    }
  } else if (!G.words.length && !G.bullets.length && G.banner <= 0) {
    nextWave(); updateHud();
  }

  const s = turret(), floorY = H - FLOOR;
  for (const w of G.words) {
    if (w.dead) continue;
    w.err = Math.max(0, w.err - dt);
    w.kick = Math.max(0, w.kick - dt * 90);
    w.y += (w.vy - w.kick) * dt;
    if (w.y + 12 >= floorY) {
      if (w.doomed) { explode(w); continue; }
      w.dead = true;
      if (G.target === w) G.target = null;
      G.lives--;
      sound("lifeLost");
      if (G.lives >= 0) G.ringFlash[G.lives] = .7;
      burst(w.x, floorY, [C.red], 22);
      G.rings.push({ x: w.x, y: floorY, r0: 6, r1: 60, life: .6, max: .6, color: C.red });
      G.hurt = .6;
      if (!reduceMotion) G.shake = 12;
      updateHud();
    }
  }

  for (const b of G.bullets) {
    const w = b.w;
    if (w.dead) { b.done = true; continue; }
    const dx = w.x - b.x, dy = w.y - b.y, d = Math.hypot(dx, dy), sp = 1500 * dt;
    if (d <= sp + 4) {
      b.done = true;
      w.pending--; w.kick = 34;
      burst(w.x, w.y + 8, [C.blue], 4, 90);
      if (w.doomed && w.pending <= 0) explode(w);
    } else {
      b.ux = dx / d; b.uy = dy / d;
      b.x += b.ux * sp; b.y += b.uy * sp;
    }
  }

  const damp = Math.pow(.08, dt);
  for (const p of G.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= damp; p.vy = p.vy * damp + 260 * dt; p.life -= dt; }
  for (const r of G.rings) r.life -= dt;
  for (const p of G.pops) p.life -= dt;

  G.words = G.words.filter(w => !w.dead);
  G.bullets = G.bullets.filter(b => !b.done);
  G.parts = G.parts.filter(p => p.life > 0);
  G.rings = G.rings.filter(r => r.life > 0);
  G.pops = G.pops.filter(p => p.life > 0);

  const aim = G.target ? Math.atan2(G.target.y - s.y, G.target.x - s.x) : (G.bullets.length ? G.angle : -Math.PI / 2);
  G.angle += (aim - G.angle) * Math.min(1, dt * (G.target ? 18 : 4));

  if (G.lives <= 0) gameOver();
}

/* ---------- Rendering ---------- */
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWord(w, now, live) {
  const full = ctx.measureText(w.text).width;
  const wig = live && w.err > 0 ? Math.sin(now * .07) * 5 * (w.err / .35) : 0;
  const x0 = w.x - full / 2 + wig;
  const locked = w === G.target || w.doomed;
  const floorY = H - FLOOR;
  const danger = Math.min(1, Math.max(0, (w.y - floorY * .55) / (floorY * .45)));
  if (locked) {
    ctx.save();
    ctx.shadowColor = C.shadow; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.fillStyle = C.card;
    rr(x0 - 13, w.y - 16, full + 26, 32, 16); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = w.err > 0 ? C.red : C.blue;
    ctx.stroke();
  }
  const done = w.text.slice(0, w.typed);
  const dw = ctx.measureText(done).width;
  ctx.fillStyle = C.blue;
  ctx.fillText(done, x0, w.y + 1);
  ctx.fillStyle = danger > 0 ? mix(INK, RED, danger * .85) : C.ink;
  ctx.fillText(w.text.slice(w.typed), x0 + dw, w.y + 1);
}

function drawTurret(now, live) {
  const s = turret();
  const a = G ? G.angle : -Math.PI / 2;
  const lives = G ? G.lives : 3;
  const wig = live && G.turretErr > 0 ? Math.sin(now * .07) * 4 * (G.turretErr / .35) : 0;
  ctx.save();
  ctx.translate(s.x + wig, s.y);

  const seg = TAU / 3, span = seg - .42;
  ctx.lineCap = "round"; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const c = -Math.PI / 2 + i * seg;
    ctx.beginPath(); ctx.arc(0, 0, 26, c - span / 2, c + span / 2);
    ctx.globalAlpha = 1; ctx.strokeStyle = i < lives ? C.blue : C.hair; ctx.stroke();
    const f = G ? G.ringFlash[i] : 0;
    if (f > 0) { ctx.globalAlpha = f / .7; ctx.strokeStyle = C.red; ctx.stroke(); }
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = C.shadow; ctx.shadowBlur = 14; ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.card;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1; ctx.strokeStyle = C.hair; ctx.stroke();

  ctx.rotate(a);
  ctx.fillStyle = C.ink;
  rr(2, -4.5, 31 - (G ? G.recoil : 0) * 7, 9, 4.5); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
  ctx.restore();
}

function vignette(alpha) {
  if (alpha <= 0) return;
  const h = 110;
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(RED, alpha)); g.addColorStop(1, rgba(RED, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, h);
  g = ctx.createLinearGradient(0, H, 0, H - h);
  g.addColorStop(0, rgba(RED, alpha)); g.addColorStop(1, rgba(RED, 0));
  ctx.fillStyle = g; ctx.fillRect(0, H - h, W, h);
}

function draw(now) {
  const live = !!G && G.state === "play";
  const floorY = H - FLOOR;
  ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (live && G.shake) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);

  ctx.fillStyle = C.dust;
  for (const d of dust) {
    const y = reduceMotion ? d.y * H : (d.y * H + now * .012 * d.z) % H;
    const x = d.x * W + (reduceMotion ? 0 : Math.sin(now * .0004 + d.p) * 6 * d.z);
    ctx.globalAlpha = .55 * d.z;
    ctx.beginPath(); ctx.arc(x, y, 1.1 + d.z * .9, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = C.floor; ctx.fillRect(-20, floorY, W + 40, FLOOR + 20);
  ctx.fillStyle = C.hair; ctx.fillRect(-20, floorY, W + 40, 1);

  if (G) {
    const s = turret();
    if (G.target) {
      ctx.save();
      ctx.strokeStyle = C.blue; ctx.globalAlpha = .28; ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(G.target.x, G.target.y); ctx.stroke();
      ctx.restore();
    }

    ctx.font = wordFont(); ctx.textBaseline = "middle"; ctx.textAlign = "left";
    for (const w of G.words) if (w !== G.target && !w.doomed) drawWord(w, now, live);
    for (const w of G.words) if (w === G.target || w.doomed) drawWord(w, now, live);

    ctx.strokeStyle = C.blue; ctx.lineCap = "round"; ctx.lineWidth = 3;
    for (const b of G.bullets) {
      ctx.beginPath(); ctx.moveTo(b.x - b.ux * 12, b.y - b.uy * 12); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    for (const r of G.rings) {
      const t = 1 - r.life / r.max, e = 1 - Math.pow(1 - t, 3);
      ctx.globalAlpha = (1 - t) * .55; ctx.strokeStyle = r.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, TAU); ctx.stroke();
    }

    for (const p of G.parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = `600 15px ${FONT_TEXT}`; ctx.textAlign = "center"; ctx.fillStyle = C.blue;
    for (const p of G.pops) {
      const t = 1 - p.life / p.max;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillText(p.text, p.x, p.y - t * 26);
    }
    ctx.globalAlpha = 1;
  }

  drawTurret(now, live);

  if (G && G.banner > 0) {
    const elapsed = BANNER - G.banner;
    const a = Math.min(1, elapsed / .3, G.banner / .5);
    const y = H * .38 + (1 - Math.min(1, elapsed / .4)) * 8;
    ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = C.ink;
    ctx.font = `600 ${W < 520 ? 34 : 46}px ${FONT_DISPLAY}`;
    ctx.fillText(`Wave ${G.wave}`, W / 2, y);
    ctx.fillStyle = C.ink2;
    ctx.font = `500 15px ${FONT_TEXT}`;
    ctx.fillText(G.wave === 1 ? "Type a falling word to fire" : `${G.waveTotal} words`, W / 2, y + (W < 520 ? 34 : 42));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.textAlign = "left";

  if (G) vignette(Math.max((G.flash / .3) * .10, (G.hurt / .6) * .24));
}

/* ---------- Readouts ---------- */
function stats() {
  const typed = G.correct + G.wrong, mins = G.activeTime / 60;
  return {
    wpm: mins > .05 ? Math.round(G.correct / 5 / mins) : 0,
    acc: typed ? Math.round((G.correct / typed) * 100) : 100
  };
}
function updateHud() {
  if (!G) return;
  const st = stats();
  $("sScore").textContent = G.score.toLocaleString();
  $("sWave").textContent = G.wave;
  $("sWpm").textContent = st.wpm;
  $("sAcc").textContent = st.acc + "%";
}
setInterval(() => { if (G && G.state === "play") updateHud(); }, 500);

/* ---------- Events ---------- */
document.addEventListener("keydown", e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "Escape") {
    if (G && G.state !== "over") { e.preventDefault(); setPaused(G.state === "play"); }
    return;
  }
  const onButton = e.target.closest && e.target.closest("button");
  if (e.key === "Enter" && !onButton) {
    if (!G) { e.preventDefault(); newGame(); return; }
    if (G.state === "over" && performance.now() - G.overAt > 700) { e.preventDefault(); newGame(); return; }
    if (G.state === "paused") { e.preventDefault(); setPaused(false); return; }
  }
  if (G && G.state === "play" && e.key.length === 1) { e.preventDefault(); handleChar(e.key); }
});
typer.addEventListener("input", () => {
  for (const ch of typer.value) handleChar(ch);
  typer.value = "";
});
stage.addEventListener("pointerdown", () => { if (G && G.state === "play") typer.focus({ preventScroll: true }); });
window.addEventListener("blur", () => { if (G && G.state === "play") setPaused(true); });

$("startBtn").onclick = newGame;
$("resumeBtn").onclick = () => setPaused(false);
$("quitBtn").onclick = toStart;
$("againBtn").onclick = newGame;
$("homeBtn").onclick = toStart;

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  if (G) step(dt);
  draw(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
})();
