import { CircuitNode, Wire, GateType } from '../types';
import { COMPONENT_CONFIGS, PIN_SPACING } from '../constants';

// --- Types ---
export type Term = string; // e.g., "01-1" where - is don't care

// --- Quine-McCluskey Algorithm Helpers ---

const combineTerms = (t1: string, t2: string): string | null => {
  let diffIndex = -1;
  for (let i = 0; i < t1.length; i++) {
    if (t1[i] !== t2[i]) {
      if (diffIndex !== -1) return null; // More than 1 difference
      diffIndex = i;
    }
  }
  if (diffIndex === -1) return null; // Identical
  return t1.substring(0, diffIndex) + '-' + t1.substring(diffIndex + 1);
};

export const solveQuineMcCluskey = (numVars: number, minterms: number[]): string[] => {
  if (minterms.length === 0) return [];
  if (minterms.length === Math.pow(2, numVars)) return ['-'.repeat(numVars)]; // Always True

  // 1. Initialize groups
  let groups: Map<string, boolean> = new Map();
  minterms.forEach(m => {
    const bin = m.toString(2).padStart(numVars, '0');
    groups.set(bin, false);
  });

  let primeImplicants = new Set<string>();
  
  // 2. Iteratively combine
  let currentTerms = Array.from(groups.keys());
  
  while (currentTerms.length > 0) {
    const nextTerms = new Set<string>();
    const usedTerms = new Set<string>();
    
    // Compare every term with every other term
    for (let i = 0; i < currentTerms.length; i++) {
      for (let j = i + 1; j < currentTerms.length; j++) {
        const combined = combineTerms(currentTerms[i], currentTerms[j]);
        if (combined) {
          nextTerms.add(combined);
          usedTerms.add(currentTerms[i]);
          usedTerms.add(currentTerms[j]);
        }
      }
    }

    // Terms that couldn't be combined are Prime Implicants
    currentTerms.forEach(t => {
      if (!usedTerms.has(t)) {
        primeImplicants.add(t);
      }
    });

    if (nextTerms.size === 0) break;
    currentTerms = Array.from(nextTerms);
  }

  // Simple optimization: Remove redundant Prime Implicants (simplified approach)
  // For a visual tool, displaying all PIs is often clearer than a heavily minimized confusing set,
  // but we sort them for consistency.
  return Array.from(primeImplicants).sort();
};

// --- Equation Generator ---

export const termsToEquation = (terms: string[], variableNames: string[]): string => {
  if (terms.length === 0) return "0 (False)";
  
  // Check for Always True
  if (terms.some(t => t.split('').every(c => c === '-'))) return "1 (True)";

  const parts = terms.map(term => {
    let part = "";
    for (let i = 0; i < term.length; i++) {
      if (term[i] === '1') {
        part += variableNames[i];
      } else if (term[i] === '0') {
        part += variableNames[i] + "'"; // using ' for NOT
      }
    }
    return part === "" ? "1" : part;
  });

  return parts.join(" + ");
};

// --- Circuit Generator ---

const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateCircuitFromTerms = (
  numVars: number, 
  terms: string[], 
  startPos: { x: number, y: number }
): { nodes: CircuitNode[], wires: Wire[] } => {
  const nodes: CircuitNode[] = [];
  const wires: Wire[] = [];

  // Layout Constants
  const COL_Spacing = 180;
  const ROW_Spacing = 80;

  // 1. Create Input Switches (Column 0)
  const inputs: CircuitNode[] = [];
  const inputLabels = ['A', 'B', 'C', 'D'].slice(0, numVars);
  
  inputLabels.forEach((label, i) => {
    const node: CircuitNode = {
      id: generateId(),
      type: GateType.INPUT_SWITCH,
      position: { x: startPos.x, y: startPos.y + (i * ROW_Spacing) },
      width: 50,
      height: 50,
      inputs: [],
      state: false,
      label: label
    };
    inputs.push(node);
    nodes.push(node);
  });

  // 2. Create NOT Gates (Column 1) - Only if needed by terms
  // We strictly create NOTs based on the equation requirements.
  const notGates: Map<number, CircuitNode> = new Map(); // inputIndex -> NotGate
  const needsNot = new Array(numVars).fill(false);
  
  terms.forEach(term => {
    for(let i=0; i<term.length; i++) {
      if (term[i] === '0') needsNot[i] = true;
    }
  });

  inputs.forEach((inputNode, i) => {
    if (needsNot[i]) {
      const notNode: CircuitNode = {
        id: generateId(),
        type: GateType.NOT,
        position: { x: startPos.x + COL_Spacing, y: inputNode.position.y + 10 },
        width: COMPONENT_CONFIGS[GateType.NOT].width,
        height: COMPONENT_CONFIGS[GateType.NOT].height,
        inputs: [false],
        state: false,
        label: 'NOT'
      };
      nodes.push(notNode);
      notGates.set(i, notNode);

      wires.push({
        id: generateId(),
        sourceNodeId: inputNode.id,
        sourcePinIndex: 0,
        targetNodeId: notNode.id,
        targetPinIndex: 0,
        state: false
      });
    }
  });

  // 3. Create Product Terms (AND Gates)
  interface TermOutput {
    sourceNodeId: string;
    sourcePinIndex: number;
    yPosition: number;
  }

  const termOutputs: TermOutput[] = [];
  const AND_COL_X = startPos.x + (COL_Spacing * 2);
  
  terms.forEach((term, idx) => {
    // If term is all dashes ("---"), it's logic 1. 
    // Usually handled by logic before calling this, but if present:
    if (term === '-'.repeat(numVars) && terms.length > 1) return; 

    const connections: { nodeId: string, pinIndex: number, y: number }[] = [];
    
    for (let i = 0; i < term.length; i++) {
      const char = term[i];
      if (char === '1') {
        connections.push({ nodeId: inputs[i].id, pinIndex: 0, y: inputs[i].position.y });
      } else if (char === '0') {
        const notNode = notGates.get(i);
        if (notNode) connections.push({ nodeId: notNode.id, pinIndex: 0, y: notNode.position.y });
      }
    }

    if (connections.length === 0) {
       // Term is "1" (Always True)
       // We can represent this as a switch that defaults to ON, or ignore if part of a sum
    } else if (connections.length === 1) {
      // Direct connection (Single Variable Term)
      termOutputs.push({
        sourceNodeId: connections[0].nodeId,
        sourcePinIndex: connections[0].pinIndex,
        yPosition: connections[0].y
      });
    } else {
      // Create AND Gate (Product)
      const inputCount = connections.length;
      const height = (inputCount + 1) * PIN_SPACING;
      
      // Smart Positioning: Average Y of inputs
      const avgY = connections.reduce((sum, c) => sum + c.y, 0) / inputCount;
      
      // Collision avoidance with previous gates
      let yPos = avgY - (height / 2);
      if (idx > 0) {
        const prevY = termOutputs[termOutputs.length - 1]?.yPosition || -1000;
        // Minimal vertical distance check
        if (yPos < prevY + 60) {
           yPos = prevY + 60;
        }
      }

      const andNode: CircuitNode = {
        id: generateId(),
        type: GateType.AND,
        position: { x: AND_COL_X, y: yPos },
        width: COMPONENT_CONFIGS[GateType.AND].width,
        height: height,
        inputs: new Array(inputCount).fill(false),
        state: false,
        label: 'AND'
      };
      
      nodes.push(andNode);
      
      connections.forEach((conn, pinIdx) => {
        wires.push({
          id: generateId(),
          sourceNodeId: conn.nodeId,
          sourcePinIndex: 0,
          targetNodeId: andNode.id,
          targetPinIndex: pinIdx,
          state: false
        });
      });

      termOutputs.push({
        sourceNodeId: andNode.id,
        sourcePinIndex: 0,
        yPosition: yPos + (height / 2)
      });
    }
  });

  // 4. Create Sum Term (OR Gate)
  const OR_COL_X = AND_COL_X + COL_Spacing + 40;
  let finalOutputNodeId = '';
  let finalOutputPinIdx = 0;
  let lampY = startPos.y;

  if (termOutputs.length === 0) {
     // No terms = False. Lamp unconnected.
  } else if (termOutputs.length === 1) {
    // Single term = Direct output
    finalOutputNodeId = termOutputs[0].sourceNodeId;
    finalOutputPinIdx = termOutputs[0].sourcePinIndex;
    lampY = termOutputs[0].yPosition;
  } else {
    // Multiple terms = OR Gate
    const inputCount = termOutputs.length;
    const height = (inputCount + 1) * PIN_SPACING;
    const avgY = termOutputs.reduce((sum, t) => sum + t.yPosition, 0) / inputCount;

    const orNode: CircuitNode = {
      id: generateId(),
      type: GateType.OR,
      position: { x: OR_COL_X, y: avgY - (height/2) },
      width: COMPONENT_CONFIGS[GateType.OR].width,
      height: height,
      inputs: new Array(inputCount).fill(false),
      state: false,
      label: 'OR'
    };
    nodes.push(orNode);
    finalOutputNodeId = orNode.id;
    finalOutputPinIdx = 0;
    lampY = avgY;

    termOutputs.forEach((term, i) => {
      wires.push({
        id: generateId(),
        sourceNodeId: term.sourceNodeId,
        sourcePinIndex: term.sourcePinIndex,
        targetNodeId: orNode.id,
        targetPinIndex: i,
        state: false
      });
    });
  }

  // 5. Output Lamp
  const lampNode: CircuitNode = {
    id: generateId(),
    type: GateType.OUTPUT_LAMP,
    position: { x: OR_COL_X + 100, y: lampY - 25 }, 
    width: 50,
    height: 50,
    inputs: [false],
    state: false,
    label: 'Q'
  };
  nodes.push(lampNode);

  if (finalOutputNodeId) {
    wires.push({
      id: generateId(),
      sourceNodeId: finalOutputNodeId,
      sourcePinIndex: finalOutputPinIdx,
      targetNodeId: lampNode.id,
      targetPinIndex: 0,
      state: false
    });
  }

  return { nodes, wires };
};

// Wrapper for backward compatibility / direct calls
export const generateCircuitFromTruthTable = (
    numVars: number, 
    truthTable: boolean[], 
    startPos: { x: number, y: number }
  ) => {
    const minterms = truthTable
      .map((val, idx) => val ? idx : -1)
      .filter(idx => idx !== -1);
      
    const terms = solveQuineMcCluskey(numVars, minterms);
    return generateCircuitFromTerms(numVars, terms, startPos);
  };