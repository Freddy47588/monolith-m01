/**
 * Interactive XY Modulation Pad with Phosphor Trail
 */
export class XYPad {
  constructor({ surface, canvas, puck, crossX, crossY, coordsEl, onChange }) {
    this.surface = surface;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.puck = puck;
    this.crossX = crossX;
    this.crossY = crossY;
    this.coordsEl = coordsEl;
    this.onChange = onChange;

    this.x = 0.52;
    this.y = 0.38;
    this.isDragging = false;
    this.trail = [];

    this._bindEvents();
    this._renderPosition();
    this._animateTrail();
  }

  setNormalized(nx, ny, notify = false) {
    this.x = Math.max(0, Math.min(1, nx));
    this.y = Math.max(0, Math.min(1, ny));
    this._renderPosition();
    if (notify && this.onChange) {
      this.onChange(this.x, this.y);
    }
  }

  _bindEvents() {
    const updateFromPointer = (e) => {
      const rect = this.surface.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1 - (e.clientY - rect.top) / rect.height;
      this.setNormalized(nx, ny, true);
      this.trail.push({
        x: this.x * this.canvas.width,
        y: (1 - this.y) * this.canvas.height,
        life: 1,
      });
    };

    this.surface.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.surface.setPointerCapture(e.pointerId);
      updateFromPointer(e);
    });

    this.surface.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      updateFromPointer(e);
    });

    const stop = () => {
      this.isDragging = false;
    };
    this.surface.addEventListener('pointerup', stop);
    this.surface.addEventListener('pointercancel', stop);
  }

  _renderPosition() {
    const leftPct = `${(this.x * 100).toFixed(1)}%`;
    const topPct = `${((1 - this.y) * 100).toFixed(1)}%`;
    this.puck.style.left = leftPct;
    this.puck.style.top = topPct;
    this.crossX.style.top = topPct;
    this.crossY.style.left = leftPct;
    this.coordsEl.textContent = `X ${this.x.toFixed(2)} / Y ${this.y.toFixed(2)}`;
  }

  _animateTrail() {
    const { ctx, canvas } = this;
    const tick = () => {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.28)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = this.trail.length - 1; i >= 0; i--) {
        const pt = this.trail[i];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 * pt.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 94, 38, ${pt.life * 0.75})`;
        ctx.fill();
        pt.life -= 0.035;
        if (pt.life <= 0) this.trail.splice(i, 1);
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
