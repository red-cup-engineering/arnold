// ansi — the byte-level styling alphabet. Pure string functions over the ANSI/VT100 escape
// vocabulary: no node:fs, no node:tty, no I/O. Everything above (buffer, render) emits styled
// cells; this module is the only place that knows the escape grammar, so the render diff can
// reason about styling as data (an { fg, bg, bold, ... } record) and serialize it here once.
//
// CSI = "\x1b[" — Control Sequence Introducer. SGR (Select Graphic Rendition) sets the pen;
// the cursor/screen sequences move and clear. We keep the 16 named colors plus 256-color and
// truecolor escape hatches; a frame never needs more than these.

export const ESC = "\x1b";
export const CSI = "\x1b[";

// === cell-rendering control ==================================================================
export const cursorTo = (row, col) => `${CSI}${(row | 0) + 1};${(col | 0) + 1}H`; // 0-indexed in, 1-indexed out
export const clearLine = `${CSI}2K`;

// === the named 16-color SGR codes ============================================================
// Foreground 30–37 / 90–97 bright; background 40–47 / 100–107 bright.
const NAMED = {
  black: 0, red: 1, green: 2, yellow: 3, blue: 4, magenta: 5, cyan: 6, white: 7,
};

// fgCode(color) / bgCode(color) -> the numeric SGR parameter(s) for a color spec, or null for
// "default". A color is: a named string ("red"), "bright-red", a number 0–255 (256-color), or
// { r, g, b } (truecolor). Returns an array of SGR parameter strings.
function colorParams(color, base, brightBase, eightBitLead) {
  if (color == null || color === "default") return [];
  if (typeof color === "number") return [`${eightBitLead};5;${color & 255}`];
  if (typeof color === "object" && "r" in color) {
    return [`${eightBitLead};2;${color.r & 255};${color.g & 255};${color.b & 255}`];
  }
  if (typeof color === "string") {
    let name = color, bright = false;
    if (name.startsWith("bright-")) { bright = true; name = name.slice(7); }
    const n = NAMED[name];
    if (n === undefined) return [];
    return [`${(bright ? brightBase : base) + n}`];
  }
  return [];
}

// sgr(style) -> the SGR escape that paints `style`, or "" for the empty/default style. style is a
// flat record: { fg, bg, bold, dim, italic, underline, inverse, strike }. The render diff compares
// styles structurally (see sameStyle) and only re-emits sgr when the pen must change.
export function sgr(style = {}) {
  const params = [];
  if (style.bold) params.push("1");
  if (style.dim) params.push("2");
  if (style.italic) params.push("3");
  if (style.underline) params.push("4");
  if (style.inverse) params.push("7");
  if (style.strike) params.push("9");
  params.push(...colorParams(style.fg, 30, 90, "38"));
  params.push(...colorParams(style.bg, 40, 100, "48"));
  if (params.length === 0) return "";
  return `${CSI}${params.join(";")}m`;
}

// sameStyle(a, b) — do two styles paint the same pen? Used by the render diff so an unchanged run
// of cells emits no redundant SGR. null/undefined are the default style and compare equal.
export function sameStyle(a, b) {
  const A = a || EMPTY_STYLE, B = b || EMPTY_STYLE;
  return A.fg === B.fg && A.bg === B.bg && !!A.bold === !!B.bold && !!A.dim === !!B.dim
    && !!A.italic === !!B.italic && !!A.underline === !!B.underline
    && !!A.inverse === !!B.inverse && !!A.strike === !!B.strike;
}

export const EMPTY_STYLE = Object.freeze({});

// stripAnsi(s) — drop every CSI/SGR sequence from a string. The buffer stores plain glyphs in
// cells, so any styled string a caller hands in must be flattened to its visible width first.
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
export const stripAnsi = (s) => String(s).replace(ANSI_RE, "");

// displayWidth(s) — the visible column count of a string after stripping escapes. We treat every
// remaining code point as width 1 (the repository has not yet derived East-Asian width tables;
// stating only what we implement). Control chars are dropped from the count.
export function displayWidth(s) {
  const plain = stripAnsi(s);
  let w = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue; // C0/C1 controls
    w += 1;
  }
  return w;
}
