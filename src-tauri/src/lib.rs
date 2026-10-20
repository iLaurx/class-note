use tauri_plugin_dialog::DialogExt;

// Initialize only the Rust dialog state. The upstream JS initializer replaces
// synchronous window.confirm with a Promise, breaking existing confirmations.
// Do not forward that script or expose any of the plugin's IPC commands.
struct NativeFileDialogs(tauri::plugin::TauriPlugin<tauri::Wry>);

impl tauri::plugin::Plugin<tauri::Wry> for NativeFileDialogs {
    fn name(&self) -> &'static str {
        "dialog"
    }

    fn initialize(
        &mut self,
        app: &tauri::AppHandle,
        config: serde_json::Value,
    ) -> Result<(), Box<dyn std::error::Error>> {
        tauri::plugin::Plugin::initialize(&mut self.0, app, config)
    }
}

// The webview supplies bytes only. The destination never comes from JavaScript.
#[tauri::command]
async fn save_group_report(app: tauri::AppHandle, bytes: Vec<u8>) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file()
            .set_title("Guardar reporte del grupo")
            .set_file_name("Reporte-ClassNote.xlsx")
            .add_filter("Libro Excel", &["xlsx"])
            .blocking_save_file();
        let Some(selected) = selected else { return Ok(false); };
        let path = selected.into_path().map_err(|_| "El destino no es un archivo local.".to_string())?;
        if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("xlsx")) != Some(true) {
            return Err("Elige un nombre con extensión .xlsx y vuelve a exportar.".to_string());
        }
        std::fs::write(path, bytes).map_err(|_| "No se pudo guardar el reporte en el destino elegido. Revisa los permisos o el espacio disponible y reintenta.".to_string())?;
        Ok(true)
    }).await.map_err(|_| "No se pudo completar la exportación.".to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(NativeFileDialogs(tauri_plugin_dialog::init()))
        .invoke_handler(tauri::generate_handler![save_group_report, save_backup, open_backup])
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar ClassNote");
}

#[tauri::command]
async fn open_backup(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let selected = app.dialog().file()
            .set_title("Elegir respaldo de ClassNote")
            .add_filter("Respaldo ClassNote", &["json"])
            .blocking_pick_file();
        let Some(selected) = selected else { return Ok(None); };
        let path = selected.into_path().map_err(|_| "Elige un archivo local.".to_string())?;
        // Bound memory consumption before reading an untrusted file.
        let file = std::fs::File::open(path).map_err(|_| "No se pudo abrir el respaldo.".to_string())?;
        use std::io::Read;
        let mut source = String::new();
        file.take(100 * 1024 * 1024 + 1).read_to_string(&mut source)
            .map_err(|_| "No se pudo leer el respaldo JSON.".to_string())?;
        if source.len() > 100 * 1024 * 1024 { return Err("El respaldo supera 100 MiB.".to_string()); }
        Ok(Some(source))
    }).await.map_err(|_| "No se pudo abrir el respaldo.".to_string())?
}

#[tauri::command]
async fn save_backup(app: tauri::AppHandle, source: String, previous: bool) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        let selected = app.dialog().file()
            .set_title(if previous { "Guardar respaldo previo obligatorio" } else { "Guardar respaldo completo" })
            .set_file_name(if previous { "ClassNote-respaldo-previo.json" } else { "ClassNote-respaldo.json" })
            .add_filter("Respaldo ClassNote", &["json"])
            .blocking_save_file();
        let Some(selected) = selected else { return Ok(false); };
        let path = selected.into_path().map_err(|_| "Elige un destino local.".to_string())?;
        if path.extension().and_then(|ext| ext.to_str()).map(|ext| ext.eq_ignore_ascii_case("json")) != Some(true) {
            return Err("Elige un nombre con extensión .json.".to_string());
        }
        if source.len() > 100 * 1024 * 1024 { return Err("El respaldo supera 100 MiB.".to_string()); }
        let nonce = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| "No se pudo preparar el guardado.".to_string())?.as_nanos();
        let temporary = path.with_file_name(format!(".classnote-{}-{}.tmp", std::process::id(), nonce));
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temporary)
            .map_err(|_| "No se pudo preparar el respaldo en ese destino.".to_string())?;
        let saved = (|| -> std::io::Result<()> {
            file.write_all(source.as_bytes())?;
            file.sync_all()?;
            drop(file);
            std::fs::rename(&temporary, &path)?;
            Ok(())
        })();
        if saved.is_err() {
            let _ = std::fs::remove_file(&temporary);
            return Err("No se pudo guardar el respaldo completo. Revisa permisos y espacio.".to_string());
        }
        Ok(true)
    }).await.map_err(|_| "No se pudo guardar el respaldo.".to_string())?
}
