/* ✏️ EDIT THIS PART ✏️ */
const CONFIG = {
  name: "Pallabi",
  signature: "— Ritam",

  // texts
  startTitle: "I  have  made  something  for  you",
  startButton: "Start",
  countdownText: "Blow the candle in:",
  blowText: "blow the candle .. And make a wish ..",
  titleLine: "Happy Birthday",
  subtitle: "Today, every star is shining just for you ✨",
  footerText: "made with love and care",
  note: [
    "Happy Birthday! 🎂",
    "I hope your day is filled with the kind of happiness that stays long after the candles are blown out. May every new chapter bring you closer to the things you dream about and may you always have reasons to smile.",
    "Have the most beautiful birthday."
  ],
  typingPace: 1, // 0.6 = faster, 1 = natural, 1.5 = slower / more cinematic
  typewriter: true, // type the note letter by letter

  // look: "romantic" | "sunset" | "midnight" | "garden"
  theme: "romantic",
  colors: {}, // override any theme colour, e.g. { accent: "#ff4d8d", gold: "#ffd27a", paper: "#fff4ea" } — no longer needed, the .full-bg layer now covers the theme sky
  backgroundImage: "", // a real photo for the final scene, e.g. "images/bg.jpg"
  backgroundBlur: 6, // px
  backgroundDim: 0.45, // 0 = bright, 1 = dark
  effects: {
    bokeh: true,
    fairyLights: true,
    petals: true,
    hearts: true,
    confetti: true
  },

  frame: "mix", // photo frames: "champagne" | "lavender" | "mix"
  photos: [ // put her pictures in an /images folder
    {
      src: "images/photo1.jpg",
      caption: "Smile 😊"
    }, {
      src: "images/photo2.jpg",
      caption: "My favourite 🧿"
    }, {
      src: "images/photo3.jpg",
      caption: "Always you ❤️‍🔥"
    }
  ],
  constellation: [ // personal messages revealed by tapping each star
    "You make ordinary days feel special.",
    "Your smile is contagious.",
    "Grateful for your friendship.",
    "You always know what to say.",
    "Here's to more memories together.",
    "You deserve all the happiness today."
  ],

  introVolume: 0.15, // soft music while the candle is still lit (0 = none)
  introMusicFile: "", // optional different file for the intro; empty = same song
  musicFile: "music/birthday.mp3", // optional: "music/song.mp3" instead of the built-in melody

  // microphone
  voiceFilter: true, // ignore talking and singing; only a real blow counts
  blowHoldMs: 220, // how long (ms) the blow must last
  blowThreshold: 0.04, // minimum loudness (0–1) counted as a blow; lower = more sensitive
  finalDelayMs: 1000 // wait after the flame goes out
};
/* ✏️ END ✏️ */

const $ = (id) => document.getElementById(id);
const SMALL = Math.min(innerWidth, innerHeight) < 600; // phones: lighter effects
const IN_APP = /FBAN|FBAV|Instagram|Snapchat|Line\//i.test(navigator.userAgent); // in-app browsers often block the mic
const screens = ["start", "blow", "final"];

function show(id) {
  const next = $(id);
  screens.forEach((name) => {
    const el = $(name);
    if (el !== next && el.classList.contains("active")) {
      el.classList.remove("active", "shake");
      el.classList.add("leaving");
      setTimeout(() => el.classList.remove("leaving", "shown"), 850);
    }
  });
  next.classList.add("active");
  if (id === "blow") fit();
  document.body.dataset.scene = id;
  veilFlash(id === "final");
  requestAnimationFrame(() => requestAnimationFrame(() => next.classList.add("shown")));
}

// Fit the candle scene on short screens
function fit() {
  const blow = $("blow");
  if (!blow.classList.contains("active")) return;

  const scene = $("scene");
  scene.style.marginBottom = "0px";
  const screenStyle = getComputedStyle(blow);
  const sceneStyle = getComputedStyle(scene);
  const fixedHeight = parseFloat(screenStyle.paddingTop) + parseFloat(screenStyle.paddingBottom) +
    parseFloat(sceneStyle.marginTop) + parseFloat(sceneStyle.marginBottom) +
    Array.from(blow.children).reduce((height, child) => {
      if (child === scene) return height;
      const style = getComputedStyle(child);
      return height + child.getBoundingClientRect().height +
        parseFloat(style.marginTop) + parseFloat(style.marginBottom);
    }, 0);
  const naturalSceneHeight = scene.offsetHeight;
  const availableHeight = innerHeight - fixedHeight - 32;
  const scale = Math.min(1, Math.max(0.2, availableHeight / naturalSceneHeight));
  document.documentElement.style.setProperty("--k", scale.toFixed(2));
  scene.style.marginBottom = `${naturalSceneHeight * (scale - 1)}px`;
}
fit();
addEventListener("resize", fit);

$("startTitle").textContent = CONFIG.startTitle;
$("finalFooter").textContent = CONFIG.footerText;
let experienceStarted = false;

function beginExperience() {
  if (experienceStarted) return;
  experienceStarted = true;
  try {
    initAudio();
  } catch (error) {
    console.warn("Audio failed to initialize:", error);
  }
  try {
    startIntro();
  } catch (error) {
    console.warn("Intro failed to start:", error);
  }
  try {
    keepAwake();
  } catch (error) {
    console.warn("Wake lock failed:", error);
  }
  show("blow");
  lightThenCount();
}
$("startBtn").addEventListener("click", beginExperience);

/* ---------- countdown ---------- */
function countdown() {
  let n = 3;
  const el = $("count");
  const tick = () => {
    el.textContent = n;
    beep(n === 1 ? 660 : 520, 0.12);
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    if (n-- > 1) setTimeout(tick, 1000);
    else setTimeout(() => {
      el.textContent = "";
      $("prompt").textContent = CONFIG.blowText;
      fit();
      listenForBlow();
    }, 1000);
  };
  tick();
}

/* ---------- microphone blow detection ---------- */
let blown = false,
  stream, micNodes = [];

/* The mic is opened only after the countdown and is fully released the moment the candle is out
   (or if the tab is hidden / closed), so the browser's mic indicator turns off. */
function releaseMic() {
  micNodes.forEach((n) => {
    try {
      n.disconnect();
    } catch (e) {}
  });
  micNodes = [];
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}
addEventListener("pagehide", releaseMic);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && stream && !blown) {
    releaseMic();
    $("meter").classList.remove("on");
    $("hint").textContent = "Mic paused. Tap the candle to blow it out";
    enableTap();
  }
});

async function listenForBlow() {
  $("hint").textContent = "Allow the microphone, then blow on it 🌬️";
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
  } catch (err) {
    return fallback();
  }
  if (blown || document.hidden) {
    releaseMic();
    return;
  } // candle already out (or tab left) while the prompt was open
  await ac.resume();
  duckIntro();
  const analyser = ac.createAnalyser();
  analyser.fftSize = 2048;
  const src = ac.createMediaStreamSource(stream);
  const silent = ac.createGain();
  silent.gain.value = 0; // keeps Safari pulling audio, no feedback
  src.connect(analyser);
  analyser.connect(silent);
  silent.connect(ac.destination);
  micNodes = [src, analyser, silent];
  $("meter").classList.add("on"); // glowing bar: how hard you are blowing
  $("hint").textContent = "Blow gently on the microphone 🌬️";
  setTimeout(() => { // nothing detected: offer a tap instead
    if (!blown) {
      $("hint").textContent = "Not working? Tap the candle to blow it out";
      enableTap();
    }
  }, 10000);

  const HOLD = CONFIG.blowHoldMs || 220,
    MIN = CONFIG.blowThreshold || 0.04;
  const N = analyser.fftSize,
    fs = ac.sampleRate;
  const f32 = new Float32Array(N),
    u8 = new Uint8Array(N),
    y = new Float32Array(N);
  const hasFloat = !!analyser.getFloatTimeDomainData;
  const lagLo = Math.floor(fs / 400),
    lagHi = Math.floor(fs / 70); // pitch range of a human voice

  // A voice has a pitch (repeating wave) or a hiss; a blow is a rumbling, non-repeating noise.
  function voiceLike() {
    let e0 = 0,
      e1 = 0;
    for (let i = 1; i < N; i++) {
      y[i] = f32[i] - 0.97 * f32[i - 1];
      e0 += f32[i] * f32[i];
      e1 += y[i] * y[i];
    }
    if (e1 < 1e-9) return false;
    if (e1 / e0 > 0.2) return true; // "s", "sh", "f" hiss
    let best = 0;
    for (let lag = lagLo; lag <= lagHi; lag += 3) {
      let c = 0;
      for (let i = 1; i < N - lag; i++) c += y[i] * y[i + lag];
      if (c > best) best = c;
    }
    return best / e1 > 0.3; // clear pitch = someone talking or singing
  }

  let ambient = 0.005,
    calSum = 0,
    calN = 0,
    held = 0,
    shown = 0,
    last = performance.now();
  const t0 = last;

  (function loop(now) {
    if (blown) return;
    if (hasFloat) analyser.getFloatTimeDomainData(f32);
    else {
      analyser.getByteTimeDomainData(u8);
      for (let i = 0; i < N; i++) f32[i] = (u8[i] - 128) / 128;
    }
    let sum = 0;
    for (let i = 0; i < N; i++) sum += f32[i] * f32[i];
    const rms = Math.sqrt(sum / N);
    const dt = Math.min(100, now - last);
    last = now;

    if (now - t0 < 700) { // learn the room noise first
      calSum += rms;
      calN++;
      ambient = Math.min(0.05, calSum / calN);
      return requestAnimationFrame(loop);
    }
    const voice = CONFIG.voiceFilter !== false && rms > ambient * 1.6 && voiceLike();
    const limit = voice ? Math.max(0.25, ambient * 8) // a voice must be extremely loud to count
      :
      Math.max(MIN, ambient * 2.5); // a blow-like noise only needs to be firm
    const floor = ambient * 1.2;
    const level = Math.max(0, Math.min(1, (rms - floor) / (limit - floor)));
    const loud = rms > limit;
    if (rms < ambient * 1.8 + 0.004) ambient = Math.min(0.05, ambient * 0.97 + rms * 0.03); // learn the quiet room
    else if (!voice && !loud) ambient = Math.min(0.05, ambient + (rms - ambient) * 0.002); // slow drift (fans, traffic)
    held = loud ? held + dt : Math.max(0, held - dt * 0.5); // blows flutter, so decay slowly
    shown += (Math.max(level * 0.85, Math.min(1, held / HOLD)) - shown) * 0.4; // smooth bar
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
  $("blow").addEventListener("click", blowOut, {
    once: true
  });
}

function fallback() {
  $("hint").textContent = IN_APP ? "Mic is blocked in this app. Open the link in your browser, or tap the screen to blow it out." : "Microphone unavailable. Tap the screen to blow the candle out.";
  $("blow").style.cursor = "pointer";
  $("blow").addEventListener("click", blowOut, {
    once: true
  });
}

function blowOut() {
  if (blown) return;
  blown = true;
  outFx();
  stopIntro();
  startMusic();
  $("flame").classList.add("out"); // flame disappears immediately
  $("hint").textContent = "";
  releaseMic();
  $("candleButterfly").classList.add("away"); // the butterfly flies off as the flame dies
  spawn(SMALL ? 10 : 18, true); // glowing dust it leaves behind
  setTimeout(showFinal, CONFIG.finalDelayMs);
}

/* ---------- final screen ---------- */
function showFinal() {
  setTitle(CONFIG.titleLine);
  $("finalName").textContent = CONFIG.name;
  $("subtitle").textContent = CONFIG.subtitle;
  $("finalFooter").textContent = CONFIG.footerText;
  $("sign").textContent = CONFIG.signature;
  // the note + signature stay hidden until the envelope is opened (see initEnvelope)
  CONFIG.photos.forEach((ph, i) => {
    const fig = document.createElement("figure");
    fig.className = "polaroid " + (CONFIG.frame === "champagne" ? "f-champagne" : CONFIG.frame === "lavender" ? "f-lavender" : (i % 2 ? "f-lavender" : "f-champagne"));
    fig.style.setProperty("--r", "0deg"); // organized grid now, no scattered tilt
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
    fig.addEventListener("click", () => openLightbox(i));
    $("photos").appendChild(fig);
  });
  show("final");
  startLoveHeart();
  buildConstellation();
  requestAnimationFrame(fitBirthdayHeading);
  if (document.fonts) document.fonts.ready.then(fitBirthdayHeading);
  scrollTo(0, 0);
  finalFx();
}

/* ---------- memory gallery: full-screen lightbox ---------- */
let lbIndex = 0;

function updateLightbox() {
  const ph = CONFIG.photos[lbIndex];
  if (!ph) return;
  $("lbImg").src = ph.src;
  $("lbImg").alt = ph.caption || "Photo";
  $("lbCaption").textContent = ph.caption || "";
}

function openLightbox(i) {
  lbIndex = i;
  updateLightbox();
  $("lightbox").hidden = false;
}

function closeLightbox() {
  $("lightbox").hidden = true;
}

function stepLightbox(d) {
  lbIndex = (lbIndex + d + CONFIG.photos.length) % CONFIG.photos.length;
  updateLightbox();
}
$("lbClose").addEventListener("click", closeLightbox);
$("lbPrev").addEventListener("click", () => stepLightbox(-1));
$("lbNext").addEventListener("click", () => stepLightbox(1));
$("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});

/* ---------- personal constellation: stars arranged in a heart shape ---------- */
function heartPoint(t) {
  // Match the particle heart curve, scaled to one tenth.
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5;
  return {
    x,
    y
  };
}

function buildConstellation() {
  const box = $("constellation");
  box.innerHTML = "";
  const msgs = (CONFIG.constellation && CONFIG.constellation.length) ? CONFIG.constellation : ["You're wonderful."];
  $("constellationLabel").hidden = false;
  const n = msgs.length;
  const pts = msgs.map((msg, i) => {
    const t = (i / n) * Math.PI * 2;
    const h = heartPoint(t);
    const scale = loveHeartScale || Math.min(box.clientWidth / 320, box.clientHeight / 340) * .82;
    const padding = 12;
    const radius = Math.hypot(h.x, h.y) || 1;
    const x = loveHeartWidth / 2 + h.x * 10 * scale + h.x / radius * padding;
    const y = loveHeartHeight / 2 - h.y * 10 * scale - h.y / radius * padding;
    return {
      x: x / (loveHeartWidth || box.clientWidth) * 100,
      y: y / (loveHeartHeight || box.clientHeight) * 100,
      msg,
    };
  });
  pts.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "star-point";
    btn.type = "button";
    btn.style.left = p.x + "%";
    btn.style.top = p.y + "%";
    btn.style.setProperty("--dl", rand(0, 2.4).toFixed(2) + "s");
    btn.setAttribute("aria-label", "Reveal a message");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      showStarMessage(p.msg);
    });
    box.appendChild(btn);
  });
}

/* ---------- red particle heart surrounded by the personal stars ---------- */
const loveCanvas = $("love-heart");
const loveContext = loveCanvas.getContext("2d");
const loveParticleImage = document.createElement("canvas");
loveParticleImage.width = loveParticleImage.height = 12;
const loveParticleContext = loveParticleImage.getContext("2d");
loveParticleContext.fillStyle = "#f20d3a";
loveParticleContext.beginPath();
loveParticleContext.moveTo(6, 11);
loveParticleContext.bezierCurveTo(4, 9, 0, 6, 0, 3.5);
loveParticleContext.bezierCurveTo(0, 0, 4.5, 0, 6, 3);
loveParticleContext.bezierCurveTo(7.5, 0, 12, 0, 12, 3.5);
loveParticleContext.bezierCurveTo(12, 6, 8, 9, 6, 11);
loveParticleContext.fill();

let loveParticles = [],
  loveHeartFrame = 0,
  loveHeartTime = 0,
  loveHeartEmission = 0;
let loveHeartWidth = 0,
  loveHeartHeight = 0,
  loveHeartScale = 0;
const LOVE_PARTICLE_RATE = 240,
  LOVE_PARTICLE_LIFE = 2.2;

function resizeLoveHeart() {
  const rect = loveCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  loveCanvas.width = Math.round(rect.width * dpr);
  loveCanvas.height = Math.round(rect.height * dpr);
  loveContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  loveHeartWidth = rect.width;
  loveHeartHeight = rect.height;
  loveHeartScale = Math.min(rect.width / 320, rect.height / 340) * .82;
  loveParticles = [];
  loveHeartEmission = 0;
}

function createLoveParticle(age = 0) {
  const t = Math.random() * Math.PI * 2;
  const x = 160 * Math.pow(Math.sin(t), 3);
  const y = 130 * Math.cos(t) - 50 * Math.cos(2 * t) - 20 * Math.cos(3 * t) - 10 * Math.cos(4 * t) + 25;
  const length = Math.hypot(x, y) || 1;
  const speed = 54 + Math.random() * 22;
  const vx = x / length * speed,
    vy = -y / length * speed;
  const ax = -vx * 1.05,
    ay = -vy * 1.05;
  return {
    x: loveHeartWidth / 2 + x * loveHeartScale + vx * age + ax * age * age / 2,
    y: loveHeartHeight / 2 - y * loveHeartScale + vy * age + ay * age * age / 2,
    vx: vx + ax * age,
    vy: vy + ay * age,
    ax,
    ay,
    age,
    size: 3 + Math.random() * 3
  };
}

function drawLoveHeart(now) {
  loveHeartFrame = 0;
  const dt = Math.min(.04, (now - (loveHeartTime || now)) / 1000);
  loveHeartTime = now;
  loveContext.clearRect(0, 0, loveHeartWidth, loveHeartHeight);
  loveHeartEmission += LOVE_PARTICLE_RATE * dt;
  while (loveHeartEmission >= 1) {
    loveParticles.push(createLoveParticle());
    loveHeartEmission--;
  }
  for (let i = loveParticles.length - 1; i >= 0; i--) {
    const p = loveParticles[i];
    p.age += dt;
    if (p.age >= LOVE_PARTICLE_LIFE) {
      loveParticles.splice(i, 1);
      continue;
    }
    p.vx += p.ax * dt;
    p.vy += p.ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    loveContext.globalAlpha = Math.min(1, (LOVE_PARTICLE_LIFE - p.age) / .55);
    loveContext.drawImage(loveParticleImage, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  loveContext.globalAlpha = 1;
  loveHeartFrame = requestAnimationFrame(drawLoveHeart);
}

function startLoveHeart() {
  resizeLoveHeart();
  loveHeartTime = 0;
  for (let i = 0; i < LOVE_PARTICLE_RATE * LOVE_PARTICLE_LIFE; i++) {
    loveParticles.push(createLoveParticle(Math.random() * LOVE_PARTICLE_LIFE));
  }
  if (!loveHeartFrame) loveHeartFrame = requestAnimationFrame(drawLoveHeart);
}

function stopLoveHeart() {
  if (loveHeartFrame) cancelAnimationFrame(loveHeartFrame);
  loveHeartFrame = 0;
  loveHeartTime = 0;
  loveParticles = [];
  loveContext.clearRect(0, 0, loveHeartWidth, loveHeartHeight);
}
addEventListener("resize", () => {
  if (!loveHeartFrame) return;
  resizeLoveHeart();
  if ($("final").classList.contains("active")) buildConstellation();
});

let starPopupTimer;

function showStarMessage(msg) {
  const pop = $("starPopup");
  pop.textContent = msg;
  pop.hidden = false;
  requestAnimationFrame(() => pop.classList.add("show"));
  clearTimeout(starPopupTimer);
  starPopupTimer = setTimeout(hideStarPopup, 3200);
}

function hideStarPopup() {
  const pop = $("starPopup");
  pop.classList.remove("show");
  setTimeout(() => {
    if (!pop.classList.contains("show")) pop.hidden = true;
  }, 320);
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".star-point")) hideStarPopup();
});

/* ---------- secret letter: envelope gate ---------- */
function initials(name) {
  return (name || "").trim().split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "💌";
}
$("envSeal").textContent = initials(CONFIG.name);
$("envelope").addEventListener("click", () => {
  if ($("envelope").classList.contains("open")) return;
  $("envelope").classList.add("open");
  $("envHint").textContent = "";
  $("note").hidden = false;
  $("sign").hidden = false;
  beep(880, 0.1);
  typeNote(() => {
    $("finale").hidden = false;
    launchFireworks();
  });
});

/* ---------- final surprise: fireworks + keepsake card + replay ---------- */
function fireworksBurst(cx, cy, n) {
  for (let i = 0; i < n; i++) {
    const ang = rand(0, 6.283),
      spd = rand(2, 7);
    bits.push({
      fw: true,
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: rand(40, 70),
      maxLife: 70,
      c: COLORS[i % COLORS.length]
    });
  }
  if (!going) {
    going = true;
    stepFx();
  }
}

function launchFireworks() {
  const n = SMALL ? 18 : 32;
  for (let i = 0; i < 5; i++) setTimeout(() => fireworksBurst(rand(innerWidth * 0.2, innerWidth * 0.8), rand(innerHeight * 0.15, innerHeight * 0.45), n), i * 420);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = (text || "").split(" ");
  let line = "",
    lines = [];
  words.forEach((w) => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  });
  if (line) lines.push(line);
  const startY = y - (lines.length - 1) * lineHeight / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

function generateKeepsake() {
  const cv2 = $("keepsakeCanvas"),
    ctx = cv2.getContext("2d");
  const W = cv2.width,
    H = cv2.height;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#fff4ea");
  grad.addColorStop(1, "#ffe3d2");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e0b04f";
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff5c93";
  ctx.font = "90px Georgia, serif";
  ctx.fillText(CONFIG.titleLine || "Happy Birthday", W / 2, 150);
  ctx.fillStyle = "#4a2336";
  ctx.font = "italic 60px Georgia, serif";
  ctx.fillText(CONFIG.name || "", W / 2, 240);
  ctx.fillStyle = "#7a5a6a";
  ctx.font = "32px Georgia, serif";
  ctx.fillText(new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  }), W / 2, 290);

  const finish = () => {
    ctx.fillStyle = "#4a2336";
    ctx.font = "italic 34px Georgia, serif";
    wrapText(ctx, CONFIG.subtitle || (CONFIG.note && CONFIG.note[0]) || "", W / 2, 1180, W - 160, 44);
    ctx.fillStyle = "#b4862f";
    ctx.font = "italic 36px Georgia, serif";
    ctx.fillText(CONFIG.signature || "", W / 2, H - 60);
    cv2.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (CONFIG.name || "birthday") + "-keepsake.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  };

  const ph = CONFIG.photos && CONFIG.photos[0];
  if (ph) {
    const img = new Image();
    img.onload = () => {
      const bw = W - 160,
        bh = 620,
        bx = 80,
        by = 360;
      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      const scale = Math.max(bw / img.width, bh / img.height);
      const iw = img.width * scale,
        ih = img.height * scale;
      ctx.drawImage(img, bx + (bw - iw) / 2, by + (bh - ih) / 2, iw, ih);
      ctx.restore();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 6;
      ctx.strokeRect(bx, by, bw, bh);
      finish();
    };
    img.onerror = finish;
    img.src = ph.src;
  } else finish();
}
$("keepsakeBtn").addEventListener("click", generateKeepsake);

function resetExperience() {
  stopMusic();
  if (introEl) stopIntro();
  stopLoveHeart();
  experienceStarted = false;
  blown = false;
  $("prompt").textContent = CONFIG.countdownText;
  $("flame").classList.remove("out");
  $("glow").classList.remove("out");
  document.querySelector(".shadow").classList.remove("out");
  $("wick").classList.remove("ember");
  $("smoke").classList.remove("go");
  $("blow").classList.remove("shake");
  $("meter").classList.remove("on");
  $("meterFill").style.width = "0%";
  $("hint").textContent = "";
  $("count").textContent = "";
  $("candleButterfly").classList.remove("landed", "away");
  $("photos").innerHTML = "";
  $("constellation").innerHTML = "";
  $("constellationLabel").hidden = true;
  $("note").innerHTML = "";
  $("note").hidden = true;
  $("sign").hidden = true;
  $("envelope").classList.remove("open");
  $("envHint").textContent = "Tap to open the letter";
  $("finale").hidden = true;
  closeLightbox();
  document.body.classList.remove("final");
  $("mute").classList.remove("show");
  bits = [];
  going = false;
  g2.clearRect(0, 0, cv.width, cv.height);
  show("start");
}
$("replayBtn").addEventListener("click", resetExperience);

/* ---------- audio (all synthesized, no files needed) ---------- */
let ac, bus, introBus, musicOn = true,
  melodyTimer, introTimer, audioEl, introEl;

function initAudio() {
  if (!ac) {
    ac = new(window.AudioContext || window.webkitAudioContext)();
    bus = ac.createGain();
    bus.connect(ac.destination);
    introBus = ac.createGain();
    introBus.gain.value = CONFIG.introVolume;
    introBus.connect(ac.destination);
  }
  ac.resume();
}

function tone(f, t, d, type = "sine", v = 0.18, dest) {
  const o = ac.createOscillator(),
    g = ac.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(dest || ac.destination);
  o.start(t);
  o.stop(t + d + 0.05);
}
const beep = (f, d) => tone(f, ac.currentTime, d, "sine", 0.15);

function puff() { // soft whoosh when the flame goes out
  const len = ac.sampleRate * 0.4,
    buf = ac.createBuffer(1, len, ac.sampleRate),
    c = buf.getChannelData(0);
  for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ac.createBufferSource(),
    f = ac.createBiquadFilter(),
    g = ac.createGain();
  s.buffer = buf;
  f.type = "lowpass";
  f.frequency.value = 900;
  g.gain.value = 0.35;
  s.connect(f).connect(g).connect(ac.destination);
  s.start();
}
// "Happy Birthday" as a music-box melody: [frequency Hz, beats]
const MELODY = [
  [392, .75],
  [392, .25],
  [440, 1],
  [392, 1],
  [523, 1],
  [494, 2],
  [392, .75],
  [392, .25],
  [440, 1],
  [392, 1],
  [587, 1],
  [523, 2],
  [392, .75],
  [392, .25],
  [784, 1],
  [659, 1],
  [523, 1],
  [494, 1],
  [440, 1],
  [698, .75],
  [698, .25],
  [659, 1],
  [523, 1],
  [587, 1],
  [523, 2]
];

function playMelody(dest, keepTimer) {
  const beat = 0.5;
  let t = ac.currentTime + 0.2;
  MELODY.forEach(([f, b]) => {
    tone(f, t, b * beat * 1.6, "triangle", 0.2, dest);
    tone(f * 2, t, b * beat * 1.2, "sine", 0.06, dest);
    t += b * beat;
  });
  keepTimer(setTimeout(() => playMelody(dest, keepTimer), (t - ac.currentTime + 1.2) * 1000));
}

function fadeAudio(el, to, ms, done) {
  const from = el.volume,
    t0 = performance.now();
  const id = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) {
      clearInterval(id);
      if (done) done();
    }
  }, 40);
}
// soft background music while the candle is still lit
function startIntro() {
  if (CONFIG.introVolume <= 0) return;
  introBus.gain.cancelScheduledValues(ac.currentTime);
  introBus.gain.setTargetAtTime(CONFIG.introVolume, ac.currentTime, 0.05);
  const file = CONFIG.introMusicFile || CONFIG.musicFile;
  const synth = () => playMelody(introBus, (id) => (introTimer = id));
  if (file) {
    introEl = new Audio(file);
    introEl.loop = true;
    introEl.volume = CONFIG.introVolume;
    introEl.addEventListener("error", () => {
      introEl = null;
      synth();
    }, {
      once: true
    });
    introEl.play().catch(() => {});
  } else synth();
}

function stopIntro() {
  clearTimeout(introTimer);
  if (introEl) {
    const el = introEl;
    introEl = null;
    fadeAudio(el, 0, 700, () => el.pause());
  }
  if (introBus) introBus.gain.setTargetAtTime(0, ac.currentTime, 0.25);
}
// full music: starts the moment the flame goes out, fades in
function startMusic() {
  if (CONFIG.musicFile) {
    if (!audioEl) {
      audioEl = new Audio(CONFIG.musicFile);
      audioEl.loop = true;
      audioEl.addEventListener("error", () => {
        CONFIG.musicFile = "";
        audioEl = null;
        if (musicOn) startMusic();
      }, {
        once: true
      });
    }
    audioEl.volume = 0;
    audioEl.play().catch(() => {});
    fadeAudio(audioEl, 1, 1500);
  } else {
    clearTimeout(melodyTimer);
    bus.gain.cancelScheduledValues(ac.currentTime);
    bus.gain.setValueAtTime(0, ac.currentTime);
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

function fitBirthdayHeading() {
  const heading = document.querySelector(".birthday-heading");
  const title = $("finalTitle"),
    name = $("finalName");
  title.style.fontSize = "";
  name.style.fontSize = "";
  const gap = parseFloat(getComputedStyle(heading).columnGap) || 0;
  const naturalWidth = title.scrollWidth + name.scrollWidth + gap;
  if (!heading.clientWidth || naturalWidth <= heading.clientWidth) return;

  const scale = heading.clientWidth / naturalWidth;
  title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * scale}px`;
  name.style.fontSize = `${parseFloat(getComputedStyle(name).fontSize) * scale}px`;
}
addEventListener("resize", fitBirthdayHeading);

const FX = Object.assign({
  bokeh: true,
  fairyLights: true,
  petals: true,
  hearts: true,
  confetti: true
}, CONFIG.effects);
const cv = $("fx"),
  g2 = cv.getContext("2d");
let bits = [],
  going = false;

function sizeFx() {
  cv.width = innerWidth;
  cv.height = innerHeight;
}
sizeFx();
addEventListener("resize", sizeFx);

function spawn(n, petal) {
  for (let i = 0; i < n; i++) bits.push(petal ?
    {
      petal: true,
      x: rand(0, cv.width),
      y: rand(-60, -10),
      s: rand(7, 13),
      vx: rand(-0.6, 0.6),
      vy: rand(0.8, 2),
      r: rand(0, 6.28),
      vr: rand(-0.04, 0.04),
      ph: rand(0, 6.28),
      c: PETALS[i % PETALS.length]
    } :
    {
      x: rand(0, cv.width),
      y: rand(-cv.height * 0.4, -10),
      w: rand(6, 11),
      h: rand(10, 16),
      vx: rand(-1.5, 1.5),
      vy: rand(2, 5),
      r: rand(0, 6.28),
      vr: rand(-0.2, 0.2),
      c: COLORS[i % COLORS.length]
    });
  if (!going) {
    going = true;
    stepFx();
  }
}

function stepFx() {
  g2.clearRect(0, 0, cv.width, cv.height);
  bits = bits.filter((b) => b.fw ? b.life > 0 : b.y < cv.height + 30);
  bits.forEach((b) => {
    if (b.fw) { // firework spark: radiates out, falls under gravity, fades
      b.life--;
      b.vy += 0.06;
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      g2.save();
      g2.globalAlpha = Math.max(0, b.life / b.maxLife);
      g2.fillStyle = b.c;
      g2.beginPath();
      g2.arc(b.x, b.y, 2.6, 0, 6.283);
      g2.fill();
      g2.restore();
      return;
    }
    b.ph = (b.ph || 0) + 0.03;
    b.x += b.vx + (b.petal ? Math.sin(b.ph) * 0.9 : Math.sin(b.y / 40));
    b.y += b.vy;
    b.r += b.vr;
    g2.save();
    g2.translate(b.x, b.y);
    g2.rotate(b.r);
    g2.fillStyle = b.c;
    if (b.petal) {
      g2.beginPath();
      g2.ellipse(0, 0, b.s, b.s * 0.55 * Math.abs(Math.cos(b.ph)) + 2, 0, 0, 6.28);
      g2.fill();
    } else g2.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    g2.restore();
  });
  if (bits.length) requestAnimationFrame(stepFx);
  else going = false;
}

/* ---------- themes ---------- */
const THEMES = {
  romantic: {
    sky: "linear-gradient(180deg,#120a24 0%,#2b1445 55%,#5a2350 100%)",
    accent: "#ff5c93",
    gold: "#ffd27a",
    paper: "#fff4ea",
    ink: "#4a2336",
    glow: "255,170,110"
  },
  sunset: {
    sky: "linear-gradient(180deg,#2a1a4a 0%,#8a3a6a 50%,#ff8a5c 100%)",
    accent: "#ff6f91",
    gold: "#ffe08a",
    paper: "#fff1e6",
    ink: "#5a2a3a",
    glow: "255,190,120"
  },
  midnight: {
    sky: "linear-gradient(180deg,#050b1f 0%,#0f2347 60%,#1f3d6e 100%)",
    accent: "#7fb7ff",
    gold: "#cfe6ff",
    paper: "#eef4ff",
    ink: "#1d2c4a",
    glow: "150,190,255"
  },
  garden: {
    sky: "linear-gradient(180deg,#1a2a2a 0%,#2f5a4a 55%,#6a8a5a 100%)",
    accent: "#ff8fb1",
    gold: "#fff0a8",
    paper: "#fffaf0",
    ink: "#2f4a3a",
    glow: "255,220,150"
  }
};

function applyTheme() {
  const t = Object.assign({}, THEMES[CONFIG.theme] || THEMES.romantic, CONFIG.colors);
  Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty("--" + k, v));
}

/* ---------- background: boken lights, stars, moon, optional real photo ---------- */
function buildBackground() {
  const box = document.createElement("div");
  box.id = "bokeh";
  document.body.prepend(box);
  if (FX.bokeh) {
    const cols = ["255,200,120", "255,150,170", "255,240,200", "200,160,255"];
    for (let i = 0; i < (SMALL ? 14 : 26); i++) {
      const d = document.createElement("i"),
        sz = rand(24, 95);
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
    const bg = document.createElement("div");
    bg.id = "bgphoto";
    bg.style.cssText = `background-image:url("${CONFIG.backgroundImage}");filter:blur(${CONFIG.backgroundBlur}px) brightness(${1 - CONFIG.backgroundDim})`;
    document.body.prepend(bg);
  }
}

/* ---------- fairy lights ---------- */
function lights() {
  if (!FX.fairyLights) return;
  const N = 7,
    y = (x) => 8 + 36 * Math.abs(Math.sin(Math.PI * x / 100 * N));
  let pts = "";
  for (let i = 0; i <= 200; i++) pts += `${i / 2},${y(i / 2).toFixed(1)} `;
  $("lights").innerHTML = `<svg viewBox="0 0 100 90" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  const cols = ["#ffd27a", "#ff8fb1", "#fff2c6", "#ffb347"];
  for (let k = 0; k < N * 3; k++) {
    const x = (k + 0.5) / (N * 3) * 100,
      el = document.createElement("i");
    el.style.cssText = `left:${x}%;top:${y(x).toFixed(1)}px;--c:${cols[k % 4]};--dl:${rand(0, 3).toFixed(1)}s`;
    $("lights").appendChild(el);
  }
}

/* ---------- typewriter note ---------- */
function typeNote(onDone) { // handwritten "wet ink": each letter appears in pink and dries to ink colour
  const box = $("note");
  box.innerHTML = "";
  const calm = !CONFIG.typewriter || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const paras = CONFIG.note.map((text, pi) => {
    const p = document.createElement("p");
    box.appendChild(p);
    const items = [];
    text.split(" ").forEach((word, wi, arr) => {
      const w = document.createElement("span");
      w.className = "w";
      p.appendChild(w); // words never break mid-typing
      [...word].forEach((ch) => {
        const el = document.createElement("span");
        el.className = pi === 0 || calm ? "c on" : "c"; // greeting shows at once
        el.textContent = ch;
        w.appendChild(el);
        items.push({
          el,
          ch
        });
      });
      if (wi < arr.length - 1) {
        p.appendChild(document.createTextNode(" "));
        items.push({
          el: null,
          ch: " "
        });
      }
    });
    return {
      items
    };
  });
  if (calm) {
    if (onDone) onDone();
    return;
  }
  const pace = CONFIG.typingPace || 1;
  // even rhythm, a soft breath at commas, a longer pause at the end of a sentence
  const delay = (ch, next) => {
    let d = rand(38, 62);
    if (",;:".includes(ch)) d += rand(130, 200);
    else if (".!?…".includes(ch) && (!next || next === " ")) d += rand(320, 480);
    return d * pace;
  };
  let pi = 1,
    ii = 0;
  const step = () => {
    if (pi >= paras.length) return;
    const items = paras[pi].items,
      it = items[ii++];
    if (it.el) it.el.classList.add("on");
    if (ii >= items.length) {
      pi++;
      ii = 0;
      if (pi < paras.length) {
        setTimeout(step, rand(700, 1000) * pace);
        return;
      }
      if (onDone) setTimeout(onDone, 500);
      return;
    }
    setTimeout(step, it.el ? delay(it.ch, items[ii].ch) : rand(28, 48) * pace);
  };
  setTimeout(step, 1200);
}

/* ---------- final scene ---------- */
function finalFx() {
  document.body.classList.add("final");
  $("mute").classList.add("show");
  [523, 659, 784, 1046].forEach((f, i) => tone(f, ac.currentTime + i * 0.09, 0.5, "triangle", 0.15));
  lights();
  if (FX.hearts)
    for (let i = 0; i < (SMALL ? 8 : 12); i++) {
      const b = document.createElement("div");
      b.className = "balloon";
      b.textContent = ["💖", "💗", "✨", "🌹"][i % 4];
      b.style.cssText = `--x:${rand(2, 92)}%;--fs:${rand(18, 34)}px;--d:${rand(9, 16)}s;--dl:${rand(0, 8)}s`;
      $("balloons").appendChild(b);
    }
  if (FX.confetti) {
    spawn(SMALL ? 70 : 120);
    setTimeout(() => spawn(SMALL ? 50 : 80), 3000);
  }
  if (FX.petals) setInterval(() => {
    if (bits.length < (SMALL ? 40 : 70)) spawn(2, true);
  }, 500);
}

/* ---------- init ---------- */
applyTheme();
buildBackground();
$("startBtn").textContent = CONFIG.startButton;
$("prompt").textContent = CONFIG.countdownText;

/* ---------- phone helpers ---------- */
let wake;
async function keepAwake() {
  try {
    wake = await navigator.wakeLock.request("screen");
  } catch (e) {}
} // keep the screen on
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (ac) ac.suspend();
    if (audioEl) audioEl.pause();
    if (introEl) introEl.pause();
  } else {
    if (introEl) introEl.play().catch(() => {});
    if (ac) ac.resume();
    if (audioEl && musicOn && $("final").classList.contains("active")) audioEl.play().catch(() => {});
    if (wake) keepAwake();
  }
});

/* ---------- scene choreography ---------- */
function lightThenCount() { // the candle rises and lights first, then the countdown begins
  $("count").textContent = "";
  $("hint").textContent = "Lighting the candle…";
  setTimeout(() => $("candleButterfly").classList.add("landed"), 900); // a butterfly lands beside the flame
  setTimeout(() => {
    $("hint").textContent = "";
    countdown();
  }, 1900);
}

function veilFlash(big) { // a warm wave of light that carries you into the next scene
  const v = $("veil");
  v.style.setProperty("--vd", big ? "1.9s" : "1.1s");
  v.classList.remove("go", "big");
  void v.offsetWidth;
  v.classList.add("go");
  if (big) v.classList.add("big");
}
document.body.dataset.scene = "start";
requestAnimationFrame(() => requestAnimationFrame(() => $("start").classList.add("shown")));
/* ---------- start-screen butterflies ---------- */
(function initStartButterflies() {
  const root = document.getElementById("start-butterflies");
  if (!root) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  // left/top position it around the box (in %), size, flight/flap speed,
  // flight waypoints (x1..x3 / y1..y3, px), and a color variant.
  const START_BUTTERFLIES = [{
    left: "10%",
    top: "14%",
    size: 34,
    fd: 9,
    fl: 0.9,
    x1: 35,
    y1: -28,
    x2: -10,
    y2: -52,
    x3: -40,
    y3: -14,
    variant: 0
  }, {
    left: "82%",
    top: "10%",
    size: 26,
    fd: 6,
    fl: 0.6,
    x1: -30,
    y1: -22,
    x2: 10,
    y2: -48,
    x3: 32,
    y3: -10,
    variant: 1
  }, {
    left: "88%",
    top: "42%",
    size: 22,
    fd: 5,
    fl: 0.45,
    x1: -24,
    y1: 20,
    x2: 8,
    y2: 44,
    x3: 28,
    y3: 8,
    variant: 2
  }, {
    left: "8%",
    top: "50%",
    size: 30,
    fd: 11,
    fl: 1.1,
    x1: 28,
    y1: 24,
    x2: -8,
    y2: 46,
    x3: -32,
    y3: 10,
    variant: 3
  }, {
    left: "20%",
    top: "86%",
    size: 20,
    fd: 7,
    fl: 0.5,
    x1: 20,
    y1: -18,
    x2: -6,
    y2: -34,
    x3: -22,
    y3: -6,
    variant: 4
  }, {
    left: "76%",
    top: "88%",
    size: 24,
    fd: 8,
    fl: 0.7,
    x1: -22,
    y1: -20,
    x2: 6,
    y2: -38,
    x3: 24,
    y3: -8,
    variant: 5
  }, {
    left: "50%",
    top: "4%",
    size: 18,
    fd: 4,
    fl: 0.35,
    x1: 16,
    y1: 14,
    x2: -5,
    y2: 28,
    x3: -18,
    y3: 6,
    variant: 6
  }, {
    left: "94%",
    top: "70%",
    size: 18,
    fd: 6.5,
    fl: 0.55,
    x1: -18,
    y1: 16,
    x2: 5,
    y2: 30,
    x3: 20,
    y3: 7,
    variant: 2
  }, {
    left: "4%",
    top: "28%",
    size: 22,
    fd: 9.5,
    fl: 0.8,
    x1: 22,
    y1: -16,
    x2: -6,
    y2: -30,
    x3: -24,
    y3: -5,
    variant: 4
  }, {
    left: "60%",
    top: "94%",
    size: 20,
    fd: 5.5,
    fl: 0.6,
    x1: -16,
    y1: -14,
    x2: 6,
    y2: -28,
    x3: 18,
    y3: -5,
    variant: 0
  }, ];

  function makeWing(side, variant) {
    const wing = document.createElement("div");
    wing.className = `wing ${side} variant-${variant}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 50 100");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttributeNS(XLINK_NS, "xlink:href", "#shape-butterfly-1");
    svg.appendChild(use);
    wing.appendChild(svg);
    return wing;
  }

  function makeButterfly(cfg) {
    const el = document.createElement("div");
    el.className = "butterfly";
    el.style.left = cfg.left;
    el.style.top = cfg.top;
    el.style.setProperty("--sz", `${cfg.size}px`);
    const waypoint = (value) => `${value * 2.5 + rand(-30, 30)}px`;
    el.style.setProperty("--fd", `${rand(5, 9).toFixed(2)}s`);
    el.style.setProperty("--fl", `${rand(0.18, 0.3).toFixed(2)}s`);
    el.style.setProperty("--dl", `-${rand(0, 9).toFixed(2)}s`);
    el.style.setProperty("--x1", waypoint(cfg.x1));
    el.style.setProperty("--y1", waypoint(cfg.y1));
    el.style.setProperty("--x2", waypoint(cfg.x2));
    el.style.setProperty("--y2", waypoint(cfg.y2));
    el.style.setProperty("--x3", waypoint(cfg.x3));
    el.style.setProperty("--y3", waypoint(cfg.y3));
    el.appendChild(makeWing("left", cfg.variant));
    el.appendChild(makeWing("right", cfg.variant));
    return el;
  }

  START_BUTTERFLIES.forEach((cfg) => root.appendChild(makeButterfly(cfg)));
})();

/* ---------- full-page background butterflies (from butterfly_1.html) ---------- */
(function initBackgroundButterflies() {
  const root = document.getElementById("full-bg-butterflies");
  if (!root) return;

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  // Spread across the whole viewport (left/top in %), roaming the full page
  // behind every screen, not confined to the start box.
  const BG_BUTTERFLIES = [{
    left: "6%",
    top: "12%",
    size: 54,
    fd: 10,
    fl: 1,
    x1: 45,
    y1: -35,
    x2: -15,
    y2: -65,
    x3: -50,
    y3: -18,
    variant: 0
  }, {
    left: "88%",
    top: "8%",
    size: 30,
    fd: 7,
    fl: 0.75,
    x1: -38,
    y1: -28,
    x2: 12,
    y2: -58,
    x3: 40,
    y3: -12,
    variant: 1
  }, {
    left: "20%",
    top: "28%",
    size: 24,
    fd: 6,
    fl: 0.6,
    x1: 30,
    y1: 24,
    x2: -10,
    y2: 46,
    x3: -34,
    y3: 10,
    variant: 2
  }, {
    left: "72%",
    top: "22%",
    size: 46,
    fd: 9,
    fl: 0.9,
    x1: -30,
    y1: 26,
    x2: 10,
    y2: 50,
    x3: 36,
    y3: 11,
    variant: 3
  }, {
    left: "4%",
    top: "55%",
    size: 26,
    fd: 8,
    fl: 0.7,
    x1: 26,
    y1: -20,
    x2: -8,
    y2: -38,
    x3: -28,
    y3: -7,
    variant: 4
  }, {
    left: "94%",
    top: "48%",
    size: 22,
    fd: 5.5,
    fl: 0.5,
    x1: -24,
    y1: -18,
    x2: 8,
    y2: -34,
    x3: 26,
    y3: -6,
    variant: 5
  }, {
    left: "40%",
    top: "6%",
    size: 20,
    fd: 4.5,
    fl: 0.4,
    x1: 18,
    y1: 16,
    x2: -6,
    y2: 30,
    x3: -20,
    y3: 7,
    variant: 6
  }, {
    left: "60%",
    top: "70%",
    size: 28,
    fd: 11,
    fl: 1.1,
    x1: -26,
    y1: -22,
    x2: 8,
    y2: -42,
    x3: 28,
    y3: -9,
    variant: 2
  }, {
    left: "14%",
    top: "80%",
    size: 32,
    fd: 7.5,
    fl: 0.8,
    x1: 28,
    y1: -22,
    x2: -9,
    y2: -42,
    x3: -30,
    y3: -9,
    variant: 4
  }, {
    left: "80%",
    top: "78%",
    size: 24,
    fd: 6.5,
    fl: 0.6,
    x1: -22,
    y1: 18,
    x2: 7,
    y2: 34,
    x3: 24,
    y3: 7,
    variant: 0
  }, {
    left: "48%",
    top: "88%",
    size: 20,
    fd: 5,
    fl: 0.45,
    x1: 20,
    y1: -16,
    x2: -6,
    y2: -30,
    x3: -22,
    y3: -6,
    variant: 1
  }, {
    left: "30%",
    top: "50%",
    size: 18,
    fd: 9.5,
    fl: 0.85,
    x1: -18,
    y1: -16,
    x2: 6,
    y2: -30,
    x3: 20,
    y3: -6,
    variant: 6
  }, {
    left: "55%",
    top: "38%",
    size: 22,
    fd: 6,
    fl: 0.55,
    x1: 20,
    y1: 18,
    x2: -7,
    y2: 34,
    x3: -24,
    y3: 7,
    variant: 5
  }, {
    left: "10%",
    top: "40%",
    size: 16,
    fd: 4,
    fl: 0.35,
    x1: 16,
    y1: -14,
    x2: -5,
    y2: -26,
    x3: -18,
    y3: -5,
    variant: 3
  }, {
    left: "34%",
    top: "14%",
    size: 38,
    fd: 8,
    fl: 0.7,
    x1: 32,
    y1: -20,
    x2: -12,
    y2: -44,
    x3: -34,
    y3: -8,
    variant: 5
  }, {
    left: "62%",
    top: "16%",
    size: 28,
    fd: 6,
    fl: 0.5,
    x1: -26,
    y1: 18,
    x2: 10,
    y2: 34,
    x3: 28,
    y3: 6,
    variant: 6
  }, {
    left: "30%",
    top: "68%",
    size: 34,
    fd: 9,
    fl: 0.8,
    x1: 28,
    y1: -18,
    x2: -10,
    y2: -38,
    x3: -30,
    y3: -7,
    variant: 1
  }, {
    left: "70%",
    top: "52%",
    size: 42,
    fd: 7,
    fl: 0.65,
    x1: -30,
    y1: -16,
    x2: 10,
    y2: -36,
    x3: 34,
    y3: -6,
    variant: 4
  }, {
    left: "48%",
    top: "76%",
    size: 26,
    fd: 5.5,
    fl: 0.5,
    x1: 22,
    y1: 18,
    x2: -8,
    y2: 34,
    x3: -24,
    y3: 7,
    variant: 2
  }, {
    left: "90%",
    top: "32%",
    size: 36,
    fd: 8.5,
    fl: 0.75,
    x1: -28,
    y1: 22,
    x2: 10,
    y2: 42,
    x3: 30,
    y3: 9,
    variant: 0
  }, {
    left: "12%",
    top: "72%",
    size: 30,
    fd: 6.5,
    fl: 0.6,
    x1: 24,
    y1: 18,
    x2: -8,
    y2: 34,
    x3: -26,
    y3: 7,
    variant: 3
  }, ];

  function makeWing(side, variant) {
    const wing = document.createElement("div");
    wing.className = `wing ${side} variant-${variant}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 50 100");
    const use = document.createElementNS(SVG_NS, "use");
    use.setAttributeNS(XLINK_NS, "xlink:href", "#shape-butterfly-1");
    svg.appendChild(use);
    wing.appendChild(svg);
    return wing;
  }

  function makeButterfly(cfg) {
    const el = document.createElement("div");
    el.className = "butterfly";
    el.style.left = cfg.left;
    el.style.top = cfg.top;
    el.style.setProperty("--sz", `${cfg.size}px`);
    const waypoint = (value) => `${value * 3.5 + rand(-45, 45)}px`;
    el.style.setProperty("--fd", `${rand(5, 9).toFixed(2)}s`);
    el.style.setProperty("--fl", `${rand(0.18, 0.3).toFixed(2)}s`);
    el.style.setProperty("--dl", `-${rand(0, 9).toFixed(2)}s`);
    el.style.setProperty("--x1", waypoint(cfg.x1));
    el.style.setProperty("--y1", waypoint(cfg.y1));
    el.style.setProperty("--x2", waypoint(cfg.x2));
    el.style.setProperty("--y2", waypoint(cfg.y2));
    el.style.setProperty("--x3", waypoint(cfg.x3));
    el.style.setProperty("--y3", waypoint(cfg.y3));
    el.appendChild(makeWing("left", cfg.variant));
    el.appendChild(makeWing("right", cfg.variant));
    return el;
  }

  const butterflies = BG_BUTTERFLIES.map((cfg) => {
    const butterfly = makeButterfly(cfg);
    root.appendChild(butterfly);
    return butterfly;
  });

  const states = butterflies.map((element) => ({
    element,
    baseFlap: parseFloat(element.style.getPropertyValue("--fl")),
    x: 0,
    y: 0,
    tilt: 0
  }));
  let pointerX = 0,
    pointerY = 0,
    pointerActive = false,
    touchUntil = 0,
    frame = 0,
    previousTime = 0;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function trackPointer(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    pointerActive = true;
    touchUntil = event.pointerType === "touch" ? performance.now() + 500 : 0;
    if (!reducedMotion && !frame) frame = requestAnimationFrame(animateInteraction);
  }

  function releasePointer(event) {
    if (event.pointerType === "touch") {
      pointerActive = true;
      touchUntil = performance.now() + 500;
    } else {
      pointerActive = false;
      touchUntil = 0;
    }
    if (!reducedMotion && !frame) frame = requestAnimationFrame(animateInteraction);
  }

  function animateInteraction(now) {
    frame = 0;
    const dt = Math.min(32, now - (previousTime || now));
    previousTime = now;
    if (touchUntil && now >= touchUntil) {
      touchUntil = 0;
      pointerActive = false;
    }
    let moving = false;

    const measurements = states.map((state) => {
      const {
        element
      } = state;
      const rect = element.getBoundingClientRect();
      return {
        state,
        centerX: rect.left + rect.width / 2 - state.x,
        centerY: rect.top + rect.height / 2 - state.y
      };
    });

    measurements.forEach(({
      state,
      centerX,
      centerY
    }) => {
      const {
        element
      } = state;
      const dx = centerX - pointerX;
      const dy = centerY - pointerY;
      const distance = Math.hypot(dx, dy);
      const radius = 190;
      const proximity = pointerActive && distance < radius ? 1 - distance / radius : 0;
      const influence = proximity * proximity * (3 - 2 * proximity);
      const direction = distance > 0.01 ? Math.atan2(dy, dx) : state.angle || (state.angle = Math.random() * Math.PI * 2);
      const strength = influence * 46;
      const targetX = pointerActive ? Math.cos(direction) * strength : 0;
      const targetY = pointerActive ? Math.sin(direction) * strength - influence * 10 : 0;
      const smoothing = 1 - Math.exp(-dt / 150);

      state.x += (targetX - state.x) * smoothing;
      state.y += (targetY - state.y) * smoothing;
      state.tilt += (Math.max(-18, Math.min(18, targetX * 0.28)) - state.tilt) * smoothing;
      element.style.setProperty("--interaction-x", `${state.x.toFixed(1)}px`);
      element.style.setProperty("--interaction-y", `${state.y.toFixed(1)}px`);
      element.style.setProperty("--interaction-tilt", `${state.tilt.toFixed(1)}deg`);

      const flapSpeed = Math.max(0.14, state.baseFlap * (1 - influence * 0.25));
      element.style.setProperty("--fl", `${flapSpeed.toFixed(2)}s`);
      if (Math.abs(targetX - state.x) > 0.5 || Math.abs(targetY - state.y) > 0.5 || Math.abs(state.x) > 0.5 || Math.abs(state.y) > 0.5) moving = true;
    });

    if (moving || now < touchUntil) frame = requestAnimationFrame(animateInteraction);
    else previousTime = 0;
  }

  document.addEventListener("pointermove", trackPointer, {
    passive: true
  });
  document.addEventListener("pointerdown", trackPointer, {
    passive: true
  });
  document.addEventListener("pointerup", releasePointer, {
    passive: true
  });
  document.addEventListener("pointercancel", releasePointer, {
    passive: true
  });
  document.addEventListener("pointerleave", releasePointer, {
    passive: true
  });
})();

/* ---------- candle-screen fireflies ---------- */
(function initFireflies() {
  const root = document.getElementById("fireflies");
  if (!root) return;

  const COUNT = 26;
  for (let i = 0; i < COUNT; i++) {
    const fly = document.createElement("div");
    fly.className = "firefly";
    fly.style.setProperty("--x", `${Math.random() * 100}%`);
    fly.style.setProperty("--y", `${Math.random() * 100}%`);
    fly.style.setProperty("--fd", `${8 + Math.random() * 10}s`);
    fly.style.setProperty("--fg", `${1.8 + Math.random() * 2.2}s`);
    fly.style.setProperty("--dl", `${(Math.random() * 10).toFixed(2)}s`);
    fly.style.setProperty("--dl2", `${(Math.random() * 3).toFixed(2)}s`);
    fly.style.setProperty("--dx1", `${(Math.random() - 0.5) * 90}px`);
    fly.style.setProperty("--dy1", `${(Math.random() - 0.5) * 90}px`);
    fly.style.setProperty("--dx2", `${(Math.random() - 0.5) * 90}px`);
    fly.style.setProperty("--dy2", `${(Math.random() - 0.5) * 90}px`);
    fly.style.setProperty("--dx3", `${(Math.random() - 0.5) * 90}px`);
    fly.style.setProperty("--dy3", `${(Math.random() - 0.5) * 90}px`);
    root.appendChild(fly);
  }
})();

/* ---------- final-screen floating hearts ---------- */
(function initHeartRain() {
  const root = document.getElementById("heartRain");
  if (!root) return;
  const GLYPHS = ["💖", "💕", "❤️", "💗", "♥"];
  const COLORS = ["#ff6f91", "#ff9ecb", "#ff4d6d", "#ffb3c6"];
  const COUNT = 18;
  for (let i = 0; i < COUNT; i++) {
    const h = document.createElement("span");
    h.className = "rising-heart";
    h.textContent = GLYPHS[i % GLYPHS.length];
    h.style.setProperty("--x", `${Math.random() * 100}%`);
    h.style.setProperty("--sz", `${1 + Math.random() * 1.3}rem`);
    h.style.setProperty("--c", COLORS[i % COLORS.length]);
    h.style.setProperty("--rd", `${9 + Math.random() * 8}s`);
    h.style.setProperty("--rdl", `${(Math.random() * 10).toFixed(2)}s`);
    h.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    root.appendChild(h);
  }
})();
