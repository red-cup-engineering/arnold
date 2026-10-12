// app — Arnold's cell/tiling composition layer. Terminal ownership belongs to
// terminal-user-interface-engine; Screen owns only the shown cell buffer and turns changed cells
// into bytes. Buffer, layout, and widgets remain pure.
//
// Usage:
//   const screen = new Screen();
//   screen.start();
//   screen.onKey((k) => { ...update state...; screen.render(draw); });
//   screen.render(draw);                 // draw(buf, rect) paints a fresh frame
//   screen.stop();                       // restores the terminal

import { Buffer } from "./buffer.mjs";
import { render as renderDiff } from "./render.mjs";
import { rect } from "./layout.mjs";
import { TerminalSession } from "@red-cup-engineering/terminal-user-interface-engine";

export class Screen {
  constructor(opts = {}) {
    this.terminal = opts.terminal || new TerminalSession({
      input: opts.in,
      output: opts.out,
      env: opts.env,
    });
    this.out = this.terminal.output;
    this.keyboard = this.terminal.keyboard;
    this.shown = null; // the buffer currently on screen; null forces a full first paint
    this._onResize = () => { this.shown = null; this._emitResize(); };
    this._resizeHandlers = [];
    this.terminal.onResize(this._onResize);
  }

  get width() { return this.terminal.columns; }
  get height() { return this.terminal.rows; }
  rect() { return rect(0, 0, this.width, this.height); }

  start() {
    this.terminal.start();
    return this;
  }

  stop() {
    this.terminal.stop();
    return this;
  }

  onKey(fn) { this.terminal.onKey(fn); return this; }
  onInterrupt(fn) { this.terminal.onInterrupt(fn); return this; }
  onResize(fn) { this._resizeHandlers.push(fn); return this; }
  _emitResize() { for (const fn of this._resizeHandlers) fn(this.rect()); }

  // render(draw) — build a fresh buffer at the current size, let `draw(buf, rect)` paint it, diff it
  // against the shown buffer, write the minimal escape stream, and adopt the new buffer as shown.
  render(draw) {
    const buf = new Buffer(this.width, this.height);
    draw(buf, this.rect());
    const { out } = renderDiff(this.shown, buf);
    if (out) this.out.write(out);
    this.shown = buf;
    return this;
  }

  // paint(buf) — adopt and diff an already-drawn buffer (for callers that build their own).
  paint(buf) {
    const { out } = renderDiff(this.shown, buf);
    if (out) this.out.write(out);
    this.shown = buf;
    return this;
  }
}

// run(opts) — a tiny driver for the append/settle/PROJECT/loop rhythm the kernel note describes.
// You give it: an initial state, a `view(state) -> draw` (state to a draw function), and a
// `reducer(state, key) -> state | {state, quit}`. It renders, then on each key reduces and
// re-renders. This is the TUI as "read -> settle -> project -> loop" with project = view + diff.
export function run({ state, view, reducer, screen = new Screen() }) {
  let s = state;
  screen.start();
  const paint = () => screen.render(view(s));
  paint();
  screen.onKey((k) => {
    const next = reducer(s, k);
    if (next && next.quit) { screen.stop(); process.exit(0); }
    s = next && next.state !== undefined ? next.state : (next ?? s);
    paint();
  });
  screen.onInterrupt(() => { screen.stop(); process.exit(0); });
  return screen;
}
