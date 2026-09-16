import { useEffect, useRef } from 'preact/hooks';
import { useAnimationFrame } from './useAnimationFrame';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
export type PointerInfo = { x: number; y: number; w: number; h: number; kind: 'down' | 'move' | 'up' };

type Props = {
  draw: Draw;
  label: string;
  height?: number;
  running?: boolean;
  onTick?: (dt: number) => void;
  onPointer?: (pointer: PointerInfo) => void;
};

export function SimCanvas({ draw, label, height = 320, running = false, onTick, onPointer }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paint = useRef(() => {});
  paint.current = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const pw = Math.round(w * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    draw(ctx, w, height);
  };

  useEffect(() => paint.current());

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => paint.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame(ref, (dt) => {
    onTick?.(dt);
    paint.current();
  }, running);

  const pointer = (kind: PointerInfo['kind']) => (event: PointerEvent) => {
    const canvas = ref.current;
    if (!onPointer || !canvas) return;
    if (kind === 'down') canvas.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    onPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: rect.width, h: rect.height, kind });
  };

  return (
    <canvas
      ref={ref}
      class="sim-canvas"
      style={{ height: `${height}px` }}
      role="img"
      aria-label={label}
      onPointerDown={pointer('down')}
      onPointerMove={pointer('move')}
      onPointerUp={pointer('up')}
      onPointerCancel={pointer('up')}
    />
  );
}
