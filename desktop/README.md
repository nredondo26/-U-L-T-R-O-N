# ULTRON Desktop App

Native desktop application built with **Tauri v2** — same framework as OpenCode.

## Architecture

```
desktop/
├── src-tauri/          # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs     # Starts server, creates window, tray icon
│   │   └── lib.rs      # Tauri plugin setup
│   ├── icons/          # App icons
│   ├── Cargo.toml      # Rust dependencies
│   └── tauri.conf.json # Window config, bundle settings
├── dist/               # Frontend (redirect to local server)
│   └── index.html
└── package.json        # Tauri CLI
```

## How It Works

1. Tauri app starts → spawns `ultron.exe` as child process
2. Waits 3s for server to be ready
3. Opens native WebView2 window loading `http://127.0.0.1:3456`
4. Native title bar, window decorations (not a browser!)
5. Close button minimizes to system tray
6. Right-click tray icon → Show/Quit
7. On quit → kills server process

## Prerequisites

### Windows
- [Rust](https://rustup.rs/) — `curl --proto '=https' --tlsv1.2 -sSf https://win.rustup.rs/x86_64 | sh`
- [Microsoft Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) — Select "Desktop development with C++"
- WebView2 (pre-installed on Windows 10/11)

### Install Tauri CLI
```bash
cd desktop
bun install
```

## Build

```bash
# 1. Compile the server executable
cd .. && bun run compile

# 2. Build the desktop app
cd desktop && bun run tauri build
```

Output: `desktop/src-tauri/target/release/bundle/msi/ultron-desktop_5.1.0_x64_en-US.msi`

## Development

```bash
# Start ULTRON server first
bun run web

# Then start Tauri in dev mode
cd desktop && bun run tauri dev
```

## Icons

Replace placeholder icons in `desktop/src-tauri/icons/`:
- Generate at: https://tauri.app/start/icons/
- Or use: `cargo tauri icon path/to/icon.png`

## Bundle Output

| Format | Location |
|--------|----------|
| Windows MSI | `src-tauri/target/release/bundle/msi/` |
| Windows NSIS | `src-tauri/target/release/bundle/nsis/` |
| macOS DMG | `src-tauri/target/release/bundle/dmg/` |
| Linux AppImage | `src-tauri/target/release/bundle/appimage/` |
