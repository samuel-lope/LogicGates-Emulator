import { CircuitNode, GateType, Wire, Camera, InteractionMode } from '../types';
import { COLORS, COMPONENT_CONFIGS, GRID_SIZE } from '../constants';

export const worldToScreen = (x: number, y: number, camera: Camera) => {
  return {
    x: (x * camera.zoom) + camera.x,
    y: (y * camera.zoom) + camera.y
  };
};

export const screenToWorld = (x: number, y: number, camera: Camera) => {
  return {
    x: (x - camera.x) / camera.zoom,
    y: (y - camera.y) / camera.zoom
  };
};

// --- Geometry Helpers for Hit Testing ---

const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
  const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
};

// Samples a bezier curve to find approximate distance
const distToBezier = (
  px: number, py: number, 
  x0: number, y0: number, 
  cp1x: number, cp1y: number, 
  cp2x: number, cp2y: number, 
  x1: number, y1: number
) => {
  const SAMPLES = 10;
  let minD = Infinity;
  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const invT = 1 - t;
    
    // Cubic Bezier Formula
    const currX = (invT ** 3) * x0 + 
                  3 * (invT ** 2) * t * cp1x + 
                  3 * invT * (t ** 2) * cp2x + 
                  (t ** 3) * x1;
    const currY = (invT ** 3) * y0 + 
                  3 * (invT ** 2) * t * cp1y + 
                  3 * invT * (t ** 2) * cp2y + 
                  (t ** 3) * y1;

    const d = distToSegment(px, py, prevX, prevY, currX, currY);
    if (d < minD) minD = d;
    
    prevX = currX;
    prevY = currY;
  }
  return minD;
};

export const checkWireHit = (
  worldX: number, 
  worldY: number, 
  wires: Wire[], 
  nodes: CircuitNode[]
): string | null => {
  const HIT_THRESHOLD = 8; // World units

  // First check remote wires
  const remoteSources = new Map<string, Wire[]>();
  const remoteTargets = new Map<string, Wire[]>();

  for (const wire of wires) {
    if (wire.curveType === 'remote') {
      const sKey = `${wire.sourceNodeId}-${wire.sourcePinIndex}`;
      if (!remoteSources.has(sKey)) remoteSources.set(sKey, []);
      remoteSources.get(sKey)!.push(wire);

      const tKey = `${wire.targetNodeId}-${wire.targetPinIndex}`;
      if (!remoteTargets.has(tKey)) remoteTargets.set(tKey, []);
      remoteTargets.get(tKey)!.push(wire);
    }
  }

  const charWidth = 6; // Approx width of 10px monospace font in world units
  const charHeight = 8;

  for (const [key, groupWires] of remoteSources.entries()) {
    const wire = groupWires[0];
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    if (!sourceNode) continue;
    
    const startX = sourceNode.position.x + sourceNode.width;
    const startY = sourceNode.position.y + (sourceNode.height / 2);

    let currentX = startX + 20;
    currentX += charWidth; // '['
    
    for (let i = 0; i < groupWires.length; i++) {
      const w = groupWires[i];
      const idWidth = 4 * charWidth;
      
      if (
        worldX >= currentX - 2 && worldX <= currentX + idWidth + 2 &&
        worldY >= startY - charHeight && worldY <= startY + charHeight
      ) {
        return w.id;
      }
      
      currentX += idWidth;
      if (i < groupWires.length - 1) {
        currentX += 3 * charWidth; // ' - '
      }
    }
  }

  for (const [key, groupWires] of remoteTargets.entries()) {
    const wire = groupWires[0];
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!targetNode) continue;

    const inputCount = targetNode.inputs.length;
    const pinSpacing = targetNode.height / (inputCount + 1);
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + (pinSpacing * (wire.targetPinIndex + 1));

    const totalChars = 1 + groupWires.length * 4 + (groupWires.length - 1) * 3 + 1;
    const totalWidth = totalChars * charWidth;
    
    let currentX = endX - 20 - totalWidth;
    currentX += charWidth; // '['

    for (let i = 0; i < groupWires.length; i++) {
      const w = groupWires[i];
      const idWidth = 4 * charWidth;
      
      if (
        worldX >= currentX - 2 && worldX <= currentX + idWidth + 2 &&
        worldY >= endY - charHeight && worldY <= endY + charHeight
      ) {
        return w.id;
      }
      
      currentX += idWidth;
      if (i < groupWires.length - 1) {
        currentX += 3 * charWidth; // ' - '
      }
    }
  }

  for (const wire of wires) {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) continue;

    if (wire.curveType === 'remote') continue;

    // Calculate start/end points exactly as they are drawn
    const startX = sourceNode.position.x + sourceNode.width;
    const startY = sourceNode.position.y + (sourceNode.height / 2);
    
    // Use dynamic input count from the node instance
    const inputCount = targetNode.inputs.length;
    const pinSpacing = targetNode.height / (inputCount + 1);
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + (pinSpacing * (wire.targetPinIndex + 1));

    const curveType = wire.curveType || 'curved';
    let dist = Infinity;

    if (curveType === 'remote') {
      continue; // Remote wires are not clickable/hittable
    }

    if (curveType === 'straight') {
      if (wire.waypoints && wire.waypoints.length > 0) {
        let prevX = startX;
        let prevY = startY;
        for (const wp of wire.waypoints) {
          dist = Math.min(dist, distToSegment(worldX, worldY, prevX, prevY, wp.x, wp.y));
          prevX = wp.x;
          prevY = wp.y;
        }
        dist = Math.min(dist, distToSegment(worldX, worldY, prevX, prevY, endX, endY));
      } else {
        dist = distToSegment(worldX, worldY, startX, startY, endX, endY);
      }
    } else {
      // Curved (bezier)
      const cpDist = Math.abs(endX - startX) * 0.5;
      dist = distToBezier(
        worldX, worldY, 
        startX, startY, 
        startX + cpDist, startY, 
        endX - cpDist, endY, 
        endX, endY
      );
    }

    if (dist < HIT_THRESHOLD) {
      return wire.id;
    }
  }

  return null;
};

export const checkWaypointHit = (
  worldX: number, 
  worldY: number, 
  wires: Wire[], 
  selectedWireIds: string[]
): { wireId: string, index: number } | null => {
  const HIT_THRESHOLD = 10;
  for (const wire of wires) {
    if (selectedWireIds.includes(wire.id) && wire.curveType === 'straight' && wire.waypoints) {
      for (let i = 0; i < wire.waypoints.length; i++) {
        const wp = wire.waypoints[i];
        if (Math.hypot(worldX - wp.x, worldY - wp.y) < HIT_THRESHOLD) {
          return { wireId: wire.id, index: i };
        }
      }
    }
  }
  return null;
};

export const getClosestSegmentIndex = (
  worldX: number, 
  worldY: number, 
  wire: Wire, 
  nodes: CircuitNode[]
): number => {
  const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
  const targetNode = nodes.find(n => n.id === wire.targetNodeId);
  if (!sourceNode || !targetNode) return -1;

  const startX = sourceNode.position.x + sourceNode.width;
  const startY = sourceNode.position.y + (sourceNode.height / 2);
  
  const inputCount = targetNode.inputs.length;
  const pinSpacing = targetNode.height / (inputCount + 1);
  const endX = targetNode.position.x;
  const endY = targetNode.position.y + (pinSpacing * (wire.targetPinIndex + 1));

  let minD = Infinity;
  let minIndex = -1;

  let prevX = startX;
  let prevY = startY;
  const waypoints = wire.waypoints || [];
  
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const d = distToSegment(worldX, worldY, prevX, prevY, wp.x, wp.y);
    if (d < minD) {
      minD = d;
      minIndex = i;
    }
    prevX = wp.x;
    prevY = wp.y;
  }
  const d = distToSegment(worldX, worldY, prevX, prevY, endX, endY);
  if (d < minD) {
    minIndex = waypoints.length;
  }

  return minIndex;
};

// --- Drawing Functions ---

const drawPin = (
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  isInput: boolean, 
  active: boolean,
  isHovered: boolean
) => {
  const r = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = active 
    ? (isInput ? COLORS.pinInput : COLORS.pinOutput) 
    : COLORS.componentBody;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = isHovered ? '#ffffff' : (isInput ? COLORS.pinInput : COLORS.pinOutput);
  ctx.stroke();
};

const drawIEEEGate = (ctx: CanvasRenderingContext2D, node: CircuitNode, selected: boolean) => {
  const { x, y } = node.position;
  const config = COMPONENT_CONFIGS[node.type];
  const w = node.width; // Total pin-to-pin width
  const h = node.height;
  const symbolW = config.symbolWidth || w; // Visual width
  const xOffset = (w - symbolW) / 2;

  ctx.save();
  ctx.translate(x, y);

  // Draw Connecting Leads (if symbol is narrower than total width)
  if (xOffset > 0 && node.type !== GateType.INPUT_SWITCH && node.type !== GateType.OUTPUT_LAMP && node.type !== GateType.CLOCK) {
    ctx.beginPath();
    ctx.strokeStyle = COLORS.componentBorder;
    ctx.lineWidth = 2;
    
    // Input leads - USE DYNAMIC INPUT COUNT
    const inputCount = node.inputs.length;
    const pinSpacingIn = h / (inputCount + 1);
    
    let cx = 0;
    if (node.type === GateType.OR || node.type === GateType.NOR) {
      cx = symbolW * (5/16);
    } else if (node.type === GateType.XOR) {
      cx = symbolW * (5/18);
    }
    
    for (let i = 0; i < inputCount; i++) {
        const py = pinSpacingIn * (i + 1);
        const t = py / h;
        const curveX = 2 * (1 - t) * t * cx;
        ctx.moveTo(0, py);
        ctx.lineTo(xOffset + curveX, py);
    }
    // Output lead
    if (config.outputCount > 0) {
        const py = h / 2;
        ctx.moveTo(xOffset + symbolW, py);
        ctx.lineTo(w, py);
    }
    ctx.stroke();
  }

  // --- Translate to Symbol Origin ---
  ctx.translate(xOffset, 0);

  // Draw Selection Glow
  if (selected) {
    ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
    ctx.shadowBlur = 15;
  }

  ctx.lineWidth = selected ? 3 : 2;
  ctx.strokeStyle = selected ? COLORS.componentBorderSelected : COLORS.componentBorder;
  ctx.fillStyle = COLORS.componentBody;

  if ([GateType.AND, GateType.NAND, GateType.OR, GateType.NOR, GateType.XOR, GateType.NOT].includes(node.type)) {
    ctx.beginPath();
    switch (node.type) {
      case GateType.AND:
      case GateType.NAND:
        ctx.moveTo(0, 0);
        ctx.lineTo(symbolW / 2, 0);
        ctx.ellipse(symbolW / 2, h / 2, symbolW / 2, h / 2, 0, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, h);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.stroke();
        break;
      case GateType.OR:
      case GateType.NOR:
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(symbolW * (5/16), h / 2, 0, h);
        ctx.lineTo(symbolW * (3/16), h);
        ctx.quadraticCurveTo(symbolW * (11/16), h, symbolW, h / 2);
        ctx.quadraticCurveTo(symbolW * (11/16), 0, symbolW * (3/16), 0);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.stroke();
        break;
      case GateType.XOR:
        ctx.moveTo(symbolW * (1/9), 0);
        ctx.quadraticCurveTo(symbolW * (7/18), h / 2, symbolW * (1/9), h);
        ctx.lineTo(symbolW * (5/18), h);
        ctx.quadraticCurveTo(symbolW * (13/18), h, symbolW, h / 2);
        ctx.quadraticCurveTo(symbolW * (13/18), 0, symbolW * (5/18), 0);
        ctx.lineTo(symbolW * (1/9), 0);
        ctx.fill();
        ctx.stroke(); 
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(symbolW * (5/18), h / 2, 0, h);
        ctx.stroke();
        break;
      case GateType.NOT:
        ctx.moveTo(0, 0);
        ctx.lineTo(symbolW, h / 2);
        ctx.lineTo(0, h);
        ctx.lineTo(0, 0);
        ctx.fill();
        ctx.stroke();
        break;
    }
    
    // Negation Circles
    if ([GateType.NAND, GateType.NOR, GateType.NOT].includes(node.type)) {
      ctx.beginPath();
      ctx.arc(symbolW + 6, h / 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (node.type === GateType.INPUT_SWITCH) {
    ctx.beginPath();
    ctx.roundRect(5, 10, 40, 30, 4);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.roundRect(12, 15, 26, 20, 2);
    ctx.fillStyle = node.state ? COLORS.lampOn : '#111';
    ctx.fill();
  } else if (node.type === GateType.OUTPUT_LAMP) {
    ctx.beginPath();
    ctx.arc(25, 25, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    const onColor = node.color || COLORS.lampOn;
    ctx.fillStyle = node.state ? onColor : COLORS.lampOff;
    ctx.beginPath();
    ctx.arc(25, 25, 10, 0, Math.PI * 2);
    ctx.fill();
    
    if (node.state) {
        ctx.shadowColor = onColor;
        ctx.shadowBlur = 20;
        ctx.stroke();
    }
  } else if (node.type === GateType.CLOCK) {
    ctx.beginPath();
    ctx.roundRect(5, 10, 40, 30, 4);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(12, 25);
    ctx.lineTo(18, 25);
    ctx.lineTo(18, 16);
    ctx.lineTo(32, 16);
    ctx.lineTo(32, 34);
    ctx.lineTo(38, 34);
    ctx.lineTo(38, 25);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;

  ctx.restore();
};

export const renderCircuit = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  nodes: CircuitNode[],
  wires: Wire[],
  camera: Camera,
  interactionState: any,
  selectedNodeIds: string[],
  selectedWireIds: string[],
  currentMousePos: { x: number, y: number },
  time: number = 0
) => {
  const { width, height } = canvas;
  
  // Clear
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Grid (Dots)
  ctx.save();
  const scaledGridSize = GRID_SIZE * camera.zoom;
  if (scaledGridSize > 5) {
    const offsetX = camera.x % scaledGridSize;
    const offsetY = camera.y % scaledGridSize;
    
    ctx.fillStyle = COLORS.gridLines;
    const dotRadius = Math.max(1, 1.5 * camera.zoom);
    
    ctx.beginPath();
    for (let x = offsetX - scaledGridSize; x < width + scaledGridSize; x += scaledGridSize) {
      for (let y = offsetY - scaledGridSize; y < height + scaledGridSize; y += scaledGridSize) {
        ctx.rect(x - dotRadius, y - dotRadius, dotRadius * 2, dotRadius * 2);
      }
    }
    ctx.fill();
  }
  ctx.restore();

  // Draw Wires
  const drawnRemoteSources = new Set<string>();
  const drawnRemoteTargets = new Set<string>();

  wires.forEach(wire => {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) return;

    const startX = sourceNode.position.x + sourceNode.width;
    const startY = sourceNode.position.y + (sourceNode.height / 2); 
    
    // Dynamic input count
    const inputCount = targetNode.inputs.length;
    const pinSpacing = targetNode.height / (inputCount + 1);
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + (pinSpacing * (wire.targetPinIndex + 1));

    const s = worldToScreen(startX, startY, camera);
    const e = worldToScreen(endX, endY, camera);

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    
    const curveType = wire.curveType || 'curved';

    if (curveType === 'remote') {
      const sourceKey = `${wire.sourceNodeId}-${wire.sourcePinIndex}`;
      const targetKey = `${wire.targetNodeId}-${wire.targetPinIndex}`;

      // For remote wires, we draw a small stub and a label instead of a full wire
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + 15 * camera.zoom, s.y);
      
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - 15 * camera.zoom, e.y);
      
      ctx.lineWidth = 3 * camera.zoom;
      ctx.strokeStyle = wire.state ? COLORS.wireActive : COLORS.wireInactive;
      ctx.stroke();

      // Draw remote ID label
      ctx.font = `${10 * camera.zoom}px monospace`;
      ctx.textBaseline = 'middle';
      
      if (!drawnRemoteSources.has(sourceKey)) {
        drawnRemoteSources.add(sourceKey);
        const sourceWires = wires.filter(w => w.curveType === 'remote' && w.sourceNodeId === wire.sourceNodeId && w.sourcePinIndex === wire.sourcePinIndex);
        
        ctx.textAlign = 'left';
        let currentX = s.x + 20 * camera.zoom;
        
        ctx.fillStyle = COLORS.wireInactive;
        ctx.fillText('[', currentX, s.y);
        currentX += ctx.measureText('[').width;

        for (let i = 0; i < sourceWires.length; i++) {
          const w = sourceWires[i];
          const idText = w.id.substring(0, 4);
          const isSelected = selectedWireIds.includes(w.id);
          const isHovered = interactionState.hoveredWireId === w.id;
          
          const textWidth = ctx.measureText(idText).width;

          if (isSelected || isHovered) {
            ctx.save();
            ctx.fillStyle = isSelected ? COLORS.componentBorderSelected : 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(currentX - 2 * camera.zoom, s.y - 8 * camera.zoom, textWidth + 4 * camera.zoom, 16 * camera.zoom);
            ctx.restore();
          }

          ctx.fillStyle = w.state ? COLORS.wireActive : COLORS.wireInactive;
          ctx.fillText(idText, currentX, s.y);
          currentX += textWidth;

          if (i < sourceWires.length - 1) {
            ctx.fillStyle = COLORS.wireInactive;
            ctx.fillText(' - ', currentX, s.y);
            currentX += ctx.measureText(' - ').width;
          }
        }
        ctx.fillStyle = COLORS.wireInactive;
        ctx.fillText(']', currentX, s.y);
      }
      
      if (!drawnRemoteTargets.has(targetKey)) {
        drawnRemoteTargets.add(targetKey);
        const targetWires = wires.filter(w => w.curveType === 'remote' && w.targetNodeId === wire.targetNodeId && w.targetPinIndex === wire.targetPinIndex);
        
        ctx.textAlign = 'left';
        
        // Calculate total width
        let totalWidth = ctx.measureText('[').width + ctx.measureText(']').width;
        for (let i = 0; i < targetWires.length; i++) {
          totalWidth += ctx.measureText(targetWires[i].id.substring(0, 4)).width;
          if (i < targetWires.length - 1) {
            totalWidth += ctx.measureText(' - ').width;
          }
        }

        let currentX = e.x - 20 * camera.zoom - totalWidth;
        
        ctx.fillStyle = COLORS.wireInactive;
        ctx.fillText('[', currentX, e.y);
        currentX += ctx.measureText('[').width;

        for (let i = 0; i < targetWires.length; i++) {
          const w = targetWires[i];
          const idText = w.id.substring(0, 4);
          const isSelected = selectedWireIds.includes(w.id);
          const isHovered = interactionState.hoveredWireId === w.id;
          
          const textWidth = ctx.measureText(idText).width;

          if (isSelected || isHovered) {
            ctx.save();
            ctx.fillStyle = isSelected ? COLORS.componentBorderSelected : 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(currentX - 2 * camera.zoom, e.y - 8 * camera.zoom, textWidth + 4 * camera.zoom, 16 * camera.zoom);
            ctx.restore();
          }

          ctx.fillStyle = w.state ? COLORS.wireActive : COLORS.wireInactive;
          ctx.fillText(idText, currentX, e.y);
          currentX += textWidth;

          if (i < targetWires.length - 1) {
            ctx.fillStyle = COLORS.wireInactive;
            ctx.fillText(' - ', currentX, e.y);
            currentX += ctx.measureText(' - ').width;
          }
        }
        ctx.fillStyle = COLORS.wireInactive;
        ctx.fillText(']', currentX, e.y);
      }
      
      return; // Skip the rest of the wire drawing
    }

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);

    if (curveType === 'straight') {
      if (wire.waypoints && wire.waypoints.length > 0) {
        for (const wp of wire.waypoints) {
          const wpScreen = worldToScreen(wp.x, wp.y, camera);
          ctx.lineTo(wpScreen.x, wpScreen.y);
        }
      }
      ctx.lineTo(e.x, e.y);
    } else {
      // Curved
      const cpDist = Math.abs(e.x - s.x) * 0.5;
      ctx.bezierCurveTo(s.x + cpDist, s.y, e.x - cpDist, e.y, e.x, e.y);
    }
    
    const isSelected = selectedWireIds.includes(wire.id);
    const isHovered = interactionState.hoveredWireId === wire.id;

    if (isSelected || isHovered) {
      // Draw highlight under the wire
      ctx.save();
      ctx.lineWidth = 6 * camera.zoom;
      ctx.strokeStyle = isSelected ? COLORS.componentBorderSelected : 'rgba(255, 255, 255, 0.3)';
      if (isSelected) {
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();
    }

    // Base Wire
    ctx.lineWidth = 3 * camera.zoom;
    if (wire.color) {
      ctx.strokeStyle = wire.color;
      if (wire.state) {
        ctx.shadowColor = wire.color;
        ctx.shadowBlur = 10;
      }
    } else {
      ctx.strokeStyle = wire.state ? COLORS.wireActive : COLORS.wireInactive;
      if (wire.state) {
        ctx.shadowColor = COLORS.wireActive;
        ctx.shadowBlur = 10;
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Flowing Animation for Active Wires
    if (wire.state) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * camera.zoom;
      ctx.setLineDash([8 * camera.zoom, 12 * camera.zoom]);
      ctx.lineDashOffset = -(time / 30);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Waypoints for selected straight wires
    if (isSelected && curveType === 'straight' && wire.waypoints) {
      ctx.save();
      ctx.fillStyle = COLORS.wireActive;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * camera.zoom;
      for (let i = 0; i < wire.waypoints.length; i++) {
        const wp = wire.waypoints[i];
        const wpScreen = worldToScreen(wp.x, wp.y, camera);
        ctx.beginPath();
        ctx.arc(wpScreen.x, wpScreen.y, 4 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  });

  // Draw Nodes
  nodes.forEach(node => {
    ctx.save();
    ctx.setTransform(camera.zoom, 0, 0, camera.zoom, camera.x, camera.y);
    
    const isSelected = selectedNodeIds.includes(node.id);
    drawIEEEGate(ctx, node, isSelected);

    // Draw Pins
    const config = COMPONENT_CONFIGS[node.type];
    
    // Inputs - DYNAMIC
    const inputCount = node.inputs.length;
    const pinSpacingIn = node.height / (inputCount + 1);
    for (let i = 0; i < inputCount; i++) {
        const pinY = node.position.y + (pinSpacingIn * (i + 1));
        const isHovered = interactionState.hoveredPin?.nodeId === node.id 
            && interactionState.hoveredPin?.type === 'input' 
            && interactionState.hoveredPin?.index === i;
            
        drawPin(ctx, node.position.x, pinY, true, node.inputs[i], isHovered);
    }

    // Outputs
    if (config.outputCount > 0) {
        const pinY = node.position.y + (node.height / 2);
        const isHovered = interactionState.hoveredPin?.nodeId === node.id 
            && interactionState.hoveredPin?.type === 'output';
        drawPin(ctx, node.position.x + node.width, pinY, false, node.state, isHovered);
    }

    ctx.restore();
  });

  // Draw Active Wire
  if (interactionState.mode === InteractionMode.WIRING && interactionState.activeWireStart) {
    const sourceNode = nodes.find(n => n.id === interactionState.activeWireStart!.nodeId);
    if (sourceNode) {
      const startX = sourceNode.position.x + sourceNode.width;
      const startY = sourceNode.position.y + (sourceNode.height / 2);
      
      const s = worldToScreen(startX, startY, camera);
      const e = currentMousePos;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);

      const curveType = interactionState.activeWireCurveType || 'curved';

      if (curveType === 'remote') {
        ctx.lineTo(s.x + 15 * camera.zoom, s.y);
        
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x - 15 * camera.zoom, e.y);
        
        ctx.lineWidth = 3 * camera.zoom;
        ctx.strokeStyle = COLORS.wireInactive;
        ctx.stroke();

        ctx.fillStyle = COLORS.wireInactive;
        ctx.font = `${10 * camera.zoom}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`[NEW]`, s.x + 20 * camera.zoom, s.y);
        
        ctx.textAlign = 'right';
        ctx.fillText(`[NEW]`, e.x - 20 * camera.zoom, e.y);
      } else if (curveType === 'straight') {
        if (interactionState.activeWireStart.waypoints && interactionState.activeWireStart.waypoints.length > 0) {
          for (const wp of interactionState.activeWireStart.waypoints) {
            const wpScreen = worldToScreen(wp.x, wp.y, camera);
            ctx.lineTo(wpScreen.x, wpScreen.y);
          }
        }
        ctx.lineTo(e.x, e.y);
        ctx.lineWidth = 3 * camera.zoom;
        ctx.strokeStyle = COLORS.wireInactive;
        ctx.stroke();
      } else {
        const cpDist = Math.abs(e.x - s.x) * 0.5;
        ctx.bezierCurveTo(s.x + cpDist, s.y, e.x - cpDist, e.y, e.x, e.y);
        ctx.lineWidth = 3 * camera.zoom;
        ctx.strokeStyle = COLORS.wireInactive;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // Draw Selection Box
  if (interactionState.mode === InteractionMode.SELECTING) {
    const startX = interactionState.dragStart.x;
    const startY = interactionState.dragStart.y;
    const currentX = currentMousePos.x;
    const currentY = currentMousePos.y;

    const width = currentX - startX;
    const height = currentY - startY;

    ctx.save();
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(0, 204, 255, 0.1)';
    ctx.fillRect(startX, startY, width, height);
    ctx.strokeRect(startX, startY, width, height);
    ctx.restore();
  }
};