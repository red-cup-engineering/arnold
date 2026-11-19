// layout — box + flex region arithmetic. A Rect is { row, col, width, height } in the parent
// buffer's coordinates. Layout is PURE geometry: given a container Rect and child specs, it
// computes each child's Rect. Widgets then draw into those Rects. No buffer, no I/O here — layout
// only divides space, so it is trivially testable (a Rect in, Rects out).
//
// flex(container, children, opts) — split a Rect along an axis. Each child carries either a fixed
// `size` (rows or cols, depending on direction) or a `grow` weight; fixed sizes are taken first and
// the remainder is shared among growers by weight. `gap` inserts blank tracks between children.

export function rect(row, col, width, height) {
  return { row: row | 0, col: col | 0, width: Math.max(0, width | 0), height: Math.max(0, height | 0) };
}

// inset(r, top, right, bottom, left) — shrink a Rect by per-side padding (a number applies to all
// sides). Returns a Rect clamped to non-negative size. Used for box borders + padding.
export function inset(r, top = 0, right = top, bottom = top, left = right) {
  return rect(
    r.row + top,
    r.col + left,
    Math.max(0, r.width - left - right),
    Math.max(0, r.height - top - bottom),
  );
}

// flex(container, children, { direction, gap }) — direction "row" splits horizontally (children
// side by side, `size`/`grow` are COLUMN widths); "column" splits vertically (`size`/`grow` are
// ROW heights). Returns an array of Rects, one per child, in order. A child is
// { size?: number, grow?: number }; default grow 1 when neither is given.
export function flex(container, children, opts = {}) {
  const direction = opts.direction || "row";
  const gap = Math.max(0, opts.gap | 0);
  const horizontal = direction === "row";
  const total = horizontal ? container.width : container.height;
  const n = children.length;
  if (n === 0) return [];

  const gapTotal = gap * (n - 1);
  let avail = Math.max(0, total - gapTotal);

  // Pass 1: fixed sizes.
  let fixed = 0, growSum = 0;
  for (const ch of children) {
    if (ch && typeof ch.size === "number") fixed += Math.max(0, ch.size | 0);
    else growSum += ch && typeof ch.grow === "number" ? Math.max(0, ch.grow) : 1;
  }
  let remaining = Math.max(0, avail - fixed);

  // Pass 2: distribute the remainder among growers by weight, giving leftover pixels to the
  // earliest growers so the tracks sum EXACTLY to `avail` (no off-by-one gaps).
  const sizes = new Array(n);
  let growAccountedRemainder = remaining;
  let distributed = 0;
  for (let i = 0; i < n; i++) {
    const ch = children[i];
    if (ch && typeof ch.size === "number") { sizes[i] = Math.max(0, ch.size | 0); continue; }
    const weight = ch && typeof ch.grow === "number" ? Math.max(0, ch.grow) : 1;
    const share = growSum > 0 ? Math.floor((growAccountedRemainder * weight) / growSum) : 0;
    sizes[i] = share;
    distributed += share;
  }
  // hand any rounding leftover to the grower tracks, earliest first
  let leftover = remaining - distributed;
  if (leftover > 0) {
    for (let i = 0; i < n && leftover > 0; i++) {
      const ch = children[i];
      const isGrow = !(ch && typeof ch.size === "number");
      if (isGrow) { sizes[i] += 1; leftover -= 1; }
    }
  }

  // Lay the tracks out along the axis, inserting gaps.
  const rects = new Array(n);
  let cursor = horizontal ? container.col : container.row;
  for (let i = 0; i < n; i++) {
    const sz = sizes[i];
    rects[i] = horizontal
      ? rect(container.row, cursor, sz, container.height)
      : rect(cursor, container.col, container.width, sz);
    cursor += sz + (i < n - 1 ? gap : 0);
  }
  return rects;
}

// stack(container, heights) — convenience: a column flex of fixed-height children, remainder to the
// last. Returns Rects. (heights is an array; a null/undefined entry grows.)
export function stack(container, heights) {
  return flex(
    container,
    heights.map((h) => (h == null ? { grow: 1 } : { size: h })),
    { direction: "column" },
  );
}

// center(container, width, height) — a Rect of the given size centered in the container, clamped.
export function center(container, width, height) {
  const w = Math.min(width, container.width);
  const h = Math.min(height, container.height);
  return rect(
    container.row + Math.floor((container.height - h) / 2),
    container.col + Math.floor((container.width - w) / 2),
    w, h,
  );
}
