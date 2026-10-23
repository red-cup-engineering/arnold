// prove-widgets — the drawing vocabulary paints into a buffer: box borders + title, text wrap,
// list selection + scroll, table column alignment, input editing reducer, and the status bar.

import { Buffer } from "../src/buffer.mjs";
import { rect } from "../src/layout.mjs";
import { box, text, wrap, list, table, input, editInput, statusLine } from "../src/widgets.mjs";
import { ok, eq, done } from "./_harness.mjs";

// box draws corners + title and returns the inner rect
const b = new Buffer(10, 4);
const inner = box(b, rect(0, 0, 10, 4), { title: "hi" });
eq(b.get(0, 0).ch, "┌", "box draws the top-left corner");
eq(b.get(3, 9).ch, "┘", "box draws the bottom-right corner");
ok(b.get(0, 2).ch === " " && b.get(0, 3).ch === "h" && b.get(0, 4).ch === "i", "box draws the title in the top border");
eq(inner, { row: 1, col: 1, width: 8, height: 2 }, "box returns the inner content rect");

// A 2x2 box has corners only: recovered line strokes must not
// overwrite corners when there is no horizontal or vertical interior.
const tiny = new Buffer(2, 2);
box(tiny, rect(0, 0, 2, 2));
eq([[tiny.get(0, 0).ch, tiny.get(0, 1).ch],
    [tiny.get(1, 0).ch, tiny.get(1, 1).ch]],
  [["┌", "┐"], ["└", "┘"]], "degenerate box retains all four corners");
const small = new Buffer(3, 3);
box(small, rect(0, 0, 3, 3));
eq([small.get(0, 1).ch, small.get(1, 0).ch,
    small.get(1, 2).ch, small.get(2, 1).ch],
  ["─", "│", "│", "─"], "small box reuses strokes without border regression");

// wrap breaks on spaces and honors newlines
eq(wrap("the quick brown", 9), ["the quick", "brown"], "wrap breaks on word boundaries at the width");
eq(wrap("a\nb", 5), ["a", "b"], "wrap honors embedded newlines");
eq(wrap("abcdefgh", 3), ["abc", "def", "gh"], "wrap hard-breaks an over-long word");

// text draws wrapped content and reports rows drawn
const tb = new Buffer(5, 3);
const n = text(tb, rect(0, 0, 5, 3), "hello world");
ok(n >= 2, "text wraps 'hello world' into multiple rows at width 5");
eq(tb.get(0, 0).ch, "h", "text starts at the rect origin");

// list highlights the selection and pads it across the width
const lb = new Buffer(6, 3);
const win = list(lb, rect(0, 0, 6, 3), ["a", "b", "c"], { selected: 1 });
eq(win, { start: 0, end: 3 }, "list with no scroll shows the whole short list");
ok(lb.get(1, 0).style.inverse === true, "the selected row is drawn inverse");
ok(lb.get(1, 5).style.inverse === true, "the selection bar fills the full row width");
ok(!lb.get(0, 0).style.inverse, "unselected rows are not inverse");

// list scrolls to keep a deep selection visible
const lb2 = new Buffer(6, 2);
const win2 = list(lb2, rect(0, 0, 6, 2), ["a", "b", "c", "d", "e"], { selected: 4 });
ok(win2.end === 5 && win2.start === 3, "list scrolls so a deep selection is in the 2-row window");

// table aligns columns and draws a header
const tbl = new Buffer(20, 3);
table(tbl, rect(0, 0, 20, 3), [["name", "oak"], ["x", "yy"]], { header: ["k", "v"] });
ok(tbl.get(0, 0).style.bold === true, "the table header row is bold");
eq(tbl.get(1, 0).ch, "n", "the table draws the first body cell at the origin");
// second column starts past the widest first-column cell ("name" = 4) + gap 1 => col 5
eq(tbl.get(1, 5).ch, "o", "the table aligns the second column under the header");

// input draws the value with a cursor mark
const ib = new Buffer(10, 1);
input(ib, rect(0, 0, 10, 1), { value: "hi", cursor: 2 }, {});
eq(ib.get(0, 0).ch, "h", "input draws the value");
ok(ib.get(0, 2).style.inverse === true, "input marks the cursor cell inverse");

// editInput reducer: insert, backspace, move
eq(editInput({ value: "ac", cursor: 1 }, { name: "char", char: "b" }), { value: "abc", cursor: 2 }, "typing inserts at the cursor");
eq(editInput({ value: "abc", cursor: 3 }, { name: "backspace" }), { value: "ab", cursor: 2 }, "backspace deletes before the cursor");
eq(editInput({ value: "abc", cursor: 1 }, { name: "left" }), { value: "abc", cursor: 0 }, "left moves the cursor");
eq(editInput({ value: "abc", cursor: 1 }, { name: "end" }), { value: "abc", cursor: 3 }, "end jumps to the line end");
eq(editInput({ value: "abc", cursor: 1 }, { name: "char", char: "x", ctrl: true }), { value: "abc", cursor: 1 }, "a ctrl-combo does not insert text");

// statusLine fills the row and places slots
const sb = new Buffer(20, 1);
statusLine(sb, rect(0, 0, 20, 1), { left: "L", right: "R" });
ok(sb.get(0, 0).style.inverse === true, "the status row is an inverse bar");
eq(sb.get(0, 1).ch, "L", "the left slot is near the left edge");
eq(sb.get(0, 19).ch, "R", "the right slot is at the right edge");

done("prove-widgets");
