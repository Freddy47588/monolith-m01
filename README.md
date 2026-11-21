# MONOLITH M-01

A tactile, hardware-inspired **FM & subtractive synthesizer**, **16-step Euclidean sequencer**, and **real-time OLED visualizer** built with pure HTML, CSS, ES Modules, and the Web Audio API — zero external samples or build steps required.

![MONOLITH M-01 Preview](assets/preview.png)

## Features

- **100% Procedural Web Audio Engine**: Polyphonic FM + sub-oscillator synth voices, synthesized analog-style drums (`kick`, `snare`, `hi-hat`, `perc`), resonant lowpass filter, waveshaper saturation, stereo ping-pong delay, and master compressor.
- **4 Sound Cartridges**: Instant presets (`01 KYOTO RAIN`, `02 ORBITAL 84`, `03 KINETIC DUB`, `04 AURORA DRIFT`) with distinct scales, waveforms, envelopes, and patterns.
- **16-Step Euclidean Sequencer**: Interactive 5-track matrix (`SYNTH`, `KICK`, `SNARE`, `HI-HAT`, `PERC`), Bjorklund Euclidean drum generator (`EUCLID`), and scale-locked generative mutator (`MUTATE`).
- **Real-Time OLED Visualizer**: 4 Canvas 2D modes — `SCOPE`, `SPECTRUM`, `LISSAJOUS`, and `TERRAIN`.
- **XY Modulation Matrix**: Drag to sweep Filter Cutoff (`X`) and Resonance + Echo (`Y`) with phosphor trails.
- **Playable Keybed**: 17-key mouse/touch & QWERTY keyboard (`A S D F G H J K L ;` for white keys, `W E T Y U O P` for sharps).
- **Dual Chassis Themes**: Switch between dark studio `OBSIDIAN` and light Braun-inspired `CHALK`.

## Controls

| Action | Control |
| --- | --- |
| Play / Stop | Click `PLAY` or press `Space` |
| Play Notes | Click keybed or use QWERTY (`A`–`;` / `W E T Y U O P`) |
| Toggle Step | Click any cell in the 16-step grid |
| Cycle Synth Note | `Shift + Click` on a `SYNTH` step |
| Adjust Knobs | Drag vertically, scroll wheel, arrow keys, or double-click to reset |

## Run Locally

Because the app uses native ES modules, serve it from any static local server:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173` in your browser.
