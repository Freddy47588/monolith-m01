import { midiToFreq, midiToName } from './presets.js';

/**
 * Web Audio API FM + Subtractive Synthesizer & Lookahead Step Sequencer
 */
export class SynthEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.filter = null;
    this.analyser = null;
    this.delayLeft = null;
    this.delayRight = null;
    this.delayWet = null;
    this.noiseBuffer = null;

    this.isPlaying = false;
    this.currentStep = 0;
    this.nextNoteTime = 0;
    this.timerId = null;

    this.params = {
      bpm: 112,
      cutoff: 2400,
      resonance: 2.8,
      fm: 28,
      delay: 32,
      drift: 24,
      volume: 78,
      waveform: 'triangle',
      fmRatio: 2,
      attack: 0.02,
      decay: 0.38,
      release: 0.45,
    };

    this.pattern = null;
    this.onStep = null;
    this.onNote = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this._buildMasterChain();
      this._createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  _buildMasterChain() {
    const ctx = this.ctx;

    this.masterBus = ctx.createGain();
    this.masterBus.gain.value = 0.85;

    // Resonant lowpass filter
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.params.cutoff;
    this.filter.Q.value = this.params.resonance;

    // Gentle analog soft-clipping waveshaper
    this.saturator = ctx.createWaveShaper();
    this.saturator.curve = this._makeSaturationCurve(18);
    this.saturator.oversample = '2x';

    // Stereo ping-pong delay
    this.delayLeft = ctx.createDelay(1.5);
    this.delayRight = ctx.createDelay(1.5);
    const fbLeft = ctx.createGain();
    const fbRight = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    this.delayWet = ctx.createGain();

    this._updateDelayTime();
    fbLeft.gain.value = 0.42;
    fbRight.gain.value = 0.38;
    this.delayWet.gain.value = this.params.delay / 100;

    // Cross-feedback loop
    this.delayLeft.connect(fbLeft);
    fbLeft.connect(this.delayRight);
    this.delayRight.connect(fbRight);
    fbRight.connect(this.delayLeft);

    this.delayLeft.connect(merger, 0, 0);
    this.delayRight.connect(merger, 0, 1);
    merger.connect(this.delayWet);

    // Master limiter / compressor + volume + analyser
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -12;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = (this.params.volume / 100) * 0.8;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.82;

    // Routing
    this.masterBus.connect(this.filter);
    this.filter.connect(this.saturator);

    // Dry + Wet
    this.saturator.connect(this.compressor);
    this.saturator.connect(this.delayLeft);
    this.delayWet.connect(this.compressor);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  _makeSaturationCurve(amount) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const k = amount;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  _createNoiseBuffer() {
    const length = this.ctx.sampleRate * 1.0;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  _updateDelayTime() {
    if (!this.delayLeft || !this.delayRight) return;
    const sixteenth = 60 / this.params.bpm / 4;
    const time = Math.min(1.2, sixteenth * 3); // dotted 8th
    this.delayLeft.delayTime.setTargetAtTime(time, this.ctx.currentTime, 0.04);
    this.delayRight.delayTime.setTargetAtTime(time * 0.66, this.ctx.currentTime, 0.04);
  }

  setParam(key, value) {
    this.params[key] = value;
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (key === 'cutoff' && this.filter) {
      const clamped = Math.max(120, Math.min(12000, value));
      this.filter.frequency.setTargetAtTime(clamped, now, 0.02);
    } else if (key === 'resonance' && this.filter) {
      this.filter.Q.setTargetAtTime(Math.max(0.5, Math.min(14, value)), now, 0.02);
    } else if (key === 'delay' && this.delayWet) {
      this.delayWet.gain.setTargetAtTime(Math.max(0, Math.min(0.9, value / 100)), now, 0.03);
    } else if (key === 'volume' && this.masterGain) {
      this.masterGain.gain.setTargetAtTime((value / 100) * 0.85, now, 0.02);
    } else if (key === 'bpm') {
      this._updateDelayTime();
    }
  }

  applyPreset(preset) {
    Object.assign(this.params, {
      bpm: preset.bpm,
      cutoff: preset.cutoff,
      resonance: preset.resonance,
      fm: preset.fm,
      delay: preset.delay,
      drift: preset.drift,
      waveform: preset.waveform,
      fmRatio: preset.fmRatio,
      attack: preset.attack,
      decay: preset.decay,
      release: preset.release,
    });
    if (this.ctx) {
      this.setParam('cutoff', this.params.cutoff);
      this.setParam('resonance', this.params.resonance);
      this.setParam('delay', this.params.delay);
      this.setParam('bpm', this.params.bpm);
    }
  }

  setPattern(pattern) {
    this.pattern = pattern;
  }

  async start() {
    await this.ensureContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.04;
    this.timerId = window.setInterval(() => this._scheduler(), 25);
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  _scheduler() {
    const scheduleAheadTime = 0.11;
    while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      const secondsPerBeat = 60.0 / this.params.bpm;
      this.nextNoteTime += 0.25 * secondsPerBeat; // 16th note
      this.currentStep = (this.currentStep + 1) % 16;
    }
  }

  _scheduleStep(step, time) {
    if (this.pattern) {
      const synthStep = this.pattern.synthSteps[step];
      if (synthStep && synthStep.on) {
        this.triggerSynth(synthStep.midi, time, 0.24, false);
      }

      const drums = this.pattern.drums;
      if (drums.kick[step]) this._triggerKick(time);
      if (drums.snare[step]) this._triggerSnare(time);
      if (drums.hat[step]) this._triggerHat(time);
      if (drums.perc[step]) this._triggerPerc(time);
    }

    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    window.setTimeout(() => {
      if (this.isPlaying && this.onStep) {
        this.onStep(step);
      }
    }, delayMs);
  }

  async playLiveNote(midi) {
    await this.ensureContext();
    this.triggerSynth(midi, this.ctx.currentTime, 0.38, true);
  }

  triggerSynth(midi, time, duration = 0.28, isLive = false) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const baseFreq = midiToFreq(midi);

    // Tape pitch drift (cents)
    const driftDepth = (this.params.drift / 100) * 14;
    const detuneCents = (Math.random() * 2 - 1) * driftDepth;

    const carrier = ctx.createOscillator();
    carrier.type = this.params.waveform || 'triangle';
    carrier.frequency.setValueAtTime(baseFreq, time);
    carrier.detune.setValueAtTime(detuneCents, time);

    // Subtle sub-oscillator for warmth
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(baseFreq * 0.5, time);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.16, time);

    // FM modulator
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(baseFreq * (this.params.fmRatio || 2), time);
    const modGain = ctx.createGain();
    const fmIndex = (this.params.fm / 100) * baseFreq * 1.4;
    modGain.gain.setValueAtTime(fmIndex, time);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, fmIndex * 0.22), time + duration);

    const env = ctx.createGain();
    const peak = isLive ? 0.34 : 0.24;
    const atk = this.params.attack || 0.015;
    const rel = this.params.release || 0.35;

    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + atk);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + rel);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    subOsc.connect(subGain);
    subGain.connect(env);
    env.connect(this.masterBus);

    const stopAt = time + duration + rel + 0.04;
    mod.start(time);
    carrier.start(time);
    subOsc.start(time);
    mod.stop(stopAt);
    carrier.stop(stopAt);
    subOsc.stop(stopAt);

    if (this.onNote) {
      const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
      window.setTimeout(() => this.onNote(midiToName(midi), baseFreq), delayMs);
    }
  }

  _triggerKick(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);

    gain.gain.setValueAtTime(0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    osc.connect(gain);
    gain.connect(this.compressor); // keep low end tight outside heavy filter/delay
    osc.start(time);
    osc.stop(time + 0.34);
  }

  _triggerSnare(time) {
    const ctx = this.ctx;
    // Noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(950, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    noise.connect(hp);
    hp.connect(noiseGain);
    noiseGain.connect(this.masterBus);
    noise.start(time);
    noise.stop(time + 0.18);

    // Snare body tone
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190, time);
    body.frequency.exponentialRampToValueAtTime(110, time + 0.08);
    bodyGain.gain.setValueAtTime(0.22, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    body.connect(bodyGain);
    bodyGain.connect(this.compressor);
    body.start(time);
    body.stop(time + 0.14);
  }

  _triggerHat(time) {
    const ctx = this.ctx;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(8400, time);
    bp.Q.setValueAtTime(2.0, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.055);

    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.compressor);
    noise.start(time);
    noise.stop(time + 0.07);
  }

  _triggerPerc(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, time);
    osc.frequency.exponentialRampToValueAtTime(340, time + 0.06);

    gain.gain.setValueAtTime(0.16, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.masterBus);
    osc.start(time);
    osc.stop(time + 0.09);
  }

  getTimeDomainData(targetArray) {
    if (!this.analyser) return false;
    this.analyser.getByteTimeDomainData(targetArray);
    return true;
  }

  getFrequencyData(targetArray) {
    if (!this.analyser) return false;
    this.analyser.getByteFrequencyData(targetArray);
    return true;
  }
}
