import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Slider } from '../../../framework/interact/Controls';
import { cssVar, drawArrow, drawAxes } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas } from '../../../framework/interact/SimCanvas';

/** Number of past angles kept for the sine trace (~6 s at 60 fps). */
const HISTORY = 360;

export function EulerCircle() {
  const [omega, setOmega] = useState(1.5);
  const [playing, setPlaying] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const theta = useRef(0.6);
  const history = useRef<number[]>([]);
  const report = useReportState();

  useEffect(() => report({ omega, velocityShown: showVelocity }), [omega, showVelocity]);

  function onTick(dt: number) {
    theta.current = (theta.current + omega * dt) % (2 * Math.PI);
    history.current.push(theta.current);
    if (history.current.length > HISTORY) history.current.shift();
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const circleWidth = Math.min(h, w * 0.45);
    const cx = circleWidth / 2;
    const cy = h / 2;
    const r = circleWidth * 0.34;
    const sinColor = cssVar('--accent-2');
    const cosColor = cssVar('--accent-3');
    const velocityColor = cssVar('--warn');
    const muted = cssVar('--muted');

    drawAxes(ctx, circleWidth, h, { ox: cx, oy: cy, scale: r }, ['Re', 'Im']);
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    const th = theta.current;
    const px = cx + r * Math.cos(th);
    const py = cy - r * Math.sin(th);
    const traceStart = circleWidth + 16;
    const traceEnd = w - 8;

    // shadows: dashed lines to the real axis (cos) and to the start of the sine trace
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = sinColor;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(traceStart, py);
    ctx.stroke();
    ctx.strokeStyle = cosColor;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cosColor;
    ctx.beginPath();
    ctx.arc(px, cy, 5, 0, 2 * Math.PI);
    ctx.fill();

    drawArrow(ctx, cx, cy, px, py, cssVar('--accent'), 3);
    ctx.font = '13px system-ui, sans-serif';

    if (showVelocity) {
      // v = iωz: the position turned by 90° and scaled by ω
      const k = r * 0.3 * omega;
      const vx = px - Math.sin(th) * k;
      const vy = py - Math.cos(th) * k;
      drawArrow(ctx, px, py, vx, vy, velocityColor, 2.5);
      ctx.fillStyle = velocityColor;
      ctx.fillText('dz/dt = iωz', vx + 6, vy - 4);
    }
    ctx.fillStyle = cosColor;
    ctx.fillText('Re z = cos ωt', 8, h - 10);

    if (traceEnd - traceStart > 80) {
      ctx.strokeStyle = cssVar('--axis');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(traceStart, cy);
      ctx.lineTo(traceEnd, cy);
      ctx.stroke();

      const angles = history.current;
      const step = (traceEnd - traceStart) / HISTORY;
      ctx.strokeStyle = sinColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      angles.forEach((angle, i) => {
        const x = traceStart + (angles.length - 1 - i) * step; // newest sample sits next to the circle
        const y = cy - r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = sinColor;
      ctx.fillText('Im z = sin ωt', traceStart + 6, 18);
      ctx.fillStyle = muted;
      ctx.fillText(pick({ en: 'earlier →', fi: 'aiemmin →' }), traceEnd - 70, h - 10);
    }
  }

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={320}
        running={playing}
        onTick={onTick}
        label={pick({ en: 'A point rotating on the unit circle and its sine shadow', fi: 'Yksikköympyrällä pyörivä piste ja sen sinivarjo' })}
      />
      <div class="controls">
        <Slider label="ω" min={0.2} max={4} step={0.1} value={omega} onInput={setOmega} display={`${fixed(omega, 1)} rad/s`} />
        <button type="button" class="btn btn--ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? pick({ en: 'Pause', fi: 'Tauko' }) : pick({ en: 'Play', fi: 'Toista' })}
        </button>
        <label class="check">
          <input type="checkbox" checked={showVelocity} onChange={(e) => setShowVelocity((e.target as HTMLInputElement).checked)} />
          {pick({ en: 'Show velocity', fi: 'Näytä nopeus' })}
        </label>
        <span class="readout">T = 2π/ω = {fixed((2 * Math.PI) / omega)} s</span>
      </div>
    </div>
  );
}
