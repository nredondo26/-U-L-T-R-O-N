<div align="center">

# ULTRON v5
### Neural Intelligence Platform — Multi-Agent Autonomous AI

[![Version](https://img.shields.io/badge/version-5.1.0-blueviolet?style=for-the-badge)](package.json)
[![Runtime](https://img.shields.io/badge/runtime-Bun-ff69b4?style=for-the-badge&logo=bun)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript)](tsconfig.json)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

> Asistente autónomo multi-agente con memoria persistente, grafo de conocimiento y control total del sistema.

---

[Features](#features) • [Architecture](#architecture) • [Quick Start](#quick-start) • [Usage](#usage) • [Desktop App](#desktop-app) • [Configuration](#configuration)

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| Multi-Agent Orchestration | 8 agents in Spanish: Cerebro, Visión, Artífice, Sabio, Ejecutor, Explorador, Estratega & Juez |
| Persistent Memory (Vault) | Obsidian-style markdown vault with cross-session memory |
| Graph Knowledge | AST-based code indexing with dependency graph, callers, and path finding |
| Multiple Sessions | Create, switch, rename sessions — each with independent context |
| Smart Router | Free-first model selection with circuit breaker, cost tracking, fallback |
| MCP Server | Model Context Protocol server for OpenCode/Claude integration |
| Skills System | Specialized instruction sets loaded from `.opencode/skills/` |
| File Watcher | Real-time file change detection with auto-indexing |
| System Automation | Mouse, keyboard, screen capture, app launching |
| Web Search | Built-in search with DuckDuckGo |
| Document Analysis | PDF, DOCX, XLSX, images, audio, video — 20+ formats |
| Git Operations | Auto-commit, push, diff, log |
| Token Tracking | Real-time usage statistics per session |
| Claude Code Theme | Orange/amber terminal with animated spinner |
| Compiled Binary | Standalone `ultron.exe` via Bun compiler |
| Electron Desktop | Native Windows app with tray icon and installer |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Cerebro (Orchestrator)                     │
│          Central coordinator — routes tasks, manages state    │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Artífice  Sabio  Ejecutor  Explorador  Estratega  Juez  Visión │
│  (Editor) (Librarian) (Basher) (Researcher) (Thinker) (Reviewer) (Architect)│
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                      Memory Layer                             │
│  Vault (MD) │ Sessions │ Config Store │ Graph Memory          │
├──────────────────────────────────────────────────────────────┤
│                      Smart Router Layer                       │
│  Circuit Breaker │ Cost Tracker │ Scoring Engine              │
├──────────────────────────────────────────────────────────────┤
│                      Tool Layer                               │
│  File Ops │ Automation │ Search │ Web │ Git │ Voice │ MCP    │
└──────────────────────────────────────────────────────────────┘
```

### How It Works

1. **User sends a message** → Cerebro (Orchestrator) receives it
2. **Smart Router** picks the best model (free-first, with fallback)
3. **Cerebro analyzes** → Decides which agent(s) to delegate
4. **Agent executes** → Uses specialized tools (file ops, terminal, web search, etc.)
5. **Results flow back** → Cerebro synthesizes response
6. **Memory updates** → Vault saves context, session tracks events

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.0
- Windows 10+
- At least one API key in `.env`

### Install & Run

```bash
git clone https://github.com/nredondo26/-U-L-T-R-O-N.git
cd ultron
bun install
cp .env.example .env
# Edit .env with your API keys
bun run dev          # Interactive CLI
```

### Compiled Binary

```bash
bun run compile
# Output: dist/ultron.exe — standalone binary
```

---

## Usage

```bash
bun run dev          # Interactive CLI (development)
bun run build        # Build JS bundle
.\dist\ultron.exe    # Run compiled binary
.\dist\ultron.exe --serve   # Web dashboard
.\dist\ultron.exe --mcp     # MCP server for OpenCode
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `-p, --project <dir>` | Project directory (default: current) |
| `-v, --vault <dir>` | Vault directory (default: ./vault) |
| `-e, --env <file>` | .env file path |
| `--serve` / `--web` | Start web dashboard on port 3456 |
| `--mcp` | Start MCP stdio server |
| `--port <n>` | Web server port (default: 3456) |
| `--bind <addr>` | Listen address (default: 127.0.0.1) |
| `--api-key <key>` | API key for web auth |
| `-h, --help` | Show help |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/new` | New conversation |
| `/model <id>` | Switch AI model |
| `/models` | List available models |
| `/session-new` | New session |
| `/sessions` | List all sessions |
| `/session-switch <id>` | Switch session |
| `/stats` / `/tokens` | Token usage statistics |
| `/vault` | Browse memory vault |
| `/graph` | Knowledge graph overview |
| `/index` | Index project in graph |
| `/cd <dir>` | Change working directory |
| `/commit [msg]` | Auto-commit git changes |
| `/push [msg]` | Auto-commit and push |
| `/diff` | Git diff |
| `/sandbox <mode>` | Sandbox mode (ask/allow/deny) |
| `/exit` | Exit |

### Slash Examples

```
/model qwen-plus          # Switch model
/session-new              # Create new session
/sessions                 # List all sessions
/session-switch sess_123  # Switch to session
/analyze file.pdf         # Analyze document
/config                   # View configuration
/skills                   # List available skills
```

---

## Desktop App

The Electron desktop app wraps ULTRON in a native Windows window with tray icon.

### Run from build

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

### Features

- Starts `ultron.exe` as background server
- Splash screen while server loads
- System tray with minimize-to-tray
- Auto-cleanup on quit

---

## Configuration

All settings in `ultron.json` at project root:

```json
{
  "agents": { "maxSteps": 25, "verbose": true },
  "models": { "defaultModel": "deepseek-chat", "freeFirst": true },
  "memory": { "graphMemory": true, "autoSummarize": true },
  "mcp": { "enabled": true, "serverMode": "stdio" },
  "skills": { "enabled": true, "dirs": [".opencode/skills"] },
  "watcher": { "enabled": false, "watchDirs": ["src"] },
  "ui": { "theme": "claude", "language": "es" }
}
```

### Multiple Sessions

Each session has its own conversation history and context:
- `session_new` — Create new session
- `session_list` — List all sessions
- `session_switch` — Switch to another session
- `session_rename` — Rename a session
- `session_delete` — Delete a session

### Available Themes

| Theme | Description |
|-------|-------------|
| `claude` | Orange/amber — Claude Code inspired |
| `ultron` | Cyan/teal — Default |
| `sky` | Blue |
| `cyber` | Teal/green |
| `midnight` | Purple |
| `matrix` | Green-on-black |

---

## Agents

| Agent | Role | Description |
|-------|------|-------------|
| Cerebro | Orchestrator | Central coordinator — routes tasks, manages state |
| Visión | Architect | Plan large projects with phases and steps |
| Artífice | Editor | Read, write, modify, create files |
| Sabio | Librarian | Analyze codebase, understand architecture |
| Ejecutor | Basher | Execute terminal commands, git, npm |
| Explorador | Researcher | Search the web, research APIs |
| Estratega | Thinker | Plan complex tasks, strategize |
| Juez | Reviewer | Review code changes, find bugs |

---

## MCP Server

ULTRON can run as an MCP server for integration with OpenCode and Claude Desktop:

```bash
ultron --mcp
```

Available tools: `graph_search`, `graph_related`, `graph_compact`, `graph_build`, `graph_overview`, `graph_callers`, `graph_dependencies`, `graph_path`, `graph_concepts`, `graph_stats`, `graph_file_summary`, `graph_read_range`, `delegate_editor`, `delegate_basher`, `read_file`, `write_file`, `grep`, `str_replace`, `direct_execute`, `direct_search`, `session_list`, `session_switch`, `session_new`, `session_rename`, `session_delete`.

---

## Project Structure

```
ultron/
├── src/
│   ├── index.ts              # Entry point
│   ├── agents/               # Multi-agent system (8 agents)
│   ├── cli/                  # Terminal interface with themes
│   ├── llm/                  # LLM providers, router, health
│   ├── memory/               # Vault, sessions, privacy
│   ├── server/               # Web dashboard + API
│   ├── shared/               # Config, logger, types
│   ├── tools/                # File, execute, git, web, voice, automation
│   ├── graph-memory/         # code-graph-memory bridge (AST analysis)
│   ├── mcp/                  # MCP server (stdio transport)
│   ├── skills/               # Skills loading system
│   └── watcher/              # File system watcher
├── electron/                 # Electron desktop app
├── dist/                     # Compiled output
├── .opencode/                # Skills and agent configs
├── ultron.json               # Project configuration
├── vault/                    # Persistent memory
├── package.json
└── tsconfig.json
```

---

## License

MIT License.

---

<div align="center">

**ULTRON v5** — Built by [NRedondo26](https://github.com/nredondo26)

</div>
