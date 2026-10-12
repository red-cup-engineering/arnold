// widgets — the app-side drawing vocabulary. Each widget is a PURE function (state, rect) that
// draws into a Buffer at a Rect; none holds I/O or mutates anything but the buffer cells it is
// given. Widgets are the framework's "elements": box (a bordered panel), text (wrapped lines),
// list (selectable rows), table (aligned columns), input (an editable line with a cursor mark),
// and statusLine (a one-row bar). Domain projectors may map their data to these widgets; the
// widgets themselves know nothing about charges — they draw cells.

import { EMPTY_STYLE, displayWidth } from "./ansi.mjs";
import { inset } from "./layout.mjs";

// === box ====================================================================================
// Single-line box-drawing glyphs. A box draws a border + optional title, and returns its INNER
// Rect (the content area) so a caller can draw children inside.
const BORDER = { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│" };

export function box(buf, r, opts = {}) {
  const style = opts.style || EMPTY_STYLE;
  if (r.width < 2 || r.height < 2) return inset(r, 0); // too small for a border; pass through
  const right = r.col + r.width - 1, bottom = r.row + r.height - 1;
  buf.set(r.row, r.col, BORDER.tl, style);
  buf.set(r.row, right, BORDER.tr, style);
  buf.set(bottom, r.col, BORDER.bl, style);
  buf.set(bottom, right, BORDER.br, style);
  for (let c = r.col + 1; c < right; c++) { buf.set(r.row, c, BORDER.h, style); buf.set(bottom, c, BORDER.h, style); }
  for (let row = r.row + 1; row < bottom; row++) { buf.set(row, r.col, BORDER.v, style); buf.set(row, right, BORDER.v, style); }
  if (opts.title) {
    const t = ` ${opts.title} `;
    buf.drawText(r.row, r.col + 2, t, opts.titleStyle || style);
  }
  return inset(r, 1); // inner content area
}

// === text ===================================================================================
// text(buf, rect, content, opts) — draw text, wrapping on width by default. content is a string or
// an array of lines. opts.wrap=false truncates each line to the rect width. opts.align "left"
// (default) / "right" / "center". Returns the number of rows drawn.
export function text(buf, r, content, opts = {}) {
  const style = opts.style || EMPTY_STYLE;
  const lines = Array.isArray(content) ? content : wrap(String(content), r.width, opts.wrap !== false);
  let drawn = 0;
  for (let i = 0; i < lines.length && i < r.height; i++) {
    const line = lines[i];
    const w = displayWidth(line);
    let col = r.col;
    if (opts.align === "right") col = r.col + Math.max(0, r.width - w);
    else if (opts.align === "center") col = r.col + Math.max(0, Math.floor((r.width - w) / 2));
    buf.drawText(r.row + i, col, line, style);
    drawn++;
  }
  return drawn;
}

// wrap(s, width, doWrap) — break a string into lines of at most `width` columns. With doWrap=false
// each source line is hard-truncated. With doWrap=true it wraps on spaces, falling back to a hard
// break for words longer than the width. Honors embedded "\n".
export function wrap(s, width, doWrap = true) {
  if (width <= 0) return [];
  const out = [];
  for (const para of String(s).split("\n")) {
    if (!doWrap) { out.push(para.slice(0, width)); continue; }
    if (para === "") { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      if (line === "" && /^\s+$/.test(word)) continue; // drop leading whitespace at a line start
      if (displayWidth(line + word) <= width) { line += word; continue; }
      if (line) { out.push(line.trimEnd()); line = ""; }
      if (/^\s+$/.test(word)) continue; // a whitespace token never starts the next line
      let w = word;
      while (displayWidth(w) > width) { out.push(w.slice(0, width)); w = w.slice(width); }
      line = w;
    }
    out.push(line.trimEnd());
  }
  return out;
}

// === list ===================================================================================
// list(buf, rect, items, opts) — a vertical list of strings; opts.selected highlights one row
// (inverse by default) and scrolls a window so the selection stays visible. Returns the visible
// window { start, end }. items is an array of strings or { text, style } records.
export function list(buf, r, items, opts = {}) {
  const sel = opts.selected ?? -1;
  const baseStyle = opts.style || EMPTY_STYLE;
  const selStyle = opts.selectedStyle || { inverse: true };
  // scroll so the selection is in-window
  let start = opts.scroll | 0;
  if (sel >= 0) {
    if (sel < start) start = sel;
    else if (sel >= start + r.height) start = sel - r.height + 1;
  }
  start = Math.max(0, Math.min(start, Math.max(0, items.length - r.height)));
  const end = Math.min(items.length, start + r.height);
  for (let i = start; i < end; i++) {
    const item = items[i];
    const itemText = typeof item === "string" ? item : item.text;
    const rowStyle = i === sel ? selStyle : (typeof item === "object" && item.style) || baseStyle;
    // pad the row to full width so the selection bar fills the line
    const padded = itemText.length < r.width ? itemText + " ".repeat(r.width - displayWidth(itemText)) : itemText;
    buf.drawText(r.row + (i - start), r.col, padded.slice(0, r.width), rowStyle);
  }
  return { start, end };
}

// === table ==================================================================================
// table(buf, rect, rows, opts) — aligned columns. rows is an array of arrays of cells (strings or
// {text,style}). opts.columns optionally fixes each column width; otherwise widths auto-size to the
// widest cell, clamped to fit the rect. opts.header (array) draws a bold header row. opts.gap
// between columns (default 1). Returns the column widths used.
export function table(buf, r, rows, opts = {}) {
  const gap = opts.gap ?? 1;
  const allRows = opts.header ? [opts.header, ...rows] : rows;
  const ncols = allRows.reduce((m, row) => Math.max(m, row.length), 0);
  // measure
  let widths = opts.columns ? opts.columns.slice() : new Array(ncols).fill(0);
  if (!opts.columns) {
    for (const row of allRows) {
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const t = typeof cell === "string" ? cell : (cell?.text ?? "");
        widths[c] = Math.max(widths[c], displayWidth(t));
      }
    }
  }
  // clamp total to rect width
  let total = widths.reduce((a, b) => a + b, 0) + gap * (ncols - 1);
  while (total > r.width && widths.length) {
    const maxIdx = widths.indexOf(Math.max(...widths));
    widths[maxIdx] = Math.max(1, widths[maxIdx] - 1);
    total = widths.reduce((a, b) => a + b, 0) + gap * (ncols - 1);
  }
  const headerOffset = opts.header ? 1 : 0;
  const drawRow = (row, rr, rowDefaultStyle) => {
    let col = r.col;
    for (let c = 0; c < ncols; c++) {
      const cell = row[c];
      const t = typeof cell === "string" ? cell : (cell?.text ?? "");
      const st = (typeof cell === "object" && cell?.style) || rowDefaultStyle;
      buf.drawText(rr, col, t.slice(0, widths[c]), st);
      col += widths[c] + gap;
    }
  };
  let rr = r.row;
  if (opts.header && rr < r.row + r.height) drawRow(opts.header, rr++, opts.headerStyle || { bold: true });
  for (let i = 0; i < rows.length && rr < r.row + r.height; i++) drawRow(rows[i], rr++, opts.style || EMPTY_STYLE);
  return widths;
}

// === input ==================================================================================
// input(buf, rect, state, opts) — an editable single line. state is { value, cursor } (cursor is a
// code-point index). Draws the value (horizontally scrolled to keep the cursor visible) and marks
// the cursor cell with an inverse pen. Returns nothing; editing is handled by editInput below so
// the widget stays a pure draw.
export function input(buf, r, state, opts = {}) {
  const style = opts.style || EMPTY_STYLE;
  const value = state.value ?? "";
  const cursor = Math.max(0, Math.min(state.cursor ?? value.length, value.length));
  const prompt = opts.prompt || "";
  const promptW = displayWidth(prompt);
  const fieldW = Math.max(0, r.width - promptW);
  // scroll so the cursor column stays inside the field
  let scroll = 0;
  if (cursor >= fieldW) scroll = cursor - fieldW + 1;
  if (promptW) buf.drawText(r.row, r.col, prompt, opts.promptStyle || style);
  const visible = value.slice(scroll, scroll + fieldW);
  buf.drawText(r.row, r.col + promptW, visible + " ".repeat(Math.max(0, fieldW - visible.length)), style);
  // cursor mark
  const cursCol = r.col + promptW + (cursor - scroll);
  const under = cursor < value.length ? value[cursor] : " ";
  buf.set(r.row, cursCol, under, { ...style, inverse: true });
}

// editInput(state, key) — apply a terminal-engine key event to an input state, returning the NEW
// { value, cursor }. Pure: a reducer the app calls on keypress. Handles printable chars, backspace,
// delete, left/right, home/end.
export function editInput(state, key) {
  let value = state.value ?? "";
  let cursor = Math.max(0, Math.min(state.cursor ?? value.length, value.length));
  const arr = [...value];
  if (key.name === "backspace") {
    if (cursor > 0) { arr.splice(cursor - 1, 1); cursor--; }
  } else if (key.name === "delete") {
    if (cursor < arr.length) arr.splice(cursor, 1);
  } else if (key.name === "left") {
    cursor = Math.max(0, cursor - 1);
  } else if (key.name === "right") {
    cursor = Math.min(arr.length, cursor + 1);
  } else if (key.name === "home") {
    cursor = 0;
  } else if (key.name === "end") {
    cursor = arr.length;
  } else if (key.char && !key.ctrl && !key.meta) {
    arr.splice(cursor, 0, key.char); cursor++;
  }
  return { value: arr.join(""), cursor };
}

// === statusLine =============================================================================
// statusLine(buf, rect, { left, center, right }, opts) — a one-row bar with up-to-three slots. The
// whole row is painted in opts.style (default inverse) so it reads as a bar.
export function statusLine(buf, r, slots = {}, opts = {}) {
  const style = opts.style || { inverse: true };
  buf.fillRect(r.row, r.col, r.width, 1, " ", style);
  if (slots.left) buf.drawText(r.row, r.col + 1, String(slots.left).slice(0, r.width - 2), style);
  if (slots.right) {
    const t = String(slots.right);
    buf.drawText(r.row, r.col + r.width - displayWidth(t), t, style);
  }
  if (slots.center) {
    const t = String(slots.center);
    buf.drawText(r.row, r.col + Math.floor((r.width - displayWidth(t)) / 2), t, style);
  }
}

// === selectInList ===========================================================================
// selectInList(selected, key, count, opts) — the pure reducer paired with list() the same way
// editInput pairs with input(). Every list-using app was reimplementing up/down/pageup/pagedown/
// home/end/clamp-vs-wrap by hand (arnold's own lantern demo hand-rolls `(selected - 1 + n) % n`
// inline in its onKey, because it never had this to reach for) — this is that logic, written once.
// opts.wrap (default false) makes up/down cycle past the ends instead of clamping; pageup/pagedown/
// home/end always land in-bounds regardless of wrap (a page or a jump has an obvious edge to stop
// at even in a wrapping list). opts.pageSize defaults to 10. An empty list (count 0) returns
// `selected` unchanged — there is nothing to select.
export function selectInList(selected, key, count, opts = {}) {
  if (count <= 0) return selected;
  const pageSize = opts.pageSize ?? 10;
  const wrap = !!opts.wrap;
  const clamp = (n) => Math.max(0, Math.min(count - 1, n));
  const step = (n) => (wrap ? ((n % count) + count) % count : clamp(n));
  if (key.name === "up") return step(selected - 1);
  if (key.name === "down") return step(selected + 1);
  if (key.name === "pageup") return clamp(selected - pageSize);
  if (key.name === "pagedown") return clamp(selected + pageSize);
  if (key.name === "home") return 0;
  if (key.name === "end") return count - 1;
  return clamp(selected);
}

// === textViewport ============================================================================
// textViewport(buf, rect, lines, opts) — like text() above, but draws a WINDOW of already-wrapped
// lines starting at opts.offset, clipped to rect.height, instead of always drawing from line 0.
// text() has no scroll offset at all; a pageable output pane (a game description, a help screen,
// wheatstone's whole world-output pane) needs one, and until now every app that wanted it had to
// write its own windowing (wheatstone's 100+-line Scrollback ring buffer exists purely for this).
// Feed it PRE-WRAPPED lines — call wrap() first, same as text() does internally for you when you
// pass a plain string there. Returns { offset, maxOffset } (offset clamped into range) so a
// caller's status line can show "12/340" or a scrollbar without recomputing the clamp itself.
export function textViewport(buf, r, lines, opts = {}) {
  const style = opts.style || EMPTY_STYLE;
  const maxOffset = Math.max(0, lines.length - r.height);
  const offset = Math.max(0, Math.min(opts.offset ?? 0, maxOffset));
  for (let i = 0; i < r.height && offset + i < lines.length; i++) {
    buf.drawText(r.row + i, r.col, String(lines[offset + i]).slice(0, r.width), style);
  }
  return { offset, maxOffset };
}

// scrollViewport(offset, key, lineCount, viewportHeight, opts) — the pure reducer paired with
// textViewport the same way selectInList pairs with list: up/down/pageup/pagedown/home/end move the
// window, always clamped to [0, maxOffset]. opts.pageSize defaults to viewportHeight - 1 (one line
// of overlap between pages, the conventional pager behavior) so a caller does not have to pick one.
export function scrollViewport(offset, key, lineCount, viewportHeight, opts = {}) {
  const maxOffset = Math.max(0, lineCount - viewportHeight);
  const pageSize = opts.pageSize ?? Math.max(1, viewportHeight - 1);
  const clamp = (n) => Math.max(0, Math.min(maxOffset, n));
  if (key.name === "up") return clamp(offset - 1);
  if (key.name === "down") return clamp(offset + 1);
  if (key.name === "pageup") return clamp(offset - pageSize);
  if (key.name === "pagedown") return clamp(offset + pageSize);
  if (key.name === "home") return 0;
  if (key.name === "end") return maxOffset;
  return clamp(offset);
}
