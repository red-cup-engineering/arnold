// prove-render — the diffed render emits a minimal escape stream: it positions only where needed,
// re-emits the pen only when the style changes, and clears the screen on a full repaint.

import { Buffer } from "../src/buffer.mjs";
import { render, renderChanges } from "../src/render.mjs";
import { ok, includes, eq, done } from "./_harness.mjs";

// a run of adjacent cells in one style: one cursorTo, one sgr, then bare glyphs
const changes = [
  { row: 0, col: 0, cell: { ch: "a", style: { fg: "red" } } },
  { row: 0, col: 1, cell: { ch: "b", style: { fg: "red" } } },
  { row: 0, col: 2, cell: { ch: "c", style: { fg: "red" } } },
];
const out = renderChanges(changes);
// exactly one position move (the run is contiguous), and "abc" appears together
includes(out, "abc", "a contiguous run writes its glyphs together");
const positionCount = (out.match(/\x1b\[\d+;\d+H/g) || []).length;
eq(positionCount, 1, "a contiguous run emits exactly one cursor position");
const sgrCount = (out.match(/\x1b\[[\d;]*m/g) || []).length;
ok(sgrCount >= 2, "the run emits the pen, then a final reset");

// a gap forces a re-position
const gapped = renderChanges([
  { row: 0, col: 0, cell: { ch: "a", style: {} } },
  { row: 0, col: 5, cell: { ch: "b", style: {} } },
]);
eq((gapped.match(/\x1b\[\d+;\d+H/g) || []).length, 2, "a non-adjacent cell re-positions the cursor");

// a style change mid-run re-emits the pen
const styled = renderChanges([
  { row: 0, col: 0, cell: { ch: "a", style: { fg: "red" } } },
  { row: 0, col: 1, cell: { ch: "b", style: { fg: "blue" } } },
]);
ok((styled.match(/\x1b\[[\d;]*m/g) || []).length >= 3, "a mid-run pen change re-emits the style");

// full render clears the screen
const a = new Buffer(2, 1);
a.drawText(0, 0, "hi");
const first = render(null, a);
ok(first.full === true, "first render (no prior) is full");
includes(first.out, "\x1b[2J", "a full render clears the screen");

// an unchanged second render emits nothing
const a2 = new Buffer(2, 1);
a2.drawText(0, 0, "hi");
const second = render(a, a2);
eq(second.out, "", "an unchanged frame renders to the empty string (no redundant writes)");
ok(second.full === false, "a same-size second render is not full");

// a one-cell change renders just that cell, not the whole screen
const a3 = new Buffer(2, 1);
a3.drawText(0, 0, "ho");
const third = render(a, a3);
ok(!third.out.includes("\x1b[2J"), "a partial change does not clear the screen");
includes(third.out, "o", "a partial change writes the changed glyph");

done("prove-render");
