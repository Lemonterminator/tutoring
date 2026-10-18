/** All label bounds are in CSS pixels, so zoom never shrinks text into illegibility. */
export type LabelBox = { x: number; y: number; width: number; height: number };

export function overlaps(a: LabelBox, b: LabelBox, gap = 3): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function wrapLabel(text: string, measure: (text: string) => number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) { lines.push(line); line = ''; }
    if (line) line += ' ';
    // Split unusually long tokens as well as ordinary space-separated names.
    for (const char of word) {
      if (line && measure(line + char) > width) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function placeLabel(x: number, y: number, radius: number, width: number, height: number,
  viewport: LabelBox, blocked: readonly LabelBox[], important: boolean): LabelBox | null {
  const offset = radius + 10;
  const candidates: LabelBox[] = [
    { x: x + offset, y: y - height / 2, width, height },
    { x: x - offset - width, y: y - height / 2, width, height },
    { x: x - width / 2, y: y - offset - height, width, height },
    { x: x - width / 2, y: y + offset, width, height },
    { x: x + offset, y: y - offset - height, width, height },
    { x: x - offset - width, y: y + offset, width, height },
  ];
  if (important) {
    // Crowded selections can use a free corner, with a leader back to their node.
    candidates.push(
      { x: viewport.x + 8, y: viewport.y + 8, width, height },
      { x: viewport.x + viewport.width - width - 8, y: viewport.y + 8, width, height },
    );
  }
  return candidates.find((box) => box.x >= viewport.x && box.y >= viewport.y
    && box.x + box.width <= viewport.x + viewport.width
    && box.y + box.height <= viewport.y + viewport.height
    && !blocked.some((other) => overlaps(box, other))) ?? null;
}
