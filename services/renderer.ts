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

  for (const wire of wires) {
    const sourceNode = nodes.find(n => n.id === wire.sourceNodeId);
    const targetNode = nodes.find(n => n.id === wire.targetNodeId);
    if (!sourceNode || !targetNode) continue;

    // Calculate start/end points exactly as they are drawn
    const startX = sourceNode.position.x + sourceNode.width;
    const startY = sourceNode.position.y + (sourceNode.height / 2);
    
    // Use dynamic input count from the node instance
    const inputCount = targetNode.inputs.length;
    const pinSpacing = targetNode.height / (inputCount + 1);
    const endX = targetNode.position.x;
    const endY = targetNode.position.y + (pinSpacing * (wire.targetPinIndex + 1));

    const curveType = wire.curveType || 'bezier';
    let dist = Infinity;

    if (curveType === 'straight') {
      dist = distToSegment(worldX, worldY, startX, startY, endX, endY);
    } else if (curveType === 'step') {
      const midX = (startX + endX) / 2;
      const d1 = distToSegment(worldX, worldY, startX, startY, midX, startY);
      const d2 = distToSegment(worldX, worldY, midX, startY, midX, endY);
      const d3 = distToSegment(worldX, worldY, midX, endY, endX, endY);
      dist = Math.min(d1, d2, d3);
    } else {
      // Bezier
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

// Image Cache System
const imageCache = new Map<string, HTMLImageElement>();
const failedImages = new Set<string>();

const getOrLoadImage = (src: string): HTMLImageElement | null => {
  if (failedImages.has(src)) return null;
  if (imageCache.has(src)) {
    const img = imageCache.get(src)!;
    return img.complete ? img : null;
  }
  const img = new Image();
  img.src = src;
  img.onload = () => { /* Render loop will pick it up naturally */ };
  img.onerror = () => { failedImages.add(src); };
  imageCache.set(src, img);
  return null;
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
  // We only draw leads for logic gates, generally not for Switch/Lamp/Clock if they are sized to fit.
  if (xOffset > 0 && node.type !== GateType.INPUT_SWITCH && node.type !== GateType.OUTPUT_LAMP && node.type !== GateType.CLOCK) {
    ctx.beginPath();
    ctx.strokeStyle = COLORS.componentBorder;
    ctx.lineWidth = 2;
    
    // Input leads - USE DYNAMIC INPUT COUNT
    const inputCount = node.inputs.length;
    const pinSpacingIn = h / (inputCount + 1);
    
    for (let i = 0; i < inputCount; i++) {
        const py = pinSpacingIn * (i + 1);
        ctx.moveTo(0, py);
        ctx.lineTo(xOffset, py);
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

  // --- 1. Attempt to Draw Image ---
  let imageDrawn = false;
  if (config.imageSrc) {
    const img = getOrLoadImage(config.imageSrc);
    if (img) {
      // Selection Glow for Image
      if (selected) {
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 15;
        ctx.strokeStyle = COLORS.componentBorderSelected;
        ctx.lineWidth = 2;
        ctx.strokeRect(-2, -2, symbolW + 4, h + 4);
      }
      
      ctx.drawImage(img, 0, 0, symbolW, h);
      imageDrawn = true;
      
      // Reset Shadow
      ctx.shadowBlur = 0;
    }
  }

  // --- 2. Fallback Canvas Drawing (If no image or custom type) ---
  if (!imageDrawn) {
    ctx.beginPath();
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? COLORS.componentBorderSelected : COLORS.componentBorder;
    ctx.fillStyle = COLORS.componentBody;

    if (selected) {
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
      ctx.shadowBlur = 10;
    }

    // NOTE: Use symbolW instead of w for the shape drawing
    switch (node.type) {
      case GateType.AND:
      case GateType.NAND:
        ctx.moveTo(0, 0);
        ctx.lineTo(symbolW / 2, 0);
        ctx.arc(symbolW / 2, h / 2, h / 2, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(0, h);
        ctx.lineTo(0, 0);
        break;
      case GateType.OR:
      case GateType.NOR:
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(symbolW / 4, h / 2, 0, h);
        ctx.lineTo(symbolW / 2, h); 
        ctx.quadraticCurveTo(symbolW, h, symbolW, h/2);
        ctx.quadraticCurveTo(symbolW, 0, symbolW/2, 0);
        ctx.lineTo(0, 0);
        break;
      case GateType.XOR:
        ctx.moveTo(10, 0);
        ctx.quadraticCurveTo(symbolW / 4 + 10, h / 2, 10, h);
        ctx.lineTo(symbolW / 2, h);
        ctx.quadraticCurveTo(symbolW, h, symbolW, h/2);
        ctx.quadraticCurveTo(symbolW, 0, symbolW/2, 0);
        ctx.lineTo(10, 0);
        ctx.stroke(); 
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(symbolW / 4, h / 2, 0, h);
        break;
      case GateType.NOT:
        ctx.moveTo(0, 0);
        ctx.lineTo(symbolW - 10, h / 2);
        ctx.lineTo(0, h);
        ctx.lineTo(0, 0);
        break;
      case GateType.INPUT_SWITCH:
        ctx.rect(0, 0, symbolW, h);
        break;
      case GateType.OUTPUT_LAMP:
        ctx.arc(symbolW/2, h/2, symbolW/2 - 2, 0, Math.PI * 2);
        break;
      default:
        ctx.rect(0, 0, symbolW, h);
    }

    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0; 

    // Negation Circle (Fallback only)
    if ([GateType.NAND, GateType.NOR, GateType.NOT].includes(node.type)) {
      ctx.beginPath();
      ctx.arc(symbolW - 5, h / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.componentBody;
      ctx.fill();
      ctx.stroke();
    }
  }

  // Visuals for Switch/Lamp (Always drawn on top)
  if (node.type === GateType.INPUT_SWITCH) {
    ctx.beginPath();
    ctx.rect(10, 10, symbolW - 20, h - 20);
    ctx.fillStyle = node.state ? COLORS.lampOn : '#111';
    ctx.fill();
    ctx.fillStyle = COLORS.textColor;
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(node.state ? 'ON' : 'OFF', symbolW/2, h/2 + 3);
  }

  if (node.type === GateType.OUTPUT_LAMP) {
    if (imageDrawn) {
        ctx.beginPath();
        ctx.arc(symbolW/2, h/2, (symbolW/2) * 0.6, 0, Math.PI * 2);
    } else {
        ctx.beginPath();
        ctx.arc(symbolW/2, h/2, symbolW/2 - 8, 0, Math.PI * 2);
    }
    
    // Custom color support
    const onColor = node.color || COLORS.lampOn;
    
    ctx.fillStyle = node.state ? onColor : COLORS.lampOff;
    ctx.fill();
    
    if (node.state) {
        ctx.shadowColor = onColor;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
  }
  
  // Label (Standard gates usually skip text if image drawn)
  if (!imageDrawn && node.type !== GateType.INPUT_SWITCH && node.type !== GateType.OUTPUT_LAMP) {
      ctx.fillStyle = COLORS.textColor;
      ctx.font = 'bold 12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(config.label, symbolW / 2, h / 2 + 4);
  }

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
  currentMousePos: { x: number, y: number }
) => {
  const { width, height } = canvas;
  
  // Clear
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Grid
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = COLORS.gridLines;
  ctx.lineWidth = 1;
  
  const startX = Math.floor((0 - camera.x) / camera.zoom / GRID_SIZE) * GRID_SIZE;
  const startY = Math.floor((0 - camera.y) / camera.zoom / GRID_SIZE) * GRID_SIZE;
  const endX = Math.floor((width - camera.x) / camera.zoom / GRID_SIZE + 1) * GRID_SIZE;
  const endY = Math.floor((height - camera.y) / camera.zoom / GRID_SIZE + 1) * GRID_SIZE;

  for (let x = startX; x <= endX; x += GRID_SIZE) {
    const screenX = (x * camera.zoom) + camera.x;
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, height);
  }
  for (let y = startY; y <= endY; y += GRID_SIZE) {
    const screenY = (y * camera.zoom) + camera.y;
    ctx.moveTo(0, screenY);
    ctx.lineTo(width, screenY);
  }
  ctx.stroke();
  ctx.restore();

  // Draw Wires
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
    
    const curveType = wire.curveType || 'bezier';

    if (curveType === 'straight') {
      ctx.lineTo(e.x, e.y);
    } else if (curveType === 'step') {
      const midX = (s.x + e.x) / 2;
      ctx.lineTo(midX, s.y);
      ctx.lineTo(midX, e.y);
      ctx.lineTo(e.x, e.y);
    } else {
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

    ctx.lineWidth = 3 * camera.zoom;
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Active wire creation line
  if (interactionState.mode === InteractionMode.WIRING && interactionState.activeWireStart) {
    const { nodeId, pinIndex } = interactionState.activeWireStart;
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        // ... (Drawing handled in App.tsx mainly, but placeholder here if needed)
    }
  }

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