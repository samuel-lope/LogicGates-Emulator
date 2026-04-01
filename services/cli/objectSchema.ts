/**
 * @file objectSchema.ts
 * @description Centralized CLI Object Schema for LogicGateSim_Web.
 *
 * This schema declaratively maps every circuit object type to its configurable
 * parameters, mirroring exactly what is exposed in the ContextMenu.tsx component.
 * It serves as the single source of truth for the CLI parser, autocompletion
 * engine, and any future API consumers.
 */

import { GateType } from '../../types';

// ---------------------------------------------------------------------------
// Property Type Definitions
// ---------------------------------------------------------------------------

/** A numeric property with optional min/max bounds. */
export interface SchemaPropertyNumber {
  type: 'number';
  min?: number;
  max?: number;
  default?: number;
}

/** A property that must be one of a fixed list of string values. */
export interface SchemaPropertySelect<T extends string = string> {
  type: 'select';
  options: readonly T[];
  default?: T;
}

/** A property whose valid values come from a named color palette constant. */
export interface SchemaPropertyPreset {
  type: 'preset';
  /** Key of the palette constant, e.g. 'GATE_COLORS' | 'LED_COLORS' */
  source: 'GATE_COLORS' | 'LED_COLORS';
  /** Whether the CLI should allow passing '' to reset to the default color. */
  allowDefault?: boolean;
}

/** A property that represents a conditional rule. */
export interface SchemaPropertyConditional<T extends string = string> {
  type: 'select';
  options: readonly T[];
  default?: T;
  /**
   * The property is disabled if the sibling property identified by the key
   * equals the specified value.
   */
  disabledIf?: Record<string, string>;
}

/** Union of all property descriptor types. */
export type SchemaProperty =
  | SchemaPropertyNumber
  | SchemaPropertySelect
  | SchemaPropertyConditional
  | SchemaPropertyPreset;

/** Record mapping parameter names to their schema descriptors. */
export type SchemaSettings = Record<string, SchemaProperty>;

// ---------------------------------------------------------------------------
// Object Entry Definition
// ---------------------------------------------------------------------------

/**
 * Describes a single logical group of circuit objects (e.g., all multi-input gates).
 */
export interface ObjectSchemaEntry {
  /** The label displayed to the user in CLI help output. */
  label: string;
  /** Gate types that belong to this schema group. */
  variants: readonly GateType[];
  /**
   * Key→Descriptor map of every parameter that can be set via Context Menu
   * and therefore via the CLI. An empty object means no editable parameters.
   */
  contextMenuSettings: SchemaSettings;
}

// ---------------------------------------------------------------------------
// CLI Object Schema
// ---------------------------------------------------------------------------

/**
 * Master schema mapping for the LogicGateSim CLI.
 *
 * Each key is a semantic group name used as the CLI object type identifier.
 * Rules extracted directly from ContextMenu.tsx logic:
 *   - supportsVariableInputs → AND, OR, NAND, NOR, XOR
 *   - isLogicGate → AND, OR, NAND, NOR, XOR, NOT, DERIVATION
 *   - color source GATE_COLORS → logic gates + derivation
 *   - color source LED_COLORS  → output lamp + wire
 */
export const CLI_OBJECT_SCHEMA = {

  /**
   * Multi-input logic gates: AND, OR, NAND, NOR, XOR.
   * Support variable input count, gate type change, and gate color.
   */
  LogicGate: {
    label: 'Logic Gate (AND / OR / NAND / NOR / XOR)',
    variants: [
      GateType.AND,
      GateType.OR,
      GateType.NAND,
      GateType.NOR,
      GateType.XOR,
    ] as const satisfies readonly GateType[],
    contextMenuSettings: {
      gateType: {
        type: 'select',
        options: [
          GateType.AND,
          GateType.OR,
          GateType.NAND,
          GateType.NOR,
          GateType.XOR,
          GateType.NOT,
          GateType.DERIVATION,
        ],
        default: GateType.AND,
      } satisfies SchemaPropertySelect<GateType>,
      inputCount: {
        type: 'number',
        min: 2,
        max: 32,
        default: 2,
      } satisfies SchemaPropertyNumber,
      color: {
        type: 'preset',
        source: 'GATE_COLORS',
        allowDefault: true,
      } satisfies SchemaPropertyPreset,
    } satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * NOT gate: single-input inverter.
   * Supports gate type change and gate color. No variable inputs.
   */
  NOT: {
    label: 'NOT Gate',
    variants: [GateType.NOT] as const satisfies readonly GateType[],
    contextMenuSettings: {
      gateType: {
        type: 'select',
        options: [
          GateType.AND,
          GateType.OR,
          GateType.NAND,
          GateType.NOR,
          GateType.XOR,
          GateType.NOT,
          GateType.DERIVATION,
        ],
        default: GateType.NOT,
      } satisfies SchemaPropertySelect<GateType>,
      color: {
        type: 'preset',
        source: 'GATE_COLORS',
        allowDefault: true,
      } satisfies SchemaPropertyPreset,
    } satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * Derivation node: pass-through junction.
   * Supports gate type change, shape (circle/square), and gate color.
   */
  Derivation: {
    label: 'Derivation Node',
    variants: [GateType.DERIVATION] as const satisfies readonly GateType[],
    contextMenuSettings: {
      gateType: {
        type: 'select',
        options: [
          GateType.AND,
          GateType.OR,
          GateType.NAND,
          GateType.NOR,
          GateType.XOR,
          GateType.NOT,
          GateType.DERIVATION,
        ],
        default: GateType.DERIVATION,
      } satisfies SchemaPropertySelect<GateType>,
      shape: {
        type: 'select',
        options: ['circle', 'square'],
        default: 'circle',
      } satisfies SchemaPropertySelect<'circle' | 'square'>,
      color: {
        type: 'preset',
        source: 'GATE_COLORS',
        allowDefault: true,
      } satisfies SchemaPropertyPreset,
    } satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * Output LED lamp: visual signal indicator.
   * Only supports LED color change (no gate-type or input-count controls).
   */
  OutputLamp: {
    label: 'Output Lamp (LED)',
    variants: [GateType.OUTPUT_LAMP] as const satisfies readonly GateType[],
    contextMenuSettings: {
      color: {
        type: 'preset',
        source: 'LED_COLORS',
        allowDefault: false,
      } satisfies SchemaPropertyPreset,
    } satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * Input switch: manual toggle. No configurable parameters in ContextMenu.
   */
  InputSwitch: {
    label: 'Input Switch',
    variants: [GateType.INPUT_SWITCH] as const satisfies readonly GateType[],
    contextMenuSettings: {} satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * Clock: auto-toggling signal source. No configurable parameters in ContextMenu.
   */
  Clock: {
    label: 'Clock',
    variants: [GateType.CLOCK] as const satisfies readonly GateType[],
    contextMenuSettings: {} satisfies SchemaSettings,
  } satisfies ObjectSchemaEntry,

  /**
   * Wire: connection between pins.
   * Supports curve type, wire style (disabled when curve=remote), and LED color.
   */
  Wire: {
    label: 'Wire',
    variants: [] as const,          // Wires are not GateType nodes, handled separately
    contextMenuSettings: {
      wireCurveType: {
        type: 'select',
        options: ['curved', 'straight', 'remote'],
        default: 'curved',
      } satisfies SchemaPropertySelect<'curved' | 'straight' | 'remote'>,
      wireStyle: {
        type: 'select',
        options: ['solid', 'dots'],
        default: 'solid',
        disabledIf: { wireCurveType: 'remote' },
      } satisfies SchemaPropertyConditional<'solid' | 'dots'>,
      color: {
        type: 'preset',
        source: 'LED_COLORS',
        allowDefault: true,
      } satisfies SchemaPropertyPreset,
    } satisfies SchemaSettings,
  },

} as const;

/** Readonly type derived from the schema for consumers. */
export type CliObjectSchema = typeof CLI_OBJECT_SCHEMA;

/** Union of all top-level schema keys (semantic object group names). */
export type SchemaKey = keyof CliObjectSchema;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Returns the schema key for a given GateType, or null if not found.
 * Used by the CLI parser to resolve "add AND" → "LogicGate" schema group.
 */
export function getSchemaKeyForGateType(gateType: GateType): SchemaKey | null {
  for (const key of Object.keys(CLI_OBJECT_SCHEMA) as SchemaKey[]) {
    const entry = CLI_OBJECT_SCHEMA[key] as ObjectSchemaEntry;
    if ((entry.variants as readonly GateType[]).includes(gateType)) {
      return key;
    }
  }
  return null;
}

/**
 * Returns the list of editable parameter names for a given GateType.
 * Used by the autocompletion engine to suggest valid subcommands.
 */
export function getEditableParams(gateType: GateType): string[] {
  const key = getSchemaKeyForGateType(gateType);
  if (!key) return [];
  return Object.keys((CLI_OBJECT_SCHEMA[key] as ObjectSchemaEntry).contextMenuSettings);
}
