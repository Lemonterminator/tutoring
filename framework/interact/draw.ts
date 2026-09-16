export function cssVar(name: string, fallback = '#888'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function drawArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width = 2.5): void {
  const length = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  if (length > 1) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const head = Math.min(12, length * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
    ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Origin in CSS pixels and pixels per unit. */
export type Frame = { ox: number; oy: number; scale: number };

export function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, frame: Frame, labels: [string, string]): void {
  const { ox, oy, scale } = frame;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = cssVar('--grid');
  for (let gx = Math.ceil(-ox / scale); gx <= (w - ox) / scale; gx++) {
    ctx.beginPath();
    ctx.moveTo(ox + gx * scale, 0);
    ctx.lineTo(ox + gx * scale, h);
    ctx.stroke();
  }
  for (let gy = Math.ceil((oy - h) / scale); gy <= oy / scale; gy++) {
    ctx.beginPath();
    ctx.moveTo(0, oy - gy * scale);
    ctx.lineTo(w, oy - gy * scale);
    ctx.stroke();
  }
  ctx.strokeStyle = cssVar('--axis');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(w, oy);
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, h);
  ctx.stroke();
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(labels[0], w - 8 - ctx.measureText(labels[0]).width, oy - 8);
  ctx.fillText(labels[1], ox + 8, 16);
  ctx.restore();
}
