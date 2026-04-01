# Project Plan: Object CLI JSON Schema

## Overview
The user wants to export an explicit JSON list within the codebase that defines all objects, their properties, and configurable parameters mapped to the Context Menu. This will serve as the foundation to create a new method for adding and parameterizing objects via a Command Line Interface (CLI) inside the application.

## Project Type
**WEB** (React/Typescript Web Application)

## Success Criteria
- [ ] A new JSON schema file or exported configuration exists in the codebase representing all objects and editable properties.
- [ ] The schema correctly groups objects and dictates valid value types (e.g. max/min input counts, predefined color sets, available shapes).
- [ ] The schema is strictly typed (using TypeScript).

## Tech Stack
- Frontend: React + TypeScript
- Structure: JSON object as a TypeScript constant (e.g. `src/cli/object-schema.ts` or `constants.ts`)

## File Structure

```
├── constants.ts (Modify to export JSON or include external schema)
└── lib/cli/ (New folder/concept)
    └── objectSchema.ts (New file to store the JSON representation)
```

## Task Breakdown

### TASK-1: Create the JSON Schema Data Structure
- [x] **Agent**: `frontend-specialist`
- [x] **Skills**: `clean-code`
- [x] **Priority**: P0
- [x] **Dependencies**: None
- [x] **INPUT**: Read existing `types.ts`, `constants.ts` and `ContextMenu.tsx` mapping.
- [x] **OUTPUT**: Create a structured JSON-like object (e.g. `CLI_OBJECT_SCHEMA`) that explicitly maps the configurable parameters of `GateType` and `Wires`.
- [x] **VERIFY**: Check TypeScript inference. Ensure `CLI_OBJECT_SCHEMA` can be correctly iterated over to retrieve types, menus, and parameters.

**Draft JSON Structure Identified:**
```json
{
  "LogicGates": {
    "variants": ["AND", "OR", "NAND", "NOR", "XOR"],
    "contextMenuSettings": {
      "inputCount": { "type": "number", "min": 2, "max": 32 },
      "color": { "type": "preset", "source": "GATE_COLORS" },
      "gateType": { "type": "select", "options": ["AND", "OR", "NAND", "NOR", "XOR", "NOT", "DERIVATION"] }
    }
  },
  "NOT": {
    "variants": ["NOT"],
    "contextMenuSettings": {
      "color": { "type": "preset", "source": "GATE_COLORS" },
      "gateType": { "type": "select", "options": ["AND", "OR", "NAND", "NOR", "XOR", "NOT", "DERIVATION"] }
    }
  },
  "Derivation": {
    "variants": ["DERIVATION"],
    "contextMenuSettings": {
      "shape": { "type": "select", "options": ["circle", "square"] },
      "color": { "type": "preset", "source": "GATE_COLORS" },
      "gateType": { "type": "select", "options": ["AND", "OR", "NAND", "NOR", "XOR", "NOT", "DERIVATION"] }
    }
  },
  "OutputLamp": {
    "variants": ["OUTPUT_LAMP"],
    "contextMenuSettings": {
      "color": { "type": "preset", "source": "LED_COLORS" }
    }
  },
  "InputSwitch": {
    "variants": ["INPUT_SWITCH"],
    "contextMenuSettings": {}
  },
  "Clock": {
    "variants": ["CLOCK"],
    "contextMenuSettings": {}
  },
  "Wire": {
    "variants": ["WIRE"],
    "contextMenuSettings": {
      "wireCurveType": { "type": "select", "options": ["curved", "straight", "remote"] },
      "wireStyle": { "type": "select", "options": ["solid", "dots"], "disabledIf": { "wireCurveType": "remote" } },
      "color": { "type": "preset", "source": "LED_COLORS", "allowDefault": true }
    }
  }
}
```

### TASK-2: Export the Schema and Add Strict Typing
- **Agent**: `frontend-specialist`
- **Skills**: `clean-code`
- **Priority**: P1
- **Dependencies**: TASK-1
- **INPUT**: `CLI_OBJECT_SCHEMA` draft.
- **OUTPUT**: Add `export const` in a dedicated `src/lib/cli/objectSchema.ts` (or appended to `constants.ts`). Create TypeScript interfaces such as `ObjectSchemaMenu` to enforce typing constraints.
- **VERIFY**: `import { CLI_OBJECT_SCHEMA } from './path'` works without build errors (`npm run build`).

## ✅ Phase X: Verification Plan (To be executed post-implementation)
- **Lint**: Run `npm run lint` && `npx tsc --noEmit`
- **Build**: Ensure the CLI configurations compile cleanly.
- **Completion**: Verify this unblocks the implementation of the CLI parser itself.

---
*Created by Antigravity (applying knowledge of project-planner)*
