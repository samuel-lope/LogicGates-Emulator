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
}

export type CommandHandler = (args: string[], context: ExecutionContext) => void;

export interface CommandDefinition {
  name: string;
  description: string;
  schema?: (string[] | (() => string[]))[];
  handler: CommandHandler;
}

export class CommandRegistry {
  private commands: Map<string, CommandDefinition> = new Map();

  register(cmd: CommandDefinition) {
    this.commands.set(cmd.name.toUpperCase(), cmd);
  }

  getSuggestions(rawInput: string): string[] {
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
    const schemaDef = command.schema[argIndex];
    const options = typeof schemaDef === 'function' ? schemaDef() : schemaDef;

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
    description: 'Adiciona um objeto na tela. Ex: ADD OR 4',
    schema: [
      ['AND', 'OR', 'NAND', 'NOR', 'XOR', 'NOT', 'SW', 'LED', 'CLK', 'DER'],
      ['[2-32]']
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

      if (supportsVariableInputs && args[1]) {
        const parsedInputs = parseInt(args[1], 10);
        if (!isNaN(parsedInputs)) {
          inputCount = Math.min(32, Math.max(2, parsedInputs));
        }
      }

      const newHeight = supportsVariableInputs ? (inputCount + 1) * PIN_SPACING : config.height;

      const newNode: CircuitNode = {
        id: generateId(),
        type: typeStr,
        position: {
          x: viewportCenterWorld.x - config.width / 2,
          y: viewportCenterWorld.y - newHeight / 2
        },
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
    description: 'Edita atributos dos objetos selecionados. Ex: EDIT INPUTS 4',
    schema: [
      ['INPUTS', 'COLOR'],
      () => {
         // Return all color options + inputs hint
         return ['[2-32]', ...Object.keys(GATE_COLORS), ...Object.keys(LED_COLORS), 'DEFAULT', '#HEX'];
      }
    ],
    handler: (args, { selectedNodeIds, setNodes, setWires }) => {
      if (selectedNodeIds.length === 0) {
        alert('Nenhum objeto selecionado para edição.');
        return;
      }

      if (args.length === 0) {
        alert('Propriedade a ser editada não informada. Ex: EDIT INPUTS 4');
        return;
      }

      const prop = args[0].toUpperCase();

      if (prop === 'INPUTS' || prop === 'INPUT') {
        const valStr = args[1];
        if (!valStr) {
          alert('Valor numérico inválido para inputs. Ex: EDIT INPUTS 4');
          return;
        }

        const val = parseInt(valStr, 10);
        if (isNaN(val)) {
          alert('Valor numérico inválido para inputs. Ex: EDIT INPUTS 4');
          return;
        }

        setNodes(prevNodes => prevNodes.map(node => {
          if (!selectedNodeIds.includes(node.id)) return node;

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
        const parsedColor = args[1]?.toUpperCase();
        if (!parsedColor || parsedColor === 'DEFAULT' || parsedColor === 'NONE') {
          setNodes(prev => prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, color: undefined } : n));
          return;
        }

        let hexColor = Object.entries(GATE_COLORS).find(([k]) => k === parsedColor)?.[1];
        if (!hexColor) {
          hexColor = Object.entries(LED_COLORS).find(([k]) => k === parsedColor)?.[1];
        }

        if (!hexColor) {
           if (/^#[0-9A-F]{6}$/i.test(args[1])) {
               hexColor = args[1];
           } else {
               alert(`Cor não reconhecida: ${parsedColor}`);
               return;
           }
        }

        setNodes(prev => prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, color: hexColor } : n));
      } else {
        alert(`Propriedade desconhecida: ${prop}`);
      }
    }
  });
}
