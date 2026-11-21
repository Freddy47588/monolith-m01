/**
 * OLED Phosphor Display Renderer
 * Modes: scope | spectrum | lissajous | terrain
 */
export class OledDisplay {
  constructor(canvas, engine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = engine;
    this.mode = 'scope';
    this.phase = 0;

    this.timeData = new Uint8Array(512);
    this.freqData = new Uint8Array(512);
    this.terrainHistory = Array.from({ length: 18 }, () => new Float32Array(32));

    this._raf = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  start() {
    if (this._raf) return;
    const render = () => {
      this._draw();
      this._raf = requestAnimationFrame(render);
    };
    this._raf = requestAnimationFrame(render);
  }

  _drawGrid(w, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(68, 242, 195, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = w / 8; x < w; x += w / 8) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = h / 4; y < h; y += h / 4) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Center crosshair
    ctx.strokeStyle = 'rgba(68, 242, 195, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  _getSignalBuffers() {
    const hasAudio =
      this.engine.ctx &&
      this.engine.ctx.state === 'running' &&
      this.engine.getTimeDomainData(this.timeData) &&
      this.engine.getFrequencyData(this.freqData);

    let energy = 0;
    if (hasAudio) {
      for (let i = 0; i < this.timeData.length; i += 4) {
        energy += Math.abs(this.timeData[i] - 128);
      }
    }

    // If standby or silent, synthesize a subtle ambient breathing wave
    if (!hasAudio || energy < 12) {
      const t = this.phase;
      for (let i = 0; i < this.timeData.length; i++) {
        const x = (i / this.timeData.length) * Math.PI * 4;
        const val =
          128 +
          Math.sin(x + t * 2.1) * 14 +
          Math.sin(x * 2.5 - t * 1.4) * 6;
        this.timeData[i] = val;
      }
      for (let i = 0; i < this.freqData.length; i++) {
        const bell = Math.exp(-Math.pow((i - 18) / 14, 2)) * 55;
        const ripple = Math.sin(i * 0.28 - t * 3) * 10 + 14;
        this.freqData[i] = Math.max(0, Math.min(255, bell + ripple));
      }
    }
  }

  _draw() {
    const { canvas, ctx } = this;
    const w = canvas.width;
    const h = canvas.height;
    this.phase += 0.025;

    // Slight phosphor persistence fade
    ctx.fillStyle = 'rgba(5, 8, 10, 0.42)';
    ctx.fillRect(0, 0, w, h);

    this._drawGrid(w, h);
    this._getSignalBuffers();

    if (this.mode === 'scope') this._drawScope(w, h);
    else if (this.mode === 'spectrum') this._drawSpectrum(w, h);
    else if (this.mode === 'lissajous') this._drawLissajous(w, h);
    else if (this.mode === 'terrain') this._drawTerrain(w, h);
  }

  _drawScope(w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#44f2c3';
    ctx.lineWidth = 2.4;
    ctx.shadowColor = '#44f2c3';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    const len = this.timeData.length;
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * w;
      const v = (this.timeData[i] - 128) / 128;
      const y = h / 2 + v * (h * 0.42);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawSpectrum(w, h) {
    const ctx = this.ctx;
    const bars = 48;
    const barW = w / bars;

    for (let i = 0; i < bars; i++) {
      const bin = Math.floor(Math.pow(i / bars, 1.35) * (this.freqData.length * 0.55));
      const amp = this.freqData[bin] / 255;
      const barH = Math.max(4, amp * (h * 0.84));
      const x = i * barW + 2;
      const y = h - barH - 6;

      ctx.fillStyle = amp > 0.65 ? '#ff7038' : '#44f2c3';
      ctx.fillRect(x, y, Math.max(3, barW - 4), barH);
    }
  }

  _drawLissajous(w, h) {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.38;

    ctx.save();
    ctx.strokeStyle = '#ff7038';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff7038';
    ctx.shadowBlur = 12;
    ctx.beginPath();

    const offset = 36;
    const len = this.timeData.length - offset;
    for (let i = 0; i < len; i++) {
      const vx = (this.timeData[i] - 128) / 128;
      const vy = (this.timeData[i + offset] - 128) / 128;
      const x = cx + vx * scale * 1.45;
      const y = cy + vy * scale * 1.15;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawTerrain(w, h) {
    const ctx = this.ctx;
    // Shift history back and sample 32 frequency bands into front row
    const latest = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
      latest[i] = this.freqData[i * 3] / 255;
    }
    this.terrainHistory.pop();
    this.terrainHistory.unshift(latest);

    const rows = this.terrainHistory.length;
    for (let r = rows - 1; r >= 0; r--) {
      const row = this.terrainHistory[r];
      const depth = r / rows;
      const baseY = h * 0.9 - depth * (h * 0.56);
      const insetX = depth * (w * 0.14);
      const spanW = w - insetX * 2;

      ctx.beginPath();
      for (let c = 0; c < row.length; c++) {
        const x = insetX + (c / (row.length - 1)) * spanW;
        const y = baseY - row[c] * (h * 0.28) * (1 - depth * 0.45);
        if (c === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      const alpha = Math.max(0.14, 1 - depth * 0.85);
      ctx.strokeStyle = r === 0 ? `rgba(255, 112, 56, ${alpha})` : `rgba(68, 242, 195, ${alpha})`;
      ctx.lineWidth = r === 0 ? 2 : 1.2;
      ctx.stroke();
    }
  }
}
