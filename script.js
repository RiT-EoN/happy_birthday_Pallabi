/* ✏️ EDIT THIS PART ✏️ */
const CONFIG = {
  name: "Pallabi",
  signature: "— Ritam",

  // texts
  startTitle: "I  have  made  something  for  you",
  startButton: "Start",
  countdownText: "Blow the candle in:",
  blowText: "blow the candle ..",
  titleLine: "Happy Birthday",
  subtitle: "Today, every star is shining just for you ✨",
  note: [
    "Happy Birthday! 🎂",
    "I hope your day is filled with the kind of happiness that stays long after the candles are blown out. May every new chapter bring you closer to the things you dream about and may you always have reasons to smile.",
    "Have the most beautiful birthday."
  ],
  typingPace: 1,                  // 0.6 = faster, 1 = natural, 1.5 = slower / more cinematic
  typewriter: true,               // type the note letter by letter

  // look: "romantic" | "sunset" | "midnight" | "garden"
  theme: "romantic",
  colors: {},                     // override any theme colour, e.g. { accent: "#ff4d8d", gold: "#ffd27a", paper: "#fff4ea" }
  backgroundImage: "",            // a real photo for the final scene, e.g. "images/bg.jpg"
  backgroundBlur: 6,              // px
  backgroundDim: 0.45,            // 0 = bright, 1 = dark
  effects: { bokeh: true, fairyLights: true, petals: true, hearts: true, confetti: true },

  frame: "mix",                   // photo frames: "champagne" | "lavender" | "mix"
  photos: [                       // put her pictures in an /images folder
    { src: "images/photo1.jpg", caption: "Smile 😊" },
    { src: "images/photo2.jpg", caption: "My favourite" },
    { src: "images/photo3.jpg", caption: "Always you" }
  ],

  introVolume: 0.15,              // soft music while the candle is still lit (0 = none)
  introMusicFile: "",             // optional different file for the intro; empty = same song
  musicFile: "music/birthday.mp3",                  // optional: "music/song.mp3" instead of the built-in melody

  // microphone
  voiceFilter: true,              // ignore talking and singing; only a real blow counts
  blowHoldMs: 220,                // how long (ms) the blow must last
  blowThreshold: 0.04,            // minimum loudness (0–1) counted as a blow; lower = more sensitive
  finalDelayMs: 1000              // wait after the flame goes out
};
/* ✏️ END ✏️ */

const $ = (id) => document.getElementById(id);
const SMALL = Math.min(innerWidth, innerHeight) < 600;                 // phones: lighter effects
const IN_APP = /FBAN|FBAV|Instagram|Snapchat|Line\//i.test(navigator.userAgent); // in-app browsers often block the mic
const screens = ["start", "blow", "final"];
function show(id) {
  const next = $(id);
  screens.forEach((name) => {
    const el = $(name);
    if (el !== next && el.classList.contains("active")) {
      el.classList.remove("active", "shake"); el.classList.add("leaving");
      setTimeout(() => el.classList.remove("leaving", "shown"), 850);
    }
  });
  next.classList.add("active");
  document.body.dataset.scene = id;
  veilFlash(id === "final");
  requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add("shown")));
}

// Fit the candle scene on short screens
function fit() {
  document.documentElement.style.setProperty("--k", Math.min(1, Math.max(0.5, (innerHeight - 330) / 550)).toFixed(2));
}
fit(); addEventListener("resize", fit);

$("startTitle").textContent = CONFIG.startTitle;
$("startBtn").addEventListener("click", () => { initAudio(); startIntro(); keepAwake(); show("blow"); lightThenCount(); });

/* ---------- countdown ---------- */
function countdown() {
  let n = 3;
  const el = $("count");
  const tick = () => {
    el.textContent = n;
    beep(n === 1 ? 660 : 520, 0.12);
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    if (n-- > 1) setTimeout(tick, 1000);
    else setTimeout(() => {
      el.textContent = "";
      $("prompt").textContent = CONFIG.blowText;
      listenForBlow();
    }, 1000);
  };
  tick();
}

/* ---------- microphone blow detection ---------- */
let blown = false, stream;

async function listenForBlow() {
  $("hint").textContent = "Allow the microphone, then blow on it 🌬️";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch (err) { return fallback(); }
  await ac.resume();
  duckIntro();
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  const src = ac.createMediaStreamSource(stream);
  const silent = ac.createGain(); silent.gain.value = 0;   // keeps Safari pulling audio, no feedback
  src.connect(analyser); analyser.connect(silent); silent.connect(ac.destination);
  $("meter").classList.add("on");                          // glowing bar: how hard you are blowing
  $("hint").textContent = "Blow gently on the microphone 🌬️";
  setTimeout(() => {                                       // nothing detected: offer a tap instead
    if (!blown) { $("hint").textContent = "Not working? Tap the candle to blow it out"; enableTap(); }
  }, 10000);

  const HOLD = CONFIG.blowHoldMs || 220, MIN = CONFIG.blowThreshold || 0.04;
  const N = analyser.fftSize, fs = ac.sampleRate;
  const f32 = new Float32Array(N), u8 = new Uint8Array(N), y = new Float32Array(N);
  const hasFloat = !!analyser.getFloatTimeDomainData;
  const lagLo = Math.floor(fs / 400), lagHi = Math.floor(fs / 70);   // pitch range of a human voice

  // A voice has a pitch (repeating wave) or a hiss; a blow is a rumbling, non-repeating noise.
  function voiceLike() {
    let e0 = 0, e1 = 0;
    for (let i = 1; i < N; i++) { y[i] = f32[i] - 0.97 * f32[i - 1]; e0 += f32[i] * f32[i]; e1 += y[i] * y[i]; }
    if (e1 < 1e-9) return false;
    if (e1 / e0 > 0.2) return true;                        // "s", "sh", "f" hiss
    let best = 0;
    for (let lag = lagLo; lag <= lagHi; lag += 3) {
      let c = 0;
      for (let i = 1; i < N - lag; i++) c += y[i] * y[i + lag];
      if (c > best) best = c;
    }
    return best / e1 > 0.3;                                // clear pitch = someone talking or singing
  }

  let ambient = 0.005, calSum = 0, calN = 0, held = 0, shown = 0, last = performance.now();
  const t0 = last;

  (function loop(now) {
    if (blown) return;
    if (hasFloat) analyser.getFloatTimeDomainData(f32);
    else { analyser.getByteTimeDomainData(u8); for (let i = 0; i < N; i++) f32[i] = (u8[i] - 128) / 128; }
    let sum = 0;
    for (let i = 0; i < N; i++) sum += f32[i] * f32[i];
    const rms = Math.sqrt(sum / N);
    const dt = Math.min(100, now - last); last = now;

    if (now - t0 < 700) {                                  // learn the room noise first
      calSum += rms; calN++; ambient = Math.min(0.05, calSum / calN);
      return requestAnimationFrame(loop);
    }
    const voice = CONFIG.voiceFilter !== false && rms > ambient * 1.6 && voiceLike();
    const limit = voice ? Math.max(0.25, ambient * 8)      // a voice must be extremely loud to count
                        : Math.max(MIN, ambient * 2.5);    // a blow-like noise only needs to be firm
    const floor = ambient * 1.2;
    const level = Math.max(0, Math.min(1, (rms - floor) / (limit - floor)));
    const loud = rms > limit;
    if (rms < ambient * 1.8 + 0.004) ambient = Math.min(0.05, ambient * 0.97 + rms * 0.03);   // learn the quiet room
    else if (!voice && !loud) ambient = Math.min(0.05, ambient + (rms - ambient) * 0.002);    // slow drift (fans, traffic)
    held = loud ? held + dt : Math.max(0, held - dt * 0.5); // blows flutter, so decay slowly
    shown += (Math.max(level * 0.85, Math.min(1, held / HOLD)) - shown) * 0.4;   // smooth bar
    $("meterFill").style.width = (shown * 100).toFixed(1) + "%";
    $("flame").style.setProperty("--lean", (level * 26).toFixed(1));
    if (held >= HOLD) return blowOut();
    requestAnimationFrame(loop);
  })(performance.now());
}

function duckIntro() { // keep the soft intro quiet so the microphone doesn't hear it
  const v = CONFIG.introVolume * 0.4;
  if (introEl) fadeAudio(introEl, v, 600);
  if (introBus) introBus.gain.setTargetAtTime(v, ac.currentTime, 0.3);
}

function enableTap() {
  $("blow").style.cursor = "pointer";
  $("blow").addEventListener("click", blowOut, { once: true });
}

function fallback() {
  $("hint").textContent = IN_APP ? "Mic is blocked in this app. Open the link in your browser, or tap the screen to blow it out." : "Microphone unavailable. Tap the screen to blow the candle out.";
  $("blow").style.cursor = "pointer";
  $("blow").addEventListener("click", blowOut, { once: true });
}

function blowOut() {
  if (blown) return;
  blown = true;
  outFx();
  stopIntro();
  startMusic();
  $("flame").classList.add("out");                 // flame disappears immediately
  $("hint").textContent = "";
  if (stream) stream.getTracks().forEach((t) => t.stop());
  setTimeout(showFinal, CONFIG.finalDelayMs);
}

/* ---------- final screen ---------- */
function showFinal() {
  setTitle(CONFIG.titleLine);
  $("finalName").textContent = CONFIG.name;
  $("subtitle").textContent = CONFIG.subtitle;
  $("sign").textContent = CONFIG.signature;
  typeNote();
  const rot = ["-4deg", "3deg", "-2deg", "4deg"];
  CONFIG.photos.forEach((ph, i) => {
    const fig = document.createElement("figure");
    fig.className = "polaroid " + (CONFIG.frame === "champagne" ? "f-champagne" : CONFIG.frame === "lavender" ? "f-lavender" : (i % 2 ? "f-lavender" : "f-champagne"));
    fig.style.setProperty("--r", rot[i % rot.length]);
    fig.style.setProperty("--i", i);
    const img = new Image();
    img.alt = ph.caption || "Photo";
    img.src = ph.src;
    img.onerror = () => {
      const d = document.createElement("div");
      d.className = "ph";
      d.textContent = "Add " + ph.src;
      img.replaceWith(d);
    };
    const cap = document.createElement("figcaption");
    cap.textContent = ph.caption || "";
    fig.append(img, cap);
    $("photos").appendChild(fig);
  });
  show("final");
  scrollTo(0, 0);
  finalFx();
}

/* ---------- audio (all synthesized, no files needed) ---------- */
let ac, bus, introBus, musicOn = true, melodyTimer, introTimer, audioEl, introEl;
function initAudio() {
  if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); bus = ac.createGain(); bus.connect(ac.destination);
    introBus = ac.createGain(); introBus.gain.value = CONFIG.introVolume; introBus.connect(ac.destination); }
  ac.resume();
}
function tone(f, t, d, type = "sine", v = 0.18, dest) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(dest || ac.destination); o.start(t); o.stop(t + d + 0.05);
}
const beep = (f, d) => tone(f, ac.currentTime, d, "sine", 0.15);
function puff() { // soft whoosh when the flame goes out
  const len = ac.sampleRate * 0.4, buf = ac.createBuffer(1, len, ac.sampleRate), c = buf.getChannelData(0);
  for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = buf; f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.35;
  s.connect(f).connect(g).connect(ac.destination); s.start();
}
// "Happy Birthday" as a music-box melody: [frequency Hz, beats]
const MELODY = [[392,.75],[392,.25],[440,1],[392,1],[523,1],[494,2],
  [392,.75],[392,.25],[440,1],[392,1],[587,1],[523,2],
  [392,.75],[392,.25],[784,1],[659,1],[523,1],[494,1],[440,1],
  [698,.75],[698,.25],[659,1],[523,1],[587,1],[523,2]];
function playMelody(dest, keepTimer) {
  const beat = 0.5; let t = ac.currentTime + 0.2;
  MELODY.forEach(([f, b]) => {
    tone(f, t, b * beat * 1.6, "triangle", 0.2, dest);
    tone(f * 2, t, b * beat * 1.2, "sine", 0.06, dest);
    t += b * beat;
  });
  keepTimer(setTimeout(() => playMelody(dest, keepTimer), (t - ac.currentTime + 1.2) * 1000));
}
function fadeAudio(el, to, ms, done) {
  const from = el.volume, t0 = performance.now();
  const id = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(id); if (done) done(); }
  }, 40);
}
// soft background music while the candle is still lit
function startIntro() {
  if (CONFIG.introVolume <= 0) return;
  const file = CONFIG.introMusicFile || CONFIG.musicFile;
  const synth = () => playMelody(introBus, (id) => (introTimer = id));
  if (file) {
    introEl = new Audio(file); introEl.loop = true; introEl.volume = CONFIG.introVolume;
    introEl.addEventListener("error", () => { introEl = null; synth(); }, { once: true });
    introEl.play().catch(() => {});
  } else synth();
}
function stopIntro() {
  clearTimeout(introTimer);
  if (introEl) { const el = introEl; introEl = null; fadeAudio(el, 0, 700, () => el.pause()); }
  if (introBus) introBus.gain.setTargetAtTime(0, ac.currentTime, 0.25);
}
// full music: starts the moment the flame goes out, fades in
function startMusic() {
  if (CONFIG.musicFile) {
    if (!audioEl) {
      audioEl = new Audio(CONFIG.musicFile); audioEl.loop = true;
      audioEl.addEventListener("error", () => { CONFIG.musicFile = ""; audioEl = null; if (musicOn) startMusic(); }, { once: true });
    }
    audioEl.volume = 0; audioEl.play().catch(() => {});
    fadeAudio(audioEl, 1, 1500);
  } else {
    clearTimeout(melodyTimer);
    bus.gain.cancelScheduledValues(ac.currentTime); bus.gain.setValueAtTime(0, ac.currentTime);
    bus.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
    playMelody(bus, (id) => (melodyTimer = id));
  }
}
function stopMusic() {
  clearTimeout(melodyTimer);
  if (audioEl) audioEl.pause();
  if (bus) bus.gain.setTargetAtTime(0, ac.currentTime, 0.05);
}
$("mute").addEventListener("click", () => {
  musicOn = !musicOn;
  $("mute").textContent = musicOn ? "🔊" : "🔇";
  musicOn ? startMusic() : stopMusic();
});

/* ---------- effects ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const COLORS = ["#ff5c93", "#ffd27a", "#ffffff", "#ff8fb1", "#cfa5ff", "#ffb347"];
const PETALS = ["#e63a5f", "#ff5c93", "#ff8fb1", "#c2185b", "#ffb3c7"];

function outFx() { // everything that happens the moment the flame dies
  $("glow").classList.add("out");
  $("meter").classList.remove("on");
  document.querySelector(".shadow").classList.add("out");
  $("wick").classList.add("ember");
  $("smoke").classList.add("go");
  $("blow").classList.add("shake");
  puff();
}

for (let i = 0; i < (SMALL ? 12 : 22); i++) { // drifting sparkles behind every screen
  const s = document.createElement("i");
  s.className = "spark";
  s.style.cssText = `--x:${rand(0, 100)}%;--s:${rand(3, 8)}px;--d:${rand(7, 14)}s;--dl:${rand(0, 10)}s;--dx:${rand(-40, 40)}px`;
  $("sparkles").appendChild(s);
}

function setTitle(text) { // letters bounce in one by one
  $("finalTitle").textContent = "";
  [...text].forEach((ch, i) => {
    const s = document.createElement("span");
    s.textContent = ch === " " ? "\u00A0" : ch;
    s.style.setProperty("--i", i);
    $("finalTitle").appendChild(s);
  });
}

const FX = Object.assign({ bokeh: true, fairyLights: true, petals: true, hearts: true, confetti: true }, CONFIG.effects);
const cv = $("fx"), g2 = cv.getContext("2d");
let bits = [], going = false;
function sizeFx() { cv.width = innerWidth; cv.height = innerHeight; }
sizeFx(); addEventListener("resize", sizeFx);
function spawn(n, petal) {
  for (let i = 0; i < n; i++) bits.push(petal
    ? { petal: true, x: rand(0, cv.width), y: rand(-60, -10), s: rand(7, 13), vx: rand(-0.6, 0.6), vy: rand(0.8, 2),
        r: rand(0, 6.28), vr: rand(-0.04, 0.04), ph: rand(0, 6.28), c: PETALS[i % PETALS.length] }
    : { x: rand(0, cv.width), y: rand(-cv.height * 0.4, -10), w: rand(6, 11), h: rand(10, 16), vx: rand(-1.5, 1.5),
        vy: rand(2, 5), r: rand(0, 6.28), vr: rand(-0.2, 0.2), c: COLORS[i % COLORS.length] });
  if (!going) { going = true; stepFx(); }
}
function stepFx() {
  g2.clearRect(0, 0, cv.width, cv.height);
  bits = bits.filter((b) => b.y < cv.height + 30);
  bits.forEach((b) => {
    b.ph = (b.ph || 0) + 0.03;
    b.x += b.vx + (b.petal ? Math.sin(b.ph) * 0.9 : Math.sin(b.y / 40)); b.y += b.vy; b.r += b.vr;
    g2.save(); g2.translate(b.x, b.y); g2.rotate(b.r); g2.fillStyle = b.c;
    if (b.petal) { g2.beginPath(); g2.ellipse(0, 0, b.s, b.s * 0.55 * Math.abs(Math.cos(b.ph)) + 2, 0, 0, 6.28); g2.fill(); }
    else g2.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    g2.restore();
  });
  if (bits.length) requestAnimationFrame(stepFx); else going = false;
}

/* ---------- themes ---------- */
const THEMES = {
  romantic: { sky: "linear-gradient(180deg,#120a24 0%,#2b1445 55%,#5a2350 100%)", accent: "#ff5c93", gold: "#ffd27a", paper: "#fff4ea", ink: "#4a2336", glow: "255,170,110" },
  sunset:   { sky: "linear-gradient(180deg,#2a1a4a 0%,#8a3a6a 50%,#ff8a5c 100%)", accent: "#ff6f91", gold: "#ffe08a", paper: "#fff1e6", ink: "#5a2a3a", glow: "255,190,120" },
  midnight: { sky: "linear-gradient(180deg,#050b1f 0%,#0f2347 60%,#1f3d6e 100%)", accent: "#7fb7ff", gold: "#cfe6ff", paper: "#eef4ff", ink: "#1d2c4a", glow: "150,190,255" },
  garden:   { sky: "linear-gradient(180deg,#1a2a2a 0%,#2f5a4a 55%,#6a8a5a 100%)", accent: "#ff8fb1", gold: "#fff0a8", paper: "#fffaf0", ink: "#2f4a3a", glow: "255,220,150" }
};
function applyTheme() {
  const t = Object.assign({}, THEMES[CONFIG.theme] || THEMES.romantic, CONFIG.colors);
  Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty("--" + k, v));
}

/* ---------- background: boken lights, stars, moon, optional real photo ---------- */
function buildBackground() {
  const box = document.createElement("div"); box.id = "bokeh"; document.body.prepend(box);
  if (FX.bokeh) {
    const cols = ["255,200,120", "255,150,170", "255,240,200", "200,160,255"];
    for (let i = 0; i < (SMALL ? 14 : 26); i++) {
      const d = document.createElement("i"), sz = rand(24, 95);
      d.style.cssText = `left:${rand(-3, 100)}%;top:${rand(52, 98)}%;width:${sz}px;height:${sz}px;--o:${rand(0.18, 0.5)};--dl:${rand(0, 6)}s;--c:${cols[i % 4]}`;
      box.appendChild(d);
    }
    for (let i = 0; i < (SMALL ? 28 : 50); i++) {
      const st = document.createElement("b");
      st.style.cssText = `left:${rand(0, 100)}%;top:${rand(0, 55)}%;--dl:${rand(0, 5)}s;--z:${rand(1, 2.6)}px`;
      box.appendChild(st);
    }
    box.appendChild(document.createElement("u"));
  }
  if (CONFIG.backgroundImage) {
    const bg = document.createElement("div"); bg.id = "bgphoto";
    bg.style.cssText = `background-image:url("${CONFIG.backgroundImage}");filter:blur(${CONFIG.backgroundBlur}px) brightness(${1 - CONFIG.backgroundDim})`;
    document.body.prepend(bg);
  }
}

/* ---------- fairy lights ---------- */
function lights() {
  if (!FX.fairyLights) return;
  const N = 7, y = (x) => 8 + 36 * Math.abs(Math.sin(Math.PI * x / 100 * N));
  let pts = "";
  for (let i = 0; i <= 200; i++) pts += `${i / 2},${y(i / 2).toFixed(1)} `;
  $("lights").innerHTML = `<svg viewBox="0 0 100 90" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  const cols = ["#ffd27a", "#ff8fb1", "#fff2c6", "#ffb347"];
  for (let k = 0; k < N * 3; k++) {
    const x = (k + 0.5) / (N * 3) * 100, el = document.createElement("i");
    el.style.cssText = `left:${x}%;top:${y(x).toFixed(1)}px;--c:${cols[k % 4]};--dl:${rand(0, 3).toFixed(1)}s`;
    $("lights").appendChild(el);
  }
}

/* ---------- typewriter note ---------- */
function typeNote() {
  const box = $("note"); box.innerHTML = "";
  const ps = CONFIG.note.map((t) => { const p = document.createElement("p"); box.appendChild(p); return [p, [...t]]; });
  if (ps.length) ps[0][0].textContent = ps[0][1].join("");      
  const rest = ps.slice(1);                                     
  if (!CONFIG.typewriter) return rest.forEach(([p, c]) => (p.textContent = c.join("")));
  const pace = CONFIG.typingPace || 1;
  // smooth, steady typing: even rhythm, a soft breath at commas, a longer one at the end of a sentence
  const delay = (ch, next) => {
    let d = rand(38, 62);
    if (",;:".includes(ch)) d += rand(130, 200);
    else if (".!?…".includes(ch) && (!next || next === " ")) d += rand(320, 480);
    return d * pace;
  };
  let pi = 0, ci = 0;
  const step = () => {
    if (pi >= rest.length) return;
    const [p, c] = rest[pi];
    if (ci === 0) { rest.forEach(([q]) => q.classList.remove("typing")); p.classList.add("typing"); }
    p.textContent = c.slice(0, ++ci).join("");
    if (ci >= c.length) {
      pi++; ci = 0;
      if (pi >= rest.length) return setTimeout(() => p.classList.remove("typing"), 2500);
      setTimeout(step, rand(700, 1000) * pace);
    } else setTimeout(step, delay(c[ci - 1], c[ci]));
  };
  setTimeout(step, 1200);
}

/* ---------- final scene ---------- */
function finalFx() {
  document.body.classList.add("final");
  $("mute").classList.add("show");
  [523, 659, 784, 1046].forEach((f, i) => tone(f, ac.currentTime + i * 0.09, 0.5, "triangle", 0.15));
  lights();
  if (FX.hearts) for (let i = 0; i < (SMALL ? 8 : 12); i++) {
    const b = document.createElement("div");
    b.className = "balloon";
    b.textContent = ["💖", "💗", "✨", "🌹"][i % 4];
    b.style.cssText = `--x:${rand(2, 92)}%;--fs:${rand(18, 34)}px;--d:${rand(9, 16)}s;--dl:${rand(0, 8)}s`;
    $("balloons").appendChild(b);
  }
  if (FX.confetti) { spawn(SMALL ? 70 : 120); setTimeout(() => spawn(SMALL ? 50 : 80), 3000); }
  if (FX.petals) setInterval(() => { if (bits.length < (SMALL ? 40 : 70)) spawn(2, true); }, 500);
}

/* ---------- init ---------- */
applyTheme();
buildBackground();
$("startBtn").textContent = CONFIG.startButton;
$("prompt").textContent = CONFIG.countdownText;

/* ---------- phone helpers ---------- */
let wake;
async function keepAwake() { try { wake = await navigator.wakeLock.request("screen"); } catch (e) {} } // keep the screen on
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (ac) ac.suspend(); if (audioEl) audioEl.pause(); if (introEl) introEl.pause(); }
  else { if (introEl) introEl.play().catch(() => {}); if (ac) ac.resume(); if (audioEl && musicOn && $("final").classList.contains("active")) audioEl.play().catch(() => {}); if (wake) keepAwake(); }
});

/* ---------- scene choreography ---------- */
function lightThenCount() { // the candle rises and lights first, then the countdown begins
  $("count").textContent = "";
  $("hint").textContent = "Lighting the candle…";
  setTimeout(() => { $("hint").textContent = ""; countdown(); }, 1900);
}
function veilFlash(big) { // a warm wave of light that carries you into the next scene
  const v = $("veil");
  v.style.setProperty("--vd", big ? "1.9s" : "1.1s");
  v.classList.remove("go", "big"); void v.offsetWidth;
  v.classList.add("go"); if (big) v.classList.add("big");
}
document.body.dataset.scene = "start";
requestAnimationFrame(() => requestAnimationFrame(() => $("start").classList.add("shown")));