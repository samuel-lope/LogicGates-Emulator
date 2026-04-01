# Changelog

Recent updates to the **LogicGateSim_Web** digital circuit simulator.

---

## [1.2.0] - 2026-04-01
### Added
- **Visual Highlight Mode:** Objects now glow in **Cyan** when navigated through the CLI suggestion list.
- **CLI Refinement:** New `cliHoveredNodeId` state to decouple terminal interaction from mouse cursor hover.

## [1.1.0] - 2026-03-31
### Added
- **Command Line Interface (CLI):** Context-aware terminal at the bottom of the screen.
- **Commands:** `ADD`, `EDIT`, and `DEL` for rapid component manipulation.
- **IntelliSense:** Dynamic autocomplete with keyboard navigation (Arrows/Tab) and ID-based selection.
- **Aliases:** Support for `SW`, `LED`, `CLK`, and `DER` aliases.

### Changed
- **Architecture:** Migrated command logic from `App.tsx` to a decoupled `services/cliEngine.ts` using the Command Registry pattern.

## [1.0.0] - 2026-03-30
### Added
- **Core Simulation Engine:** Real-time Boolean logic propagation using an event-driven approach.
- **Graphic Engine:** High-performance HTML5 Canvas renderer with world-space transformation (Pan/Zoom).
- **Component Set:** Initial support for standard IEEE logic gates (AND, OR, NOT, etc.).
- **Truth Table Integration:** Interactive truth table viewer for individual components via context menu.
- **Quine-McCluskey Solver:** Boolean expression simplification module.
