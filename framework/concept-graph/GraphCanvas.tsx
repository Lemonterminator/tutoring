import { useEffect, useRef, useState } from 'preact/hooks';
import { drawArrow } from '../interact/draw';
import { courseLabel, type ConceptNode, type ConceptEdge } from './model';
import type { Positions, Point } from './layout';
import { placeLabel, wrapLabel, type LabelBox } from './labels';
import { onThemeChange } from '../theme/theme-state';

type Camera = { x: number; y: number; scale: number };
type Props = {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  positions: Positions;
  selected: string | null;
  ancestors: ReadonlySet<string>;
  descendants: ReadonlySet<string>;
  queryHits: ReadonlySet<string> | null;
  onSelect: (id: string | null) => void;
};
const NODE_SIZE_SPREAD = 2.5;
const radius = (node: ConceptNode) => 3 + NODE_SIZE_SPREAD * Math.min(9, Math.sqrt(Math.max(0, node.degree)) * 1.5);
const clampScale = (value: number) => Math.max(0.06, Math.min(8, value));

export function GraphCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labels = useRef<(LabelBox & { id: string })[]>([]);
  const camera = useRef<Camera>({ x: 0, y: 0, scale: 0.6 });
  const previousSize = useRef({ width: 0, height: 0 });
  const hovered = useRef<string | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const drag = useRef<{ origin: Point; camera: Camera; moved: boolean } | null>(null);
  const pinch = useRef<{ center: Point; distance: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pendingFit = useRef(true);
  const latest = useRef(props);
  latest.current = props;
  const [zoom, setZoom] = useState(0.6);
  const paintRef = useRef(() => {});

  const schedulePaint = () => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => { frame.current = null; paintRef.current(); });
  };
  const fit = () => { pendingFit.current = true; schedulePaint(); };
  const zoomAt = (factor: number, point: Point) => {
    const view = camera.current;
    const scale = clampScale(view.scale * factor), actual = scale / view.scale;
    view.x = point.x - (point.x - view.x) * actual;
    view.y = point.y - (point.y - view.y) * actual;
    view.scale = scale;
    setZoom(scale); schedulePaint();
  };
  const centerPoint = () => ({ x: (canvasRef.current?.clientWidth ?? 600) / 2, y: (canvasRef.current?.clientHeight ?? 480) / 2 });
  const focusSelection = () => {
    const point = latest.current.selected ? latest.current.positions[latest.current.selected] : null;
    if (!point) return;
    pendingFit.current = false;
    const center = centerPoint(), view = camera.current;
    view.scale = Math.max(1.2, view.scale);
    view.x = center.x - point.x * view.scale; view.y = center.y - point.y * view.scale;
    setZoom(view.scale); schedulePaint();
  };

  paintRef.current = () => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { nodes, edges, positions, selected, ancestors, descendants, queryHits } = latest.current;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    }
    const view = camera.current;
    if (pendingFit.current && nodes.length) {
      const points = nodes.map((node) => positions[node.id]).filter(Boolean);
      if (points.length) {
        const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        view.scale = clampScale(Math.min((width - 60) / (x1 - x0 + 60), (height - 60) / (y1 - y0 + 60)));
        view.x = width / 2 - (x0 + x1) / 2 * view.scale;
        view.y = height / 2 - (y0 + y1) / 2 * view.scale;
        setZoom(view.scale);
      }
      pendingFit.current = false;
    } else if (previousSize.current.width) {
      view.x += (width - previousSize.current.width) / 2;
      view.y += (height - previousSize.current.height) / 2;
    }
    previousSize.current = { width, height };
    const theme = getComputedStyle(canvas);
    const color = (name: string, fallback = '#888') => theme.getPropertyValue(name).trim() || fallback;
    const ink = color('--text'), muted = color('--muted'), accent = color('--accent'), successor = color('--accent-2');
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const highlight = selected ? new Set([selected, ...ancestors, ...descendants]) : null;
    // Include direct course/topic relations when a course hub is selected.
    if (highlight) for (const edge of edges) {
      if (edge.src === selected) highlight.add(edge.dst);
      if (edge.dst === selected) highlight.add(edge.src);
    }
    const candidates: { node: ConceptNode; x: number; y: number; r: number; priority: number }[] = [];
    const blocked: LabelBox[] = [];
    labels.current = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.scale, view.scale);
    for (const edge of edges) {
      const a = positions[edge.src], b = positions[edge.dst];
      if (!a || !b) continue;
      const prerequisite = edge.rel === 'prerequisite_of', excluded = prerequisite && !edge.in_dag;
      const relevant = highlight?.has(edge.src) && highlight.has(edge.dst)
        && (prerequisite || edge.src === selected || edge.dst === selected);
      if (highlight && !relevant) continue;
      ctx.globalAlpha = highlight ? 0.55 : (prerequisite ? 0.22 : 0.12);
      const stroke = excluded ? muted : (highlight ? (ancestors.has(edge.src) ? accent : descendants.has(edge.dst) ? successor : muted) : muted);
      const lineWidth = (highlight ? 1.6 : 0.7) / Math.sqrt(view.scale) * (0.5 + edge.confidence * 0.6);
      ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth;
      ctx.setLineDash(excluded ? [7, 4] : prerequisite ? [] : [3, 4]);
      if (prerequisite && view.scale > 0.55) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const inset = radius(byId.get(edge.dst)!) + 2;
        drawArrow(ctx, a.x, a.y, b.x - (b.x - a.x) / distance * inset, b.y - (b.y - a.y) / distance * inset, stroke, lineWidth);
      } else {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    for (const node of nodes) {
      const point = positions[node.id];
      if (!point) continue;
      const dimmed = Boolean((highlight && !highlight.has(node.id)) || (queryHits && !queryHits.has(node.id)));
      const r = radius(node);
      const x = point.x * view.scale + view.x, y = point.y * view.scale + view.y;
      const screenRadius = r * view.scale;
      if (x + screenRadius < 0 || x - screenRadius > width || y + screenRadius < 0 || y - screenRadius > height) continue;
      const outer = (r + 6) * view.scale + 2;
      blocked.push({ x: x - outer, y: y - outer, width: outer * 2, height: outer * 2 });
      ctx.globalAlpha = dimmed ? 0.14 : 1;
      ctx.fillStyle = selected && ancestors.has(node.id) ? accent : selected && descendants.has(node.id) ? successor
        : color(`--graph-${courseLabel(node.courses[0])}`, accent);
      ctx.beginPath(); ctx.arc(point.x, point.y, r, 0, Math.PI * 2); ctx.fill();
      if (node.courses.length > 1) { ctx.lineWidth = 2 / Math.sqrt(view.scale); ctx.strokeStyle = ink; ctx.stroke(); }
      if (node.status === 'needs_review') {
        ctx.lineWidth = 1.7 / Math.sqrt(view.scale); ctx.strokeStyle = color('--warn');
        ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(point.x, point.y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (node.id === selected || node.id === hovered.current) {
        ctx.lineWidth = 2.5 / Math.sqrt(view.scale); ctx.strokeStyle = accent;
        ctx.beginPath(); ctx.arc(point.x, point.y, r + 6, 0, Math.PI * 2); ctx.stroke();
      }
      if ((!dimmed && view.scale > 1.1) || node.id === selected || node.id === hovered.current
        || (highlight?.has(node.id) && !dimmed && (view.scale > 0.5 || nodes.length <= 40)) || queryHits?.has(node.id)) {
        const priority = node.id === selected ? 4 : node.id === hovered.current ? 3 : queryHits?.has(node.id) ? 2 : highlight?.has(node.id) ? 1 : 0;
        candidates.push({ node, x, y, r: outer, priority });
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
    // Draw labels after every edge and node, in screen space, with collision-free bounds.
    candidates.sort((a, b) => b.priority - a.priority || b.node.degree - a.node.degree || a.node.id.localeCompare(b.node.id));
    const viewport: LabelBox = { x: 8, y: 8, width: Math.max(0, width - 16), height: Math.max(0, height - 16) };
    const placed: { item: typeof candidates[number]; box: LabelBox; lines: string[]; important: boolean }[] = [];
    for (const item of candidates) {
      const important = item.priority >= 3;
      ctx.font = `${item.node.id === selected ? '600' : '400'} 12px system-ui`;
      const lines = wrapLabel(item.node.name, (text) => ctx.measureText(text).width, Math.min(180, width - 44));
      const labelWidth = Math.max(...lines.map((text) => ctx.measureText(text).width)) + 14;
      const labelHeight = lines.length * 16 + 10;
      const box = placeLabel(item.x, item.y, item.r, labelWidth, labelHeight, viewport, blocked, important);
      if (!box) continue;
      blocked.push(box); labels.current.push({ ...box, id: item.node.id });
      placed.push({ item, box, lines, important });
    }
    for (const { item, box, important } of placed) {
      // The leader makes labels placed above/below a node or in a free corner unambiguous.
      ctx.strokeStyle = important ? accent : color('--border'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(item.x, item.y);
      ctx.lineTo(Math.max(box.x, Math.min(box.x + box.width, item.x)), Math.max(box.y, Math.min(box.y + box.height, item.y))); ctx.stroke();
    }
    for (const { item, box, lines, important } of placed) {
      ctx.font = `${item.node.id === selected ? '600' : '400'} 12px system-ui`;
      ctx.fillStyle = color('--surface'); ctx.fillRect(box.x, box.y, box.width, box.height);
      if (important) { ctx.strokeStyle = accent; ctx.strokeRect(box.x, box.y, box.width, box.height); }
      ctx.fillStyle = ink; ctx.textBaseline = 'top';
      lines.forEach((text, index) => ctx.fillText(text, box.x + 7, box.y + 5 + index * 16));
    }
  };

  useEffect(() => { pendingFit.current = true; schedulePaint(); }, [props.positions]);
  useEffect(() => { pendingFit.current = true; schedulePaint(); }, [props.nodes.map((node) => node.id).join('|')]);
  useEffect(() => {
    if (!props.selected) { schedulePaint(); return; }
    const point = props.positions[props.selected];
    if (point) {
      const center = centerPoint();
      camera.current.x = center.x - point.x * camera.current.scale;
      camera.current.y = center.y - point.y * camera.current.scale;
    }
    schedulePaint();
  }, [props.selected]);
  useEffect(() => schedulePaint());
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedulePaint) : null;
    observer?.observe(canvas);
    // Repaint when <html data-theme> changes or, for Auto, when the OS colour scheme changes.
    const stopTheme = onThemeChange(schedulePaint);
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const rect = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0012), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer?.disconnect(); stopTheme();
      canvas.removeEventListener('wheel', wheel);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const eventPoint = (event: PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const pick = (point: Point): string | null => {
    const label = labels.current.find((box) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height);
    if (label) return label.id;
    const view = camera.current, x = (point.x - view.x) / view.scale, y = (point.y - view.y) / view.scale;
    let closest: string | null = null, distance = Infinity;
    for (const node of latest.current.nodes) {
      const position = latest.current.positions[node.id];
      if (!position) continue;
      const delta = Math.hypot(position.x - x, position.y - y);
      if (delta < radius(node) + 4 / view.scale && delta < distance) { closest = node.id; distance = delta; }
    }
    return closest;
  };
  const pinchValue = () => {
    const [a, b] = [...pointers.current.values()];
    return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const point = eventPoint(event);
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) drag.current = { origin: point, camera: { ...camera.current }, moved: false };
    if (pointers.current.size >= 2) { pinch.current = pinchValue(); if (drag.current) drag.current.moved = true; }
  };
  const pointerMove = (event: PointerEvent) => {
    const point = eventPoint(event);
    if (!pointers.current.has(event.pointerId)) {
      hovered.current = pick(point); schedulePaint(); return;
    }
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size >= 2 && pinch.current) {
      const next = pinchValue(), previous = pinch.current;
      zoomAt(next.distance / previous.distance, previous.center);
      camera.current.x += next.center.x - previous.center.x;
      camera.current.y += next.center.y - previous.center.y;
      pinch.current = next;
    } else if (drag.current) {
      const dx = point.x - drag.current.origin.x, dy = point.y - drag.current.origin.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      camera.current.x = drag.current.camera.x + dx; camera.current.y = drag.current.camera.y + dy;
    }
    schedulePaint();
  };
  const pointerUp = (event: PointerEvent) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (event.type !== 'pointercancel' && !drag.current?.moved && pointers.current.size === 0) latest.current.onSelect(pick(eventPoint(event)));
    pinch.current = null;
    if (pointers.current.size === 1) {
      drag.current = { origin: [...pointers.current.values()][0], camera: { ...camera.current }, moved: true };
    } else drag.current = null;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === '+' || event.key === '=') zoomAt(1.25, centerPoint());
    else if (event.key === '-') zoomAt(0.8, centerPoint());
    else if (event.key === 'Home') fit();
    else if (event.key === 'Escape') latest.current.onSelect(null);
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      camera.current.x += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
      camera.current.y += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
      schedulePaint();
    } else return;
    event.preventDefault();
  };

  return <div class="concept-canvas">
    <canvas ref={canvasRef} tabIndex={0} role="img"
      aria-label="课程概念图谱。可拖动平移、滚轮或双指缩放；键盘方向键平移，加减键缩放，Home 适应全图。也可用上方概念选择框查看节点。"
      onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={pointerUp} onPointerLeave={() => { hovered.current = null; schedulePaint(); }} />
    <div class="concept-canvas__tools" role="group" aria-label="图谱视图控制">
      <button class="btn btn--ghost" type="button" aria-label="缩小图谱" onClick={() => zoomAt(0.8, centerPoint())}>−</button>
      <button class="btn btn--ghost" type="button" aria-label="放大图谱" onClick={() => zoomAt(1.25, centerPoint())}>＋</button>
      <button class="btn btn--ghost" type="button" onClick={fit}>适应全图</button>
      <button class="btn btn--ghost" type="button" disabled={!props.selected || !props.positions[props.selected] || !props.nodes.some((node) => node.id === props.selected)} onClick={focusSelection}>聚焦所选</button>
      <span>缩放 {zoom.toFixed(2)}</span>
    </div>
    {props.nodes.length === 0 && <p class="concept-canvas__empty">没有显示的概念，请选择至少一门课程。</p>}
  </div>;
}
