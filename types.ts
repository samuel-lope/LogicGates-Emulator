export enum GateType {
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  NAND = 'NAND',
  NOR = 'NOR',
  XOR = 'XOR',
  INPUT_SWITCH = 'INPUT_SWITCH',
  OUTPUT_LAMP = 'OUTPUT_LAMP',
  CLOCK = 'CLOCK',
  DERIVATION = 'DERIVATION'
}

export interface Position {
  x: number;
  y: number;
}

export interface PinDef {
  id: string;
  type: 'input' | 'output';
  label?: string;
}

export interface CircuitNode {
  id: string;
  type: GateType;
  position: Position;
  state: boolean; // Main output state (High/Low)
  inputs: boolean[]; // Current state of inputs
  width: number;
  height: number;
  label: string;
  color?: string; // Optional custom color (e.g. for LEDs/Wires/Gates)
  shape?: 'circle' | 'square'; // For Derivation
}

export type WireCurveType = 'curved' | 'straight' | 'remote';
export type WireStyle = 'solid' | 'dots';

export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePinIndex: number; // usually 0 for single output gates
  targetNodeId: string;
  targetPinIndex: number;
  state: boolean;
  curveType?: WireCurveType;
  wireStyle?: WireStyle;
  color?: string;
  waypoints?: Position[]; // For straight wires
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export enum InteractionMode {
  IDLE = 'IDLE',
  PANNING = 'PANNING',
  DRAGGING_NODE = 'DRAGGING_NODE',
  WIRING = 'WIRING',
  PLACING = 'PLACING',
  SELECTING = 'SELECTING'
}

export interface InteractionState {
  mode: InteractionMode;
  hoveredNodeId: string | null;
  hoveredWireId: string | null;
  hoveredPin: { nodeId: string; type: 'input' | 'output'; index: number } | null;
  dragStart: Position; // Screen coordinates
  dragOffset: Position; // Offset from node center (Legacy/Single) or unused in multi-drag
  activeWireStart: { nodeId: string; pinIndex: number; waypoints?: Position[] } | null;
  activeWireCurveType: WireCurveType;
  placingType: GateType | null;
  draggingWaypoint: { wireId: string; index: number } | null;
}

export interface ProjectData {
  version: string;
  nodes: CircuitNode[];
  wires: Wire[];
  camera: Camera;
}