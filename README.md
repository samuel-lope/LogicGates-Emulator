# ⚡ LogicGateSim Web

Um simulador de circuitos digitais interativo de alta performance, construído inteiramente sobre **HTML5 Canvas** e **React**. Projete, simule e valide portas lógicas em tempo real com uma interface fluida, estilo néon e ferramentas para usuários avançados.

---

## ✨ Funcionalidades

- **Engine Gráfica em Canvas:** Renderização suave de circuitos vianogais (Bezier/Step) e animações de propagação de sinal.
- **Simulação em Tempo Real:** Visualização instantânea de 0s e 1s através de gradientes de cores (Neon Green para Ativo).
- **Interface de Linha de Comando (CLI):** Barra de ferramentas para adicionar, editar e deletar componentes sem remover as mãos do teclado.
- **IntelliSense Customizado:** Autocomplete dinâmico que reconhece as peças que você criou na tela.
- **Suporte IEEE:** Símbolos de portas lógicas baseados em padrões internacionais de engenharia.

---

## 🚀 Como Executar

**Pré-requisitos:** Node.js (v18+)

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/samuel-lope/LogicGates-Emulator.git
   cd LogicGates-Emulator
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Subir Ambiente de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse: `http://localhost:3000/`

---

## ⌨️ Comandos Rápidos (CLI)

O simulador inclui uma barra de comandos na parte inferior (`>`). Experimente:

| Comando | Descrição | Exemplo |
|---------|-----------|---------|
| `ADD` | Adiciona novos componentes | `ADD OR 4` ou `ADD SW` |
| `EDIT` | Altera propriedades via ID | `EDIT AND wzbf INPUTS 6` |
| `DEL` | Remove peças do circuito | `DEL XOR k9pa` |

Consulte o [Guia CLI Completo](./docs/CLI.md) para ver todos os aliases (`SW`, `LED`, `CLK`, `DER`).

---

## 🛠️ Tecnologias

- **React + TypeScript**
- **Vite** (Build Tool)
- **Tailwind CSS** (UI / Toolbars)
- **Canvas API** (Simulation Core)
- **Cloudflare Pages** (Deployment)

---

## 📄 Documentação

- [📖 Guia de Interface de Linha de Comando (CLI)](./docs/CLI.md)
- [🏛️ Arquitetura do Projeto](./GEMINI.md)

---

## Licença

Este projeto está sob a licença MIT.
