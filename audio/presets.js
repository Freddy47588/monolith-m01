/**
 * Sound Cartridges, Musical Scales, and Euclidean Pattern Generators
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToName(midi) {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Bjorklund Euclidean rhythm generator: distributes `pulses` evenly across `steps`.
 */
export function euclidean(steps, pulses, rotation = 0) {
  if (pulses <= 0) return Array(steps).fill(0);
  if (pulses >= steps) return Array(steps).fill(1);

  let pattern = [];
  let counts = [];
  let remainders = [];
  let divisor = steps - pulses;
  remainders.push(pulses);
  let level = 0;

  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level += 1;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const build = (lvl) => {
    if (lvl === -1) {
      pattern.push(0);
    } else if (lvl === -2) {
      pattern.push(1);
    } else {
      for (let i = 0; i < counts[lvl]; i++) build(lvl - 1);
      if (remainders[lvl] !== 0) build(lvl - 2);
    }
  };

  build(level);
  const offset = ((rotation % steps) + steps) % steps;
  return pattern.map((_, i) => pattern[(i + offset) % steps]);
}

export const SCALES = {
  minorPentatonic: [0, 3, 5, 7, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export const PRESETS = [
  {
    id: 'kyoto-rain',
    name: 'KYOTO RAIN',
    tag: 'CART 01 // KYOTO RAIN',
    bpm: 94,
    cutoff: 1950,
    resonance: 2.8,
    fm: 26,
    delay: 42,
    drift: 38,
    waveform: 'triangle',
    fmRatio: 2,
    attack: 0.025,
    decay: 0.42,
    release: 0.55,
    rootMidi: 60, // C4
    scale: SCALES.hirajoshi,
    synthSteps: [
      { on: true, midi: 60 },
      { on: false, midi: 62 },
      { on: true, midi: 67 },
      { on: false, midi: 68 },
      { on: true, midi: 63 },
      { on: false, midi: 60 },
      { on: true, midi: 72 },
      { on: false, midi: 67 },
      { on: true, midi: 62 },
      { on: false, midi: 63 },
      { on: true, midi: 68 },
      { on: false, midi: 67 },
      { on: true, midi: 63 },
      { on: true, midi: 62 },
      { on: false, midi: 60 },
      { on: true, midi: 67 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
      perc: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    },
  },
  {
    id: 'orbital-84',
    name: 'ORBITAL 84',
    tag: 'CART 02 // ORBITAL 84',
    bpm: 118,
    cutoff: 3200,
    resonance: 4.2,
    fm: 44,
    delay: 34,
    drift: 18,
    waveform: 'sawtooth',
    fmRatio: 1,
    attack: 0.008,
    decay: 0.24,
    release: 0.28,
    rootMidi: 57, // A3
    scale: SCALES.minorPentatonic,
    synthSteps: [
      { on: true, midi: 45 },
      { on: true, midi: 57 },
      { on: true, midi: 64 },
      { on: true, midi: 60 },
      { on: true, midi: 45 },
      { on: true, midi: 57 },
      { on: true, midi: 67 },
      { on: true, midi: 64 },
      { on: true, midi: 48 },
      { on: true, midi: 60 },
      { on: true, midi: 67 },
      { on: true, midi: 64 },
      { on: true, midi: 50 },
      { on: true, midi: 62 },
      { on: true, midi: 69 },
      { on: true, midi: 67 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
      perc: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0],
    },
  },
  {
    id: 'kinetic-dub',
    name: 'KINETIC DUB',
    tag: 'CART 03 // KINETIC DUB',
    bpm: 126,
    cutoff: 1450,
    resonance: 6.4,
    fm: 58,
    delay: 58,
    drift: 14,
    waveform: 'sawtooth',
    fmRatio: 3,
    attack: 0.005,
    decay: 0.18,
    release: 0.22,
    rootMidi: 53, // F3
    scale: SCALES.dorian,
    synthSteps: [
      { on: true, midi: 53 },
      { on: false, midi: 53 },
      { on: false, midi: 60 },
      { on: true, midi: 56 },
      { on: false, midi: 53 },
      { on: false, midi: 65 },
      { on: true, midi: 60 },
      { on: false, midi: 56 },
      { on: false, midi: 53 },
      { on: true, midi: 63 },
      { on: false, midi: 60 },
      { on: false, midi: 58 },
      { on: true, midi: 53 },
      { on: false, midi: 65 },
      { on: true, midi: 68 },
      { on: false, midi: 63 },
    ],
    drums: {
      kick: euclidean(16, 5, 0),
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
      hat: euclidean(16, 11, 1),
      perc: euclidean(16, 7, 2),
    },
  },
  {
    id: 'aurora-drift',
    name: 'AURORA DRIFT',
    tag: 'CART 04 // AURORA DRIFT',
    bpm: 84,
    cutoff: 4400,
    resonance: 2.2,
    fm: 68,
    delay: 64,
    drift: 48,
    waveform: 'sine',
    fmRatio: 3.5,
    attack: 0.045,
    decay: 0.65,
    release: 0.9,
    rootMidi: 62, // D4
    scale: SCALES.lydian,
    synthSteps: [
      { on: true, midi: 62 },
      { on: false, midi: 69 },
      { on: true, midi: 74 },
      { on: false, midi: 73 },
      { on: true, midi: 66 },
      { on: false, midi: 69 },
      { on: false, midi: 74 },
      { on: true, midi: 76 },
      { on: true, midi: 69 },
      { on: false, midi: 74 },
      { on: true, midi: 78 },
      { on: false, midi: 73 },
      { on: false, midi: 66 },
      { on: true, midi: 74 },
      { on: false, midi: 69 },
      { on: true, midi: 81 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      perc: euclidean(16, 3, 1),
    },
  },
];

/**
 * Generates a scale-locked melodic sequence + Euclidean percussion variation.
 */
export function generateMutatedSequence(preset) {
  const scale = preset.scale || SCALES.minorPentatonic;
  const root = preset.rootMidi || 60;

  const synthSteps = Array.from({ length: 16 }, (_, i) => {
    const density = i % 4 === 0 ? 0.82 : 0.45;
    const on = Math.random() < density;
    const degree = scale[Math.floor(Math.random() * scale.length)];
    const octaveShift = Math.random() < 0.25 ? 12 : Math.random() < 0.12 ? -12 : 0;
    return {
      on,
      midi: Math.max(40, Math.min(84, root + degree + octaveShift)),
    };
  });

  const kickPulses = [3, 4, 5][Math.floor(Math.random() * 3)];
  const hatPulses = [7, 9, 11, 13][Math.floor(Math.random() * 4)];
  const percPulses = [3, 5, 6][Math.floor(Math.random() * 3)];

  return {
    synthSteps,
    drums: {
      kick: euclidean(16, kickPulses, 0),
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, Math.random() < 0.35 ? 1 : 0, 0],
      hat: euclidean(16, hatPulses, Math.floor(Math.random() * 4)),
      perc: euclidean(16, percPulses, Math.floor(Math.random() * 4)),
    },
  };
}
