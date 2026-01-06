import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  CircuitNode, 
  Wire, 
  Camera, 
  InteractionMode, 
  InteractionState, 
  GateType,
  Position,
  ProjectData
} from './types';
import { COMPONENT_CONFIGS, COLORS, PIN_SPACING } from './constants';
import { renderCircuit, screenToWorld, worldToScreen, checkWireHit } from './services/renderer';
import { propagateCircuit } from './services/circuitEngine';
import { generateCircuitFromTruthTable } from './services/quineMcCluskey';
import Toolbar from './components/Toolbar';
import { ContextMenu } from './components/ContextMenu';
import { KarnaughModal } from './components/KarnaughModal';

const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [nodes, setNodes] = useState<CircuitNode[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedWireIds, setSelectedWireIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [isKarnaughOpen, setIsKarnaughOpen] = useState(false);
  
  // Interaction State
  const [interaction, setInteraction] = useState<InteractionState>({
    mode: InteractionMode.IDLE,
    hoveredNodeId: null,
    hoveredWireId: null,
    hoveredPin: null,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
    activeWireStart: null,
    placingType: null,
  });

  // Refs
  const nodesRef = useRef(nodes);
  const wiresRef = useRef(wires);
  const interactionRef = useRef(interaction);
  const cameraRef = useRef(camera);
  const mousePosRef = useRef<Position>({ x: 0, y: 0 });
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedWireIdsRef = useRef(selectedWireIds);
  
  // Store initial positions of selected nodes when dragging starts
  const initialNodePositionsRef = useRef<Map<string, Position>>(new Map());

  // Sync refs
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { wiresRef.current = wires; }, [wires]);
  useEffect(() => { interactionRef.current = interaction; }, [interaction]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);
  useEffect(() => { selectedWireIdsRef.current = selectedWireIds; }, [selectedWireIds]);

  // Main Logic Loop (Clock & Propagation)
  useEffect(() => {
    const interval = setInterval(() => {
      let needsUpdate = false;
      const currentNodes = [...nodesRef.current];
      
      // Handle Clock Components
      currentNodes.forEach(node => {
        if (node.type === GateType.CLOCK) {
          node.state = !node.state;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        const result = propagateCircuit(currentNodes, wiresRef.current);
        setNodes(result.nodes);
        setWires(result.wires);
      }
    }, 500); // 500ms Clock tick

    return () => clearInterval(interval);
  }, []);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Handle resize
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }

      const currentInteraction = interactionRef.current;
      
      renderCircuit(
        canvas, 
        ctx, 
        nodesRef.current, 
        wiresRef.current, 
        cameraRef.current, 
        currentInteraction,
        selectedNodeIdsRef.current,
        selectedWireIdsRef.current,
        mousePosRef.current
      );

      // Draw active wire line if dragging
      if (currentInteraction.mode === InteractionMode.WIRING && currentInteraction.activeWireStart) {
        const { nodeId } = currentInteraction.activeWireStart;
        const node = nodesRef.current.find(n => n.id === nodeId);
        if (node) {
          const startX = node.position.x + node.width;
          const startY = node.position.y + node.height / 2;
          const s = worldToScreen(startX, startY, cameraRef.current);
          
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(mousePosRef.current.x, mousePosRef.current.y);
          ctx.strokeStyle = COLORS.wireActive;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // --- Actions ---
  const deleteSelected = () => {
    // Collect ids
    const nodeIdsToDelete = new Set(selectedNodeIdsRef.current);
    const wireIdsToDelete = new Set(selectedWireIdsRef.current);
    
    // Add context menu target if applicable
    if (contextMenu?.nodeId && !nodeIdsToDelete.has(contextMenu.nodeId)) {
        nodeIdsToDelete.add(contextMenu.nodeId);
    }
    
    if (nodeIdsToDelete.size === 0 && wireIdsToDelete.size === 0) return;

    // Filter nodes
    setNodes(prev => prev.filter(n => !nodeIdsToDelete.has(n.id)));
    
    // Filter wires (remove if explicitly selected OR if attached to a deleted node)
    setWires(prev => prev.filter(w => 
      !wireIdsToDelete.has(w.id) && 
      !nodeIdsToDelete.has(w.sourceNodeId) && 
      !nodeIdsToDelete.has(w.targetNodeId)
    ));

    setSelectedNodeIds([]);
    setSelectedWireIds([]);
    setContextMenu(null);
  };

  const duplicateSelected = () => {
    // If context menu was triggered on an unselected node, duplicate just that.
    // Otherwise duplicate the selection.
    let idsToDuplicate = selectedNodeIds;
    if (contextMenu?.nodeId && !idsToDuplicate.includes(contextMenu.nodeId)) {
      idsToDuplicate = [contextMenu.nodeId];
    }

    if (idsToDuplicate.length === 0) return;

    const newNodes: CircuitNode[] = [];
    const idMap = new Map<string, string>(); // oldId -> newId

    // 1. Clone Nodes
    idsToDuplicate.forEach(id => {
      const original = nodes.find(n => n.id === id);
      if (original) {
        const newId = generateId();
        idMap.set(id, newId);
        newNodes.push({
          ...original,
          id: newId,
          position: { x: original.position.x + 20, y: original.position.y + 20 },
          inputs: [...original.inputs], // Copy state
          state: original.state,
          color: original.color
        });
      }
    });

    // 2. Clone internal wires (wires connecting two duplicated nodes)
    const newWires: Wire[] = [];
    wires.forEach(w => {
      if (idMap.has(w.sourceNodeId) && idMap.has(w.targetNodeId)) {
        newWires.push({
          ...w,
          id: generateId(),
          sourceNodeId: idMap.get(w.sourceNodeId)!,
          targetNodeId: idMap.get(w.targetNodeId)!
        });
      }
    });

    setNodes(prev => [...prev, ...newNodes]);
    setWires(prev => [...prev, ...newWires]);
    
    // Select the new copies
    setSelectedNodeIds(newNodes.map(n => n.id));
    setSelectedWireIds([]); // Do not auto-select duplicated wires for now
    setContextMenu(null);
  };

  const handleInputCountChange = (delta: number) => {
    if (!contextMenu?.nodeId) return;
    
    const nodeId = contextMenu.nodeId;
    
    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id !== nodeId) return node;

      const currentCount = node.inputs.length;
      const newCount = Math.min(8, Math.max(2, currentCount + delta));
      
      if (newCount === currentCount) return node;

      let newInputs = [...node.inputs];
      
      if (newCount > currentCount) {
        // Add inputs (default false)
        for(let i = 0; i < (newCount - currentCount); i++) {
            newInputs.push(false);
        }
      } else {
        // Remove inputs from end
        newInputs = newInputs.slice(0, newCount);
        
        // Remove wires connected to deleted pins
        setWires(prevWires => prevWires.filter(w => 
           !(w.targetNodeId === nodeId && w.targetPinIndex >= newCount)
        ));
      }

      // Calculate new height based on pin count + 1 gap for top/bottom margin
      // 2 inputs = 3 spaces * 20px = 60px (Standard)
      // 8 inputs = 9 spaces * 20px = 180px
      const newHeight = (newCount + 1) * PIN_SPACING;

      return {
        ...node,
        inputs: newInputs,
        height: newHeight
      };
    }));
  };

  // --- Save / Load ---

  const handleSaveProject = () => {
    const projectData: ProjectData = {
      version: '1.0.0',
      nodes: nodes,
      wires: wires,
      camera: camera
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const projectData = JSON.parse(content) as ProjectData;
        
        // Basic validation
        if (Array.isArray(projectData.nodes) && Array.isArray(projectData.wires)) {
          setNodes(projectData.nodes);
          setWires(projectData.wires);
          if (projectData.camera) {
            setCamera(projectData.camera);
          }
          // Reset selection
          setSelectedNodeIds([]);
          setSelectedWireIds([]);
        } else {
          alert("Invalid project file format.");
        }
      } catch (err) {
        console.error("Failed to parse project file", err);
        alert("Failed to load project file.");
      }
    };
    reader.readAsText(file);
  };

  // --- Karnaugh Generator ---
  
  const handleKarnaughGenerate = (numVars: number, truthTable: boolean[]) => {
    // Determine spawn position (center of current view)
    const centerWorld = screenToWorld(
        (containerRef.current?.clientWidth || 800) / 2,
        (containerRef.current?.clientHeight || 600) / 2,
        camera
    );
    // Shift slightly left so the circuit centers better
    centerWorld.x -= 300; 
    centerWorld.y -= 200;

    const { nodes: newNodes, wires: newWires } = generateCircuitFromTruthTable(
        numVars, 
        truthTable, 
        centerWorld
    );

    // Merge into existing circuit
    setNodes(prev => [...prev, ...newNodes]);
    setWires(prev => [...prev, ...newWires]);
    setIsKarnaughOpen(false);
  };


  // --- Interaction Handlers ---

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    
    let targetNodeId = interaction.hoveredNodeId;
    
    if (targetNodeId) {
      if (!selectedNodeIds.includes(targetNodeId)) {
        setSelectedNodeIds([targetNodeId]);
        setSelectedWireIds([]);
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: targetNodeId
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y, camera);

    // Right click handled by ContextMenu or Pan
    if (e.button === 2) {
      if (!interaction.hoveredNodeId) {
        setInteraction(prev => ({
          ...prev,
          mode: InteractionMode.PANNING,
          dragStart: { x, y }
        }));
      }
      return;
    }

    // Placing Mode
    if (interaction.mode === InteractionMode.PLACING && interaction.placingType) {
      const config = COMPONENT_CONFIGS[interaction.placingType];
      const newNode: CircuitNode = {
        id: generateId(),
        type: interaction.placingType,
        position: { x: worldPos.x - config.width/2, y: worldPos.y - config.height/2 },
        width: config.width,
        height: config.height,
        inputs: new Array(config.inputCount).fill(false),
        state: false,
        label: config.label
      };
      
      setNodes(prev => [...prev, newNode]);
      setSelectedNodeIds([newNode.id]);
      setSelectedWireIds([]);
      return;
    }

    // Wiring Mode
    if (interaction.hoveredPin) {
      if (interaction.hoveredPin.type === 'output') {
        setInteraction(prev => ({
          ...prev,
          mode: InteractionMode.WIRING,
          activeWireStart: { nodeId: prev.hoveredPin!.nodeId, pinIndex: prev.hoveredPin!.index }
        }));
        setSelectedNodeIds([]); 
        setSelectedWireIds([]);
      }
      return;
    }

    // Node Interaction (Selection / Dragging)
    if (interaction.hoveredNodeId) {
      const nodeId = interaction.hoveredNodeId;
      const isSelected = selectedNodeIds.includes(nodeId);
      const isMultiSelectKey = e.shiftKey || e.ctrlKey || e.metaKey;

      let newSelection = [...selectedNodeIds];

      if (isMultiSelectKey) {
        if (isSelected) {
          newSelection = newSelection.filter(id => id !== nodeId);
        } else {
          newSelection.push(nodeId);
        }
      } else {
        if (!isSelected) {
          newSelection = [nodeId];
          setSelectedWireIds([]); // Clear wires if selecting a node without Shift
        }
      }

      setSelectedNodeIds(newSelection);
      
      // Prepare for Dragging
      const initialPosMap = new Map<string, Position>();
      nodes.forEach(n => {
        if (newSelection.includes(n.id)) {
          initialPosMap.set(n.id, { ...n.position });
        }
      });
      initialNodePositionsRef.current = initialPosMap;

      setInteraction(prev => ({
        ...prev,
        mode: InteractionMode.DRAGGING_NODE,
        dragStart: { x, y }
      }));
      return;
    }
    
    // Wire Selection Check (if no node or pin is hovered)
    // Check if we hit a wire using the logic in renderer
    const hitWireId = checkWireHit(worldPos.x, worldPos.y, wires, nodes);
    if (hitWireId) {
      const isMultiSelectKey = e.shiftKey || e.ctrlKey || e.metaKey;
      let newWireSelection = [...selectedWireIds];
      
      if (isMultiSelectKey) {
        if (newWireSelection.includes(hitWireId)) {
          newWireSelection = newWireSelection.filter(id => id !== hitWireId);
        } else {
          newWireSelection.push(hitWireId);
        }
      } else {
        newWireSelection = [hitWireId];
        setSelectedNodeIds([]); // Clear nodes if selecting wire without Shift
      }
      
      setSelectedWireIds(newWireSelection);
      return;
    }

    // Empty Space -> Selection Box
    if (!e.shiftKey && !e.ctrlKey) {
        setSelectedNodeIds([]);
        setSelectedWireIds([]);
    }
    setInteraction(prev => ({
      ...prev,
      mode: InteractionMode.SELECTING,
      dragStart: { x, y }
    }));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y };

    // Panning
    if (interaction.mode === InteractionMode.PANNING) {
      const dx = x - interaction.dragStart.x;
      const dy = y - interaction.dragStart.y;
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setInteraction(prev => ({ ...prev, dragStart: { x, y } }));
      return;
    }

    // Dragging Nodes
    if (interaction.mode === InteractionMode.DRAGGING_NODE) {
      const dx = (x - interaction.dragStart.x) / camera.zoom;
      const dy = (y - interaction.dragStart.y) / camera.zoom;
      
      setNodes(prev => prev.map(n => {
        if (initialNodePositionsRef.current.has(n.id)) {
            const initial = initialNodePositionsRef.current.get(n.id)!;
            return {
                ...n,
                position: { x: initial.x + dx, y: initial.y + dy }
            };
        }
        return n;
      }));
      return;
    }

    // Selection Box
    if (interaction.mode === InteractionMode.SELECTING) {
      const startWorld = screenToWorld(interaction.dragStart.x, interaction.dragStart.y, camera);
      const currentWorld = screenToWorld(x, y, camera);
      
      const minX = Math.min(startWorld.x, currentWorld.x);
      const maxX = Math.max(startWorld.x, currentWorld.x);
      const minY = Math.min(startWorld.y, currentWorld.y);
      const maxY = Math.max(startWorld.y, currentWorld.y);

      const enclosedIds = nodes
        .filter(n => 
          n.position.x >= minX && (n.position.x + n.width) <= maxX &&
          n.position.y >= minY && (n.position.y + n.height) <= maxY
        )
        .map(n => n.id);
      
      setSelectedNodeIds(enclosedIds);
      // Optional: Select enclosed wires too? For now, stick to nodes.
      return;
    }

    // Hover Detection
    if ([InteractionMode.IDLE, InteractionMode.WIRING, InteractionMode.PLACING].includes(interaction.mode)) {
      const worldPos = screenToWorld(x, y, camera);
      let foundNodeId: string | null = null;
      let foundPin: InteractionState['hoveredPin'] = null;

      // Check Nodes & Pins
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const config = COMPONENT_CONFIGS[node.type];
        
        // Pins - Dynamic Check
        const inputCount = node.inputs.length;
        const pinSpacingIn = node.height / (inputCount + 1);
        for (let p = 0; p < inputCount; p++) {
          const px = node.position.x;
          const py = node.position.y + (pinSpacingIn * (p + 1));
          if (Math.hypot(worldPos.x - px, worldPos.y - py) < 10) {
            foundPin = { nodeId: node.id, type: 'input', index: p };
            break;
          }
        }
        if (foundPin) break;

        if (config.outputCount > 0) {
          const px = node.position.x + node.width;
          const py = node.position.y + node.height / 2;
          if (Math.hypot(worldPos.x - px, worldPos.y - py) < 10) {
            foundPin = { nodeId: node.id, type: 'output', index: 0 };
            break;
          }
        }
        if (foundPin) break;

        // Body
        if (worldPos.x >= node.position.x && worldPos.x <= node.position.x + node.width &&
            worldPos.y >= node.position.y && worldPos.y <= node.position.y + node.height) {
          foundNodeId = node.id;
          break;
        }
      }
      
      // Check Wires (Only if no node/pin hovered to avoid noise)
      let foundWireId: string | null = null;
      if (!foundNodeId && !foundPin) {
        foundWireId = checkWireHit(worldPos.x, worldPos.y, wires, nodes);
      }

      setInteraction(prev => ({
        ...prev,
        hoveredNodeId: foundNodeId,
        hoveredPin: foundPin,
        hoveredWireId: foundWireId
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Complete Wiring
    if (interaction.mode === InteractionMode.WIRING && interaction.hoveredPin && interaction.activeWireStart) {
      if (interaction.hoveredPin.type === 'input') {
        const newWire: Wire = {
          id: generateId(),
          sourceNodeId: interaction.activeWireStart.nodeId,
          sourcePinIndex: interaction.activeWireStart.pinIndex,
          targetNodeId: interaction.hoveredPin.nodeId,
          targetPinIndex: interaction.hoveredPin.index,
          state: false
        };
        
        const exists = wires.some(w => 
          w.targetNodeId === newWire.targetNodeId && w.targetPinIndex === newWire.targetPinIndex
        );

        if (!exists) {
          const newWires = [...wires, newWire];
          const res = propagateCircuit(nodes, newWires);
          setNodes(res.nodes);
          setWires(res.wires);
        }
      }
    }

    // Toggle Switch click handling
    if (interaction.mode === InteractionMode.DRAGGING_NODE) {
      const dist = Math.hypot(e.clientX - interaction.dragStart.x, e.clientY - interaction.dragStart.y);
      if (dist < 3 && interaction.hoveredNodeId) {
        const node = nodes.find(n => n.id === interaction.hoveredNodeId);
        if (node && node.type === GateType.INPUT_SWITCH) {
           const newNodes = nodes.map(n => 
             n.id === node.id ? { ...n, state: !n.state } : n
           );
           const res = propagateCircuit(newNodes, wires);
           setNodes(res.nodes);
           setWires(res.wires);
        }
      }
    }

    setInteraction(prev => ({
      ...prev,
      mode: prev.mode === InteractionMode.PLACING ? InteractionMode.PLACING : InteractionMode.IDLE,
      activeWireStart: null,
      dragStart: { x: 0, y: 0 }
    }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newZoom = Math.min(Math.max(camera.zoom + (direction * zoomIntensity), 0.2), 3);
    setCamera(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const selectTool = (mode: InteractionMode, gateType?: GateType) => {
    setInteraction(prev => ({
      ...prev,
      mode: mode,
      placingType: gateType || null
    }));
    if (mode !== InteractionMode.IDLE) {
      setSelectedNodeIds([]);
      setSelectedWireIds([]);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#1e1e1e] overflow-hidden">
      <Toolbar 
        onSelectTool={selectTool} 
        currentMode={interaction.mode} 
        selectedGateType={interaction.placingType}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        onOpenKarnaugh={() => setIsKarnaughOpen(true)}
      />
      
      <div 
        ref={containerRef} 
        className="w-full h-full cursor-crosshair"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
          className="block"
        />
      </div>

      <KarnaughModal 
        isOpen={isKarnaughOpen}
        onClose={() => setIsKarnaughOpen(false)}
        onGenerate={handleKarnaughGenerate}
      />

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          nodeType={nodes.find(n => n.id === contextMenu.nodeId)?.type}
          currentColor={nodes.find(n => n.id === contextMenu.nodeId)?.color}
          inputCount={nodes.find(n => n.id === contextMenu.nodeId)?.inputs.length}
          onColorChange={(color) => {
             setNodes(prev => prev.map(n => n.id === contextMenu.nodeId ? { ...n, color } : n));
          }}
          onInputCountChange={handleInputCountChange}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div className="absolute top-4 right-4 pointer-events-none text-zinc-500 text-xs font-mono">
        Nodes: {nodes.length} | Wires: {wires.length} | Zoom: {Math.round(camera.zoom * 100)}% | Selected: {selectedNodeIds.length + selectedWireIds.length}
      </div>
    </div>
  );
};

export default App;