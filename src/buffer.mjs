// buffer — the screen as a grid of cells, and the DIFF between two grids. A cell is
// { ch, style }: one visible glyph plus its pen (an ansi-module style record). A Buffer is a
// width×height array of cells; drawing mutates cells in place; rendering (in render.mjs) walks the
// DIFF against the previously-shown buffer and emits only the changed cells. This is the whole
// reason the TUI is cheap: a caller re-draws a fresh frame every read, but only the
// cells that actually changed reach the terminal.
//
// Pure data + pure functions: no node:tty, no I/O. A Buffer is constructed, drawn onto, diffed.

import { displayWidth, EMPTY_STYLE, stripAnsi } from "./ansi.mjs";

export const SPACE = Object.freeze({ ch: " ", style: EMPTY_STYLE });

export class Buffer {
  constructor(width, height) {
    this.width = Math.max(0, width | 0);
    this.height = Math.max(0, height | 0);
    this.cells = new Array(this.width * this.height);
    this.clear();
  }

  clear(style = EMPTY_STYLE) {
    const blank = style === EMPTY_STYLE ? SPACE : { ch: " ", style };
    this.cells.fill(blank);
    return this;
  }

  inBounds(row, col) {
    return row >= 0 && col >= 0 && row < this.height && col < this.width;
  }

  set(row, col, ch, style = EMPTY_STYLE) {
    if (!this.inBounds(row, col)) return this;
    this.cells[row * this.width + col] = { ch, style };
    return this;
  }

  get(row, col) {
    if (!this.inBounds(row, col)) return SPACE;
    return this.cells[row * this.width + col] || SPACE;
  }

  // drawText — lay a (possibly already-styled) string starting at (row,col), clipped to width.
  // The string is flattened to plain glyphs (the pen comes from `style`, not from embedded SGR),
  // so a caller can pass display text without smuggling escapes into the cell grid. Returns the
  // column just past the last glyph written (so callers can chain).
  drawText(row, col, text, style = EMPTY_STYLE) {
    const plain = stripAnsi(String(text));
    let c = col;
    for (const ch of plain) {
      const cp = ch.codePointAt(0);
      if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue; // skip controls
      if (c >= this.width) break;
      if (c >= 0) this.set(row, c, ch, style);
      c += 1;
    }
    return c;
  }

  // fillRect — paint a rectangle of one glyph (default space) with one style. Used by layout to
  // back a box/panel before its children draw over it.
  fillRect(row, col, w, h, ch = " ", style = EMPTY_STYLE) {
    for (let r = row; r < row + h; r++) {
      for (let c = col; c < col + w; c++) this.set(r, c, ch, style);
    }
    return this;
  }

  // blit — copy another buffer onto this one at (row,col), clipped. Lets layout compose a child
  // region buffer into a parent without the child knowing its absolute position.
  blit(src, row, col) {
    for (let r = 0; r < src.height; r++) {
      for (let c = 0; c < src.width; c++) {
        const cell = src.get(r, c);
        this.set(row + r, col + c, cell.ch, cell.style);
      }
    }
    return this;
  }
}

// cellsEqual — do two cells show the same glyph in the same pen? The diff's atom.
import { sameStyle } from "./ansi.mjs";
export function cellsEqual(a, b) {
  const A = a || SPACE, B = b || SPACE;
  return A.ch === B.ch && sameStyle(A.style, B.style);
}

// diff(prev, next) — the list of changed cells going from `prev` to `next`. Each change is
// { row, col, cell }. If `prev` is null (first paint) or the dimensions differ, EVERY next cell is
// a change (a full repaint). The render step turns this list into the minimal escape stream.
// Returns { full, changes }: `full` true means the caller should repaint from a clean screen.
export function diff(prev, next) {
  if (!prev || prev.width !== next.width || prev.height !== next.height) {
    const changes = [];
    for (let r = 0; r < next.height; r++) {
      for (let c = 0; c < next.width; c++) changes.push({ row: r, col: c, cell: next.get(r, c) });
    }
    return { full: true, changes };
  }
  const changes = [];
  for (let r = 0; r < next.height; r++) {
    for (let c = 0; c < next.width; c++) {
      const a = prev.get(r, c), b = next.get(r, c);
      if (!cellsEqual(a, b)) changes.push({ row: r, col: c, cell: b });
    }
  }
  return { full: false, changes };
}

// width — re-export the ansi display-width so layout/widgets measure text through one definition.
export { displayWidth };
