import { CircuitNode, Wire, GateType } from '../types';
import { COMPONENT_CONFIGS, PIN_SPACING } from '../constants';

// --- Types ---
type Term = string; // e.g., "01-1" where - is don't care

// --- Quine-McCluskey Algorithm Helpers ---

const countOnes = (term: string) => term.split('').filter(c => c === '1').length;

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

  // Note: A full QM implementation would now assume a Prime Implicant Chart to find 
  // the Essential Prime Implicants. For this visual simulator, using all PIs is 
  // usually acceptable and safer to ensure coverage, even if not 100% minimal.
  return Array.from(primeImplicants);
};

// --- Circuit Generator ---

const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateCircuitFromTruthTable = (
  numVars: number, 
  truthTable: boolean[], // length 2^numVars
  startPos: { x: number, y: number }
): { nodes: CircuitNode[], wires: Wire[] } => {
  const nodes: CircuitNode[] = [];
  const wires: Wire[] = [];
  
  // 1. Get Simplified Terms
  const minterms = truthTable
    .map((val, idx) => val ? idx : -1)
    .filter(idx => idx !== -1);
    
  const simplifiedTerms = solveQuineMcCluskey(numVars, minterms);

  // Layout Constants
  const COL_Spacing = 150;
  const ROW_Spacing = 80;
  const HEADER_Y = startPos.y;

  // 2. Create Input Switches (Column 0)
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

  // 3. Create NOT Gates (Column 1) - Only if needed by terms
  // We map '0' in a term to a NOT gate for that input index
  const notGates: Map<number, CircuitNode> = new Map(); // inputIndex -> NotGate
  
  // Check which inputs need negation
  const needsNot = new Array(numVars).fill(false);
  simplifiedTerms.forEach(term => {
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

      // Wire Input -> NOT
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

  // 4. Create AND Gates (Column 2) - One for each term
  const andGates: CircuitNode[] = [];
  const AND_COL_X = startPos.x + (COL_Spacing * 2);
  
  // If result is always TRUE or FALSE, handle separately? 
  // For simpliciy, if simplifiedTerms is empty, it's FALSE. If one term is all '-', it's TRUE.
  
  if (simplifiedTerms.length === 0) {
    // Always False -> Just a Lamp off? 
    // We'll create a lamp and leave it disconnected (Floating Low)
  } else if (simplifiedTerms.length === 1 && simplifiedTerms[0] === '-'.repeat(numVars)) {
    // Always True -> Connect Lamp to a default ON source? 
    // Or connect to an OR gate with inverted inputs cancelling out? 
    // Edge case: Let's simpler logic handle specific terms.
  }

  simplifiedTerms.forEach((term, idx) => {
    // Skip terms that are purely "don't care" (handled by logic, but ensuring sanity)
    if (term === '-'.repeat(numVars) && simplifiedTerms.length > 1) return; 

    // Determine inputs for this AND gate
    // A term like "1-0" (Vars A,B,C) means: A AND (NOT C)
    const connections: { nodeId: string, pinIndex: number }[] = [];
    
    for (let i = 0; i < term.length; i++) {
      const char = term[i];
      if (char === '1') {
        connections.push({ nodeId: inputs[i].id, pinIndex: 0 });
      } else if (char === '0') {
        const notNode = notGates.get(i);
        if (notNode) connections.push({ nodeId: notNode.id, pinIndex: 0 });
      }
    }

    // Special case: If term is all dashes ("---"), it's an "Always True" condition.
    // In logic circuits, this is VCC. We can simulate by connecting A and NOT A to an OR? 
    // For this tool, if we have connections, we make an AND.
    
    if (connections.length > 0) {
      const gateType = connections.length === 1 ? GateType.OR : GateType.AND; // Use OR as buffer for single input
      const inputCount = connections.length;
      const height = (inputCount + 1) * PIN_SPACING;

      const andNode: CircuitNode = {
        id: generateId(),
        type: connections.length === 1 ? GateType.OR : GateType.AND, // Visual buffer
        position: { x: AND_COL_X, y: startPos.y + (idx * (height + 20)) },
        width: COMPONENT_CONFIGS[GateType.AND].width,
        height: height,
        inputs: new Array(inputCount).fill(false),
        state: false,
        label: connections.length === 1 ? 'BUF' : 'AND'
      };
      
      nodes.push(andNode);
      andGates.push(andNode);

      // Wire inputs to this gate
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
    }
  });

  // 5. Create OR Gate (Column 3) - Sum of Products
  const OR_COL_X = AND_COL_X + COL_Spacing + 40;
  const lampPos = { x: OR_COL_X + 100, y: startPos.y };
  let finalOutputNodeId = '';

  if (andGates.length > 0) {
    if (andGates.length === 1) {
      // Direct connection (only one term)
      finalOutputNodeId = andGates[0].id;
    } else {
      const inputCount = andGates.length;
      const height = (inputCount + 1) * PIN_SPACING;
      // Center the OR gate vertically relative to AND gates
      const avgY = andGates.reduce((sum, n) => sum + n.position.y, 0) / andGates.length;

      const orNode: CircuitNode = {
        id: generateId(),
        type: GateType.OR,
        position: { x: OR_COL_X, y: avgY },
        width: COMPONENT_CONFIGS[GateType.OR].width,
        height: height,
        inputs: new Array(inputCount).fill(false),
        state: false,
        label: 'OR'
      };
      nodes.push(orNode);
      finalOutputNodeId = orNode.id;
      lampPos.y = avgY + (height / 2) - 25;

      // Wire ANDs to OR
      andGates.forEach((andGate, i) => {
        wires.push({
          id: generateId(),
          sourceNodeId: andGate.id,
          sourcePinIndex: 0,
          targetNodeId: orNode.id,
          targetPinIndex: i,
          state: false
        });
      });
    }
  }

  // 6. Create Output Lamp
  const lampNode: CircuitNode = {
    id: generateId(),
    type: GateType.OUTPUT_LAMP,
    position: lampPos,
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
      sourcePinIndex: 0,
      targetNodeId: lampNode.id,
      targetPinIndex: 0,
      state: false
    });
  }

  return { nodes, wires };
};