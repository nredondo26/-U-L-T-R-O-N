#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

fn find_ultron(app_handle: &tauri::AppHandle) -> Option<String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .ok()?;

    let candidates = vec![
        resource_dir.join("ultron.exe"),
        resource_dir.join("ultron-server.exe"),
        resource_dir.join("..").join("ultron.exe"),
        resource_dir.join("..").join("..").join("dist").join("ultron.exe"),
    ];

    for c in &candidates {
        if c.exists() {
            return Some(c.to_string_lossy().to_string());
        }
    }
    None
}

fn start_server(path: &str) -> Option<Child> {
    let mut cmd = Command::new(path);
    cmd.args(["--serve", "--port", "3456", "--bind", "127.0.0.1"]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().ok()?;
    Some(child)
}

fn wait_for_server() -> bool {
    use std::net::TcpStream;
    use std::time::Duration;
    for _ in 0..30 {
        std::thread::sleep(Duration::from_millis(500));
        if TcpStream::connect_timeout(
            &"127.0.0.1:3456".parse().unwrap(),
            Duration::from_secs(1),
        )
        .is_ok()
        {
            return true;
        }
    }
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Start server from resource dir
            if let Some(server_path) = find_ultron(app.handle()) {
                let child = start_server(&server_path);
                if let Some(c) = child {
                    let state = app.state::<ServerProcess>();
                    *state.0.lock().unwrap() = Some(c);
                }
                // Wait for server with loading UI
                if wait_for_server() {
                    let _ = window.eval("window.location.href = 'http://127.0.0.1:3456'");
                } else {
                    let _ = window.eval(
                        "document.body.innerHTML = '<div style=\"display:flex;align-items:center;justify-content:center;height:100vh;color:#c9ccd3;font-family:monospace;font-size:14px\"><div><h2>ULTRON</h2><p>Could not connect to server.</p><p>Make sure ultron.exe is next to this app.</p></div></div>'"
                    );
                }
            } else {
                let _ = window.eval(
                    "document.body.innerHTML = '<div style=\"display:flex;align-items:center;justify-content:center;height:100vh;color:#c9ccd3;font-family:monospace;font-size:14px\"><div><h2>ULTRON</h2><p>Server executable not found.</p><p>Place ultron.exe in the same folder as this app.</p></div></div>'"
                );
            }

            // Minimize to tray on close
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { .. } = event {
                    window_clone.hide().ok();
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<ServerProcess>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                    }
                }
                std::process::exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ULTRON Desktop");
}
