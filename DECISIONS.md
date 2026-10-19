# Registro de decisiones arquitectónicas

## ADR-001 — Aplicación de escritorio con Tauri 2
**Estado:** aceptada para MVP. **Motivo:** instalador Windows y capacidad offline sin servidor. **Trade-off:** toolchain de Rust/Tauri y dependencia de WebView2; necesita QA real en Windows.

## ADR-002 — Dexie.js / IndexedDB en lugar de SQLite
**Estado:** aceptada para MVP. **Motivo:** desarrollo con TypeScript y hooks reactivos. **Trade-off:** persistencia dentro del perfil WebView2 y manejo de esquema/migraciones; plan de backups obligatorio.

## ADR-003 — ExcelJS para reportes XLSX
**Estado:** aceptada. **Motivo:** libros con varias hojas editables. **Trade-off:** capa de export independiente, consumo de memoria y sanitización de fórmulas. **Dexie no genera Excel por sí mismo.**

## ADR-004 — Sin nube ni cuentas
**Estado:** aceptada. **Motivo:** privacidad, simplicidad y escuelas con internet deficiente. **Trade-off:** no sincronización, no recuperación remota y copias bajo responsabilidad del docente.

## ADR-005 — Historias por matrícula
**Estado:** aceptada. **Motivo:** alumno único con distintas inscripciones/grados, sin perder historial.

## Decisiones pendientes
- Nombre y ubicación final del perfil persistente WebView2 (pruebas por instalador/actualización).
- Mecanismo robusto de backup/restauración atómica y estrategia ante interrupciones.
- Licencia MIT vs otra, antes de publicar.
- Políticas exactas de métricas de asistencia y faltas justificadas.
- Experiencia de desinstalación y preservación de datos.
