import { GateType } from './types';

// Palette from JSON requirements
export const COLORS = {
  background: '#1e1e1e',
  gridLines: '#2a2a2a',
  componentBody: '#333333',
  componentBorder: '#555555',
  componentBorderSelected: '#ffffff',
  textColor: '#e0e0e0',
  wireInactive: '#4a4a4a',
  wireActive: '#00ff41', // Neon Green
  pinInput: '#ffcc00',
  pinOutput: '#00ccff',
  lampOn: '#00ff41',
  lampOff: '#222222',
};

export const LED_COLORS = {
  GREEN: '#00ff41',
  RED: '#ff0033',
  BLUE: '#00ccff',
  YELLOW: '#ffcc00',
  WHITE: '#ffffff',
  ORANGE: '#ff8800',
  PURPLE: '#9900ff',
  PINK: '#ff00ff',
  CYAN: '#00ffff',
};

export const GATE_COLORS = {
  DEFAULT: '#333333',
  RED: '#5a2a2a',
  GREEN: '#2a5a2a',
  BLUE: '#2a2a5a',
  YELLOW: '#5a5a2a',
  PURPLE: '#4a2a5a',
  CYAN: '#2a5a5a',
  ORANGE: '#5a3a2a',
};

export const GRID_SIZE = 20;
export const PIN_SPACING = 20; // Vertical space per pin/gap

export interface ComponentConfig {
  type: GateType;
  label: string;
  width: number; // Total distance between input and output pins
  symbolWidth?: number; // Width of the graphical symbol. Defaults to width if undefined.
  height: number;
  inputCount: number;
  outputCount: number;
  description: string;
}

export const COMPONENT_CONFIGS: Record<GateType, ComponentConfig> = {
  [GateType.AND]: { 
    type: GateType.AND, 
    label: 'AND', 
    width: 120, // Increased for leads
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Output High only if all inputs are High.'
  },
  [GateType.OR]: { 
    type: GateType.OR, 
    label: 'OR', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Output High if any input is High.'
  },
  [GateType.NOT]: { 
    type: GateType.NOT, 
    label: 'NOT', 
    width: 100, 
    symbolWidth: 60,
    height: 40, 
    inputCount: 1, 
    outputCount: 1, 
    description: 'Inverts the input signal.'
  },
  [GateType.NAND]: { 
    type: GateType.NAND, 
    label: 'NAND', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'AND followed by NOT.'
  },
  [GateType.NOR]: { 
    type: GateType.NOR, 
    label: 'NOR', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'OR followed by NOT.'
  },
  [GateType.XOR]: { 
    type: GateType.XOR, 
    label: 'XOR', 
    width: 130, 
    symbolWidth: 90,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Exclusive OR.'
  },
  [GateType.INPUT_SWITCH]: { 
    type: GateType.INPUT_SWITCH, 
    label: 'SW', 
    width: 50, 
    height: 50, 
    inputCount: 0, 
    outputCount: 1, 
    description: 'Toggle switch for logic High/Low.'
  },
  [GateType.OUTPUT_LAMP]: { 
    type: GateType.OUTPUT_LAMP, 
    label: 'LED', 
    width: 50, 
    height: 50, 
    inputCount: 1, 
    outputCount: 0, 
    description: 'Visual indicator of signal state.'
  },
  [GateType.CLOCK]: { 
    type: GateType.CLOCK, 
    label: 'CLK', 
    width: 50, 
    height: 50, 
    inputCount: 0, 
    outputCount: 1, 
    description: 'Toggles signal periodically.'
  },
};