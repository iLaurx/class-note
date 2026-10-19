pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar ClassNote");
}
