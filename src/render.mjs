// render — turn a buffer DIFF into the minimal escape stream, and serialize a full buffer when a
// clean repaint is needed. This is the only module that produces the byte string the terminal
// consumes; it still does no I/O (the app's screen writes it). Pure: (prev, next) -> string.
//
// The render walks the diff's changed cells in row-major order. It tracks two pieces of pen state
// so it emits the FEWEST escapes: the current cursor position (skip a cursorTo when the next change
// is the very next column on the same row) and the current style (skip an sgr when the pen is
// unchanged). That is what makes "only redraw changed cells" actually translate to a small write.

import { cursorTo, sgr, sameStyle, EMPTY_STYLE } from "./ansi.mjs";
import { clearScreen, cursorHome, resetStyle } from "@red-cup-engineering/terminal-user-interface-engine";
import { diff } from "./buffer.mjs";

// renderChanges(changes) — serialize an explicit, row-major-sorted change list. Exposed for tests
// and for callers that compute their own diff.
export function renderChanges(changes) {
  let out = "";
  let curRow = -1, curCol = -1;
  let curStyle = null; // null = unknown pen => first cell forces an sgr
  for (const { row, col, cell } of changes) {
    if (row !== curRow || col !== curCol) {
      out += cursorTo(row, col);
      curRow = row; curCol = col;
    }
    const style = cell.style || EMPTY_STYLE;
    if (curStyle === null || !sameStyle(curStyle, style)) {
      out += resetStyle + sgr(style);
      curStyle = style;
    }
    out += cell.ch;
    curCol += 1; // cursor advances one column after writing a glyph
  }
  if (out) out += resetStyle;
  return out;
}

// render(prev, next) — the diffed paint. Returns { out, full }: `out` is the escape stream to
// write, `full` true if a clean-screen repaint was performed (the caller resets its shown buffer to
// `next` either way). On a full paint we clear the screen first so stale cells outside the new
// dimensions cannot linger.
export function render(prev, next) {
  const d = diff(prev, next);
  // Stable row-major order so the cursor-advance optimization in renderChanges fires on runs.
  d.changes.sort((a, b) => (a.row - b.row) || (a.col - b.col));
  let out = "";
  if (d.full) out += clearScreen + cursorHome;
  out += renderChanges(d.changes);
  return { out, full: d.full };
}
