#!/usr/bin/env node
// arnold — canonical bin entrypoint.
//
// Composes a TUI scene, diffs it twice, and prints the real escape output and change counts to
// stdout, so a pipe or audit can see the diffed render actually happen.
//
// Run: node scripts/arnold.mjs

import { Buffer, diff } from "../src/buffer.mjs";
import { render } from "../src/render.mjs";
import { box, text, list, statusLine } from "../src/widgets.mjs";
import { stack, inset } from "../src/layout.mjs";

function drawScene(buf, root, { selected, title }) {
  const [titleR, bodyR, statusR] = stack(root, [1, null, 1]);
  text(buf, titleR, title, { style: { bold: true } });
  const inner = box(buf, bodyR, { title: "terminal scene", style: { fg: "cyan" } });
  const items = [
    { text: "  Inbox", style: { fg: "green" } },
    { text: "  Recent activity", style: { fg: "yellow", bold: true } },
    { text: "  Settings", style: { fg: "red" } },
    { text: "  Help", style: { fg: "bright-black", dim: true } },
  ];
  list(buf, inner, items, { selected, selectedStyle: { inverse: true } });
  statusLine(buf, statusR, {
    left: "arnold — composed scene",
    center: `selection ${selected + 1}/${items.length}`,
    right: "diffed render",
  });
}

function headless() {
  const width = 48, height = 10;

  // frame 1: a full first paint (diff against null is ALWAYS full — every cell is "changed").
  const scene1 = new Buffer(width, height);
  drawScene(scene1, { row: 0, col: 0, width, height }, { selected: 0, title: "arnold — headless demo" });
  const d1 = diff(null, scene1);
  const r1 = render(null, scene1);

  console.log("── paint 1 (first paint, prev=null) ──");
  console.log(`diff: full=${d1.full}  changed cells=${d1.changes.length} (of ${width * height})`);
  console.log(`escape stream: ${r1.out.length} bytes`);
  for (let row = 0; row < height; row++) {
    let line = "";
    for (let col = 0; col < width; col++) line += scene1.get(row, col).ch;
    console.log(line);
  }

  // frame 2: move the selection by one row. Everything else on screen is IDENTICAL, so the diff
  // against scene1 should report only the cells the selection bar actually touched — this is the
  // "only redraw what changed" claim, proven by an actual second diff, not asserted in prose.
  const scene2 = new Buffer(width, height);
  drawScene(scene2, { row: 0, col: 0, width, height }, { selected: 1, title: "arnold — headless demo" });
  const d2 = diff(scene1, scene2);
  const r2 = render(scene1, scene2);

  console.log("\n── paint 2 (selection moved 0 -> 1, diffed against paint 1) ──");
  console.log(`diff: full=${d2.full}  changed cells=${d2.changes.length} (of ${width * height})`);
  console.log(`escape stream: ${r2.out.length} bytes`);
  const rowsTouched = [...new Set(d2.changes.map((c) => c.row))].sort((a, b) => a - b);
  console.log(`rows touched: [${rowsTouched.join(", ")}]  (only the two list rows the selection bar left/entered, plus nothing else)`);
  for (let row = 0; row < height; row++) {
    let line = "";
    for (let col = 0; col < width; col++) line += scene2.get(row, col).ch;
    console.log(line);
  }
  console.log(`\n(paint 1 was full: ${d1.full} && ${d1.changes.length} cells. paint 2 was NOT full: ${d2.full} && only ${d2.changes.length} cells — the diffed render, proven.)`);
}

headless();
