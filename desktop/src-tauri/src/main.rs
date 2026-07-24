#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

fn find_ultron() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;

    let candidates = vec![
        exe_dir.join("ultron-server.exe"),
        exe_dir.join("ultron.exe"),
        exe_dir.join("..").join("..").join("dist").join("ultron.exe"),
    ];

    for c in candidates {
        if c.exists() {
            return Some(c.to_string_lossy().to_string());
        }
    }
    None
}

fn start_server() -> Option<Child> {
    let server_path = find_ultron()?;
    let child = Command::new(&server_path)
        .args(["--web", "--port", "3456"])
        .spawn()
        .ok()?;
    println!("ULTRON server started (PID: {})", child.id());
    Some(child)
}

fn main() {
    // Start the ULTRON backend server
    let server = start_server();
    if server.is_none() {
        eprintln!("[ULTRON] Could not find ultron-server.exe next to the app.");
        eprintln!("[ULTRON] Make sure ultron.exe is in the same folder.");
    }

    // Wait for server to be ready
    std::thread::sleep(std::time::Duration::from_secs(3));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerProcess(Mutex::new(server)))
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Load the ULTRON web dashboard
            let _ = window.eval("window.location.href = 'http://127.0.0.1:3456'");

            // Handle close -> hide to tray
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
                // Kill server when app exits
                let state = window.state::<ServerProcess>();
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                        println!("ULTRON server stopped.");
                    }
                }
                std::process::exit(0);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running ULTRON Desktop");
}
