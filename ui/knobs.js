/**
 * Precision Rotary Encoder Controller
 * Supports vertical pointer drag, mouse wheel, keyboard arrows, and double-click reset.
 */
export function initKnobs(knobElements, onParamChange) {
  const controllers = new Map();

  const formatVal = (param, val) => {
    if (param === 'cutoff') {
      return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${Math.round(val)}`;
    }
    if (param === 'bpm') return `${Math.round(val)}`;
    return `${Math.round(val)}%`;
  };

  knobElements.forEach((el) => {
    const param = el.dataset.param;
    const min = parseFloat(el.dataset.min);
    const max = parseFloat(el.dataset.max);
    const defaultVal = parseFloat(el.dataset.default);
    const isExp = el.dataset.curve === 'exp';
    const cap = el.querySelector('.knob-cap');
    const valEl = document.getElementById(`val-${param}`);

    let current = parseFloat(el.dataset.value);

    const toNorm = (val) => {
      const clamped = Math.max(min, Math.min(max, val));
      if (isExp) {
        return Math.log(clamped / min) / Math.log(max / min);
      }
      return (clamped - min) / (max - min);
    };

    const fromNorm = (norm) => {
      const n = Math.max(0, Math.min(1, norm));
      if (isExp) {
        return min * Math.pow(max / min, n);
      }
      return min + n * (max - min);
    };

    const applyValue = (nextVal, notify = true) => {
      current = Math.max(min, Math.min(max, nextVal));
      const norm = toNorm(current);
      const deg = -135 + norm * 270;
      cap.style.setProperty('--angle', `${deg.toFixed(1)}deg`);
      el.setAttribute('aria-valuenow', Math.round(current));
      if (valEl) valEl.textContent = formatVal(param, current);
      if (notify) onParamChange(param, current);
    };

    let startY = 0;
    let startNorm = 0;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.focus();
      startY = e.clientY;
      startNorm = toNorm(current);
      el.setPointerCapture(e.pointerId);

      const onMove = (moveEvent) => {
        const deltaNorm = (startY - moveEvent.clientY) / 140;
        applyValue(fromNorm(startNorm + deltaNorm), true);
      };

      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });

    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const step = e.deltaY < 0 ? 0.03 : -0.03;
        applyValue(fromNorm(toNorm(current) + step), true);
      },
      { passive: false }
    );

    el.addEventListener('dblclick', () => applyValue(defaultVal, true));

    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        applyValue(fromNorm(toNorm(current) + 0.04), true);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        applyValue(fromNorm(toNorm(current) - 0.04), true);
      }
    });

    applyValue(current, false);
    controllers.set(param, { setValue: (v) => applyValue(v, false) });
  });

  return controllers;
}
