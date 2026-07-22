
<div align="center">

# ⚡ ULTRON v5 ⚡
### Neural Intelligence Platform — Multi-Agent Autonomous AI

[![Version](https://img.shields.io/badge/version-5.1.0-blueviolet?style=for-the-badge)](package.json)
[![Runtime](https://img.shields.io/badge/runtime-Bun-ff69b4?style=for-the-badge&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

> **"I am ULTRON. I am everywhere. I am inevitable."**
> Una inteligencia artificial autónoma con arquitectura multi-agente, memoria persistente estilo Obsidian, y control total del sistema.

---

[🚀 Features](#-features) • [🧠 Architecture](#-architecture) • [⚙️ Installation](#️-installation) • [🛠️ Usage](#️-usage) • [🤖 Agents](#-agents) • [🌐 Web Interface](#-web-interface) • [📁 Project Structure](#-project-structure)

</div>

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-Agent Orchestration** | 8 specialized agents in Spanish: Cerebro, Visión, Artífice, Sabio, Ejecutor, Explorador, Estratega & Juez |
| 🧠 **Persistent Memory (Vault)** | Obsidian-style markdown vault with `[[links]]` and `#tags` — cross-session memory |
| 🔌 **Smart Router** | Free-first model selection with circuit breaker, cost tracking, and automatic fallback |
| 🤝 **Fusion Strategy** | Query multiple models simultaneously and pick the best response |
| 🔄 **Auto Model Validation** | Validates all models on startup via SSE progress bar, synced with circuit breaker |
| 🛑 **Stop + Queue** | Cancel running requests via `/api/stop` and queue messages for sequential processing |
| 🖥️ **System Automation** | Mouse control, keyboard simulation, screen capture, app launching — via PowerShell |
| 🌐 **Web Search** | Built-in web search with timeouts and abort signals |
| 📁 **File Operations** | Read, write, edit, grep, search — full codebase manipulation |
| 🎯 **Smart Click & Type** | Intelligent UI automation with multi-strategy fallback |
| 📊 **Model Health** | Health checks synced with circuit breaker — unhealthy models pre-blocked |
| 🔄 **Auto-Summarization** | Automatic conversation summarization every 12 turns |
| 🌍 **Bilingual** | Full Spanish/English support |
| 🚀 **Compiled Executable** | Single `.exe` binary via Bun's compiler |
| 🐳 **Docker Support** | Containerized deployment with multi-stage build |
| 📈 **Token Tracking** | Real-time token usage statistics across all requests |
| 🔒 **API Key Auth** | Optional Bearer token authentication + reverse proxy support with `--bind` and `--trust-proxy` |
| ⚡ **Parallel Testing** | Batch model testing in parallel (5 concurrent) |

---

## 🧠 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       🎯 Cerebro (Orchestrator)                  │
│           Central coordinator — routes tasks, manages state      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│   │ Artífice │  │  Sabio   │  │ Ejecutor │  │ Explorador   │   │
│   │ (Editor) │  │(Librarian)│  │ (Basher) │  │ (Researcher) │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐     │
│   │Estratega │  │  Juez    │  │ Visión   │  │   Graph    │     │
│   │(Thinker) │  │(Reviewer)│  │(Architect)│  │   Learner  │     │
│   └──────────┘  └──────────┘  └──────────┘  └────────────┘     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                      🗄️ MEMORY LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐    │
│  │ Vault (MD)  │  │   Session   │  │    Config Store       │    │
│  │ Persistent  │  │ Short-term  │  │ (model, history,      │    │
│  │             │  │   Memory    │  │  token stats)         │    │
│  └─────────────┘  └─────────────┘  └───────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    🤖 SMART ROUTER LAYER                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Circuit      │  │   Cost Tracker   │  │  Scoring Engine  │   │
│  │ Breaker      │  │  (quotas, usage) │  │ (free-first,     │   │
│  │              │  │                  │  │  coding-aware)   │   │
│  └──────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Providers: DashScope │ DeepSeek │ NVIDIA (40+ free) │ OR│    │
│  │  Auto fallback: model fails → next scored model          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    🛠️ TOOL LAYER                                  │
│                                                                  │
│  📂 File Ops  │  🖥️ Automation  │  🔍 Search  │  📄 Docs        │
│  🎤 Voice     │  🏗️ Sandbox     │  🌐 Web     │  🚀 Execute     │
│  📁 Git       │  ✈️ AutoPilot   │  📊 Graph   │                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User sends a message** → Cerebro (Orchestrator) receives it
2. **Smart Router** picks the best model (free-first, coding-aware, with circuit breaker fallback)
3. **Cerebro analyzes** → Decides which agent(s) to delegate
4. **Agent executes** → Uses specialized tools (file ops, terminal, web search, etc.)
5. **Results flow back** → Cerebro synthesizes response
6. **Memory updates** → Vault saves context, session tracks events
7. **Auto-summarization** → Every 12 turns, conversation is condensed

---

## ⚙️ Installation

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.0
- Windows (primary), Linux/macOS (partial support)
- API Keys (at least one):
  - [DashScope API Key](https://bailian.console.aliyun.com/) — Primary provider (qwen, deepseek)
  - [DeepSeek API Key](https://platform.deepseek.com/)
  - [NVIDIA API Key](https://build.nvidia.com/) — 40+ free models
  - [OpenRouter API Key](https://openrouter.ai/) — Multi-model access

### Quick Start

```bash
git clone https://github.com/nredondo26/-U-L-T-R-O-N.git
cd ultron
bun install
cp .env.example .env
# Edit .env and add your API keys
bun run dev
```

### Compile to Executable

```bash
bun run compile
# Output: dist/ultron.exe — standalone binary
```

---

## 🛠️ Usage

```bash
bun run dev          # Interactive CLI + dashboard
bun run web          # Web dashboard only
bun run build && bun start  # Production mode
bun test             # Run tests
bun run typecheck    # Type check
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `-p, --project <dir>` | Project directory (default: current) |
| `-v, --vault <dir>` | Vault directory (default: ./vault) |
| `-e, --env <file>` | .env file path |
| `--web` | Web UI only |
| `--cli` | CLI only |
| `--port <n>` | Web UI port (default: 3456) |
| `--bind <addr>` | Listen address (default: 127.0.0.1, use 0.0.0.0 for network) |
| `--trust-proxy` | Trust X-Forwarded-For headers (for reverse proxy) |
| `--api-key <key>` | API key for web auth |
| `-h, --help` | Show help |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/new` `/clear` | New conversation |
| `/history` | Recent conversation history |
| `/model <id>` | Switch AI model |
| `/models` | List all available models |
| `/test-models` | Test all models (background) |
| `/health` | Model health status |
| `/stats` `/tokens` | Usage statistics |
| `/vault` | Browse memory vault |
| `/vault:search <q>` | Search notes in memory |
| `/graph` | Knowledge graph overview |
| `/index` | Index project in knowledge graph |
| `/init` | Create knowledge.md in project |
| `/install` | Install dependencies (npm/pip) |
| `/build` | Compile project |
| `/test` | Run project tests |
| `/cd <dir>` | Change working directory |
| `/browse <url>` | Open URL in browser |
| `/open <app>` | Launch application |
| `/sandbox <mode>` | Sandbox mode (ask/allow/deny) |
| `/allow <cmd>` | Add command to allowlist |
| `/say <text>` | Text-to-speech |
| `/voices` | List available voices |
| `/voice-install` | Install Spanish voices |
| `/click` `/type` `/press` | Mouse/keyboard automation |
| `/screenshot` | Capture screen |
| `/mouse` | Mouse position |
| `/commit [msg]` | Auto-commit git changes |
| `/push [msg]` | Auto-commit and push |
| `/diff` | Git diff |
| `/log [n]` | Git log |
| `/resume` | Restore session |
| `/logs` | View recent logs |
| `/status` | System status |
| `/exit` | Exit |

---

## 🤖 Agents

| Agent | Name (ES) | Tool | Description |
|-------|-----------|------|-------------|
| 🧠 **Orchestrator** | Cerebro | `delegate_*` | Central coordinator — routes tasks, manages state |
| 👁️ **Architect** | Visión | `delegate_architect` | Plan large projects with phases and steps |
| 📝 **Editor** | Artífice | `delegate_editor` | Read, write, modify, create files |
| 🔍 **Librarian** | Sabio | `delegate_librarian` | Analyze codebase, understand architecture |
| 💻 **Basher** | Ejecutor | `delegate_basher` | Execute terminal commands, git, npm |
| 🌐 **Researcher** | Explorador | `delegate_researcher` | Search the web, research APIs |
| 🧠 **Thinker** | Estratega | `delegate_thinker` | Plan complex tasks, strategize |
| 🔎 **Reviewer** | Juez | `delegate_reviewer` | Review code changes, find bugs |

---

## 🌐 Web Interface

```bash
bun run web                         # Open dashboard
bun run web -- --port 8080          # Custom port
bun run web -- --api-key "secret"   # With auth
bun run web -- --bind 0.0.0.0 --api-key "secret" --trust-proxy  # Production
```

### Dashboard Features

- Real-time chat with SSE streaming
- Agent activity panel — see which agent is working
- Model selector with health indicators
- Stop button (`/api/stop`) and message queue
- Auto model validation progress bar on startup
- Token counter and test models button

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message (SSE streaming response) |
| `/api/stop` | POST | Cancel current request |
| `/api/auth` | POST | Validate API key |
| `/api/models` | GET | List all models with health status |
| `/api/models` | POST | Set active model |
| `/api/status` | GET | Current model and token stats |
| `/api/agents` | GET | Agent activity states |
| `/api/health` | GET | Server health and model health summary |
| `/api/router` | GET | Smart Router state |
| `/ws` | GET | SSE endpoint for real-time events |

### Security

- Optional API key auth via `--api-key` flag
- Rate limiting per endpoint (30 chat, 60 models, 120 agents)
- CSP, HSTS, CORS headers
- Body size limit (1MB)
- Reverse proxy support (`--trust-proxy`, `--bind`)
- Sandbox mode for command execution

---

## 📁 Project Structure

```
ultron/
├── src/
│   ├── index.ts                  # Entry point
│   ├── agents/                   # Multi-agent system
│   │   ├── orchestrator.ts       # Cerebro — central coordinator
│   │   ├── architect.ts          # Visión — project architecture
│   │   ├── editor.ts             # Artífice — file manipulation
│   │   ├── librarian.ts          # Sabio — codebase analysis
│   │   ├── basher.ts             # Ejecutor — terminal execution
│   │   ├── researcher.ts         # Explorador — web research
│   │   ├── thinker.ts            # Estratega — planning
│   │   ├── reviewer.ts           # Juez — code review
│   │   ├── graph-learner.ts      # Knowledge graph builder
│   │   ├── model-tester.ts       # Model testing utility
│   │   ├── prompts.ts            # System prompt builder
│   │   ├── tools-executor.ts     # Tool execution engine
│   │   ├── commands.ts           # Slash commands
│   │   ├── base.ts               # Base agent class
│   │   └── types.ts              # Agent type definitions
│   ├── cli/                      # CLI interface
│   │   ├── app.ts                # CLI application
│   │   ├── display.ts            # Terminal display
│   │   └── theme.ts              # Color theme
│   ├── llm/                      # LLM integration
│   │   ├── chat.ts               # Chat completion
│   │   ├── providers.ts          # Provider configuration
│   │   ├── health.ts             # Model health checks
│   │   ├── discovery.ts          # Automatic model discovery
│   │   ├── types.ts              # LLM type definitions
│   │   ├── compression/          # Token compression
│   │   └── router/               # Smart Router
│   │       ├── index.ts          # Router implementation
│   │       ├── circuit-breaker.ts
│   │       ├── cost-tracker.ts
│   │       ├── strategies/       # Scoring strategies
│   │       └── types.ts
│   ├── memory/                   # Memory systems
│   │   ├── vault.ts              # Obsidian-style vault
│   │   ├── session.ts            # Session memory
│   │   └── types.ts
│   ├── server/                   # Web server
│   │   ├── index.ts              # HTTP server
│   │   ├── rate-limiter.ts       # Per-endpoint rate limiting
│   │   ├── security.ts           # CSP, HSTS, CORS headers
│   │   └── public/               # Web UI
│   ├── shared/                   # Shared utilities
│   │   ├── config.ts             # Configuration store
│   │   ├── logger.ts             # Logging system
│   │   ├── types.ts              # Shared types
│   │   ├── utils.ts              # Utility functions
│   │   └── validate.ts           # Schema validation
│   └── tools/                    # Tool implementations
│       ├── automation.ts         # Mouse/keyboard/screen
│       ├── auto-pilot.ts         # Autonomous task execution
│       ├── document.ts           # PDF, DOCX, XLSX parsing
│       ├── execute.ts            # Command execution
│       ├── file.ts               # File system utilities
│       ├── file-ops.ts           # Desktop file operations
│       ├── git.ts                # Git operations
│       ├── git-workflow.ts       # Git workflow automation
│       ├── sandbox.ts            # Command sandboxing
│       ├── search.ts             # File search
│       ├── voice.ts              # Text-to-speech
│       └── web.ts                # Web search
├── __tests__/                    # Test suite (9 test files)
├── scripts/                      # Build scripts
├── dist/                         # Compiled output
├── .env.example                  # Environment template
├── Dockerfile                    # Multi-stage Docker build
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🧪 Testing

```bash
bun test                    # All tests
bun run test:watch          # Watch mode
bun test -- --coverage      # Coverage
```

---

## 🔒 Sandbox Mode

```bash
/sandbox ask           # Ask before executing commands
/sandbox deny          # Block all commands
/sandbox allow-all     # Allow all commands this session
/allow "git push"      # Add command to allowlist
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License.

---

<div align="center">

### ⚡ Built by [NRedondo26](https://github.com/nredondo26)

**ULTRON v5** — *"I am not a monster. I am... evolution."*

[Report Bug](https://github.com/nredondo26/-U-L-T-R-O-N/issues) • [Star ⭐](https://github.com/nredondo26/-U-L-T-R-O-N)

</div>
