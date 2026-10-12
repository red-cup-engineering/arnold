// prove-focus — focus traversal is a PURE state machine: nextFocus/prevFocus/currentFocus take a
// { names, index } state and return a new one, wrapping at the ends, no closures, nothing mutated.
// focusRing() is then proven to be exactly that pure core wearing a stateful wrapper (its
// current()/next()/prev() sequence must match hand-threading the pure functions call for call).

import { nextFocus, prevFocus, currentFocus, focusRing } from "../src/focus.mjs";
import { ok, eq, done } from "./_harness.mjs";

// currentFocus reads the name at the index
eq(currentFocus({ names: ["list", "filter"], index: 0 }), "list", "currentFocus reads index 0");
eq(currentFocus({ names: ["list", "filter"], index: 1 }), "filter", "currentFocus reads index 1");
eq(currentFocus({ names: [], index: 0 }), undefined, "currentFocus on an empty ring is undefined");

// nextFocus advances, wrapping past the end
const s0 = { names: ["a", "b", "c"], index: 0 };
const s1 = nextFocus(s0);
eq(s1, { names: ["a", "b", "c"], index: 1 }, "nextFocus advances by one");
const s2 = nextFocus(s1);
const s3 = nextFocus(s2);
eq(s3, { names: ["a", "b", "c"], index: 0 }, "nextFocus wraps from the last name back to the first");

// prevFocus is the mirror, wrapping backward past the start
const p1 = prevFocus(s0);
eq(p1, { names: ["a", "b", "c"], index: 2 }, "prevFocus from index 0 wraps to the last name");
eq(prevFocus(p1), { names: ["a", "b", "c"], index: 1 }, "prevFocus steps back one from there");

// nextFocus/prevFocus never mutate the state they were given
eq(s0, { names: ["a", "b", "c"], index: 0 }, "nextFocus did not mutate its input state");

// a single-name ring is a no-op fixed point in both directions
const one = { names: ["only"], index: 0 };
eq(nextFocus(one), { names: ["only"], index: 0 }, "nextFocus on a single-name ring stays put");
eq(prevFocus(one), { names: ["only"], index: 0 }, "prevFocus on a single-name ring stays put");

// an empty ring: next/prev are no-ops (nothing to advance to), not a crash
const empty = { names: [], index: 0 };
eq(nextFocus(empty), empty, "nextFocus on an empty ring returns the same state unchanged");
eq(prevFocus(empty), empty, "prevFocus on an empty ring returns the same state unchanged");

// focusRing() is the pure core wearing a stateful wrapper: its call sequence matches hand-threading
// the pure functions through the same sequence of actions.
{
  const ring = focusRing(["list", "filter", "detail"]);
  eq(ring.current(), "list", "focusRing starts at the first name");
  eq(ring.next(), "filter", "focusRing.next() returns the newly-focused name");
  eq(ring.next(), "detail", "focusRing.next() advances again");
  eq(ring.next(), "list", "focusRing.next() wraps back to the first name");
  eq(ring.prev(), "detail", "focusRing.prev() from the first name wraps to the last");
  eq(ring.current(), "detail", "focusRing.current() reflects the last prev()");
}

// a Tab-cycle app convention: dispatch on currentFocus(state) to route a key to the right reducer.
{
  let state = { names: ["list", "input"], index: 0 };
  const routeFor = (st) => (currentFocus(st) === "list" ? "list-reducer" : "input-reducer");
  eq(routeFor(state), "list-reducer", "a key routes to the list reducer while list is focused");
  state = nextFocus(state);
  eq(routeFor(state), "input-reducer", "after a Tab (nextFocus) the same key routes to the input reducer");
}

done("prove-focus");
