# ULTRON v5

**Neural Intelligence Platform** — Multi-agent autonomous AI assistant with persistent memory, graph-based code understanding, and full system control.

[![Version](https://img.shields.io/badge/version-5.1.0-blueviolet?style=flat-square)](package.json)
[![Runtime](https://img.shields.io/badge/runtime-Bun-ff69b4?style=flat-square&logo=bun)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Desktop App](#desktop-app)
- [Configuration](#configuration)
- [Agents](#agents)
- [MCP Server](#mcp-server)
- [Project Structure](#project-structure)
- [Development](#development)

---

## Overview

ULTRON is a CLI-based AI assistant that coordinates 8 specialized agents to understand, analyze, and modify codebases. It features persistent memory (Obsidian-style vault), AST-based code graph indexing, multi-session support, and an optional web dashboard.

It can run as:
- **Interactive CLI** — Full-featured terminal with themes and spinner animations
- **Web dashboard** — HTTP server with REST API and streaming responses
- **MCP server** — Model Context Protocol for integration with OpenCode and Claude Desktop
- **Desktop app** — Electron wrapper with system tray (Windows)

---

## Features

| Category | Features |
|----------|----------|
| **Multi-Agent** | 8 specialized agents (Orchestrator, Editor, Librarian, Basher, Researcher, Thinker, Reviewer, Architect) |
| **Memory** | Obsidian-style markdown vault, cross-session persistence, proactive profile learning |
| **Code Intelligence** | AST-based graph indexing, dependency tracking, caller/callee analysis, path finding |
| **Sessions** | Multiple independent sessions with isolated context, rename and delete |
| **LLM Routing** | Free-first model selection, circuit breaker, cost tracking, automatic fallback |
| **File Operations** | Read, write, edit (str_replace with fuzzy matching), grep search, file tree listing |
| **System Automation** | Mouse control, keyboard simulation, screen capture, application launching |
| **Web Search** | Built-in DuckDuckGo search with timeout and abort support |
| **Document Analysis** | PDF, DOCX, XLSX, PPTX, EPUB, RTF, images, audio, video — 20+ formats |
| **Git Integration** | Auto-commit, push, diff, log — with repair workflow |
| **Sandbox** | Command execution with ask/allow/deny modes and allowlist |
| **MCP Protocol** | Expose all tools as MCP server for OpenCode and Claude Desktop |
| **Token Tracking** | Per-request and cumulative token usage statistics |
| **Skills System** | Extensible skill definitions loaded from `.opencode/skills/` |
| **File Watcher** | Optional real-time file change detection with auto-indexing |
| **Web Dashboard** | SSE streaming, agent activity panel, model selector, session management |

---

## Architecture

```
Orchestrator (Cerebro)
  ├── Editor (Artífice)       — File read/write/modify
  ├── Librarian (Sabio)       — Codebase analysis
  ├── Basher (Ejecutor)       — Command execution
  ├── Researcher (Explorador) — Web search
  ├── Thinker (Estratega)     — Task planning
  ├── Reviewer (Juez)         — Code review
  └── Architect (Visión)      — Project planning

Memory Layer
  ├── Vault (markdown files)
  ├── Session Manager
  ├── Config Store
  └── Graph Memory (AST index)

Smart Router
  ├── Circuit Breaker
  ├── Cost Tracker
  └── Scoring Engine (free-first, coding-aware)
```

**Message flow:**
1. User input → Orchestrator receives message
2. Router selects optimal model (free-first with fallback)
3. Orchestrator delegates to specialized agent(s)
4. Agents execute tools (file ops, commands, search)
5. Results synthesized and returned to user
6. Context saved to vault and session

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.0
- Windows 10+ (primary), Linux/macOS (partial)
- At least one API key in `.env`

### Installation

```bash
git clone https://github.com/nredondo26/-U-L-T-R-O-N.git
cd ultron
bun install
cp .env.example .env
# Edit .env with your API keys
```

### Run

```bash
bun run dev          # Interactive CLI
bun run dev -- --serve  # Web dashboard on http://localhost:3456
```

### Compile standalone binary

```bash
bun run compile
# ./dist/ultron.exe
```

---

## Usage

### CLI

```bash
ultron                          # Interactive CLI
ultron --serve                  # Web dashboard
ultron --mcp                    # MCP server (stdio)
ultron --project ./my-project   # Set project directory
ultron --vault ./data           # Set vault directory
ultron --port 8080              # Web server port
ultron --api-key "secret"       # Web auth
ultron --help                   # All options
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/new`, `/clear` | Reset conversation |
| `/model <id>` | Switch AI model |
| `/models` | List available models |
| `/session-new` | Create new session |
| `/sessions` | List sessions |
| `/session-switch <id>` | Switch to session |
| `/stats`, `/tokens` | Usage statistics |
| `/vault` | Browse vault notes |
| `/graph` | Knowledge graph status |
| `/index` | Index project in graph |
| `/cd <dir>` | Change directory |
| `/commit [msg]` | Git auto-commit |
| `/push [msg]` | Git auto-commit + push |
| `/diff` | Git diff |
| `/sandbox <mode>` | Set sandbox mode |
| `/allow <cmd>` | Add command to allowlist |
| `/analyze <file>` | Analyze document |
| `/config` | View configuration |
| `/skills` | List available skills |
| `/exit` | Exit |

### Reference files

```bash
@src/index.ts          # Read file content inline
@path/to/file.ts:50    # Read from line 50
```

### Execute commands

```bash
!git status            # Run shell command
!npm install           # Install dependencies
```

---

## Desktop App

Electron-based native Windows application with system tray integration.

### Run

```powershell
cd electron
npm install
npm start
```

### Build installer

```powershell
cd electron
npm run build:win
# Output: electron/dist/ULTRON Setup 5.1.0.exe
```

The desktop app:
- Starts `ultron.exe --serve` as a background process
- Shows splash screen while server loads
- Loads the web dashboard in a native window
- Minimizes to system tray on close
- Cleans up server process on exit

---

## Configuration

All settings in `ultron.json` at project root. Generated automatically on first run.

```json
{
  "agents": {
    "maxSteps": 25,
    "verbose": true,
    "delegationStrategy": "structured",
    "sharedContext": true
  },
  "models": {
    "defaultModel": "deepseek-chat",
    "freeFirst": true,
    "circuitBreaker": {
      "maxRetries": 3,
      "cooldownMs": 60000,
      "failureThreshold": 5
    }
  },
  "memory": {
    "graphMemory": true,
    "autoSummarize": true,
    "summarizeEvery": 12,
    "maxHistoryMessages": 20
  },
  "mcp": {
    "enabled": true,
    "serverMode": "stdio",
    "port": 3457
  },
  "skills": {
    "enabled": true,
    "dirs": [".opencode/skills"]
  },
  "ui": {
    "theme": "claude",
    "language": "es"
  }
}
```

### Themes

| Name | Colors |
|------|--------|
| `claude` | Orange/amber — inspired by Claude Code |
| `ultron` | Cyan/teal |
| `sky` | Blue |
| `cyber` | Teal/green |
| `midnight` | Purple |
| `matrix` | Green-on-black |

Switch with `/theme <name>`.

---

## Agents

| Agent | Name (ES) | Function |
|-------|-----------|----------|
| Orchestrator | Cerebro | Coordinates all agents, routes tasks, manages state |
| Editor | Artífice | Reads, creates, and modifies files with precision |
| Librarian | Sabio | Analyzes codebase structure and dependencies |
| Basher | Ejecutor | Executes terminal commands (npm, git, python) |
| Researcher | Explorador | Searches the web for documentation and APIs |
| Thinker | Estratega | Breaks down complex tasks into executable steps |
| Reviewer | Juez | Reviews code changes for bugs and improvements |
| Architect | Visión | Creates structured project plans with phases and dependencies |

---

## MCP Server

Run ULTRON as an MCP server for integration with OpenCode and Claude Desktop:

```bash
ultron --mcp
```

Available tools:
- `graph_search`, `graph_related`, `graph_compact`, `graph_build`, `graph_overview`
- `graph_callers`, `graph_dependencies`, `graph_path`, `graph_concepts`, `graph_stats`
- `graph_file_summary`, `graph_read_range`
- `delegate_editor`, `delegate_basher`, `delegate_librarian`
- `read_file`, `write_file`, `grep`, `str_replace`
- `direct_execute`, `direct_search`
- `session_list`, `session_switch`, `session_new`, `session_rename`, `session_delete`

---

## Project Structure

```
ultron/
├── src/
│   ├── index.ts              # Entry point
│   ├── agents/               # Multi-agent orchestration
│   │   ├── orchestrator.ts   # Central coordinator
│   │   ├── editor.ts         # File operations agent
│   │   ├── librarian.ts      # Code analysis agent
│   │   ├── basher.ts         # Command execution agent
│   │   ├── researcher.ts     # Web search agent
│   │   ├── thinker.ts        # Task planning agent
│   │   ├── reviewer.ts       # Code review agent
│   │   ├── architect.ts      # Project planning agent
│   │   ├── graph-learner.ts  # Knowledge graph builder
│   │   ├── model-tester.ts   # Model validation
│   │   ├── tools-executor.ts # Tool dispatch with retry
│   │   ├── commands.ts       # Slash command handlers
│   │   ├── prompts.ts        # System prompt builder
│   │   ├── base.ts           # Base agent class
│   │   └── types.ts          # Type definitions
│   ├── cli/                  # Terminal interface
│   │   ├── app.ts            # CLI main loop
│   │   ├── display.ts        # Spinner, formatting, output
│   │   └── theme.ts          # Color themes
│   ├── llm/                  # LLM integration
│   │   ├── chat.ts           # Chat completion
│   │   ├── providers.ts      # Provider configuration
│   │   ├── health.ts         # Model health checks
│   │   ├── discovery.ts      # Model discovery
│   │   ├── types.ts          # Type definitions
│   │   ├── compression/      # Token compression
│   │   └── router/           # Smart Router
│   ├── memory/               # Memory systems
│   │   ├── vault.ts          # Obsidian-style vault
│   │   ├── session.ts        # Session events
│   │   ├── session-manager.ts # Multi-session management
│   │   ├── privacy.ts        # PII filtering
│   │   └── types.ts          # Type definitions
│   ├── server/               # Web server
│   │   ├── index.ts          # HTTP server + API routes
│   │   ├── proxy.ts          # OpenAI/Anthropic proxy
│   │   ├── rate-limiter.ts   # Per-endpoint rate limiting
│   │   ├── security.ts       # Headers and auth
│   │   └── public/           # Web UI (index.html)
│   ├── shared/               # Shared utilities
│   │   ├── config.ts         # Config persistence
│   │   ├── ultron-config.ts  # ultron.json loader
│   │   ├── logger.ts         # File-based logging
│   │   ├── types.ts          # Shared types
│   │   ├── utils.ts          # Utility functions
│   │   └── validate.ts       # Schema validation
│   ├── tools/                # Tool implementations
│   │   ├── file.ts           # File system
│   │   ├── file-ops.ts       # Desktop file operations
│   │   ├── execute.ts        # Command execution
│   │   ├── search.ts         # File search
│   │   ├── web.ts            # Web search
│   │   ├── git.ts            # Git operations
│   │   ├── git-workflow.ts   # Git automation
│   │   ├── document.ts       # Document parsing
│   │   ├── automation.ts     # Mouse/keyboard/screen
│   │   ├── auto-pilot.ts     # Multi-step automation
│   │   ├── voice.ts          # Text-to-speech
│   │   └── sandbox.ts        # Command sandboxing
│   ├── graph-memory/         # code-graph-memory bridge
│   ├── mcp/                  # MCP protocol server
│   ├── skills/               # Skills loading system
│   └── watcher/              # File system watcher
├── electron/                 # Electron desktop app
├── dist/                     # Compiled output
├── .opencode/                # Skills and agent configs
├── vault/                    # Persistent memory
├── ultron.json               # Project configuration
├── package.json
└── tsconfig.json
```

---

## Development

### Commands

```bash
bun run typecheck     # TypeScript type checking
bun run test          # Run test suite
bun run build         # Build JS bundle (dist/index.js)
bun run compile       # Compile standalone .exe (dist/ultron.exe)
bun run lint          # ESLint
bun run format        # Prettier formatting
```

### Adding an agent

1. Create `src/agents/<agent>.ts` extending `BaseAgent`
2. Register tools in `registerTools()`
3. Add to `Orchestrator` constructor and tool dispatch
4. Add display name and color in `display.ts` and web UI

### Adding a tool

1. Add implementation in `src/tools/<tool>.ts`
2. Add handler in `tools-executor.ts`
3. Add tool definition in `Orchestrator.getTools()`
4. Optionally register in MCP server

---

## License

MIT License. See [LICENSE](LICENSE).

---

<div align="center">

**ULTRON v5** — [NRedondo26](https://github.com/nredondo26)

</div>
