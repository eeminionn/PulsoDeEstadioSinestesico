# PulsoDeEstadioSinestesico

Interactive p5.js piece for **Sinestesia Digital: Ver el Sonido**, built around the concept of a **sinesthetic stadium pulse** where football match data becomes a living audiovisual field driven by microphone input.

The project transforms FIFA World Cup matches into reactive entities: each match appears as an orb on the pitch, and its halos no longer respond to timeline playback. Instead, **even-numbered goals react to low frequencies** and **odd-numbered goals react to high frequencies**, turning live sound into a visual reading of rhythm, pressure, and intensity.

## Concept

**Pulso de estadio sinestesico** explores the feeling of collective tension in football as if the stadium itself were an organism. The visual system treats matches as bodies, goals as layers of memory, and sound as the force that wakes them up.

- **Bass** activates halos linked to even goals.
- **Treble** activates halos linked to odd goals.
- **Mid frequencies** affect drift, orbital motion, and visual instability.
- **Volume** amplifies the overall visual pressure of the field.

## Features

- Live microphone input with adjustable sensitivity.
- FFT analysis for **bass**, **mid**, and **treble** bands.
- Main reactive class with multiple instances and behavioral variation.
- Real-time controls for microphone gain, thresholds, aura scale, speed, and color flow.
- Toggleable legend with `L`.
- Fullscreen-ready presentation for exhibition/class critique.
- Dataset-driven structure using FIFA World Cup CSV files.

## Controls

| Input | Action |
| --- | --- |
| `L` | Show or hide legend |
| `F` | Toggle fullscreen |
| `A / Z` | Increase or decrease motion speed |
| `Left / Right` | Change World Cup year |
| Mouse drag | Orbit the field |
| Mouse wheel | Zoom |
| Click on orb | Pin match information |
| Sliders | Adjust mic sensitivity, thresholds, aura scale, speed and color |

## Files

| File | Role |
| --- | --- |
| `index.html` | Entry point |
| `style.css` | Interface and overlay styling |
| `sketch.js` | Main p5.js visualization and audio-reactive logic |
| `matches_clean.csv` | Match dataset |
| `goals_clean.csv` | Goal dataset |
| `teams_clean.csv` | Team metadata |
| `tournaments_clean.csv` | Tournament metadata |

## Run Locally

Because the piece uses microphone input, it should be opened from a local server instead of directly from the filesystem.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Allow microphone access in the browser and press the interface button to activate audio input.

## Context

This piece was adapted from an earlier World Cup data visualization into a final-exam interactive system focused on **seeing sound** through color, form, and motion. The result keeps the football archive as source material while shifting the experience toward live audiovisual performance.
