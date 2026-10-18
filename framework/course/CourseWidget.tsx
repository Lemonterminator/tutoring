import { useEffect, useMemo, useState } from 'preact/hooks';
import { Figure, useReportState } from '../ask/Figure';
import { Slider, Segmented } from '../interact/Controls';
import { SimCanvas } from '../interact/SimCanvas';
import { courseLang } from '../i18n/course-state';
import { resolvedTheme } from '../theme/theme-state';
import { getWidget, type Control, type WidgetDefinition } from './widget-registry';

type Props = { id: string };
type JsonObject = Record<string, unknown>;
type Point = { x: number; y: number };

function cloneInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  return { ...inputs };
}

function numeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function matrixCandidate(value: unknown): number[][] | null {
  if (Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row) && row.length > 0 && row.every(numeric))) {
    return value as number[][];
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const candidate = matrixCandidate(child);
      if (candidate) return candidate;
    }
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as JsonObject)) {
      const candidate = matrixCandidate(child);
      if (candidate) return candidate;
    }
  }
  return null;
}

function pointCandidate(value: unknown): Point[] | null {
  if (Array.isArray(value) && value.length > 1) {
    const points = value.flatMap((item, index) => {
      if (Array.isArray(item) && item.length >= 2 && numeric(item[0]) && numeric(item[1])) return [{ x: item[0], y: item[1] }];
      if (item && typeof item === 'object') {
        const row = item as JsonObject;
        const x = [row.x, row.t, row.step, row.lag, row.k, index].find(numeric);
        const y = [row.y, row.value, row.loss, row.accuracy, row.offManifoldProbability].find(numeric);
        if (numeric(x) && numeric(y)) return [{ x, y }];
      }
      return [];
    });
    if (points.length > 1) return points;
    for (const child of value) {
      const candidate = pointCandidate(child);
      if (candidate) return candidate;
    }
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as JsonObject)) {
      const candidate = pointCandidate(child);
      if (candidate) return candidate;
    }
  }
  return null;
}

function numberArrayCandidate(value: unknown): number[] | null {
  if (Array.isArray(value) && value.length > 1 && value.every(numeric)) return value as number[];
  if (Array.isArray(value)) {
    for (const child of value) {
      const candidate = numberArrayCandidate(child);
      if (candidate) return candidate;
    }
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as JsonObject)) {
      const candidate = numberArrayCandidate(child);
      if (candidate) return candidate;
    }
  }
  return null;
}

function css(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, left = 36, bottom = 24) {
  ctx.strokeStyle = css('--axis', '#9aa2ae');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, 8);
  ctx.lineTo(left, h - bottom);
  ctx.lineTo(w - 8, h - bottom);
  ctx.stroke();
}

function drawMatrix(ctx: CanvasRenderingContext2D, matrix: number[][], w: number, h: number) {
  const rows = matrix.length;
  const cols = Math.max(...matrix.map((row) => row.length));
  const max = Math.max(...matrix.flat().map(Math.abs), 1e-12);
  const left = 36;
  const top = 10;
  const cellW = Math.max(1, (w - left - 8) / cols);
  const cellH = Math.max(1, (h - top - 24) / rows);
  const dark = resolvedTheme() === 'dark';
  ctx.fillStyle = css('--surface', '#fff');
  ctx.fillRect(0, 0, w, h);
  matrix.forEach((row, r) => row.forEach((value, c) => {
    const intensity = Math.min(1, Math.abs(value) / max);
    const hue = value >= 0 ? 214 : 8;
    // Light theme: pale to saturated; dark theme: near-surface dark to saturated, so faint cells do not glare.
    const lightness = dark ? 20 + 32 * intensity : 96 - 54 * intensity;
    ctx.fillStyle = `hsl(${hue} 72% ${lightness}%)`;
    ctx.fillRect(left + c * cellW, top + r * cellH, Math.ceil(cellW), Math.ceil(cellH));
  }));
  ctx.strokeStyle = css('--border', '#e3e0d8');
  ctx.strokeRect(left, top, cellW * cols, cellH * rows);
  ctx.fillStyle = css('--muted', '#5d6675');
  ctx.font = '12px system-ui';
  ctx.fillText(`${rows} × ${cols}`, 8, h - 7);
}

function drawSeries(ctx: CanvasRenderingContext2D, points: Point[], w: number, h: number) {
  const left = 36;
  const bottom = 24;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs, minX + 1);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys, minY + 1e-9);
  const mapX = (x: number) => left + ((x - minX) / (maxX - minX)) * (w - left - 8);
  const mapY = (y: number) => h - bottom - ((y - minY) / (maxY - minY)) * (h - bottom - 18);
  ctx.fillStyle = css('--surface', '#fff');
  ctx.fillRect(0, 0, w, h);
  drawAxes(ctx, w, h, left, bottom);
  ctx.strokeStyle = css('--accent', '#2f6fdb');
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = mapX(point.x);
    const y = mapY(point.y);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = css('--muted', '#5d6675');
  ctx.font = '12px system-ui';
  ctx.fillText(`x: ${minX.toPrecision(3)}…${maxX.toPrecision(3)}`, 42, h - 8);
  ctx.fillText(`y: ${minY.toPrecision(3)}…${maxY.toPrecision(3)}`, Math.max(42, w - 130), 16);
}

function drawBars(ctx: CanvasRenderingContext2D, values: number[], w: number, h: number) {
  const left = 36;
  const bottom = 24;
  const max = Math.max(...values.map(Math.abs), 1e-9);
  ctx.fillStyle = css('--surface', '#fff');
  ctx.fillRect(0, 0, w, h);
  drawAxes(ctx, w, h, left, bottom);
  const barW = (w - left - 12) / values.length;
  values.forEach((value, index) => {
    const height = (Math.abs(value) / max) * (h - bottom - 20);
    ctx.fillStyle = value >= 0 ? css('--accent', '#2f6fdb') : css('--accent-2', '#d9480f');
    ctx.fillRect(left + index * barW + 1, h - bottom - height, Math.max(1, barW - 2), height);
  });
}

function drawOutput(ctx: CanvasRenderingContext2D, w: number, h: number, output: unknown) {
  const matrix = matrixCandidate(output);
  if (matrix) return drawMatrix(ctx, matrix, w, h);
  const points = pointCandidate(output);
  if (points) return drawSeries(ctx, points, w, h);
  const values = numberArrayCandidate(output);
  if (values) return drawBars(ctx, values.slice(0, 128), w, h);
  ctx.fillStyle = css('--surface', '#fff');
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css('--muted', '#5d6675');
  ctx.font = '14px system-ui';
  ctx.fillText('Structured output is shown below.', 16, 28);
}

function compactJson(output: unknown): string {
  try {
    const text = JSON.stringify(output, (_key, value) => {
      if (Array.isArray(value) && value.length > 16) return [...value.slice(0, 16), `… (${value.length} items)`];
      return value;
    }, 2);
    return text.length > 2400 ? `${text.slice(0, 2400)}\n…` : text;
  } catch {
    return String(output);
  }
}

function ControlView({ control, value, onChange }: { control: Control; value: unknown; onChange: (value: unknown) => void }) {
  if (control.kind === 'number') {
    return <Slider label={control.label} min={control.min} max={control.max} step={control.step} value={Number(value ?? control.min)} onInput={onChange as (value: number) => void} />;
  }
  if (control.kind === 'select') {
    return <Segmented label={control.label} options={control.options} value={String(value ?? control.options[0]?.value ?? '')} onChange={onChange as (value: string) => void} />;
  }
  return <label class="check"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange((event.target as HTMLInputElement).checked)} />{control.label}</label>;
}

export function CourseWidget({ id }: Props) {
  const definition: WidgetDefinition = getWidget(id);
  const lang = courseLang.value;
  const [inputs, setInputs] = useState<Record<string, unknown>>(() => cloneInputs(definition.defaults));
  const [step, setStep] = useState(0);
  const report = useReportState();
  const output = useMemo(() => {
    try {
      return definition.compute(inputs, { ...definition.state, step, max_steps: definition.maxSteps ?? 40, seed: Number(inputs.seed ?? definition.state.seed ?? 7) });
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [definition, inputs, step]);

  useEffect(() => {
    report({ widgetId: id, derivation: definition.derivation, inputs, step });
  }, [definition, id, inputs, report, step]);

  const setInput = (name: string, value: unknown) => setInputs((current) => ({ ...current, [name]: value }));
  const reset = () => {
    setInputs(cloneInputs(definition.defaults));
    setStep(0);
  };
  const advance = () => setStep((current) => Math.min(definition.maxSteps ?? 40, current + 1));

  return (
    <Figure id={id}>
      <div class="course-widget">
        <div class="course-widget__head">
          <div>
            <div class="course-widget__title">{definition.title[lang]}</div>
            <div class="course-widget__meta">{id} · {definition.derivation}</div>
          </div>
          <span class="course-widget__kind">{definition.kind}</span>
        </div>
        <div class="course-widget__equation"><code>{definition.equation}</code></div>
        {definition.controls.length > 0 && <div class="controls course-widget__controls">{definition.controls.map((control) => <ControlView key={control.name} control={control} value={inputs[control.name]} onChange={(value) => setInput(control.name, value)} />)}</div>}
        <div class="course-widget__actions">
          <button type="button" class="btn btn--ghost" onClick={reset}>Reset</button>
          {(definition.kind === 'trainer' || definition.kind === 'animation') && <button type="button" class="btn" onClick={advance} disabled={step >= (definition.maxSteps ?? 40)}>Step {step + 1}</button>}
          {(definition.kind === 'trainer' || definition.kind === 'animation') && <span class="readout">step {step}</span>}
        </div>
        <div class="course-widget__canvas"><SimCanvas label={`${definition.title.en} visualization`} height={270} draw={(ctx, w, h) => drawOutput(ctx, w, h, output)} /></div>
        <p class="course-widget__insight">{definition.insight[lang]}</p>
        <details class="course-widget__details">
          <summary>Computed output</summary>
          <pre class="course-widget__json">{compactJson(output)}</pre>
        </details>
      </div>
    </Figure>
  );
}
