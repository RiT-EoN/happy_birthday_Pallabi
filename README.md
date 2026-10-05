# A little surprise for you !!

An interactive birthday surprise. Press **Start**, wait for the 3‑2‑1 countdown, then **blow into your microphone** to put out the candle. One second later, a wishing note and photos appear.

Pure HTML, CSS and JavaScript. No build step, no dependencies.

## Files

```
blow-the-candle/
├── index.html   # three screens: start, candle, final
├── style.css    # flat 2D cartoon style (#555675 bg, 4px black outlines)
├── script.js    # countdown, Web Audio blow detection, final screen
├── README.md
└── images/      # you create this: photo1.jpg, photo2.jpg, ...
```

## Run it

The microphone only works on **HTTPS or localhost**, so don't just double-click `index.html`.

```bash
cd blow-the-candle
python3 -m http.server 8000
```

Open <http://localhost:8000>. To use it on her phone, deploy the folder to any free HTTPS host (GitHub Pages, Netlify, Vercel, Cloudflare Pages) and share the link.

## Customize

Everything personal is in the `CONFIG` block at the top of `script.js`:

- `name`: her name, shown in the final title
- `note`: the lines of your wishing note (one string per paragraph)
- `photos`: file paths and captions. Put her pictures in an `images/` folder; a placeholder shows if a file is missing
- `blowThreshold`: lower it if the mic is not picking up your blow, raise it if it triggers too easily
- `finalDelayMs`: delay between the flame going out and the final screen (default 1000)

## Sending it to her phone (no PC needed)

The microphone only works on an **HTTPS link**, so upload the folder once and send her the link:

1. Compress her photos first (about 800 px wide, under 300 KB each) so they load fast on mobile data.
2. Upload the whole `blow-the-candle` folder to a free host: **Netlify Drop** (drag the folder onto app.netlify.com/drop), **GitHub Pages** or **Cloudflare Pages**.
3. Send her the HTTPS link on WhatsApp or SMS.

Tell her to:
- open it in **Chrome or Safari** (in-app browsers such as Instagram or Facebook often block the microphone; the screen then lets her tap to blow instead),
- turn the sound up and switch off silent mode (iPhones mute web audio in silent mode),
- tap **Allow** when it asks for the microphone, then blow close to the phone.

It is built for portrait phones. The page keeps the screen awake, avoids double-tap zoom, respects notches and uses lighter effects on small screens.

## Themes and customization

Everything is in the `CONFIG` block at the top of `script.js`:

- `theme`: `"romantic"`, `"sunset"`, `"midnight"` or `"garden"`. Override single colours with `colors: { accent: "#ff4d8d", gold: "#ffd27a", paper: "#fff4ea" }`.
- `backgroundImage`: a real photo for the final scene (for example `images/bg.jpg`), with `backgroundBlur` and `backgroundDim`. Without it you get a night scene with moon, stars and glowing bokeh lights.
- `frame`: photo frame colour, `"champagne"`, `"lavender"` or `"mix"` (alternating).
- `effects`: switch `bokeh`, `fairyLights`, `petals`, `hearts` and `confetti` on or off.
- All texts (`titleLine`, `subtitle`, `note`, `signature`, button and countdown text) and `typewriter` (letter-by-letter note).

## Microphone tips

- It needs HTTPS or localhost, and you must allow the microphone prompt.
- Blow close to the mic in one firm breath. If it triggers too easily or not at all, change `blowThreshold` in `CONFIG`.
- If the microphone is blocked, tap the candle instead.

## Animations

Candle rises in and ignites, the flame flickers and **bends as you blow**, then the glow fades, smoke curls up, the wick ember dies and the screen shakes. The final screen has bouncing title letters, floating balloons, falling confetti and photos that fly in.

## Music and sounds

Everything is synthesized with the Web Audio API, so no audio files are needed: countdown beeps, a "whoosh" when the flame goes out, a chime and a music-box **Happy Birthday** melody on the final screen (with a 🔊/🔇 button).

To use your own song, add a file such as `music/song.mp3` and set `musicFile: "music/song.mp3"` in `CONFIG`. A soft, low-volume intro (`introVolume`, 0 to turn it off) plays from the moment she presses Start. The full music starts, fading in, the instant the flame goes out. If the intro makes the microphone trigger too early, lower `introVolume` or set it to 0.

The note types like a person: uneven keystrokes, a breath at commas and long pauses after sentences. Change `typingPace` (0.6 faster, 1.5 slower).

## How blow detection works

The app reads the microphone through the Web Audio API (`getUserMedia` + `AnalyserNode`). It measures room noise for half a second, then treats a loud, sustained burst (about four frames in a row) as a blow, so a single click or cough won't trigger it.

If microphone access is denied or unsupported, the screen tells you to tap the candle instead.

## Palette

| Part | Colour |
| --- | --- |
| Background | `#555675` |
| Candle wax | `#FCE4EC` |
| Flame outer / inner | `#FA8C00` / `#FFD400` |
| Shadow | `#3B3A55` |
| Outline | `#000`, 4px |