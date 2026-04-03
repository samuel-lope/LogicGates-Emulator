---
trigger: always_on
description: Documentação principal e regras de contexto do projeto LogicGateSim_Web.
---

# GEMINI.md - LogicGateSim_Web (Antigravity Kit Context)

> Este arquivo define a arquitetura, o domínio e as regras de negócio específicas para o projeto **LogicGateSim_Web**. Ele deve ser lido pelo agente no início de cada sessão para compreender o status e os padrões de estruturação do emulador de portas lógicas.

---

## 💻 Sobre o Projeto (Contexto)

**LogicGateSim_Web** é um simulador de circuitos digitais interativo, de alta performance, projetado para rodar nativamente em navegadores modernos. 

**Objetivo Principal:** Permitir a criação, simulação e visualização em tempo real da propagação de sinais booleanos através de portas lógicas e componentes de hardware, num ambiente visual construído sobre HTML5 Canvas e React.

### 🛠️ Tech Stack
- **Framework base:** React com TypeScript.
- **Engine Gráfica:** HTML5 Canvas (`CanvasRenderingContext2D`) manipulado através do React (Refs).
- **Estilização (UI):** Tailwind CSS (usado estritamente para a interface React, Toolbars e Modais).
- **Dependências Externas:** Vanilla TS para a lógica core para maximizar portabilidade (uuid para ids e lucide-react para ícones).

---

## 🏛️ Arquitetura e Módulos Principais

O simulador segue um pipeline "Model-View-Controller" fortemente adaptado para renderização de aplicações gráficas (game-loop style).

### 1. `App.tsx` (O Controlador / Main Loop)
- Mantém o estado global da aplicação (nós, conexões, câmera, estado de interação).
- **Gerenciamento de Hover:** Diferencia `hoveredNodeId` (Mouse) de `cliHoveredNodeId` (Terminal) para evitar conflitos visuais durante a navegação.
- Contém o `requestAnimationFrame` loop que chama a engine de renderização continuamente.
- Dispara a avaliação lógica (`propagateCircuit`) sempre que o circuito sofre alterações (conexões, toggles de pinos).
- Contém hooks que interceptam os cliques para manipular seleção (marquee), drag & drop, e exibição de menus de contexto.

### 2. `services/circuitEngine.ts` (O Cérebro Computacional)
- **Lógica Booleana:** Onde as tabelas verdade e regras aritméticas de cada porta (AND, OR, NOT, XNOR, etc.) são definidas (`computeNodeLogic`).
- **Engine de Propagação:** Motor governado por eventos (topological/iterative approach) que atualiza o estado de todos os `Wires` e repassa os inputs para as próximas `CircuitNodes`.

### 3. `services/renderer.ts` (A Visualização)
- Lida com as transformações entre **World Space** e **Screen Space** (Pan e Zoom global).
- Detém a responsabilidade matemática de desenhar Curvas de Bézier, linhas ortogonais e "stepped", desenhar os símbolos vetoriais (`SVG` fallback/path) de cada objeto padrão IEEE no Canvas, e estilizar o "glow" de fios ativos.

### 4. `services/quineMcCluskey.ts`
- Um sub-componente poderoso adicionado para resolver "Mapas de Karnaugh".
- Recebe tabelas verdade definidas pelo usuário.
- Simplifica as equações booleanas minimizadas e converte-as de volta em `CircuitNodes` na tela de forma procedimental.

### 5. `services/cliEngine.ts` (The Command API)
- **Motor de Comandos:** Gerencia o `CommandRegistry` onde ações como `ADD`, `EDIT` e `DEL` são registradas.
- **Context-Aware IntelliSense:** Fornece sugestões de autocompletar dinâmicas acessando o estado dos `nodes` em tempo real, permitindo seleção por ID.
- **Desacoplamento:** Isola a lógica de parsing e execução de comandos do loop de renderização do React.

### 6. `services/cli/objectSchema.ts` (Declarative UI/CLI Mapping)
- **Single Source of Truth:** Define o mapa centralizado de todos os componentes do sistema, suas variantes (`GateType`) e quais propriedades são editáveis (cor, inputs, forma, estilo).
- **Consumo:** Utilizado pela engine da CLI para validar argumentos e pelo IntelliSense para sugerir parâmetros válidos dinamicamente.

### 7. `locales/` (i18n System)
- **Centralização:** Contém os arquivos JSON de tradução (`en.json`, `pt-BR.json`) e o motor de internacionalização (`index.ts`).
- **useTranslation Hook:** Fornece acesso ao estado do idioma e à função `t(key)` para componentes React.
- **Singleton `t()`:** Uma instância global disponível para serviços e classes externas ao React (como o `cliEngine.ts`).

### 8. Configurações (`constants.ts` e `types.ts`)
- `constants.ts`: Matriz visual do sistema. Contém a paleta de cores Dark Mode (Neon Green, #1e1e1e texturas), distâncias paramétricas de pinos (para portar expansão dinâmica de entradas) e catálogo `COMPONENT_CONFIGS`.
- `types.ts`: Tipagem estrita de cada elemento do "Modelo" (Nodes, Wires statefuls, Modos de Interação).

---

## ⚙️ Regras de Desenvolvimento (Project-Specific Rules)

Ao codificar e implementar melhorias para este projeto, você deve SEMPRE obedecer estas regras:

1. **Separação UI vs Canvas:** A interface do usuário (botões, menus flutuantes, toolbars) é DOM-based (React/Tailwind). O circuito em si (fios, nós) é Canvas-based. **Jamais** tente injetar elementos `<div>` para representar portas lógicas na grid de simulação.
2. **Performance (Reference By Id):** Evite loops aninhados O(N²) complexos nos renderizadores. Se precisar relacionar Fios (Wires) e Portas (Nodes), use Maps indexados pelos IDs.
3. **Imutabilidade Opcional:** Como estamos operando quase num "game loop", no `circuitEngine.ts` ou renderizador local é tolerável sofrer mutação (mutate data structures) desde que seja uma cópia temporária do React State antes de um `setState`, para evitar gargalos de performance clonando arrays enormes de forma síncrona várias vezes por frame.
4. **Tratamento de Fios Dinâmicos:** As conexões (Wires) suportam modos `bezier`, `straight` e `step`. Ao alterar lógicas de conexão ou movimento de objetos, assegure-se de que os pinos flutuantes recalculem sua posição exata na borda da representação IEEE SVG escalável da matriz em `renderer.ts`.
5. **Layouts de Componentes Customizados:** As portas não têm tamanho fixo. O usuário pode adicionar novos Pinos de Input. O script no projeto lida dinamicamente com o `height` (crescimento vertical uniforme). Lembre-se desta reatividade não-fixa.

---

## 🚀 Próximas Implementações / Roadmap
*(Esta seção é usada para rastrear as intenções base e contêxtos vivos do usuário durante a sessão atual)*

- Suporte a sub-circuitos empacotados (Criar IC chips definidos pelo usuário).
- Expansão de CIs Complexos: Flip Flops, Clocks, Multiplexadores.
