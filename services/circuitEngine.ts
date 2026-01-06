import { CircuitNode, GateType, Wire } from '../types';

/**
 * Calculates the output of a single node based on its inputs and type.
 */
export const computeNodeLogic = (node: CircuitNode, inputStates: boolean[]): boolean => {
  // If no inputs (shouldn't happen for logic gates, but safety first)
  if (inputStates.length === 0 && node.type !== GateType.INPUT_SWITCH && node.type !== GateType.CLOCK) {
    return false;
  }

  switch (node.type) {
    case GateType.AND:
      return inputStates.every(s => s);
    case GateType.OR:
      return inputStates.some(s => s);
    case GateType.NOT:
      return !inputStates[0];
    case GateType.NAND:
      return !inputStates.every(s => s);
    case GateType.NOR:
      return !inputStates.some(s => s);
    case GateType.XOR:
      // Multi-input XOR is technically a parity check (Odd number of TRUEs = TRUE)
      return inputStates.filter(s => s).length % 2 === 1;
    case GateType.INPUT_SWITCH:
      // State is toggled by user interaction, not inputs
      return node.state;
    case GateType.CLOCK:
      // State handled by timer in main loop
      return node.state; 
    case GateType.OUTPUT_LAMP:
      // Pass-through for visualization (taking the first input)
      return inputStates[0] || false;
    default:
      return false;
  }
};

/**
 * Propagates signals through the circuit.
 * Iteratively updates wire states and node states until stable or max depth reached.
 */
export const propagateCircuit = (
  nodes: CircuitNode[],
  wires: Wire[]
): { nodes: CircuitNode[]; wires: Wire[] } => {
  // Create a working copy
  let nextNodes = nodes.map(n => ({ ...n }));
  let nextWires = wires.map(w => ({ ...w }));

  // Create quick lookup maps
  const nodeMap = new Map<string, CircuitNode>();
  nextNodes.forEach(n => nodeMap.set(n.id, n));

  let stabilityReached = false;
  const MAX_ITERATIONS = 20; // Prevent infinite loops
  let iteration = 0;

  while (!stabilityReached && iteration < MAX_ITERATIONS) {
    stabilityReached = true;
    iteration++;

    // 1. Update Wires based on Source Nodes
    nextWires.forEach(wire => {
      const sourceNode = nodeMap.get(wire.sourceNodeId);
      if (sourceNode) {
        const newSignal = sourceNode.state;
        if (wire.state !== newSignal) {
          wire.state = newSignal;
          stabilityReached = false;
        }
      }
    });

    // 2. Update Nodes based on Input Wires
    nextNodes.forEach(node => {
      if (node.type === GateType.INPUT_SWITCH || node.type === GateType.CLOCK) {
        // Source nodes don't update based on inputs
        return;
      }

      // Gather current inputs from wires connected to this node
      const currentInputs = [...node.inputs];
      let inputsChanged = false;

      // Find wires targeting this node
      const incomingWires = nextWires.filter(w => w.targetNodeId === node.id);

      // Reset inputs that have no wires connected (default to false / Floating Low)
      // This is important if a wire was deleted
      for(let i=0; i<currentInputs.length; i++) {
        const wire = incomingWires.find(w => w.targetPinIndex === i);
        const signal = wire ? wire.state : false;
        
        if (currentInputs[i] !== signal) {
            currentInputs[i] = signal;
            inputsChanged = true;
        }
      }

      // If wires changed inputs, or we need to re-evaluate logic
      if (inputsChanged) {
        node.inputs = currentInputs;
        const newOutputState = computeNodeLogic(node, currentInputs);
        
        if (node.state !== newOutputState) {
          node.state = newOutputState;
          stabilityReached = false;
        }
      }
    });
  }

  return { nodes: nextNodes, wires: nextWires };
};