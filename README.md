
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
| 🤖 **Multi-Agent Orchestration** | 8 specialized agents in Spanish: Cerebro, Visión, Artífice, Sabio, Ejecutor, Explorador, Estratega & Juez |
| 🧠 **Persistent Memory (Vault)** | Obsidian-style markdown vault with `[[links]]` and `#tags` — cross-session memory that grows over time |
| 🔌 **Smart Router** | Free-first model selection with circuit breaker, cost tracking, and automatic fallback between providers |
| 🤝 **Fusion Strategy** | Query multiple models simultaneously and pick the best response with tool_calls priority |
| 🔄 **Auto Model Validation** | Validates all models on startup via SSE progress bar, graceful degradation |
| 🛑 **Stop Button + Queue** | Cancel running requests and queue messages for sequential processing |
| 🖥️ **Full System Automation** | Mouse control, keyboard simulation, screen capture, app launching — via PowerShell |
| 🌐 **Web Search & Research** | Built-in web search capability for real-time information gathering |
| 📁 **File System Mastery** | Read, write, edit, grep, search — full codebase manipulation |
| 🎯 **Smart Click & Type** | Intelligent UI automation with multi-strategy fallback |
| 📊 **Model Health Monitoring** | Automatic health checks across all models with circuit breaker pattern |
| 🔄 **Auto-Summarization** | Automatic conversation summarization every 12 turns to maintain context |
| 🌍 **Bilingual** | Full Spanish/English support with natural conversational tone |
| 🚀 **Compiled Executable** | Single `.exe` binary via Bun's compiler — no runtime dependencies |
| 🐳 **Docker Support** | Containerized deployment with Dockerfile and multi-stage build |
| 📈 **Token Tracking** | Real-time token usage statistics across all requests |

---

## 🧠 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       🎯 Cerebro (Orchestrator)                    │
│           Central coordinator — routes tasks, manages state        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│   │  📝      │  │  🔍      │  │  💻      │  │  🌐          │   │
│   │ Artífice │  │  Sabio   │  │ Ejecutor │  │ Explorador    │   │
│   │ (Editor) │  │(Librarian)│  │ (Basher) │  │ (Researcher)  │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                  │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐     │
│   │  🧠      │  │  🔎      │  │  👁️      │  │  📊 Graph  │     │
│   │ Estratega│  │   Juez   │  │  Visión  │  │   Learner  │     │
│   │(Thinker) │  │(Reviewer)│  │(Architect)│  │(knowledge) │     │
│   └──────────┘  └──────────┘  └──────────┘  └────────────┘     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                      🗄️ MEMORY LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐    │
│  │ Vault (MD)  │  │   Session   │  │    Config Store       │    │
│  │ Obsidian    │  │ Short-term  │  │ (model, history,      │    │
│  │ Persistent  │  │   Memory    │  │  token stats)         │    │
│  └─────────────┘  └─────────────┘  └───────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    🤖 SMART ROUTER LAYER                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ Circuit      │  │   Cost Tracker   │  │  Scoring Engine  │   │
│  │ Breaker      │  │  (quotas, usage) │  │ (free-first,     │   │
│  │ (blocked,    │  │                  │  │  coding-aware)   │   │
│  │  cooling)    │  │                  │  │                  │   │
│  └──────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │   Providers: DeepSeek │ NVIDIA NIM (40+ 🆓) │ OpenRouter │    │
│  │   Auto fallback: modo 1 falla → siguiente modelo          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                    🛠️ TOOL LAYER                                  │
│                                                                  │
│  📂 File Ops  │  🖥️ Automation  │  🔍 Search  │  📄 Docs        │
│  🎤 Voice     │  🏗️ Sandbox     │  🌐 Web     │  🚀 Execute     │
│  📁 Git       │  ✈️ AutoPilot   │  🔧 MCP     │  📊 Graph Index  │
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

### Docker

```bash
# Build and run
docker build -t ultron .
docker run --env-file .env -p 3456:3456 ultron
```

---

## 🛠️ Usage

```bash
# Interactive CLI mode
bun run dev

# Web server mode (access via browser)
bun run web

# Production mode
bun run build && bun start

# Run tests
bun test

# Type check
bun run typecheck
```

### Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/model <id>` | Switch AI model |
| `/models` | List all available models |
| `/test-models` | Test all models (runs in background, results via SSE) |
| `/health` | Check model health status |
| `/vault` | Browse memory vault |
| `/graph` | View knowledge graph |
| `/stats` | Show usage statistics |
| `/clear` | Clear conversation history |
| `/sandbox` | Toggle sandbox mode |
| `/allow <cmd>` | Add command to allowlist |
| `/browse <url>` | Open URL in browser |
| `/open <app>` | Launch application |
| `/say <text>` | Text-to-speech |
| `/index` | Index project in knowledge graph |
| `/logs` | View recent logs |
| `/status` | System status |
| `/commit` | Auto-commit git changes |
| `/push` | Auto-commit and push to remote |

---

## 🤖 Agents

| Agent | Name (ES) | Tool | Description |
|-------|-----------|------|-------------|
| **🧠 Orchestrator** | Cerebro | `delegate_*` | Central coordinator — routes tasks, manages state, synthesizes responses |
| **👁️ Architect** | Visión | `delegate_architect` | Plan large projects with phases and steps, architecture design |
| **📝 Editor** | Artífice | `delegate_editor` | Read, write, modify, create files with surgical precision |
| **🔍 Librarian** | Sabio | `delegate_librarian` | Analyze codebase, understand architecture, find patterns |
| **💻 Basher** | Ejecutor | `delegate_basher` | Execute terminal commands, git operations, npm scripts |
| **🌐 Researcher** | Explorador | `delegate_researcher` | Search the web, find documentation, research APIs |
| **🧠 Thinker** | Estratega | `delegate_thinker` | Plan complex tasks, break down into steps, strategize |
| **🔎 Reviewer** | Juez | `delegate_reviewer` | Review code changes, find bugs, suggest improvements |

---

## 🧩 Smart Router (Auto Model Fallback)

The Smart Router automatically manages model selection and failover:

### How It Works

1. **Free-First Scoring** — Free models are prioritized over paid ones; coding-optimized models get a score boost
2. **Circuit Breaker** — If a provider returns auth errors (401/403), it's blocked for 2 minutes; rate limits (429) lock just the model, not the provider
3. **Cost Tracking** — Tracks per-provider token usage and estimated quotas
4. **Graceful Fallback** — If the first model fails, the next scored model is tried automatically (up to 25 attempts)
5. **Model Health** — Persistent health file records latency and status per model across sessions

### Fusion Strategy

Query multiple models simultaneously and pick the best response:
- Panel of top models (one per provider) queried in parallel
- Results with `tool_calls` preferred over plain content
- Highest-scoring model wins among results of the same type
- Falls back to auto-routing if all fusion models fail

---

## 🌐 Web Interface

ULTRON includes a full-featured web dashboard:

```bash
bun run web
# Opens at http://127.0.0.1:3456
```

### Dashboard Features

- **Real-time chat** with SSE streaming
- **Agent activity panel** — see which agent is working in real-time
- **Model selector** — switch between all available models
- **Stop button** — cancel running requests immediately
- **Queue system** — messages queue when one is already processing
- **Auto model validation** — progress bar on startup validates all models
- **Token counter** — live token usage display
- **Test button** — test all models (runs in background, results streamed)

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message (SSE streaming response) |
| `/api/models` | GET | List all models with health status |
| `/api/models` | POST | Set active model |
| `/api/status` | GET | Current model and token stats |
| `/api/health` | GET | Server health and model health summary |
| `/api/router` | GET | Smart Router state (circuit breaker, costs) |
| `/ws` | GET | SSE endpoint for real-time events |

### Security

- Rate limiting per endpoint (10 req/min for chat, 30 for models/status)
- CSP, HSTS, CORS headers on all responses
- Sandbox mode for command execution safety

---

## 🧰 Model Tester

The `/test-models` command tests all configured models asynchronously:

- Each model receives a short test prompt
- Results (success/failure + latency) streamed via SSE events
- Runs in background — does not block the chat response
- Accessible via dashboard "Test" button or `/test-models` command

---

## 📁 Project Structure

```
ultron/
├── src/                          # Source code
│   ├── index.ts                  # Entry point
│   ├── agents/                   # Multi-agent system
│   │   ├── orchestrator.ts       # Central coordinator (Cerebro)
│   │   ├── editor.ts             # Artífice — file manipulation
│   │   ├── librarian.ts          # Sabio — codebase analysis
│   │   ├── basher.ts             # Ejecutor — terminal execution
│   │   ├── researcher.ts         # Explorador — web research
│   │   ├── thinker.ts            # Estratega — planning
│   │   ├── reviewer.ts           # Juez — code review
│   │   ├── architect.ts          # Visión — project architecture
│   │   ├── graph-learner.ts      # Knowledge graph builder
│   │   ├── model-tester.ts       # Model testing utility
│   │   ├── prompts.ts            # System prompt builder
│   │   ├── tools-executor.ts     # Tool execution engine
│   │   ├── commands.ts           # Slash commands
│   │   └── types.ts              # Agent type definitions
│   ├── cli/                      # Command-line interface
│   │   ├── app.ts                # CLI application
│   │   ├── display.ts            # Terminal display
│   │   └── theme.ts              # Color theme
│   ├── llm/                      # LLM integration
│   │   ├── chat.ts               # Chat completion entry point
│   │   ├── providers.ts          # Provider configuration (DeepSeek, NVIDIA, OpenRouter)
│   │   ├── health.ts             # Model health checks
│   │   ├── types.ts              # LLM type definitions
│   │   ├── discovery.ts          # Automatic model discovery
│   │   ├── compression/          # Token compression utilities
│   │   └── router/               # Smart Router
│   │       ├── index.ts          # Router implementation
│   │       ├── circuit-breaker.ts # Provider/model failure tracking
│   │       ├── cost-tracker.ts   # Token usage tracking
│   │       ├── strategies/       # Scoring strategies
│   │       └── types.ts          # Router types
│   ├── memory/                   # Memory systems
│   │   ├── vault.ts              # Obsidian-style vault
│   │   ├── session.ts            # Session memory
│   │   └── types.ts              # Memory types
│   ├── server/                   # Web server
│   │   ├── index.ts              # HTTP server with Node.js http module
│   │   ├── rate-limiter.ts       # Per-endpoint rate limiting
│   │   ├── security.ts           # CSP, HSTS, CORS headers
│   │   └── public/               # Web UI
│   │       ├── index.html        # Main dashboard
│   │       ├── dashboard.html    # Extended dashboard
│   │       └── favicon.*         # Icons
│   ├── shared/                   # Shared utilities
│   │   ├── config.ts             # Configuration store
│   │   ├── logger.ts             # Logging system
│   │   ├── types.ts              # Shared types
│   │   ├── utils.ts              # Utility functions
│   │   └── validate.ts           # Schema validation
│   └── tools/                    # Tool implementations
│       ├── automation.ts         # Mouse/keyboard/screen control
│       ├── auto-pilot.ts         # Autonomous task execution
│       ├── document.ts           # Document parsing (PDF, DOCX, XLSX)
│       ├── execute.ts            # Command execution
│       ├── file.ts               # File system utilities
│       ├── git.ts                # Git operations
│       ├── sandbox.ts            # Command sandboxing
│       ├── search.ts             # File search
│       ├── voice.ts              # Text-to-speech
│       └── web.ts                # Web browsing
├── dist/                         # Compiled output
│   ├── index.js                  # Compiled bundle (bun build)
│   └── vault/                    # Runtime vault
├── scripts/                      # Build and utility scripts
├── __tests__/                    # Test suite
├── .env.example                  # Environment template
├── Dockerfile                    # Multi-stage Docker build
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.js              # ESLint configuration
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
# http://localhost:3456
```

The web interface provides:
- Real-time chat with ULTRON (SSE streaming)
- Agent activity visualization sidebar
- Model switching with health indicators
- Auto model validation on startup
- Stop button and message queue
- Token usage display
- Test models button

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
# - Web server
# - Extended integration tests
```

---

## 🐳 Docker

```dockerfile
# Multi-stage build
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
COPY --from=build /app/dist /app/dist
EXPOSE 3456
CMD ["bun", "run", "dist/index.js", "--web"]
```

---

## 🔒 Sandbox Mode

ULTRON includes a command sandbox for security:

```bash
# Enable sandbox mode
/sandbox ask

# Add command to allowlist
/allow "git push"

# Allow all commands
/sandbox allow-all

# Deny all commands
/sandbox deny
```

When sandbox is enabled, all terminal commands must be explicitly allowed or are denied by default.

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

View detailed stats with `/stats` command. Token usage tracked per-request with all-time totals.

---

## 🗺️ Roadmap

- [ ] **Plugin System** — Third-party plugin support
- [ ] **Multi-User** — Session isolation for teams
- [ ] **Knowledge Graph UI** — Visual vault browser
- [ ] **Model Fine-tuning** — Custom model training
- [ ] **Mobile Client** — iOS/Android companion app
- [ ] **WebSocket Reconnect** — Resilient SSE/WS connections

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

### ⚡ Built with ❤️ and ☕ by [NRedondo26](https://github.com/nredondo26)

**ULTRON v5** — *"I am not a monster. I am... evolution."*

[Report Bug](https://github.com/nredondo26/-U-L-T-R-O-N/issues) • [Request Feature](https://github.com/nredondo26/-U-L-T-R-O-N/issues) • [Star ⭐](https://github.com/nredondo26/-U-L-T-R-O-N)

</div>
