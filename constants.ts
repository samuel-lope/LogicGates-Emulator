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
  imageSrc?: string; // Optional image source (PNG/SVG)
}

// SVG Generators for Professional Look
const svgBase = (content: string, w: number, h: number) => 
  `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <style>path, circle { fill: #333333; stroke: #e0e0e0; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }</style>
  ${content}
</svg>`)}`;

const GATES_SVG = {
  AND: svgBase('<path d="M0,0 L40,0 A30,30 0 0,1 40,60 L0,60 Z" />', 80, 60),
  OR: svgBase('<path d="M0,0 Q25,30 0,60 L15,60 Q55,60 80,30 Q55,0 15,0 L0,0 Z" />', 80, 60),
  NOT: svgBase('<path d="M0,0 L0,40 L45,20 Z" /><circle cx="50" cy="20" r="4" />', 60, 40),
  NAND: svgBase('<path d="M0,0 L40,0 A30,30 0 0,1 40,60 L0,60 Z" /><circle cx="74" cy="30" r="4" />', 80, 60),
  NOR: svgBase('<path d="M0,0 Q25,30 0,60 L15,60 Q55,60 80,30 Q55,0 15,0 L0,0 Z" /><circle cx="84" cy="30" r="4" />', 80, 60),
  XOR: svgBase('<path d="M10,0 Q35,30 10,60 L25,60 Q65,60 90,30 Q65,0 25,0 L10,0 Z" /><path d="M0,0 Q25,30 0,60" fill="none" />', 90, 60),
};

export const COMPONENT_CONFIGS: Record<GateType, ComponentConfig> = {
  [GateType.AND]: { 
    type: GateType.AND, 
    label: 'AND', 
    width: 120, // Increased for leads
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Output High only if all inputs are High.',
    imageSrc: GATES_SVG.AND
  },
  [GateType.OR]: { 
    type: GateType.OR, 
    label: 'OR', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Output High if any input is High.',
    imageSrc: GATES_SVG.OR
  },
  [GateType.NOT]: { 
    type: GateType.NOT, 
    label: 'NOT', 
    width: 100, 
    symbolWidth: 60,
    height: 40, 
    inputCount: 1, 
    outputCount: 1, 
    description: 'Inverts the input signal.',
    imageSrc: GATES_SVG.NOT
  },
  [GateType.NAND]: { 
    type: GateType.NAND, 
    label: 'NAND', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'AND followed by NOT.',
    imageSrc: GATES_SVG.NAND
  },
  [GateType.NOR]: { 
    type: GateType.NOR, 
    label: 'NOR', 
    width: 120, 
    symbolWidth: 80,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'OR followed by NOT.',
    imageSrc: GATES_SVG.NOR
  },
  [GateType.XOR]: { 
    type: GateType.XOR, 
    label: 'XOR', 
    width: 130, 
    symbolWidth: 90,
    height: 60, 
    inputCount: 2, 
    outputCount: 1, 
    description: 'Exclusive OR.',
    imageSrc: GATES_SVG.XOR
  },
  [GateType.INPUT_SWITCH]: { type: GateType.INPUT_SWITCH, label: 'SW', width: 50, height: 50, inputCount: 0, outputCount: 1, description: 'Toggle switch for logic High/Low.' },
  [GateType.OUTPUT_LAMP]: { type: GateType.OUTPUT_LAMP, label: 'LED', width: 50, height: 50, inputCount: 1, outputCount: 0, description: 'Visual indicator of signal state.' },
  [GateType.CLOCK]: { type: GateType.CLOCK, label: 'CLK', width: 50, height: 50, inputCount: 0, outputCount: 1, description: 'Toggles signal periodically.' },
};