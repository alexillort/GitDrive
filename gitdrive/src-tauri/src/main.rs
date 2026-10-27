#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{io::Write, process::{Command, Stdio}, sync::Mutex};
use tauri::Manager;
struct Engine(Mutex<()>);
#[tauri::command]
async fn request(app: tauri::AppHandle, action: String, args: serde_json::Value) -> Result<serde_json::Value,String> {
 tauri::async_runtime::spawn_blocking(move || {
  let state = app.state::<Engine>();
  let _lock = state.0.lock().map_err(|e|e.to_string())?;
  let script = if cfg!(debug_assertions) { std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../backend/cli.mjs") } else { app.path().resource_dir().map_err(|e|e.to_string())?.join("backend/cli.mjs") };
  let runtime = if cfg!(debug_assertions) { std::path::PathBuf::from("node") } else { app.path().resource_dir().map_err(|e|e.to_string())?.join("runtime/node.exe") };
  let mut command = Command::new(runtime);
  // Keep bundled module paths intact on substituted/virtual Windows drives.
  // Repository file access still goes through the engine's canonical-path checks.
  command.args(["--preserve-symlinks", "--preserve-symlinks-main"]).arg(script).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
  #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
  let mut child = command.spawn().map_err(|e|format!("No se pudo iniciar Node.js. Instala Node.js 22 o posterior y reinicia GitDrive. {e}"))?;
  let payload = serde_json::json!({"action":action,"args":args});
  child.stdin.take().ok_or("No se pudo abrir el motor")?.write_all(payload.to_string().as_bytes()).map_err(|e|e.to_string())?;
  let output = child.wait_with_output().map_err(|e|e.to_string())?;
  if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).into_owned()); }
  let value: serde_json::Value = serde_json::from_slice(&output.stdout).map_err(|e|e.to_string())?;
  if let Some(error)=value.get("error") { return Err(error.as_str().unwrap_or("Error del motor").to_owned()); }
  Ok(value["data"].clone())
 }).await.map_err(|e|e.to_string())?
}
fn main() {
 tauri::Builder::default().plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_notification::init()).manage(Engine(Mutex::new(()))).invoke_handler(tauri::generate_handler![request]).run(tauri::generate_context!()).expect("No se pudo iniciar GitDrive");
}
