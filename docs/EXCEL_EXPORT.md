# Exportación Excel — CN-011

## Uso y contrato

En Reportes, seleccionar ciclo/grupo y Desde/Hasta, luego Exportar Excel. Elegir
nombre y ubicación en el diálogo nativo. Cancelar no escribe ni informa éxito;
un error conserva las fechas para reintentar. El XLSX es un **reporte no restaurable**
y contiene información educativa que debe protegerse. No promete cifrado.

- `src/features/reports/` → `Repositories.loadGroupReport` con IDs y rango explícitos
  → `src/services/export/` → `src/lib/tauri/saveReport.ts` → comando Rust.
- Instantánea transaccional de solo lectura: valida ciclo/grupo y días reales
  ordenados; consulta por índices y lotes/bulkGet, sin N+1. No lee observaciones
  privadas ni ajustes, ni escribe o cambia schema Dexie v1.
- **Alumnos contiene todas las matrículas del grupo independientemente del rango**,
  incluidas inactivas/fichas archivadas. Matrícula es el UUID existente, no un folio
  nuevo; estado es el de matrícula. No se deduce una salida de la auditoría/estado.
- Rango inclusivo para asistencia.date, assignments.assignedDate y readingLogs.date.
  La entrega de una tarea puede quedar fuera del rango. Se permiten rangos mayores
  que el ciclo: solo coinciden registros del contexto, sin inventar filas.
- Tareas genera fila por matrícula aplicable en la asignación; sin Submission muestra
  Pendiente, sin escritura ni vencimiento automático. Conserva entregas históricas
  del mismo grupo incluso fuera de la población actual tras corregir intervalos.
  Una tarea sin destinatarios muestra Sin matrículas aplicables, sin inventar estado.
- Exactamente Alumnos, Asistencia, Tareas y Lecturas. Encabezados en español,
  cabecera fija/filtro, ajuste de texto y anchos de 18–48 caracteres. Opcionales
  vacíos, minutos numéricos incluidos ceros; hoja vacía: Sin registros para este reporte.
- Fechas DD/MM/AAAA como texto civil, sin convertir Date/UTC. Orden ascendente:
  alumnos por apellidos/nombres en español y UUID; asistencia/lecturas por fecha,
  alumno y UUID; tareas por asignación, título y UUID, luego alumno.

## Seguridad, permisos y dependencias

Todas las cadenas de celdas pasan por safeCell. Ante `=`, `+`, `-`, `@`, tabulador,
retorno o salto de línea inicial, incluso tras espacios/blancos, antepone apóstrofo.
No crea objetos formula, hipervínculos ni rich text desde entradas de usuario.
ExcelJS normaliza CR a LF al reabrir XML, conservando el prefijo protector. Los
encabezados/pies de impresión no interpolan texto libre.

Producción: ExcelJS 4.4.0, @tauri-apps/api 2.12.4 y tauri-plugin-dialog 2.8.3 en
Cargo (transitivos rfd/tauri-plugin-fs) y serde_json 1 (ya transitiva de Tauri, ahora
declarada para el adaptador nativo). El plugin exige Rust 1.90, reflejado en
Cargo.toml. Ambos locks actualizados. ExcelJS se carga al exportar desde recursos
empaquetados, sin CDN/servicio; Vite advierte fragmento >500 kB (unos 258 kB gzip).

Comando propio local save_group_report recibe solo bytes. Rust abre el diálogo y
escribe únicamente en su resultado local con extensión .xlsx. JS no proporciona
rutas ni obtiene permisos generales fs. Cancelar devuelve false antes de escribir;
solo una escritura completada devuelve true. El diálogo confirma reemplazos y no
preselecciona carpeta pública. Error de escritura no garantiza conservar atómicamente
un archivo previo; no es un respaldo. Sin API JS de dialog/fs ni comodines de rutas.
Capabilities sigue vacía: los comandos propios registrados son accesibles desde la
webview local; no se conceden comandos de plugins a JS. Identifier, origen, perfil
y CSP conservados. Referencia del diálogo Rust: [Tauri](https://v2.tauri.app/plugin/dialog/).

NativeFileDialogs delega exclusivamente la inicialización Rust del plugin mediante
la interfaz Plugin de Tauri: no reenvía su script ni sus comandos IPC. El script del
plugin 2.8.3 reemplaza window.confirm por una Promise; la primera prueba nativa
detectó que eso aceptaba confirmaciones canceladas. El adaptador conserva las
confirmaciones síncronas existentes y la suite nativa completa vuelve a pasarlas.

## Pruebas

- tests/db/excel-export.test.ts abre XLSX con ExcelJS: hojas/encabezados/valores/orden,
  rango inclusivo/días locales, acentos, opcionales/ceros, vacíos, pendientes,
  aislamiento y snapshot sin escrituras. Prefijos peligrosos/espacios en todas las
  columnas libres y tipos de celda sin fórmulas tras reabrir el archivo.
- tests/ui/reports.spec.ts: filtros, teclado, 1100/768/360 px sin desbordamiento,
  exportación offline, cancelación/error de guardado/lectura fallida/reintento/doble
  envío. IPC simulado solo en tests. Chunks servidos desde disco porque setOffline
  también corta localhost; la comprobación real usa el protocolo local Tauri.
- tests/native/persistence.mjs mantiene reinicio real y regresiones. Checkpoint
  adicional: `$env:CN011_EXPORT_UI='1'; pnpm test:native`. Elegir en el diálogo la
  ruta sintética impresa y cancelar el segundo diálogo. La prueba abre el archivo
  con ExcelJS y compara las diez tablas, sin puente de pruebas en el producto.
  Abrir también el archivo sintético en Excel/LibreOffice. Evidencia excluida de Git:
  test-results/native/reporte-sintetico.xlsx, excel-result.json y reports-*.png.
  Ejecutar nativa al final: UI limpia test-results.

## Resultados y límites de 20/10/2026

Lint, format:check, typecheck, build y tauri:build aprobados; release x64 e instalador
NSIS generados. Suite de dominio: 58/58; distribución: 2/2. Edge fue afectado por solicitudes inyectadas local.adguard.org;
la repetición diagnóstica con Chrome (configuración temporal, sin cambiar configuración
permanente) obtuvo 49/59 UI, incluidas las cuatro de CN-011; nueve fallos por inyección
AdGuard y uno por errores de conexión en consola. No se relajan aserciones ni se
modifica red/seguridad del equipo. Los primeros intentos restringidos de dependencias,
preview y descarga NSIS se bloquearon por el entorno; reintentos con permisos.

Prueba nativa final con CN011_EXPORT_UI=1 aprobada: procesos 32124 y 16340, mismo
release/perfil temporal, 39 registros de dominio y snapshot exacto de diez tablas
conservados al reiniciar. Guardado real desde diálogo, XLSX reabierto por ExcelJS
y cancelación nativa posterior sin éxito ni escrituras. Alumnos 4 filas, Asistencia
5, Tareas 8, Lecturas 4 (sin contar cabeceras); captura de fechas 19–20/10/2026.
Se abrió el mismo archivo en Microsoft Excel, solo lectura, sin reparación; se
inspeccionaron visualmente las cuatro hojas, acentos/fechas/estados/comentarios y
minutos cero. También se inspeccionaron capturas de 1100/768/360 px y WebView2.
Evidencias locales: native/result.json, native/excel-result.json, reporte-sintetico.xlsx
y reports-*.png. El reloj de la prueba nativa ahora refresca Inicio con un evento
focus tras fijar su fecha sintética: al reabrir, la vista ya montada conservaba el
día real hasta su siguiente refresco. Sin cambiar el reloj ni fechas del producto.

No acredita instalación inicial offline, tráfico global de Windows, actualización,
desinstalación, lector de pantalla, volúmenes grandes ni backup/restauración.
CN-012/CN-013 permanecen pendientes.
