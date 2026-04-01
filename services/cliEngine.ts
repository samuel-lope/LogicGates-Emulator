import React from 'react';
import { CircuitNode, Wire, Camera, GateType } from '../types';
import { COMPONENT_CONFIGS, PIN_SPACING, GATE_COLORS, LED_COLORS } from '../constants';

const generateId = () => Math.random().toString(36).substr(2, 9);

export interface ExecutionContext {
  nodes: CircuitNode[];
  setNodes: React.Dispatch<React.SetStateAction<CircuitNode[]>>;
  wires: Wire[];
  setWires: React.Dispatch<React.SetStateAction<Wire[]>>;
  selectedNodeIds: string[];
  camera: Camera;
  viewportCenterWorld: { x: number; y: number };
  onSave: () => void;
  onLoad: () => void;
}

export type CommandHandler = (args: string[], context: ExecutionContext) => void;

export type CommandSchemaResolver = (context: Pick<ExecutionContext, 'nodes'> | undefined, prevArgs: string[]) => string[];

export interface CommandDefinition {
  name: string;
  description: string;
  schema?: (string[] | CommandSchemaResolver)[];
  handler: CommandHandler;
}

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();

  register(cmd: CommandDefinition) {
    this.commands.set(cmd.name.toUpperCase(), cmd);
  }

  getSuggestions(rawInput: string, context?: Pick<ExecutionContext, 'nodes'>): string[] {
    const parts = rawInput.split(' ');
    
    if (parts.length === 1) {
      const partial = parts[0].toUpperCase();
      return Array.from(this.commands.keys()).filter(cmd => cmd.startsWith(partial));
    }

    const commandName = parts[0].toUpperCase();
    const command = this.commands.get(commandName);
    if (!command || !command.schema) return [];

    const argIndex = parts.length - 2; 
    if (argIndex >= command.schema.length) return [];

    const partial = parts[parts.length - 1].toUpperCase();
    const prevArgs = parts.slice(1, parts.length - 1);
    const schemaDef = command.schema[argIndex];
    
    let options: string[] = [];
    if (typeof schemaDef === 'function') {
      options = schemaDef(context, prevArgs);
    } else {
      options = schemaDef;
    }

    return options.filter(opt => opt.toUpperCase().startsWith(partial));
  }

  execute(rawCommand: string, context: ExecutionContext) {
    const parts = rawCommand.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return;
    
    const actionName = parts[0].toUpperCase();
    const args = parts.slice(1);

    const command = this.commands.get(actionName);
    if (!command) {
      alert(`Comando desconhecido: ${actionName}`);
      return;
    }

    try {
      command.handler(args, context);
    } catch (err: any) {
      alert(`Erro executando '${actionName}': ${err.message}`);
    }
  }
}

export const cliEngine = new CommandRegistry();

export function registerCoreCommands() {
  cliEngine.register({
    name: 'ADD',
    description: 'Adiciona um objeto na tela. Ex: ADD OR 4 [300,350]',
    schema: [
      ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'NOT', 'SW', 'LED', 'CLK', 'DER'],
      ['[2-32]'],
      ['[x,y]']
    ],
    handler: (args, { setNodes, viewportCenterWorld }) => {
      if (args.length === 0) {
        alert('Falta o tipo do objeto. Ex: ADD AND');
        return;
      }

      const aliasMap: Record<string, GateType> = {
        'SW': GateType.INPUT_SWITCH,
        'LED': GateType.OUTPUT_LAMP,
        'CLK': GateType.CLOCK,
        'DER': GateType.DERIVATION
      };

      const rawType = args[0].toUpperCase();
      const typeStr = (aliasMap[rawType] || rawType) as GateType;
      const config = COMPONENT_CONFIGS[typeStr];
      if (!config) {
        alert(`Objeto inválido ou desconhecido: ${args[0]}`);
        return;
      }

      let inputCount = config.inputCount;
      const supportsVariableInputs = [
        GateType.AND,
        GateType.OR,
        GateType.NAND,
        GateType.NOR,
        GateType.XOR
      ].includes(typeStr);

      // Parse optional [x,y] position token — can appear at any position after the type
      const POS_REGEX = /^\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]$/;
      let spawnX: number | null = null;
      let spawnY: number | null = null;

      for (const arg of args.slice(1)) {
        const posMatch = arg.match(POS_REGEX);
        if (posMatch) {
          spawnX = parseFloat(posMatch[1]);
          spawnY = parseFloat(posMatch[2]);
        } else if (supportsVariableInputs) {
          const parsedInputs = parseInt(arg, 10);
          if (!isNaN(parsedInputs)) {
            inputCount = Math.min(32, Math.max(2, parsedInputs));
          }
        }
      }

      const newHeight = supportsVariableInputs ? (inputCount + 1) * PIN_SPACING : config.height;

      // Use explicit world-space position if provided, otherwise center on viewport
      const posX = spawnX !== null ? spawnX - config.width / 2 : viewportCenterWorld.x - config.width / 2;
      const posY = spawnY !== null ? spawnY - newHeight / 2 : viewportCenterWorld.y - newHeight / 2;

      const newNode: CircuitNode = {
        id: generateId(),
        type: typeStr,
        position: { x: posX, y: posY },
        width: config.width,
        height: newHeight,
        inputs: new Array(inputCount).fill(false),
        state: false,
        label: config.label,
      };

      setNodes(prev => [...prev, newNode]);
    }
  });

  cliEngine.register({
    name: 'EDIT',
    description: 'Edita atributos de um objeto pelo ID. Ex: EDIT OR wzbf INPUTS 4',
    schema: [
      (context) => {
         if (!context) return [];
         const types = new Set(context.nodes.map(n => n.type));
         return Array.from(types);
      },
      (context, prevArgs) => {
         if (!context) return [];
         const targetType = prevArgs[0]?.toUpperCase();
         return context.nodes
           .filter(n => n.type === targetType)
           .map(n => n.id.substring(0, 4));
      },
      ['INPUTS', 'COLOR'],
      () => {
         return ['[2-32]', ...Object.keys(GATE_COLORS), ...Object.keys(LED_COLORS), 'DEFAULT', '#HEX'];
      }
    ],
    handler: (args, { nodes, setNodes, setWires }) => {
      if (args.length < 4) {
        alert('Argumentos insuficientes. Ex: EDIT OR wzbf INPUTS 4');
        return;
      }

      const type = args[0].toUpperCase();
      const shortId = args[1].toLowerCase();
      const prop = args[2].toUpperCase();

      const targetNode = nodes.find(n => n.type === type && n.id.toLowerCase().startsWith(shortId));
      if (!targetNode) {
          alert(`Objeto não encontrado: ${type} com ID ${shortId}`);
          return;
      }
      
      const targetNodeId = targetNode.id;

      if (prop === 'INPUTS' || prop === 'INPUT') {
        const valStr = args[3];
        const val = parseInt(valStr, 10);
        if (isNaN(val)) {
          alert('Valor numérico inválido para inputs. Ex: EDIT OR wzbf INPUTS 4');
          return;
        }

        setNodes(prevNodes => prevNodes.map(node => {
          if (node.id !== targetNodeId) return node;

          const supportsVariableInputs = [
            GateType.AND, GateType.OR, GateType.NAND, GateType.NOR, GateType.XOR
          ].includes(node.type);

          if (!supportsVariableInputs) return node;

          const currentCount = node.inputs.length;
          const newCount = Math.min(32, Math.max(2, val));

          if (newCount === currentCount) return node;

          let newInputs = [...node.inputs];

          if (newCount > currentCount) {
            for (let i = 0; i < (newCount - currentCount); i++) {
              newInputs.push(false);
            }
          } else {
            newInputs = newInputs.slice(0, newCount);
            // Clean wires attached to removed pins
            setWires(prevWires => prevWires.filter(w =>
              !(w.targetNodeId === node.id && w.targetPinIndex >= newCount)
            ));
          }

          const newHeight = (newCount + 1) * PIN_SPACING;

          return {
            ...node,
            inputs: newInputs,
            height: newHeight
          };
        }));
      } else if (prop === 'COLOR') {
        const parsedColor = args[3]?.toUpperCase();
        if (!parsedColor || parsedColor === 'DEFAULT' || parsedColor === 'NONE') {
          setNodes(prev => prev.map(n => n.id === targetNodeId ? { ...n, color: undefined } : n));
          return;
        }

        let hexColor = Object.entries(GATE_COLORS).find(([k]) => k === parsedColor)?.[1];
        if (!hexColor) {
          hexColor = Object.entries(LED_COLORS).find(([k]) => k === parsedColor)?.[1];
        }

        if (!hexColor) {
           if (/^#[0-9A-F]{6}$/i.test(args[3])) {
               hexColor = args[3];
           } else {
               alert(`Cor não reconhecida: ${parsedColor}`);
               return;
           }
        }

        setNodes(prev => prev.map(n => n.id === targetNodeId ? { ...n, color: hexColor } : n));
      } else {
        alert(`Propriedade desconhecida: ${prop}`);
      }
    }
  });

  cliEngine.register({
    name: 'DEL',
    description: 'Deleta um objeto pelo ID. Ex: DEL OR wzbf',
    schema: [
      (context) => {
         if (!context) return [];
         const types = new Set(context.nodes.map(n => n.type));
         return Array.from(types);
      },
      (context, prevArgs) => {
         if (!context) return [];
         const targetType = prevArgs[0]?.toUpperCase();
         return context.nodes
           .filter(n => n.type === targetType)
           .map(n => n.id.substring(0, 4));
      }
    ],
    handler: (args, { nodes, setNodes, setWires }) => {
      if (args.length < 2) {
        alert('Argumentos insuficientes. Ex: DEL OR wzbf');
        return;
      }

      const type = args[0].toUpperCase();
      const shortId = args[1].toLowerCase();

      const targetNode = nodes.find(n => n.type === type && n.id.toLowerCase().startsWith(shortId));
      if (!targetNode) {
          alert(`Objeto não encontrado: ${type} com ID ${shortId}`);
          return;
      }
      
      const targetNodeId = targetNode.id;

      setNodes(prev => prev.filter(n => n.id !== targetNodeId));
      setWires(prev => prev.filter(w => w.sourceNodeId !== targetNodeId && w.targetNodeId !== targetNodeId));
    }
  });
  cliEngine.register({
    name: 'SAVE',
    description: 'Fazer download do projeto atual (mesma ação do botão Save). Ex: SAVE',
    handler: (args, context) => {
      context.onSave();
    }
  });

  cliEngine.register({
    name: 'LOAD',
    description: 'Abre a janela de seleção para carregar um arquivo JSON. Ex: LOAD',
    handler: (args, context) => {
      context.onLoad();
    }
  });
}
