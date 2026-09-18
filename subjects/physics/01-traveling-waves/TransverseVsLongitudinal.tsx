import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Segmented } from '../../../framework/interact/Controls';
import { cssVar } from '../../../framework/interact/draw';
import { SimCanvas } from '../../../framework/interact/SimCanvas';
import { displacement, fromLambdaAndPeriod, pressure } from './wave1d';

type Mode = 'transverse' | 'longitudinal';

const WAVE = fromLambdaAndPeriod(1, 2, 1); // λ = 2 m, T = 1 s: slow enough to watch
const X_MAX = 6;
const PARTICLES = 90;
const HEIGHT = 340;
const BULK = 1; // arbitrary units: only the shape and the phase of p matter here

export function TransverseVsLongitudinal() {
  const [mode, setMode] = useState<Mode>('transverse');
  const [playing, setPlaying] = useState(true);
  const [, repaint] = useState(0);
  const time = useRef(0);
  const report = useReportState();

  useEffect(() => report({ mode }), [mode]);

  function onTick(step: number) {
    time.current += step;
    repaint((n) => n + 1);
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = time.current;
    const left = 16;
    const right = w - 16;
    const span = right - left;
    const rowY = h * 0.26;
    const curveTop = h * 0.5;
    const curveBottom = h - 18;
    const curveMid = (curveTop + curveBottom) / 2;
    const amp = (curveBottom - curveTop) * 0.36;
    const perParticle = span / (PARTICLES - 1);

    ctx.fillStyle = cssVar('--accent');
    for (let i = 0; i < PARTICLES; i++) {
      const x = (i / (PARTICLES - 1)) * X_MAX;
      const value = displacement(WAVE, x, t);
      const baseX = left + (x / X_MAX) * span;
      const px = mode === 'longitudinal' ? baseX + value * perParticle * 2.4 : baseX;
      const py = mode === 'longitudinal' ? rowY : rowY - value * 28;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.strokeStyle = cssVar('--axis');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, curveMid);
    ctx.lineTo(right, curveMid);
    ctx.stroke();

    const plot = (value: (x: number) => number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 240; i++) {
        const x = (i / 240) * X_MAX;
        const px = left + (x / X_MAX) * span;
        const py = curveMid - value(x) * amp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    };

    plot((x) => displacement(WAVE, x, t), cssVar('--accent'));
    if (mode === 'longitudinal') {
      // p = −B ∂ξ/∂x, scaled by the wavenumber so both curves fit the same box
      plot((x) => pressure(WAVE, x, t, BULK) / WAVE.waveNumber, cssVar('--accent-2'));
    }
  }

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={HEIGHT}
        running={playing}
        onTick={onTick}
        label={pick({
          en: 'A row of particles carrying the same wave across the line or along it, with the displacement and pressure curves below',
          fi: 'Hiukkasrivi, joka kuljettaa saman aallon poikittain tai pitkittäin, ja alla siirtymä- ja painekuvaajat',
        })}
      />
      <div class="controls">
        <Segmented
          label={pick({ en: 'Wave type', fi: 'Aallon tyyppi' })}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'transverse', label: pick({ en: 'Transverse', fi: 'Poikittainen' }) },
            { value: 'longitudinal', label: pick({ en: 'Longitudinal', fi: 'Pitkittäinen' }) },
          ]}
        />
        <button type="button" class="btn btn--ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? pick({ en: 'Pause', fi: 'Tauko' }) : pick({ en: 'Play', fi: 'Toista' })}
        </button>
      </div>
      <div class="controls">
        <span class="readout readout--active">
          {pick({ en: 'blue: displacement', fi: 'sininen: siirtymä' })}
        </span>
        {mode === 'longitudinal' && (
          <span class="readout readout--active">
            {pick({ en: 'orange: pressure p', fi: 'oranssi: paine p' })}
          </span>
        )}
      </div>
      <p class="sim__hint">
        {mode === 'longitudinal'
          ? pick({
              en: 'Where the particles bunch together the pressure peaks, and there the displacement is zero. The two curves are a quarter of a cycle apart.',
              fi: 'Siellä missä hiukkaset tiivistyvät, paine on suurimmillaan ja siirtymä on nolla. Kuvaajat ovat neljänneksen jakson päässä toisistaan.',
            })
          : pick({
              en: 'Each particle only moves up and down. Nothing travels along the line except the shape.',
              fi: 'Jokainen hiukkanen liikkuu vain ylös ja alas. Mikään ei kulje riviä pitkin paitsi muoto.',
            })}
      </p>
    </div>
  );
}
