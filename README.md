# @red-cup-engineering/arnold

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

A composable cell and tiling terminal-interface engine. Arnold owns cell buffers, minimal ANSI
repaints, layout, widgets, focus, and `Screen`; terminal lifecycle and normalized input come from
`@red-cup-engineering/terminal-user-interface-engine`.

It has no domain model. A system provides its own view data and draws it with Arnold's primitives.
The EAVT settled-section projection is separately available from
`@red-cup-engineering/eavt-terminal-projectors/cell`.

## Public modules

| subpath | capability |
| --- | --- |
| `@red-cup-engineering/arnold/buffer` | cell grid and changed-cell diff |
| `@red-cup-engineering/arnold/render` | diff to minimal ANSI output |
| `@red-cup-engineering/arnold/layout` | rect, stack, flex, inset, center |
| `@red-cup-engineering/arnold/widgets` | text, list, table, input, boxes, status lines |
| `@red-cup-engineering/arnold/focus` | focus-ring state transitions |
| `@red-cup-engineering/arnold/app` | `Screen` and run loop |

`arnold` runs a non-interactive scene/diff demonstration. Applications own their interactive
behavior and domain projection.
