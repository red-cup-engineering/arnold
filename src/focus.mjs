// focus — a tiny pure focus-ring primitive: "which widget currently owns the keyboard", plus a
// Tab-cycle convention. arnold's Screen delivers every keypress to one global reducer
// (Screen.onKey / app.mjs's run()); nothing in buffer/layout/widgets knows about MULTIPLE
// navigable widgets sharing one keyboard. A list-plus-filter-input app (a shelf browser: a list of
// items, an optional "/" filter line) needs exactly this, and nothing in arnold provided it before.
//
// The core is a PURE state machine — { names, index } in, { names, index } out — the same shape as
// editInput/selectInList: a state and an action go in, the next state comes out, nothing is
// mutated, nothing closes over anything. That is what makes focus traversal testable byte-for-byte
// the way the rest of arnold is.
//
// Convention for callers: an app's onKey checks `k.name === "tab"` (cycle forward, or shift+tab to
// cycle back) FIRST, and only if that doesn't match dispatches the key to whichever pure reducer
// belongs to the currently-focused name (e.g. `focus.names[focus.index] === "list"` routes to
// `selectInList`, `"filter"` routes to `editInput`).

// nextFocus(state) — advance the ring by one, wrapping past the end. `state` is
// `{ names: string[], index: number }`. Returns a NEW state (or the same state, unchanged, for an
// empty ring — advancing nowhere is a no-op, not a crash).
export function nextFocus(state) {
  const n = state.names.length;
  if (n === 0) return state;
  return { names: state.names, index: (state.index + 1) % n };
}

// prevFocus(state) — the same, backward.
export function prevFocus(state) {
  const n = state.names.length;
  if (n === 0) return state;
  return { names: state.names, index: (state.index - 1 + n) % n };
}

// currentFocus(state) — the name the ring currently points at, or undefined for an empty ring.
export function currentFocus(state) {
  return state.names[state.index];
}

// focusRing(names) — a thin STATEFUL convenience wrapper over the pure functions above, for a
// caller that would rather hold "the ring" as one object than thread { names, index } through its
// own app state by hand. current()/next()/prev() close over one cell and delegate to
// currentFocus/nextFocus/prevFocus, so its behavior is exactly what the pure-function tests prove.
export function focusRing(names) {
  let state = { names: [...names], index: 0 };
  return {
    current: () => currentFocus(state),
    next: () => { state = nextFocus(state); return currentFocus(state); },
    prev: () => { state = prevFocus(state); return currentFocus(state); },
  };
}
