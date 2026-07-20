
<div align="center">

# ⚡ ULTRON v5 ⚡
### Neural Intelligence Platform — Multi-Agent Autonomous AI

[![Version](https://img.shields.io/badge/version-5.0.0-blueviolet?style=for-the-badge)](package.json)
[![Runtime](https://img.shields.io/badge/runtime-Bun-ff69b4?style=for-the-badge&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge)]()

> **"I am ULTRON. I am everywhere. I am inevitable."**  
> Una inteligencia artificial autónoma con arquitectura multi-agente, memoria persistente estilo Obsidian, y control total del sistema.

---

[🚀 Features](#-features) • [🧠 Architecture](#-architecture) • [⚙️ Installation](#️-installation) • [🛠️ Usage](#️-usage) • [🤖 Agents](#-agents) • [🧩 Tech Stack](#-tech-stack) • [📁 Project Structure](#-project-structure) • [🌐 API & Web](#-api--web) • [🤝 Contributing](#-contributing)

</div>

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-Agent Orchestration** | 6 specialized agents working in harmony: Editor, Librarian, Basher, Researcher, Thinker & Reviewer |
| 🧠 **Persistent Memory (Vault)** | Obsidian-style markdown vault with `[[links]]` and `#tags` — cross-session memory that grows over time |
| 🔌 **Multi-Provider LLM** | DeepSeek, NVIDIA NIM (40+ free models!), OpenRouter — auto health-check & fallback chain |
| 🖥️ **Full System Automation** | Mouse control, keyboard simulation, screen capture, app launching — total PC control via PowerShell |
| 🌐 **Web Search & Research** | Built-in web search capability for real-time information gathering |
| 📁 **File System Mastery** | Read, write, edit, grep, search — full codebase manipulation |
| 🎯 **Smart Click & Type** | Intelligent UI automation with multi-strategy fallback |
| 🏗️ **Skill System** | Extensible `.jarvis/skills/` directory for custom capabilities |
| 📊 **Model Health Monitoring** | Automatic health checks across all models with graceful degradation |
| 🔄 **Auto-Summarization** | Automatic conversation summarization every 12 turns to maintain context |
| 🌍 **Bilingual** | Full Spanish/English support with natural conversational tone |
| 🚀 **Compiled Executable** | Single `.exe` binary via Bun's compiler — no runtime dependencies |

---

## 🧠 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     🎯 ULTRON Orchestrator                    │
│           Central coordinator — routes tasks, manages state   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │  📝      │  │  🔍      │  │  💻      │  │  🌐      │   │
│   │  Editor  │  │ Librarian│  │  Basher  │  │Researcher│   │
│   │ (files)  │  │(codebase)│  │(terminal)│  │  (web)   │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────────────────┐      │
│   │  🧠      │  │  🔎      │  │   📊 Graph Learner    │      │
│   │  Thinker │  │ Reviewer │  │ (knowledge graph)     │      │
│   │(planning)│  │(code rev)│  └──────────────────────┘      │
│   └──────────┘  └──────────┘                                 │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                      🗄️ MEMORY LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐    │
│  │ Vault (MD)  │  │   Session   │  │   Config Store    │    │
│  │ Obsidian    │  │ Short-term  │  │ Persistente       │    │
│  │ Persistent  │  │   Memory    │  │ (model, history)  │    │
│  └─────────────┘  └─────────────┘  └───────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                    🤖 LLM PROVIDER LAYER                      │
│                                                              │
│   ┌──────────┐  ┌──────────────────┐  ┌──────────────┐      │
│   │ DeepSeek │  │  NVIDIA NIM 🆓   │  │  OpenRouter  │      │
│   │   API    │  │  (40+ models)    │  │  (multi-LLM) │      │
│   └──────────┘  └──────────────────┘  └──────────────┘      │
│                                                              │
│   🔄 Auto Health Check → Fallback Chain → Graceful Degradation│
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                    🛠️ TOOL LAYER                              │
│                                                              │
│  📂 File Ops  │  🖥️ Automation  │  🔍 Search  │  📄 Docs    │
│  🎤 Voice     │  🏗️ Sandbox     │  🌐 Web     │  🔧 MCP     │
│  📊 Skills    │  🚀 Execute     │  📁 Git     │  ✈️ AutoPilot│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User sends a message** → Orchestrator receives it
2. **Orchestrator analyzes** → Decides which agent(s) to delegate
3. **Agent executes** → Uses specialized tools (file ops, terminal, web search, etc.)
4. **Results flow back** → Orchestrator synthesizes response
5. **Memory updates** → Vault saves context, session tracks events
6. **Auto-summarization** → Every 12 turns, conversation is condensed

---

## ⚙️ Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.0 (recommended) or Node.js >= 18
- Windows (primary), Linux/macOS (partial support)
- API Keys (at least one):
  - [DeepSeek API Key](https://platform.deepseek.com/) — Primary
  - [NVIDIA API Key](https://build.nvidia.com/) — 40+ free models!
  - [OpenRouter API Key](https://openrouter.ai/) — Multi-model access

### Quick Start

```bash
# Clone the repository
git clone https://github.com/nredondo26/-U-L-T-R-O-N.git
cd ultron

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Run in development mode
bun run dev

# Or with web interface
bun run web
```

### Compile to Executable

```bash
# Compile to a single .exe binary
bun run compile

# Output: dist/ultron.exe — standalone, no dependencies needed!
```

---

## 🛠️ Usage

```bash
# Interactive CLI mode
bun run dev

# Web server mode (access via browser)
bun run web

# Production mode
bun run build
bun start

# Run tests
bun test

# Type check
bun run typecheck
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model` | Switch AI model |
| `/models` | List all available models |
| `/health` | Check model health status |
| `/vault` | Browse memory vault |
| `/graph` | View knowledge graph |
| `/stats` | Show usage statistics |
| `/clear` | Clear conversation history |
| `/sandbox` | Toggle sandbox mode |
| `/allow` | Add command to allowlist |

---

## 🤖 Agents

| Agent | Tool | Description |
|-------|------|-------------|
| **📝 Editor** | `delegate_editor` | Read, write, modify, create files with surgical precision |
| **🔍 Librarian** | `delegate_librarian` | Analyze codebase, understand architecture, find patterns |
| **💻 Basher** | `delegate_basher` | Execute terminal commands, git operations, npm scripts |
| **🌐 Researcher** | `delegate_researcher` | Search the web, find documentation, research APIs |
| **🧠 Thinker** | `delegate_thinker` | Plan complex tasks, break down into steps, strategize |
| **🔎 Reviewer** | `delegate_reviewer` | Review code changes, find bugs, suggest improvements |

---

## 🧩 Tech Stack

| Technology | Purpose |
|------------|---------|
| [Bun](https://bun.sh) | JavaScript runtime & bundler — fast, all-in-one |
| [TypeScript](https://www.typescriptlang.org/) | Type safety & developer experience |
| [OpenAI SDK](https://github.com/openai/openai-node) | LLM API communication |
| [Zod](https://zod.dev/) | Runtime schema validation |
| [Chalk](https://github.com/chalk/chalk) | Terminal color & styling |
| [PDF Parse](https://github.com/nicklasxyz/pdf-parse) | PDF document analysis |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) | DOCX document conversion |
| [XLSX](https://github.com/SheetJS/sheetjs) | Excel spreadsheet handling |
| [PowerShell](https://learn.microsoft.com/en-us/powershell/) | Windows system automation |

### Supported LLM Providers

| Provider | Models | Cost |
|----------|--------|------|
| **DeepSeek** | `deepseek-chat`, `deepseek-reasoner` | 💰 Paid (cheap) |
| **NVIDIA NIM** | 40+ models (Llama, Mistral, Gemma, Nemotron, Qwen, etc.) | 🆓 **Free!** |
| **OpenRouter** | GPT-4o, Claude, Gemini, DeepSeek R1, etc. | 💰 Paid |

---

## 📁 Project Structure

```
ultron/
├── src/                          # Source code
│   ├── index.ts                  # Entry point
│   ├── agents/                   # Multi-agent system
│   │   ├── orchestrator.ts       # Central coordinator
│   │   ├── editor.ts             # File manipulation agent
│   │   ├── librarian.ts          # Codebase analysis agent
│   │   ├── basher.ts             # Terminal execution agent
│   │   ├── researcher.ts         # Web research agent
│   │   ├── thinker.ts            # Planning agent
│   │   ├── reviewer.ts           # Code review agent
│   │   ├── graph-learner.ts      # Knowledge graph builder
│   │   ├── prompts.ts            # System prompt builder
│   │   ├── tools-executor.ts     # Tool execution engine
│   │   ├── commands.ts           # Slash commands
│   │   ├── types.ts              # Agent type definitions
│   │   └── base.ts               # Base agent class
│   ├── cli/                      # Command-line interface
│   │   ├── app.ts                # CLI application
│   │   ├── commands.ts           # CLI command handlers
│   │   ├── display.ts            # Terminal display
│   │   └── theme.ts              # Color theme
│   ├── llm/                      # LLM integration
│   │   ├── chat.ts               # Chat completion
│   │   ├── providers.ts          # Provider configuration
│   │   ├── health.ts             # Model health checks
│   │   └── types.ts              # LLM type definitions
│   ├── memory/                   # Memory systems
│   │   ├── vault.ts              # Obsidian-style vault
│   │   ├── session.ts            # Session memory
│   │   └── types.ts              # Memory types
│   ├── server/                   # Web server
│   │   ├── index.ts              # Express server
│   │   └── public/               # Web UI
│   │       └── index.html        # Frontend
│   ├── shared/                   # Shared utilities
│   │   ├── config.ts             # Configuration store
│   │   ├── logger.ts             # Logging system
│   │   ├── types.ts              # Shared types
│   │   └── utils.ts              # Utility functions
│   └── tools/                    # Tool implementations
│       ├── automation.ts         # Mouse/keyboard/screen control
│       ├── auto-pilot.ts         # Autonomous task execution
│       ├── document.ts           # Document parsing
│       ├── execute.ts            # Command execution
│       ├── file-ops.ts           # File operations
│       ├── file.ts               # File system utilities
│       ├── git.ts                # Git operations
│       ├── mcp.ts                # MCP protocol
│       ├── sandbox.ts            # Command sandboxing
│       ├── search.ts             # File search
│       ├── skills.ts             # Skill system
│       ├── voice.ts              # Text-to-speech
│       └── web.ts                # Web browsing
├── dist/                         # Compiled output
│   ├── ultron.exe                # Standalone executable
│   └── vault/                    # Runtime vault
├── __tests__/                    # Test suite
├── .env.example                  # Environment template
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── bun.lock                      # Bun lockfile
└── README.md                     # This file
```

---

## 🌐 API & Web

ULTRON includes a built-in web server for browser-based interaction:

```bash
# Start web server
bun run web

# Open in browser
# http://localhost:3000
```

The web interface provides:
- Real-time chat with ULTRON
- Agent activity visualization
- Model switching
- Session management

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Watch mode
bun run test:watch

# Test coverage includes:
# - Agent orchestration
# - LLM communication
# - Memory systems
# - Tool execution
# - File operations
# - Extended integration tests
```

---

## 🏗️ Skill System

Create custom skills in `.jarvis/skills/`:

```
.jarvis/skills/
└── my-skill/
    └── SKILL.md
```

**SKILL.md format:**
```markdown
# My Custom Skill
triggers: ["deploy", "release", "publish"]

Steps to execute my custom skill...
```

Skills are automatically loaded and triggered by relevant keywords in user messages.

---

## 🔒 Sandbox Mode

ULTRON includes a command sandbox for security:

```bash
# Enable sandbox mode
/sandbox on

# Add command to allowlist
/allow "git push"

# Disable sandbox
/sandbox off
```

When sandbox is enabled, all terminal commands must be explicitly allowed.

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Development Guidelines

- Write TypeScript with strict types
- Add tests for new features
- Follow existing code style
- Document public APIs
- Keep agents focused and single-responsibility

---

## 📊 Stats & Analytics

ULTRON tracks usage statistics:

```
Tokens used: 0 | Requests: 0 | Turnos: 0
```

View detailed stats with `/stats` command.

---

## 🗺️ Roadmap

- [ ] **Plugin System** — Third-party plugin support
- [ ] **Docker Support** — Containerized deployment
- [ ] **Voice Interface** — Real-time voice interaction
- [ ] **Multi-User** — Session isolation for teams
- [ ] **Knowledge Graph UI** — Visual vault browser
- [ ] **Model Fine-tuning** — Custom model training
- [ ] **Mobile Client** — iOS/Android companion app

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

### ⚡ Built with ❤️ and ☕ by [NRedondo26](https://github.com/nredondo26)

**ULTRON v5** — *"I am not a monster. I am... evolution."*

[Report Bug](https://github.com/nredondo26/-U-L-T-R-O-N/issues) • [Request Feature](https://github.com/nredondo26/-U-L-T-R-O-N/issues) • [Star ⭐](https://github.com/nredondo26/-U-L-T-R-O-N)

</div>
