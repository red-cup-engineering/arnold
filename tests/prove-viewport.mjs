// prove-viewport — the new list-navigation and text-viewport primitives. selectInList/
// scrollViewport are pure reducers proven the same way editInput is (a state and a key event in,
// the next state out); textViewport is proven by inspecting the exact cells it draws, the same way
// prove-widgets inspects list()'s cells.

import { Buffer } from "../src/buffer.mjs";
import { rect } from "../src/layout.mjs";
import { selectInList, textViewport, scrollViewport, list } from "../src/widgets.mjs";
import { ok, eq, done } from "./_harness.mjs";

// === selectInList ============================================================================
const K = (name) => ({ name });

eq(selectInList(0, K("down"), 5), 1, "down moves the selection forward by one");
eq(selectInList(4, K("down"), 5), 4, "down at the last row clamps (no wrap by default)");
eq(selectInList(0, K("up"), 5), 0, "up at the first row clamps (no wrap by default)");
eq(selectInList(2, K("up"), 5), 1, "up moves the selection back by one");
eq(selectInList(0, K("down"), 5, { wrap: true }), 1, "down still moves forward normally when wrap is on");
eq(selectInList(4, K("down"), 5, { wrap: true }), 0, "down at the last row WRAPS to the first when wrap is on");
eq(selectInList(0, K("up"), 5, { wrap: true }), 4, "up at the first row WRAPS to the last when wrap is on");
eq(selectInList(2, K("pagedown"), 20, { pageSize: 5 }), 7, "pagedown advances by pageSize");
eq(selectInList(2, K("pagedown"), 5, { pageSize: 5 }), 4, "pagedown clamps to the last row even with wrap off");
eq(selectInList(2, K("pagedown"), 5, { pageSize: 5, wrap: true }), 4, "pagedown clamps in-bounds even when wrap is on (a page always has an edge)");
eq(selectInList(4, K("pageup"), 20, { pageSize: 10 }), 0, "pageup clamps at zero");
eq(selectInList(3, K("home"), 10), 0, "home jumps to the first row");
eq(selectInList(3, K("end"), 10), 9, "end jumps to the last row");
eq(selectInList(3, K("char"), 10), 3, "an unrelated key leaves the selection unchanged");
eq(selectInList(99, K("char"), 10), 9, "an unrelated key still clamps an out-of-range selection into bounds");
eq(selectInList(0, K("down"), 0), 0, "an empty list (count 0) is a no-op");

// === textViewport =============================================================================
// draws a WINDOW of pre-wrapped lines, clipped to rect.height, starting at opts.offset
{
  const buf = new Buffer(6, 3);
  const lines = ["line0", "line1", "line2", "line3", "line4"];
  const win = textViewport(buf, rect(0, 0, 6, 3), lines, { offset: 0 });
  eq(win, { offset: 0, maxOffset: 2 }, "at offset 0 with 5 lines in a 3-row viewport, maxOffset is 2");
  eq(buf.get(0, 0).ch, "l", "textViewport draws the first visible line at the rect origin");
  eq(buf.get(1, 0).ch, "l", "the second row is drawn");
  // exact cell-by-cell check of the first row's text "line0"
  const row0 = [0, 1, 2, 3, 4].map((c) => buf.get(0, c).ch).join("");
  eq(row0, "line0", "the exact glyphs of the first visible line are drawn left to right");
}
{
  // scrolled: offset 2 shows line2..line4 (only 3 lines exist past offset 2, filling the 3-row rect)
  const buf = new Buffer(6, 3);
  const lines = ["line0", "line1", "line2", "line3", "line4"];
  const win = textViewport(buf, rect(0, 0, 6, 3), lines, { offset: 2 });
  eq(win, { offset: 2, maxOffset: 2 }, "offset 2 is exactly maxOffset for 5 lines in a 3-row viewport");
  const row0 = [0, 1, 2, 3, 4].map((c) => buf.get(0, c).ch).join("");
  eq(row0, "line2", "at offset 2 the FIRST drawn row is the third source line (line2), not line0");
}
{
  // offset beyond maxOffset clamps down, not up (never scrolls past the true end)
  const buf = new Buffer(6, 3);
  const lines = ["a", "b", "c", "d", "e"];
  const win = textViewport(buf, rect(0, 0, 6, 3), lines, { offset: 999 });
  eq(win.offset, 2, "an out-of-range offset clamps down to maxOffset");
}
{
  // fewer lines than the viewport height: maxOffset is 0, nothing scrolls, only real rows draw
  const buf = new Buffer(6, 3);
  const win = textViewport(buf, rect(0, 0, 6, 3), ["only"], {});
  eq(win, { offset: 0, maxOffset: 0 }, "a short content list has maxOffset 0");
  eq(buf.get(0, 0).ch, "o", "the one real line draws");
  eq(buf.get(1, 0).ch, " ", "a row past the content stays blank, not repeating or erroring");
}
{
  // a style is applied to every drawn cell, same convention as text()/list()
  const buf = new Buffer(4, 1);
  textViewport(buf, rect(0, 0, 4, 1), ["hi"], { style: { fg: "cyan" } });
  eq(buf.get(0, 0).style, { fg: "cyan" }, "textViewport carries the given style onto its cells");
}

// === scrollViewport ===========================================================================
eq(scrollViewport(0, K("down"), 100, 10), 1, "down moves the offset forward by one line");
eq(scrollViewport(5, K("up"), 100, 10), 4, "up moves the offset back by one line");
eq(scrollViewport(0, K("up"), 100, 10), 0, "up at offset 0 clamps at zero");
eq(scrollViewport(90, K("down"), 100, 10), 90, "down at maxOffset clamps (100 lines, 10-row viewport => maxOffset 90)");
eq(scrollViewport(0, K("pagedown"), 100, 10), 9, "pagedown advances by the default page size (viewportHeight - 1)");
eq(scrollViewport(20, K("pageup"), 100, 10), 11, "pageup retreats by the default page size");
eq(scrollViewport(0, K("pagedown"), 100, 10, { pageSize: 20 }), 20, "an explicit pageSize overrides the default");
eq(scrollViewport(50, K("home"), 100, 10), 0, "home jumps to offset 0");
eq(scrollViewport(0, K("end"), 100, 10), 90, "end jumps to maxOffset");
eq(scrollViewport(999, K("char"), 100, 10), 90, "an unrelated key still clamps an out-of-range offset into bounds");
eq(scrollViewport(3, K("down"), 5, 10), 0, "when content is shorter than the viewport, maxOffset is 0 and every move clamps there");

// === a viewport's offset/maxOffset round-trips with its own reducer ===
{
  const lines = Array.from({ length: 25 }, (_, i) => `l${i}`);
  const height = 10;
  let offset = 0;
  offset = scrollViewport(offset, K("pagedown"), lines.length, height);
  const buf = new Buffer(4, height);
  const win = textViewport(buf, rect(0, 0, 4, height), lines, { offset });
  eq(win.offset, offset, "the offset the reducer computed is exactly what the viewport draws from");
  eq(buf.get(0, 0).ch, "l", "the viewport's first drawn row after one pagedown starts with the paged-to line");
}

// selectInList's window still matches list()'s own auto-scroll behavior at the same selection
{
  const items = Array.from({ length: 10 }, (_, i) => `item${i}`);
  let selected = 0;
  for (let i = 0; i < 6; i++) selected = selectInList(selected, K("down"), items.length, { pageSize: 3 });
  eq(selected, 6, "six downs from 0 lands on row 6");
  const buf = new Buffer(8, 3);
  const win = list(buf, rect(0, 0, 8, 3), items, { selected });
  ok(win.start <= selected && selected < win.end, "list()'s own scroll window keeps selectInList's result visible");
}

done("prove-viewport");
