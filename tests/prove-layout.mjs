// prove-layout — flex divides space: fixed sizes are honored, growers share the remainder EXACTLY
// (tracks sum to the container, no off-by-one gaps), gaps are inserted, and inset/center are right.

import { rect, flex, inset, center, stack } from "../src/layout.mjs";
import { ok, eq, done } from "./_harness.mjs";

// fixed + grow on a row: total must be exactly the container width
const container = rect(0, 0, 20, 5);
const r = flex(container, [{ size: 4 }, { grow: 1 }, { grow: 1 }], { direction: "row" });
eq(r.length, 3, "flex returns one rect per child");
eq(r[0].width, 4, "a fixed child keeps its size");
eq(r[1].width + r[2].width, 16, "growers split the remainder");
eq(r[0].width + r[1].width + r[2].width, 20, "the tracks sum EXACTLY to the container width");
eq(r[0].col, 0, "the first track starts at the container origin");
eq(r[1].col, 4, "the second track starts after the first");
ok(r.every((x) => x.height === 5), "row children keep the full container height");

// weighted grow
const w = flex(rect(0, 0, 30, 1), [{ grow: 2 }, { grow: 1 }], { direction: "row" });
eq(w[0].width + w[1].width, 30, "weighted growers still sum to the width");
ok(w[0].width > w[1].width, "a grow:2 child is wider than a grow:1 child");

// gap
const g = flex(rect(0, 0, 11, 1), [{ grow: 1 }, { grow: 1 }], { direction: "row", gap: 1 });
eq(g[0].width + g[1].width, 10, "a gap of 1 between two children leaves 10 columns of content");
eq(g[1].col, g[0].col + g[0].width + 1, "the second track starts one column past the gap");

// column direction splits height
const col = flex(rect(0, 0, 8, 12), [{ size: 2 }, { grow: 1 }], { direction: "column" });
eq(col[0].height, 2, "a fixed column child keeps its height");
eq(col[1].height, 10, "the grower takes the remaining height");
eq(col[1].row, 2, "the second row track starts below the first");
ok(col.every((x) => x.width === 8), "column children keep the full container width");

// stack convenience
const s = stack(rect(0, 0, 10, 10), [1, null, 1]);
eq([s[0].height, s[1].height, s[2].height], [1, 8, 1], "stack honors fixed rows and grows the null");

// inset
const i = inset(rect(0, 0, 10, 10), 1);
eq(i, { row: 1, col: 1, width: 8, height: 8 }, "inset shrinks all sides by the pad");

// inset never goes negative
const tiny = inset(rect(0, 0, 1, 1), 2);
ok(tiny.width === 0 && tiny.height === 0, "inset clamps to non-negative size");

// center
const cen = center(rect(0, 0, 10, 10), 4, 2);
eq(cen, { row: 4, col: 3, width: 4, height: 2 }, "center places a box in the middle");

// empty children => empty result
eq(flex(container, []), [], "flex of no children is empty");

done("prove-layout");
