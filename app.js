import { SynthEngine } from './audio/engine.js';
import {
  PRESETS,
  euclidean,
  generateMutatedSequence,
  midiToName,
} from './audio/presets.js';
import { OledDisplay } from './ui/oled.js';
import { XYPad } from './ui/xypad.js';
import { initKnobs } from './ui/knobs.js';

const TRACKS = [
  { key: 'synth', label: 'SYNTH', color: '#ff5e26' },
  { key: 'kick', label: 'KICK', color: '#36e2b4' },
  { key: 'snare', label: 'SNARE', color: '#ffb020' },
  { key: 'hat', label: 'HI-HAT', color: '#70a1ff' },
  { key: 'perc', label: 'PERC', color: '#c084fc' },
];

// 16-key layout from C4 (60) to D#5 (75)
const KEYBED_NOTES = [
  { midi: 60, type: 'white', label: 'C4', key: 'a' },
  { midi: 61, type: 'black', label: 'C#', key: 'w', whiteIndex: 0 },
  { midi: 62, type: 'white', label: 'D4', key: 's' },
  { midi: 63, type: 'black', label: 'D#', key: 'e', whiteIndex: 1 },
  { midi: 64, type: 'white', label: 'E4', key: 'd' },
  { midi: 65, type: 'white', label: 'F4', key: 'f' },
  { midi: 66, type: 'black', label: 'F#', key: 't', whiteIndex: 3 },
  { midi: 67, type: 'white', label: 'G4', key: 'g' },
  { midi: 68, type: 'black', label: 'G#', key: 'y', whiteIndex: 4 },
  { midi: 69, type: 'white', label: 'A4', key: 'h' },
  { midi: 70, type: 'black', label: 'A#', key: 'u', whiteIndex: 5 },
  { midi: 71, type: 'white', label: 'B4', key: 'j' },
  { midi: 72, type: 'white', label: 'C5', key: 'k' },
  { midi: 73, type: 'black', label: 'C#', key: 'o', whiteIndex: 7 },
  { midi: 74, type: 'white', label: 'D5', key: 'l' },
  { midi: 75, type: 'black', label: 'D#', key: 'p', whiteIndex: 8 },
  { midi: 76, type: 'white', label: 'E5', key: ';' },
];

const engine = new SynthEngine();
let activePresetIndex = 0;
let euclidCycle = 0;
let currentPattern = clonePattern(PRESETS[0]);

function clonePattern(preset) {
  return {
    synthSteps: preset.synthSteps.map((s) => ({ ...s })),
    drums: {
      kick: [...preset.drums.kick],
      snare: [...preset.drums.snare],
      hat: [...preset.drums.hat],
      perc: [...preset.drums.perc],
    },
  };
}

// DOM References
const playBtn = document.getElementById('playBtn');
const playBtnText = document.getElementById('playBtnText');
const playLed = document.getElementById('playLed');
const oledPresetTag = document.getElementById('oledPresetTag');
const oledAudioStatus = document.getElementById('oledAudioStatus');
const oledNoteReadout = document.getElementById('oledNoteReadout');
const oledParamReadout = document.getElementById('oledParamReadout');
const oledBpmReadout = document.getElementById('oledBpmReadout');
const seqGridEl = document.getElementById('seqGrid');
const keybedEl = document.getElementById('keybed');
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');

// Initialize OLED
const oled = new OledDisplay(document.getElementById('oledCanvas'), engine);
oled.start();

// Sync OLED telemetry bar
function updateOledTelemetry() {
  const cutoffStr = `${Math.round(engine.params.cutoff)}Hz`;
  const delayStr = `${Math.round(engine.params.delay)}%`;
  oledParamReadout.textContent = `FLT ${cutoffStr} // DLY ${delayStr}`;
  oledBpmReadout.textContent = `${Math.round(engine.params.bpm)} BPM`;
}

// Initialize Rotary Knobs
const knobControllers = initKnobs(document.querySelectorAll('.knob'), (param, value) => {
  engine.setParam(param, value);
  updateOledTelemetry();
  if (param === 'cutoff' || param === 'delay') {
    const nx = Math.log(Math.max(180, engine.params.cutoff) / 180) / Math.log(9500 / 180);
    const ny = engine.params.delay / 85;
    xyPad.setNormalized(nx, ny, false);
  }
});

// Initialize XY Pad
const xyPad = new XYPad({
  surface: document.getElementById('xyPad'),
  canvas: document.getElementById('xyCanvas'),
  puck: document.getElementById('xyPuck'),
  crossX: document.getElementById('xyCrossX'),
  crossY: document.getElementById('xyCrossY'),
  coordsEl: document.getElementById('xyCoords'),
  onChange: (nx, ny) => {
    const cutoff = 180 * Math.pow(9500 / 180, nx);
    const resonance = 1 + ny * 9.5;
    const delay = ny * 78;

    engine.setParam('cutoff', cutoff);
    engine.setParam('resonance', resonance);
    engine.setParam('delay', delay);

    knobControllers.get('cutoff')?.setValue(cutoff);
    knobControllers.get('delay')?.setValue(delay);
    updateOledTelemetry();
  },
});

// Build Sequencer Grid
const stepButtonMap = {
  synth: [],
  kick: [],
  snare: [],
  hat: [],
  perc: [],
};

function buildSequencerGrid() {
  seqGridEl.innerHTML = '';
  TRACKS.forEach((track) => {
    const row = document.createElement('div');
    row.className = 'seq-row';
    row.style.setProperty('--track-color', track.color);

    const label = document.createElement('div');
    label.className = 'seq-track-label';
    label.innerHTML = `<span class="track-dot"></span><span>${track.label}</span>`;
    row.appendChild(label);

    stepButtonMap[track.key] = [];

    for (let s = 0; s < 16; s++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seq-step';
      btn.setAttribute('aria-label', `${track.label} step ${s + 1}`);

      btn.addEventListener('click', async (e) => {
        await engine.ensureContext();
        if (track.key === 'synth') {
          const stepObj = currentPattern.synthSteps[s];
          if (e.shiftKey) {
            // Cycle note through preset scale + octave
            const preset = PRESETS[activePresetIndex];
            const scale = preset.scale;
            const currentOffset = (stepObj.midi - preset.rootMidi + 24) % 12;
            const idx = scale.indexOf(currentOffset);
            const nextDegree = scale[(idx + 1) % scale.length];
            stepObj.midi = preset.rootMidi + nextDegree + (idx === scale.length - 1 ? 12 : 0);
            stepObj.on = true;
          } else {
            stepObj.on = !stepObj.on;
          }
          if (stepObj.on) {
            engine.triggerSynth(stepObj.midi, engine.ctx.currentTime, 0.22, true);
          }
        } else {
          currentPattern.drums[track.key][s] = currentPattern.drums[track.key][s] ? 0 : 1;
        }
        renderSequencerState();
      });

      stepButtonMap[track.key].push(btn);
      row.appendChild(btn);
    }

    seqGridEl.appendChild(row);
  });
}

function renderSequencerState() {
  for (let s = 0; s < 16; s++) {
    const synthStep = currentPattern.synthSteps[s];
    const synthBtn = stepButtonMap.synth[s];
    synthBtn.classList.toggle('active', synthStep.on);
    synthBtn.textContent = synthStep.on ? midiToName(synthStep.midi).replace(/\d/, '') : '';

    ['kick', 'snare', 'hat', 'perc'].forEach((drumKey) => {
      const active = Boolean(currentPattern.drums[drumKey][s]);
      stepButtonMap[drumKey][s].classList.toggle('active', active);
    });
  }
}

function highlightPlayhead(step) {
  TRACKS.forEach((track) => {
    stepButtonMap[track.key].forEach((btn, idx) => {
      btn.classList.toggle('playhead', idx === step);
    });
  });
}

function clearPlayhead() {
  TRACKS.forEach((track) => {
    stepButtonMap[track.key].forEach((btn) => btn.classList.remove('playhead'));
  });
}

// Build Playable Keybed
const keyElementByMidi = new Map();
const midiByHotkey = new Map();

function buildKeybed() {
  keybedEl.innerHTML = '';
  const whiteCount = KEYBED_NOTES.filter((n) => n.type === 'white').length;

  KEYBED_NOTES.forEach((note) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `piano-key ${note.type}`;
    btn.setAttribute('aria-label', `${note.label} (${note.key.toUpperCase()})`);
    btn.innerHTML = `<span class="key-shortcut">${note.key.toUpperCase()}</span>`;

    if (note.type === 'black') {
      const leftPct = ((note.whiteIndex + 0.72) / whiteCount) * 100;
      btn.style.left = `${leftPct.toFixed(2)}%`;
    }

    const triggerDown = async (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      await engine.playLiveNote(note.midi);
      oledAudioStatus.textContent = engine.isPlaying ? 'RUNNING' : 'LIVE';
      oledAudioStatus.classList.add('live');
    };

    const triggerUp = () => {
      btn.classList.remove('pressed');
    };

    btn.addEventListener('pointerdown', triggerDown);
    btn.addEventListener('pointerup', triggerUp);
    btn.addEventListener('pointerleave', triggerUp);
    btn.addEventListener('pointercancel', triggerUp);

    keybedEl.appendChild(btn);
    keyElementByMidi.set(note.midi, btn);
    midiByHotkey.set(note.key.toLowerCase(), note.midi);
  });
}

// Engine Callbacks
engine.onStep = (step) => {
  highlightPlayhead(step);
};

engine.onNote = (noteName, freq) => {
  oledNoteReadout.textContent = `NOTE: ${noteName} (${Math.round(freq)}Hz)`;
};

// Load Cartridge Preset
function loadPreset(index) {
  activePresetIndex = index;
  const preset = PRESETS[index];
  currentPattern = clonePattern(preset);

  engine.applyPreset(preset);
  engine.setPattern(currentPattern);

  knobControllers.get('bpm')?.setValue(preset.bpm);
  knobControllers.get('cutoff')?.setValue(preset.cutoff);
  knobControllers.get('fm')?.setValue(preset.fm);
  knobControllers.get('delay')?.setValue(preset.delay);
  knobControllers.get('drift')?.setValue(preset.drift);

  const nx = Math.log(Math.max(180, preset.cutoff) / 180) / Math.log(9500 / 180);
  const ny = preset.delay / 85;
  xyPad.setNormalized(nx, ny, false);

  oledPresetTag.textContent = preset.tag;
  updateOledTelemetry();
  renderSequencerState();

  document.querySelectorAll('.cartridge-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
}

// Transport Controls
async function togglePlayback() {
  if (engine.isPlaying) {
    engine.stop();
    playBtn.setAttribute('aria-pressed', 'false');
    playBtnText.textContent = 'PLAY';
    playLed.classList.remove('on');
    oledAudioStatus.textContent = 'STANDBY';
    oledAudioStatus.classList.remove('live');
    clearPlayhead();
  } else {
    engine.setPattern(currentPattern);
    await engine.start();
    playBtn.setAttribute('aria-pressed', 'true');
    playBtnText.textContent = 'STOP';
    playLed.classList.add('on');
    oledAudioStatus.textContent = 'RUNNING';
    oledAudioStatus.classList.add('live');
  }
}

playBtn.addEventListener('click', togglePlayback);

document.getElementById('mutateBtn').addEventListener('click', async () => {
  await engine.ensureContext();
  const mutated = generateMutatedSequence(PRESETS[activePresetIndex]);
  currentPattern.synthSteps = mutated.synthSteps;
  currentPattern.drums = mutated.drums;
  engine.setPattern(currentPattern);
  renderSequencerState();
  if (!engine.isPlaying) {
    await togglePlayback();
  }
});

document.getElementById('euclidBtn').addEventListener('click', async () => {
  await engine.ensureContext();
  const densities = [
    [4, 7, 3],
    [5, 11, 5],
    [3, 9, 6],
    [6, 13, 4],
  ];
  euclidCycle = (euclidCycle + 1) % densities.length;
  const [k, h, p] = densities[euclidCycle];
  currentPattern.drums.kick = euclidean(16, k, 0);
  currentPattern.drums.hat = euclidean(16, h, 1);
  currentPattern.drums.perc = euclidean(16, p, 2);
  engine.setPattern(currentPattern);
  renderSequencerState();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  currentPattern.synthSteps.forEach((s) => {
    s.on = false;
  });
  Object.keys(currentPattern.drums).forEach((k) => {
    currentPattern.drums[k].fill(0);
  });
  engine.setPattern(currentPattern);
  renderSequencerState();
});

// Cartridge Selection
document.querySelectorAll('.cartridge-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.preset, 10);
    loadPreset(idx);
  });
});

// Visualizer Mode Selection
document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    oled.setMode(btn.dataset.vis);
  });
});

// Theme Switcher
themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'obsidian' ? 'chalk' : 'obsidian';
  html.setAttribute('data-theme', next);
  themeLabel.textContent = next.toUpperCase();
});

// QWERTY Keyboard Playing + Spacebar Transport
const activeKeys = new Set();

window.addEventListener('keydown', async (e) => {
  if (e.repeat) return;
  if (e.code === 'Space' && document.activeElement?.tagName !== 'BUTTON') {
    e.preventDefault();
    togglePlayback();
    return;
  }
  const midi = midiByHotkey.get(e.key.toLowerCase());
  if (midi !== undefined && !activeKeys.has(e.key.toLowerCase())) {
    activeKeys.add(e.key.toLowerCase());
    keyElementByMidi.get(midi)?.classList.add('pressed');
    await engine.playLiveNote(midi);
    oledAudioStatus.textContent = engine.isPlaying ? 'RUNNING' : 'LIVE';
    oledAudioStatus.classList.add('live');
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (activeKeys.has(k)) {
    activeKeys.delete(k);
    const midi = midiByHotkey.get(k);
    if (midi !== undefined) {
      keyElementByMidi.get(midi)?.classList.remove('pressed');
    }
  }
});

// Boot Sequence
buildSequencerGrid();
buildKeybed();
loadPreset(0);
