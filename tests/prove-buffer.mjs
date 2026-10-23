import assert from "node:assert/strict";
// prove-buffer — the cell buffer draws, and the DIFF reports exactly the changed cells (the basis
// of "only redraw what changed").

import { Buffer, diff, cellsEqual, SPACE } from "../src/buffer.mjs";
import { ok, eq, done } from "./_harness.mjs";

// construction + draw
const b = new Buffer(5, 3);
ok(b.width === 5 && b.height === 3, "buffer has the requested dimensions");
ok(b.get(0, 0).ch === " ", "a fresh buffer is blank spaces");
b.drawText(1, 1, "hi", { fg: "red" });
ok(b.get(1, 1).ch === "h" && b.get(1, 2).ch === "i", "drawText lays glyphs at the position");
eq(b.get(1, 1).style, { fg: "red" }, "drawText carries the style onto the cell");

// out-of-bounds is a no-op, not a throw
b.set(99, 99, "x");
ok(b.get(99, 99).ch === " ", "out-of-bounds set is ignored");

// clipping
const c = new Buffer(3, 1);
c.drawText(0, 1, "abcdef");
ok(c.get(0, 1).ch === "a" && c.get(0, 2).ch === "b", "drawText clips at the right edge");

// diff: first paint against null is FULL
const d0 = diff(null, b);
ok(d0.full === true, "diff against null is a full repaint");
ok(d0.changes.length === b.width * b.height, "a full repaint reports every cell");

// diff: identical buffers => no changes
const b2 = new Buffer(5, 3);
b2.drawText(1, 1, "hi", { fg: "red" });
const dSame = diff(b, b2);
eq(dSame.changes, [], "diffing identical buffers reports no changes");
ok(dSame.full === false, "a same-size diff is not full");

// diff: a single changed cell => exactly one change
const b3 = new Buffer(5, 3);
b3.drawText(1, 1, "hi", { fg: "red" });
b3.set(0, 0, "X", { bold: true });
const dOne = diff(b, b3);
eq(dOne.changes.length, 1, "one changed cell yields exactly one diff entry");
eq(dOne.changes[0], { row: 0, col: 0, cell: { ch: "X", style: { bold: true } } }, "the diff entry names the cell, its row and col");

// a style-only change (same glyph, different pen) still diffs
const b4 = new Buffer(1, 1);
const b5 = new Buffer(1, 1);
b4.set(0, 0, "a", { fg: "red" });
b5.set(0, 0, "a", { fg: "blue" });
ok(!cellsEqual(b4.get(0, 0), b5.get(0, 0)), "cellsEqual sees a pen change");
eq(diff(b4, b5).changes.length, 1, "a style-only change is a diff");

// dimension change forces full
ok(diff(new Buffer(2, 2), new Buffer(3, 3)).full === true, "a dimension change forces a full repaint");

// blit composes a child buffer
const parent = new Buffer(4, 2);
const child = new Buffer(2, 1);
child.drawText(0, 0, "ok");
parent.blit(child, 1, 2);
ok(parent.get(1, 2).ch === "o" && parent.get(1, 3).ch === "k", "blit copies a child onto the parent at an offset");

ok(cellsEqual(SPACE, SPACE), "SPACE equals itself");

// The discrete line stroke comes from the retained Tsander wireframe
// rasterizer, but stays in Arnold's domain-neutral cell vocabulary.
const raster = new Buffer(7, 7);
const contestedPen = { fg: "yellow", bold: true };
raster.drawLine(1, 1, 5, 5, "%", contestedPen);
for (let n = 1; n <= 5; n++) {
  eq(raster.get(n, n).ch, "%", "recovered diagonal strokes the expected cell");
  eq(raster.get(n, n).style, contestedPen, "line stroke preserves the caller's pen");
}
eq(raster.cells.filter(cell => cell.ch === "%").length, 5, "diagonal is one discrete 5-cell segment");

const clipped = new Buffer(5, 3);
clipped.drawLine(1, -200000, 1, 200000, "─", { fg: "cyan" });
eq([...Array(5).keys()].map(col => clipped.get(1, col).ch), ["─", "─", "─", "─", "─"],
  "far-offscreen horizontal segment clips to five visible columns");
eq(clipped.cells.filter(cell => cell.ch === "─").length, 5,
  "clipped line does not write unrelated rows");
const untouched = new Buffer(5, 3);
untouched.drawLine(-9, -4, -4, -4, "x");
eq(diff(new Buffer(5, 3), untouched).changes, [],
  "fully out-of-view line leaves the receiving frame untouched");

const backwards = new Buffer(4, 4);
backwards.drawLine(3, 3, 0, 0, "x");
eq([...Array(4).keys()].map(n => backwards.get(n, n).ch), ["x", "x", "x", "x"],
  "descending endpoints rasterize in reverse without missing cells");
const beforeInvalid = new Buffer(3, 3);
assert.throws(() => beforeInvalid.drawLine(0, 0, 2, 2, "\x1b"),
  /one printable terminal cell glyph/u);
assert.throws(() => beforeInvalid.drawLine(0.5, 0, 2, 2, "x"),
  /safe integer grid endpoints/u);
assert.throws(() => beforeInvalid.drawLine(0, -9007199254740991, 0, 9007199254740991, "x"),
  /endpoint displacement is out of range/u);
eq(diff(new Buffer(3, 3), beforeInvalid).changes, [],
  "invalid or unsafe strokes refuse before mutating the buffer");
const repeat = new Buffer(5, 3);
repeat.drawLine(0, 0, 2, 4, "•");
const after = new Buffer(5, 3);
after.drawLine(0, 0, 2, 4, "•");
eq(diff(repeat, after).changes, [],
  "repeated raster on the same frame is deterministic and causes no terminal delta");

done("prove-buffer");
