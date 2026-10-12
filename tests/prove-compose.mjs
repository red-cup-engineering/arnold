// prove-compose — a COMPOSED two-pane fixture: flex splits a 20x5 buffer into a list pane (left,
// fixed 9 cols) and a textViewport pane (right, grows), the shape a shelf browser's body is built
// from (list + detail pane). Proves the composition renders to EXPECTED CELLS exactly (byte-level,
// full row-major grids), and that moving the list selection + scrolling the viewport produces an
// EXACT diff — only the cells that actually changed, nothing more, nothing less — the same
// "diff outputs asserted exactly" standard prove-render/prove-buffer hold the rest of arnold to.

import { Buffer, diff } from "../src/buffer.mjs";
import { rect, flex } from "../src/layout.mjs";
import { list, textViewport } from "../src/widgets.mjs";
import { ok, eq, done } from "./_harness.mjs";

const ITEMS = ["Alpha", "Beta", "Gamma"];
const DESC = ["desc one", "desc two", "desc three", "desc four", "desc five", "desc six", "desc seven"];

// draw(selected, offset) — the fixture: a left list pane + a right scrollable detail pane, split by
// flex the way an app's view() would build it. Returns the buffer plus each widget's own return
// value (the list's scroll window, the viewport's offset/maxOffset).
function draw(selected, offset) {
  const buf = new Buffer(20, 5);
  const [leftRect, rightRect] = flex(rect(0, 0, 20, 5), [{ size: 9 }, { grow: 1 }], { direction: "row" });
  const win = list(buf, leftRect, ITEMS, { selected });
  const vp = textViewport(buf, rightRect, DESC, { offset });
  return { buf, win, vp };
}

function gridOf(buf) {
  const rows = [];
  for (let r = 0; r < buf.height; r++) {
    let s = "";
    for (let c = 0; c < buf.width; c++) s += buf.get(r, c).ch;
    rows.push(s);
  }
  return rows;
}

// === frame 1: selection on row 0, viewport at the top =======================================
const f1 = draw(0, 0);
eq(f1.win, { start: 0, end: 3 }, "the list pane shows all 3 items (no scroll needed for 3 in a 5-row pane)");
eq(f1.vp, { offset: 0, maxOffset: 2 }, "the viewport starts at offset 0; 7 lines in a 5-row pane gives maxOffset 2");
eq(gridOf(f1.buf), [
  "Alpha    desc one   ",
  "Beta     desc two   ",
  "Gamma    desc three ",
  "         desc four  ",
  "         desc five  ",
], "frame 1 renders the EXACT expected 20x5 grid: list left, description right");
ok(f1.buf.get(0, 0).style.inverse === true, "row 0 (the selection) is drawn inverse in frame 1");
ok(!f1.buf.get(1, 0).style.inverse, "row 1 (not selected) is not inverse in frame 1");

// === frame 2: selection moved to row 1, viewport scrolled to its own maxOffset (2) ===========
const f2 = draw(1, 2);
eq(f2.vp, { offset: 2, maxOffset: 2 }, "the viewport is now at its maxOffset");
eq(gridOf(f2.buf), [
  "Alpha    desc three ",
  "Beta     desc four  ",
  "Gamma    desc five  ",
  "         desc six   ",
  "         desc seven ",
], "frame 2 renders the EXACT expected grid after the selection move + scroll");
ok(f2.buf.get(1, 0).style.inverse === true, "row 1 (the new selection) is drawn inverse in frame 2");
ok(!f2.buf.get(0, 0).style.inverse, "row 0 (no longer selected) lost its inverse style in frame 2");

// === the diff between frame 1 and frame 2 is EXACT: every changed cell, no more, no fewer =====
const d = diff(f1.buf, f2.buf);
ok(d.full === false, "a same-size two-pane diff is never a forced full repaint");

// left pane: rows 0 and 1 repaint in full (their 9-column width: the glyphs change on row 0,
// the SELECTION STYLE changes on both rows even where the glyph itself is identical); row 2
// (Gamma, unselected in both frames) does not appear in the diff at all.
const leftChanges = d.changes.filter((c) => c.col < 9);
eq(leftChanges.length, 18, "the list pane's diff touches exactly its two changed rows (9 cols x 2 rows)");
ok(leftChanges.every((c) => c.row === 0 || c.row === 1), "no left-pane row 2 cell changed (Gamma stayed unselected)");
eq(leftChanges.filter((c) => c.row === 0).map((c) => c.cell.ch).join(""), "Alpha    ",
  "row 0's diffed glyphs spell out its own unchanged text (only its STYLE changed, deselected)");

// right pane: only the columns where the scrolled text actually differs appear — the viewport
// re-draws its full window on every offset change, but the diff still reports only real deltas.
const rightChanges = d.changes.filter((c) => c.col >= 9);
eq(rightChanges.length, 20, "the description pane's diff is exactly the cells whose glyph changed");
ok(rightChanges.every((c) => c.row >= 0 && c.row <= 4), "every right-pane change lands inside the 5-row viewport");

// total: the two panes' changes exhaustively account for the whole diff (nothing outside them)
eq(leftChanges.length + rightChanges.length, d.changes.length,
  "the left- and right-pane changes exhaustively partition the full diff (col < 9 vs col >= 9)");

done("prove-compose");
