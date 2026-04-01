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
import { COMPONENT_CONFIGS, COLORS, PIN_SPACING, GATE_COLORS, LED_COLORS } from './constants';
import { renderCircuit, screenToWorld, worldToScreen, checkWireHit, checkWaypointHit, getClosestSegmentIndex } from './services/renderer';
import { propagateCircuit, computeNodeLogic } from './services/circuitEngine';
import Toolbar from './components/Toolbar';
import { ContextMenu } from './components/ContextMenu';
import CommandLine from './components/CommandLine';
import { cliEngine, registerCoreCommands } from './services/cliEngine';

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string; wireId?: string } | null>(null);
  const [isMatrixExpanded, setIsMatrixExpanded] = useState(false);
  const [truthTableNodeId, setTruthTableNodeId] = useState<string | null>(null);

  // Interaction State
  const [interaction, setInteraction] = useState<InteractionState>({
    mode: InteractionMode.IDLE,
    hoveredNodeId: null,
    hoveredWireId: null,
    hoveredPin: null,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
    activeWireStart: null,
    activeWireCurveType: 'curved',
    placingType: null,
    draggingWaypoint: null,
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

  useEffect(() => {
    registerCoreCommands();
  }, []);

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

    const render = (time: number) => {
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
        mousePosRef.current,
        time
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
          ctx.lineDashOffset = -(time / 50);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
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
      const newCount = Math.min(32, Math.max(2, currentCount + delta)); // Increased limit to 32

      if (newCount === currentCount) return node;

      let newInputs = [...node.inputs];

      if (newCount > currentCount) {
        // Add inputs (default false)
        for (let i = 0; i < (newCount - currentCount); i++) {
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
  const handleChangeNodeType = (newType: GateType) => {
    if (!contextMenu?.nodeId) return;

    const nodeId = contextMenu.nodeId;
    const config = COMPONENT_CONFIGS[newType];

    setNodes(prevNodes => prevNodes.map(node => {
      if (node.id !== nodeId) return node;

      let newInputs = [...node.inputs];
      let newCount = newInputs.length;

      const supportsVariableInputs = [
        GateType.AND,
        GateType.OR,
        GateType.NAND,
        GateType.NOR,
        GateType.XOR
      ].includes(newType);

      if (!supportsVariableInputs) {
        newCount = config.inputCount;
      } else {
        newCount = Math.max(2, newCount);
      }

      if (newCount > newInputs.length) {
        for (let i = 0; i < (newCount - newInputs.length); i++) {
          newInputs.push(false);
        }
      } else if (newCount < newInputs.length) {
        newInputs = newInputs.slice(0, newCount);

        setWires(prevWires => prevWires.filter(w =>
          !(w.targetNodeId === nodeId && w.targetPinIndex >= newCount)
        ));
      }

      const newHeight = supportsVariableInputs ? (newCount + 1) * PIN_SPACING : config.height;

      return {
        ...node,
        type: newType,
        label: config.label,
        width: config.width,
        height: newHeight,
        inputs: newInputs
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

  // --- Interaction Handlers ---

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    let targetNodeId = interaction.hoveredNodeId;
    let targetWireId = interaction.hoveredWireId;

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
    } else if (targetWireId) {
      if (!selectedWireIds.includes(targetWireId)) {
        setSelectedWireIds([targetWireId]);
        setSelectedNodeIds([]);
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        wireId: targetWireId
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu) setContextMenu(null);

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y, camera);

    // Right click handled by ContextMenu or Pan or Wiring cancel
    if (e.button === 2) {
      if (interaction.mode === InteractionMode.WIRING) {
        // Handled in mouseUp
        return;
      }
      if (!interaction.hoveredNodeId && !interaction.hoveredWireId) {
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
        position: { x: worldPos.x - config.width / 2, y: worldPos.y - config.height / 2 },
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

    // Waypoint Interaction (Dragging / Removing)
    const waypointHit = checkWaypointHit(worldPos.x, worldPos.y, wires, selectedWireIds);
    if (waypointHit) {
      if (e.detail === 2) {
        // Double click to remove waypoint
        setWires(prev => prev.map(w => {
          if (w.id === waypointHit.wireId) {
            const newWaypoints = [...(w.waypoints || [])];
            newWaypoints.splice(waypointHit.index, 1);
            return { ...w, waypoints: newWaypoints };
          }
          return w;
        }));
      } else {
        // Start dragging waypoint
        setInteraction(prev => ({
          ...prev,
          draggingWaypoint: waypointHit
        }));
      }
      return;
    }

    // Wire Selection Check (if no node or pin is hovered)
    // Check if we hit a wire using the logic in renderer
    const hitWireId = checkWireHit(worldPos.x, worldPos.y, wires, nodes);
    if (hitWireId) {
      if (e.detail === 2) {
        // Double click on straight wire to add waypoint
        const wire = wires.find(w => w.id === hitWireId);
        if (wire && wire.curveType === 'straight') {
          const segmentIndex = getClosestSegmentIndex(worldPos.x, worldPos.y, wire, nodes);
          if (segmentIndex !== -1) {
            setWires(prev => prev.map(w => {
              if (w.id === hitWireId) {
                const newWaypoints = [...(w.waypoints || [])];
                newWaypoints.splice(segmentIndex, 0, { x: worldPos.x, y: worldPos.y });
                return { ...w, waypoints: newWaypoints };
              }
              return w;
            }));
            // Also select the wire if not selected
            if (!selectedWireIds.includes(hitWireId)) {
              setSelectedWireIds([hitWireId]);
              setSelectedNodeIds([]);
            }
            return;
          }
        }
      }

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

    // Dragging Waypoints
    if (interaction.draggingWaypoint) {
      const worldPos = screenToWorld(x, y, camera);
      setWires(prev => prev.map(w => {
        if (w.id === interaction.draggingWaypoint!.wireId && w.waypoints) {
          const newWaypoints = [...w.waypoints];
          newWaypoints[interaction.draggingWaypoint!.index] = { x: worldPos.x, y: worldPos.y };
          return { ...w, waypoints: newWaypoints };
        }
        return w;
      }));
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

        if (config.outputCount > 0 && node.type !== GateType.DERIVATION) {
          const px = node.position.x + node.width;
          const py = node.position.y + node.height / 2;
          if (Math.hypot(worldPos.x - px, worldPos.y - py) < 10) {
            foundPin = { nodeId: node.id, type: 'output', index: 0 };
            break;
          }
        } else if (node.type === GateType.DERIVATION && config.outputCount > 0) {
          const outputCount = config.outputCount;
          const pinSpacingOut = node.height / (outputCount + 1);
          for (let p = 0; p < outputCount; p++) {
            const px = node.position.x + node.width;
            const py = node.position.y + (pinSpacingOut * (p + 1));
            if (Math.hypot(worldPos.x - px, worldPos.y - py) < 10) {
              foundPin = { nodeId: node.id, type: 'output', index: p };
              break;
            }
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
    if (interaction.draggingWaypoint) {
      setInteraction(prev => ({
        ...prev,
        draggingWaypoint: null
      }));
      return;
    }

    // Right click to cancel wiring or remove last waypoint
    if (e.button === 2 && interaction.mode === InteractionMode.WIRING && interaction.activeWireStart) {
      if (interaction.activeWireCurveType === 'straight' && interaction.activeWireStart.waypoints && interaction.activeWireStart.waypoints.length > 0) {
        setInteraction(prev => ({
          ...prev,
          activeWireStart: {
            ...prev.activeWireStart!,
            waypoints: prev.activeWireStart!.waypoints!.slice(0, -1)
          }
        }));
        return;
      }

      setInteraction(prev => ({
        ...prev,
        mode: InteractionMode.IDLE,
        activeWireStart: null
      }));
      return;
    }

    // Complete Wiring
    if (interaction.mode === InteractionMode.WIRING && interaction.activeWireStart) {
      if (interaction.hoveredPin && interaction.hoveredPin.type === 'input') {
        const targetNode = nodes.find(n => n.id === interaction.hoveredPin!.nodeId);

        const newWire: Wire = {
          id: generateId(),
          sourceNodeId: interaction.activeWireStart.nodeId,
          sourcePinIndex: interaction.activeWireStart.pinIndex,
          targetNodeId: interaction.hoveredPin.nodeId,
          targetPinIndex: interaction.hoveredPin.index,
          state: false,
          curveType: interaction.activeWireCurveType,
          waypoints: interaction.activeWireCurveType === 'straight' ? [...(interaction.activeWireStart.waypoints || [])] : []
        };

        const exists = wires.some(w =>
          w.targetNodeId === newWire.targetNodeId && w.targetPinIndex === newWire.targetPinIndex
        );

        let newWires = [...wires];
        if (exists && targetNode && targetNode.type !== GateType.DERIVATION) {
          // Replace existing wire for non-derivation nodes
          newWires = newWires.filter(w => !(w.targetNodeId === newWire.targetNodeId && w.targetPinIndex === newWire.targetPinIndex));
        }

        newWires.push(newWire);

        const res = propagateCircuit(nodes, newWires);
        setNodes(res.nodes);
        setWires(res.wires);
      } else if (interaction.activeWireCurveType === 'straight') {
        // Add waypoint on click if straight wire and not hitting a pin
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const worldPos = screenToWorld(x, y, camera);

        const currentWaypoints = interaction.activeWireStart.waypoints || [];
        const lastWaypoint = currentWaypoints[currentWaypoints.length - 1];

        // Prevent adding duplicate waypoints if clicked too close to the last one
        if (!lastWaypoint || Math.hypot(worldPos.x - lastWaypoint.x, worldPos.y - lastWaypoint.y) > 5) {
          setInteraction(prev => ({
            ...prev,
            activeWireStart: {
              ...prev.activeWireStart!,
              waypoints: [...currentWaypoints, worldPos]
            }
          }));
        }
        return; // Don't reset interaction mode
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
      dragStart: { x: 0, y: 0 },
      draggingWaypoint: null
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
    } else if (e.key === 'Escape') {
      setInteraction(prev => {
        if (prev.mode === InteractionMode.WIRING) {
          return {
            ...prev,
            mode: InteractionMode.IDLE,
            activeWireStart: null
          };
        }
        return prev;
      });
    }
  }, [deleteSelected]);

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

  const renderTruthTable = () => {
    if (!truthTableNodeId) return null;
    const selectedNode = nodes.find(n => n.id === truthTableNodeId);
    
    // Check if it's a valid logical gate
    if (!selectedNode || selectedNode.inputs.length === 0 || 
        [GateType.INPUT_SWITCH, GateType.OUTPUT_LAMP, GateType.CLOCK, GateType.DERIVATION].includes(selectedNode.type)) {
      return null;
    }
  
    const inputCount = selectedNode.inputs.length;
    // Limit to 6 inputs to avoid browser crash
    if (inputCount > 6) {
      return (
        <div className="absolute top-16 right-4 bg-[#1e1e1e]/90 border border-zinc-800 rounded p-2 text-red-500 text-xs font-mono shadow-lg backdrop-blur-sm z-10 max-w-[200px]">
          <div className="flex items-center justify-between gap-4 mb-2 border-b border-zinc-800 pb-1">
            <span className="font-bold text-zinc-300">Erro Tabela Verdade</span>
            <button onClick={() => setTruthTableNodeId(null)} className="text-zinc-500 hover:text-white cursor-pointer px-1">✕</button>
          </div>
          Tabela Verdade muito grande para exibir ({inputCount} inputs gerariam {Math.pow(2, inputCount)} linhas).
        </div>
      );
    }
  
    const rowsCount = Math.pow(2, inputCount);
    const rows = [];
    const tempNode = { ...selectedNode };
    
    for (let i = 0; i < rowsCount; i++) {
        const inputs = [];
        for (let j = 0; j < inputCount; j++) {
            // MSB to LSB
            inputs.push( ((i >> (inputCount - 1 - j)) & 1) === 1 );
        }
        const output = computeNodeLogic(tempNode, inputs);
        rows.push({ inputs, output });
    }
  
    return (
      <div className="absolute top-16 right-4 bg-[#1e1e1e]/90 border border-zinc-800 rounded p-2 text-zinc-500 text-xs font-mono pointer-events-auto shadow-lg max-w-md backdrop-blur-sm z-10 transition-opacity">
        <div className="flex items-center justify-between gap-4 mb-2 border-b border-zinc-800 pb-1">
          <span className="font-bold text-zinc-300">Tabela Verdade: {selectedNode.type}</span>
          <button onClick={() => setTruthTableNodeId(null)} className="text-zinc-500 hover:text-white cursor-pointer px-1">✕</button>
        </div>
        
        <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr>
                {Array.from({ length: inputCount }).map((_, idx) => (
                  <th key={idx} className="px-3 py-1 text-zinc-400 font-semibold border-b border-zinc-700">
                    {String.fromCharCode(65 + idx)}
                  </th>
                ))}
                <th className="px-3 py-1 font-bold text-zinc-300 border-b border-zinc-700 border-l border-zinc-700">OUT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                  {row.inputs.map((val, jdx) => (
                    <td key={jdx} className={`px-3 py-1 border-b border-zinc-800/50 ${val ? 'text-green-400/70' : 'text-zinc-600'}`}>
                      {val ? '1' : '0'}
                    </td>
                  ))}
                  <td className={`px-3 py-1 border-b border-zinc-800/50 border-l border-zinc-800 font-bold ${row.output ? 'text-green-400' : 'text-zinc-500'}`}>
                    {row.output ? '1' : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const promptLoadProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleLoadProject(file);
    };
    input.click();
  };

  const executeCommand = (cmdStr: string) => {
    cliEngine.execute(cmdStr, {
      nodes,
      setNodes,
      wires,
      setWires,
      selectedNodeIds,
      camera,
      viewportCenterWorld: screenToWorld(
        (containerRef.current?.clientWidth || window.innerWidth) / 2,
        (containerRef.current?.clientHeight || window.innerHeight) / 2,
        camera
      ),
      onSave: handleSaveProject,
      onLoad: promptLoadProject
    });
  };

  const handleCliHoverSuggestion = useCallback((id: string | null) => {
    setInteraction(prev => ({
      ...prev,
      cliHoveredNodeId: id
    }));
  }, []);

  return (
    <div className="relative w-screen h-screen bg-[#1e1e1e] overflow-hidden">
      <Toolbar
        onSelectTool={selectTool}
        currentMode={interaction.mode}
        selectedGateType={interaction.placingType}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
        activeWireCurveType={interaction.activeWireCurveType}
        onChangeWireCurveType={(type) => setInteraction(prev => ({ ...prev, activeWireCurveType: type }))}
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeType={nodes.find(n => n.id === contextMenu.nodeId)?.type}
          currentColor={nodes.find(n => n.id === contextMenu.nodeId)?.color || wires.find(w => w.id === contextMenu.wireId)?.color}
          inputCount={nodes.find(n => n.id === contextMenu.nodeId)?.inputs.length}
          wireCurveType={contextMenu.wireId ? wires.find(w => w.id === contextMenu.wireId)?.curveType : undefined}
          wireStyle={contextMenu.wireId ? (wires.find(w => w.id === contextMenu.wireId)?.wireStyle || 'solid') : undefined}
          shape={nodes.find(n => n.id === contextMenu.nodeId)?.shape}
          onColorChange={(color) => {
            if (contextMenu.nodeId) {
              setNodes(prev => prev.map(n => n.id === contextMenu.nodeId ? { ...n, color } : n));
            } else if (contextMenu.wireId) {
              setWires(prev => prev.map(w => w.id === contextMenu.wireId ? { ...w, color } : w));
            }
          }}
          onChangeShape={(shape) => {
            if (contextMenu.nodeId) {
              setNodes(prev => prev.map(n => n.id === contextMenu.nodeId ? { ...n, shape } : n));
            }
          }}
          onInputCountChange={handleInputCountChange}
          onChangeNodeType={handleChangeNodeType}
          onChangeWireCurveType={(type) => {
            if (contextMenu.wireId) {
              setWires(prev => prev.map(w => w.id === contextMenu.wireId ? { ...w, curveType: type } : w));
            }
          }}
          onChangeWireStyle={(style) => {
            if (contextMenu.wireId) {
              setWires(prev => prev.map(w => w.id === contextMenu.wireId ? { ...w, wireStyle: style } : w));
            }
          }}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onClose={() => setContextMenu(null)}
          onShowTruthTable={() => setTruthTableNodeId(contextMenu.nodeId || null)}
        />
      )}

      {renderTruthTable()}

      <div className="absolute top-4 right-4 bg-[#1e1e1e]/90 border border-zinc-800 rounded p-2 text-zinc-500 text-xs font-mono pointer-events-auto shadow-lg max-w-md backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <span>Nodes: {nodes.length} | Wires: {wires.length} | Zoom: {Math.round(camera.zoom * 100)}% | Selected: {selectedNodeIds.length + selectedWireIds.length}</span>
          <button
            onClick={() => setIsMatrixExpanded(!isMatrixExpanded)}
            className="text-zinc-400 hover:text-zinc-300 underline cursor-pointer shrink-0"
          >
            {isMatrixExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {isMatrixExpanded && (
          <div className="mt-2 pt-2 border-t border-zinc-800 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 gap-y-1 text-left">
              <div className="font-bold text-zinc-400 border-b border-zinc-800 pb-1">Object</div>
              <div className="font-bold text-zinc-400 border-b border-zinc-800 pb-1">Origin</div>
              <div className="font-bold text-zinc-400 border-b border-zinc-800 pb-1">Target</div>
              <div className="font-bold text-zinc-400 border-b border-zinc-800 pb-1">ID</div>
              <div className="font-bold text-zinc-400 border-b border-zinc-800 pb-1">Status</div>

              {nodes.length === 0 && wires.length === 0 && (
                <div className="col-span-5 text-zinc-600 italic py-1">None</div>
              )}

              {nodes.map(n => (
                <React.Fragment key={n.id}>
                  <div className="truncate text-zinc-300" title={n.type}>{n.type}</div>
                  <div className="text-zinc-600 text-center">-</div>
                  <div className="text-zinc-600 text-center">-</div>
                  <div className="text-zinc-500" title={n.id}>{n.id.substring(0, 4)}</div>
                  <div className={n.state ? 'text-green-400' : 'text-zinc-500'}>
                    {n.state ? 'true' : 'false'}
                  </div>
                </React.Fragment>
              ))}

              {wires.map(w => (
                <React.Fragment key={w.id}>
                  <div className="truncate text-zinc-500" title="WIRE">WIRE</div>
                  <div className="text-zinc-400" title={w.sourceNodeId}>{w.sourceNodeId.substring(0, 4)}</div>
                  <div className="text-zinc-400" title={`${w.targetNodeId}-${w.targetPinIndex + 1}`}>{w.targetNodeId.substring(0, 4)}-{w.targetPinIndex + 1}</div>
                  <div className="text-zinc-500" title={w.id}>{w.id.substring(0, 4)}</div>
                  <div className={w.state ? 'text-green-400' : 'text-zinc-500'}>
                    {w.state ? 'true' : 'false'}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      <CommandLine 
        onExecuteCommand={executeCommand} 
        nodes={nodes} 
        onHoverSuggestion={handleCliHoverSuggestion} 
      />
    </div>
  );
};

export default App;