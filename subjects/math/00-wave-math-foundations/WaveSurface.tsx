import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Segmented, Slider } from '../../../framework/interact/Controls';
import { cssVar, drawArrow } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas } from '../../../framework/interact/SimCanvas';
import { d2ydx2, dydt, dydx, y, type WaveParams } from './wave';

type Mode = 'dt' | 'dx' | 'dxx';

const WAVE: WaveParams = { A: 1, k: (2 * Math.PI) / 4, omega: (2 * Math.PI) / 3 };
const X_MAX = 8;
const TRACE_SAMPLES = 300;
const READOUT_SECONDS = 0.15;
const ROPE_SEGMENTS = 240;

export function WaveSurface() {
  const [mode, setMode] = useState<Mode>('dt');
  const [x0, setX0] = useState(2);
  const [playing, setPlaying] = useState(true);
  const [, refreshReadouts] = useState(0);
  const time = useRef(0);
  const trace = useRef<number[]>([]);
  const sinceReadout = useRef(0);
  const report = useReportState();

  useEffect(() => report({ mode, x0 }), [mode, x0]);

  function chooseMode(next: Mode) {
    setMode(next);
    setPlaying(next === 'dt'); // "freeze time" modes start paused
  }

  function onTick(dt: number) {
    time.current += dt;
    trace.current.push(y(WAVE, x0, time.current));
    if (trace.current.length > TRACE_SAMPLES) trace.current.shift();
    sinceReadout.current += dt;
    if (sinceReadout.current > READOUT_SECONDS) {
      sinceReadout.current = 0;
      refreshReadouts((n) => n + 1);
    }
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = time.current;
    const ropeHeight = h * 0.62;
    const left = 16;
    const right = w - 16;
    const sx = (right - left) / X_MAX;
    const sy = ropeHeight * 0.3;
    const oy = ropeHeight / 2;
    const X = (x: number) => left + x * sx;
    const Y = (v: number) => oy - v * sy;
    const accent = cssVar('--accent');
    const probeColor = cssVar('--accent-2');
    const bendsUp = cssVar('--accent-3');
    const bendsDown = cssVar('--warn');
    const axis = cssVar('--axis');
    const muted = cssVar('--muted');

    ctx.strokeStyle = axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, oy);
    ctx.lineTo(right, oy);
    ctx.stroke();

    ctx.lineWidth = 3;
    for (let i = 0; i < ROPE_SEGMENTS; i++) {
      const xa = (i / ROPE_SEGMENTS) * X_MAX;
      const xb = ((i + 1) / ROPE_SEGMENTS) * X_MAX;
      ctx.strokeStyle = mode === 'dxx' ? (d2ydx2(WAVE, (xa + xb) / 2, t) >= 0 ? bendsUp : bendsDown) : accent;
      ctx.beginPath();
      ctx.moveTo(X(xa), Y(y(WAVE, xa, t)));
      ctx.lineTo(X(xb), Y(y(WAVE, xb, t)));
      ctx.stroke();
    }

    const px = X(x0);
    const yp = y(WAVE, x0, t);
    const py = Y(yp);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, ropeHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    if (mode === 'dt') drawArrow(ctx, px, py, px, py - dydt(WAVE, x0, t) * sy * 0.3, probeColor, 3);
    if (mode === 'dx') {
      const slope = dydx(WAVE, x0, t);
      ctx.strokeStyle = probeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(X(x0 - 0.8), Y(yp - 0.8 * slope));
      ctx.lineTo(X(x0 + 0.8), Y(yp + 0.8 * slope));
      ctx.stroke();
    }
    if (mode === 'dxx') {
      const bend = d2ydx2(WAVE, x0, t);
      drawArrow(ctx, px, py, px, py - bend * sy * 0.35, bend >= 0 ? bendsUp : bendsDown, 3);
    }
    ctx.fillStyle = probeColor;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fill();

    // lower strip: the probe's displacement over time
    const stripTop = ropeHeight + 18;
    const stripMid = (stripTop + h - 6) / 2;
    const stripAmp = (h - 6 - stripTop) * 0.42;
    ctx.fillStyle = muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(pick({ en: 'y at the probe over time (newest on the right)', fi: 'y mittapisteessä ajan funktiona (uusin oikealla)' }), left, ropeHeight + 12);
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, stripMid);
    ctx.lineTo(right, stripMid);
    ctx.stroke();
    const samples = trace.current;
    const step = (right - left) / TRACE_SAMPLES;
    ctx.strokeStyle = probeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    samples.forEach((value, i) => {
      const x = right - (samples.length - 1 - i) * step;
      const yy = stripMid - value * stripAmp;
      if (i === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    });
    ctx.stroke();
  }

  const t = time.current;
  const readouts: { key: Mode | 'y'; name: string; value: number }[] = [
    { key: 'y', name: 'y', value: y(WAVE, x0, t) },
    { key: 'dt', name: '∂y/∂t', value: dydt(WAVE, x0, t) },
    { key: 'dx', name: '∂y/∂x', value: dydx(WAVE, x0, t) },
    { key: 'dxx', name: '∂²y/∂x²', value: d2ydx2(WAVE, x0, t) },
  ];

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={360}
        running={playing}
        onTick={onTick}
        label={pick({ en: 'A sine wave on a rope with a movable probe', fi: 'Siniaalto köydessä ja siirrettävä mittapiste' })}
      />
      <div class="controls">
        <Segmented
          label={pick({ en: 'What to measure', fi: 'Mitä mitataan' })}
          value={mode}
          onChange={chooseMode}
          options={[
            { value: 'dt', label: `∂y/∂t · ${pick({ en: 'freeze place', fi: 'paikka kiinni' })}` },
            { value: 'dx', label: `∂y/∂x · ${pick({ en: 'freeze time', fi: 'aika pysäytetty' })}` },
            { value: 'dxx', label: `∂²y/∂x² · ${pick({ en: 'bending', fi: 'kaareutuminen' })}` },
          ]}
        />
        <button type="button" class="btn btn--ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? pick({ en: 'Pause', fi: 'Tauko' }) : pick({ en: 'Play', fi: 'Toista' })}
        </button>
      </div>
      <div class="controls">
        <Slider label={pick({ en: 'Probe position x', fi: 'Mittapisteen paikka x' })} min={0} max={X_MAX} step={0.05} value={x0} onInput={setX0} display={`${fixed(x0)} m`} />
      </div>
      <div class="controls">
        {readouts.map((r) => (
          <span key={r.key} class={`readout${r.key === mode ? ' readout--active' : ''}`}>
            {r.name} = {fixed(r.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
