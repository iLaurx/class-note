# CN-013 — Matriz Windows y recuperación

Ejecución del 20/10/2026 sobre `main`, inicialmente limpio. Windows x64, build
26300, ClassNote 0.1.0 / Dexie v1. Solo datos sintéticos y perfiles creados dentro
de `test-results/native/`. No se modificaron red, firewall, perfiles personales,
schema, dependencias, permisos ni configuración global. Sin commit ni push.

**CN-013 permanece pendiente:** los casos aprobados abajo no acreditan los casos
de instalación, actualización, desinstalación o reinicio de Windows. CN-002 sigue
pendiente y fuera de alcance. Esta es la evidencia vigente; las cifras de los
documentos de módulos anteriores describen sus ejecuciones históricas.

## Matriz ejecutada

Las rutas de evidencia de esta tabla son relativas a `test-results/`, fuera de Git.

| Caso                                                        | Estado                            | Evidencia y alcance real                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empaquetado Windows                                         | Aprobado                          | `pnpm tauri:build`: release x64 y NSIS de 2.356.497 bytes. Generación, sin instalación.                                                                                                                                                                                                                                                                           |
| Instalación limpia                                          | Pendiente                         | Windows Sandbox no está disponible (`WindowsSandbox.exe` ausente). No hay VM/equipo de prueba aislado disponible; no se ejecutó NSIS sobre la instalación del usuario.                                                                                                                                                                                            |
| Primer inicio sin internet                                  | Pendiente                         | Perfil nuevo con diez stores vacías aprobado en `native/result.json`; el aislamiento CDP se aplica después de cargar UI. No prueba primer inicio/instalación offline ni disponibilidad inicial de WebView2.                                                                                                                                                       |
| Uso con 35 alumnos                                          | Aprobado                          | `native/hardening-result.json`, `workload-35-*.png`: 22 días laborables de septiembre (770 asistencias), diez tareas (350 entregas), alumnos, búsqueda, consulta y correcciones confirmadas de asistencia/entrega desde UI.                                                                                                                                       |
| Uso con 100 alumnos                                         | Aprobado                          | Mismo caso con 2.200 asistencias y 1.000 entregas; `workload-100-*.png`. Sin fallos observados en esta muestra.                                                                                                                                                                                                                                                   |
| Cierre completo/reapertura                                  | Aprobado                          | `native/result.json`, `hardening-before.json`, `hardening-after.json`: procesos distintos, cierre del ejecutable y todos los WebView2 de su perfil, igualdad exacta de diez stores antes de consultar/seleccionar otra vez.                                                                                                                                       |
| Reinicio de Windows                                         | Pendiente                         | No se reinició el equipo compartido de trabajo. Requiere equipo/VM de prueba y comparación posterior con la misma instantánea.                                                                                                                                                                                                                                    |
| Actualización con datos previos                             | Pendiente                         | No hay dos releases instalables de versiones distintas disponibles y un equipo aislado para instalarlas. Reabrir el mismo 0.1.0 no cuenta como actualización. Sin escrituras de actualización ni comparación atribuida a ese caso.                                                                                                                                |
| Migración histórica poblada                                 | Pendiente (no aplica a v1 actual) | `src/db/database.ts` solo declara `version(1)`; no existe una versión de schema anterior real. No se inventó v0/v2. Cuando exista, conservar origen/perfil e igualar diez stores/UUID/relaciones/auditoría antes/después.                                                                                                                                         |
| Excel: cuatro hojas, datos y caracteres peligrosos          | Aprobado                          | 3 tests DB Excel y `native/hardening-result.json`: conteos, fechas/rango, estados y cadenas `=`, `+`, `-`, `@`, sin objetos fórmula; XLSX de 35/100 generados en WebView2 y reabiertos con ExcelJS.                                                                                                                                                               |
| Apertura compatible de Excel                                | Aprobado                          | `native/excel-compatible-result.json`: Microsoft Excel 16.0 abre normalmente, sin reparación, solo lectura y macros deshabilitadas, tres libros; cuatro hojas y ninguna fórmula.                                                                                                                                                                                  |
| Guardar/cancelar Excel nativo                               | Aprobado                          | `native/excel-result.json`, `reports-*.png`, `dialog-persistence-result.json`: diálogo real, archivo guardado, cancelación sin éxito ni cambios en diez tablas.                                                                                                                                                                                                   |
| Respaldo válido y reemplazo con pre-backup                  | Aprobado                          | `native/backup-result.json` y `backup-*.png`: diálogos reales, respaldo previo físico validado contra diez stores anteriores, reemplazo y tercera apertura con igualdad exacta/relaciones por UI.                                                                                                                                                                 |
| Restaurar en perfil nuevo vacío                             | Aprobado                          | `native/clean-restore-result.json`, `clean-before.json`, `clean-after-restore.json`, `clean-after-restart.json`: diez stores inicialmente vacías, importación por servicio real en WebView2, pre-backup vacío validado, cierre/reapertura y consulta UI de ambos grupos. No equivale a instalación limpia.                                                        |
| Corrupción/truncado/incompatibilidad                        | Aprobado en validación            | 5 tests DB backup, 5 UI backup y `native/hardening-result.json`: fuente truncada rechazada antes del guardado previo, diez stores intactas. Corrupción por servicio nativo; IPC de archivo corrupto simulado en suite UI, sin abrir un archivo corrupto mediante diálogo Windows en esta ejecución.                                                               |
| Cancelar confirmación/pre-backup                            | Aprobado                          | Suite UI y servicio nativo: no llama guardado si falta confirmación, cancelar destino aborta, diez stores idénticas. Diálogo real de cancelación de Excel comprobado aparte.                                                                                                                                                                                      |
| Fallo intermedio/rollback/reintento                         | Aprobado                          | `native/hardening-result.json`: excepción real en hook de escritura de entregas durante reemplazo; revierte diez tablas. Hook `QuotaExceededError` en escritura de asistencia y error simulado de guardado previo conservan datos; reintento inserta exactamente una asistencia; restauración posterior recupera instantánea anterior. No se llenó el disco real. |
| Cancelaciones destructivas, conflictos y borradores         | Aprobado                          | 63 DB y 64 UI: archivo, baja, correcciones y borrado de nota cancelados; concurrencia, rollback y lectura posterior al commit sin duplicar. Flujos nativos anteriores conservados.                                                                                                                                                                                |
| Aislamiento de ciclo/grupo                                  | Aprobado                          | Suites DB/UI y selección/consulta nativa de grupos distintos antes/después de reabrir/restaurar.                                                                                                                                                                                                                                                                  |
| Teclado y 1100/768/360 px                                   | Aprobado                          | Suite UI, capturas de módulos, foco/labels/salto al contenido/sin desbordamiento. Inspección visual de backup 360, formulario notas 360, lectura 768, reporte 1100 y vistas nativas de carga/restauración. Contraste legible en capturas; sin auditoría colorimétrica exhaustiva.                                                                                 |
| Lector de pantalla                                          | Pendiente                         | Se comprobó árbol accesible de diálogos Windows, pero no se evaluó salida hablada de Narrador/NVDA. Requiere sesión accesible con escucha y revisión manual.                                                                                                                                                                                                      |
| Desinstalación/preservación                                 | Pendiente                         | Sin entorno Windows desechable aislado; no se ejecutó desinstalador ni se tocaron perfiles personales. No se afirma que los datos sobrevivan: exportar y proteger un respaldo fuera del perfil antes de desinstalar.                                                                                                                                              |
| Ausencia de solicitudes externas de la app                  | Aprobado en flujos observados     | 2 tests de distribución, UI y `externalRequests: []`/`externalPageRequests: []` en resultados nativos. Contextos offline después de carga local; CSP del producto sin cambios.                                                                                                                                                                                    |
| Tráfico global del sistema / corte eléctrico / disco dañado | Pendiente                         | CDP no aísla Windows ni observa todo su tráfico. No se cambiaron red/firewall ni se provocó corte/daño físico. Atomicidad transaccional no prueba esos escenarios.                                                                                                                                                                                                |

La carga grande se genera mediante repositorios reales en IndexedDB de WebView2,
exclusivamente desde la sonda de pruebas. La UI consulta todos los alumnos/estados y
guarda una corrección de asistencia y otra de entrega por grupo. No representa una
docente capturando manualmente 135 alumnos, ni mide la meta de usabilidad de dos
minutos. El fixture nunca se incorpora al producto distribuido.

## Fallos encontrados y corrección

Se reprodujeron aisladamente los dos fallos históricos en
`tests/ui/reading.spec.ts` y `tests/ui/notes.spec.ts`: faltaba el aviso esperado de
consulta inicial. Al navegar a Inicio, su resumen consulta `groups` de manera
asíncrona. Las pruebas activaban el fallo de un solo uso sobre `groups.get` antes
de terminar esa consulta; Inicio lo consumía antes de montar Lecturas/Observaciones.
La corrección espera el resumen resuelto antes de armar el fallo. Se conservaron
las aserciones de aviso, reintento, conflicto, borrador y datos remotos; no se cambió
código de aplicación. Resultado: 6/6 en tres repeticiones y 64/64 en suite global.

Incidencias del entorno: primer preview restringido sin progreso, cancelado y
repetido con autorización para localhost/navegadores. Primer empaquetado generó
release pero no descargó NSIS por DNS 11001; reintento autorizado aprobado. CIM de
información del sistema restringido; versión de Windows obtenida por lectura del
registro. Errores temporales de tipos/lint de los nuevos helpers se corrigieron
antes de su ejecución final. Advertencias de color del runner y fragmento ExcelJS
mayor de 500 kB, sin errores de producto demostrados.

## Resultados y evidencia

- `pnpm test`: **63/63 DB + 2/2 distribución + 64/64 UI**, aprobado.
- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` y
  `pnpm tauri:build`: aprobados en ejecución final.
- Primera ejecución nativa con `CN011_EXPORT_UI=1`, `CN012_BACKUP_UI=1` y
  `CN013_HARDENING=1`: aprobada. Perfil `webview2-kyEVll`; respaldo con procesos
  33536 → 6088 → 5116. Evidencia preservada en `dialog-persistence-result.json`,
  `backup-result.json`, `excel-result.json`, `initial-hardening-result.json`.
- Ejecución final `CN013_HARDENING=1 pnpm test:native`: aprobada. Perfil nuevo
  `webview2-lVk97n`, procesos base 9424 → 29168 y carga 27576 → 33724. Restauración
  limpia en `webview2-clean-AWOS4p`, procesos 8144 → 4128. Diez stores exactamente
  iguales, UUID/auditoría/relaciones conservados; todas las verificaciones de
  recuperación de `hardening-result.json` son verdaderas.
- Instantánea final: ciclos 5, grupos 7, alumnos 140, matrículas 141, asistencias
  2.976, tareas 23, entregas 1.355, lecturas 7, notas 5 y ajustes 4. Incluye las
  regresiones anteriores además de las dos cargas de CN-013.
- Muestra de carga nativa antes de reabrir: contexto/listado 83 ms (35) y 149 ms
  (100); flujo con consultas y guardados 703 ms y 1.178 ms. Tras reabrir, consulta
  759 ms y 741 ms. Mediciones únicas con automatización y capturas incluidas;
  no son percentiles ni una garantía para otros equipos.
- `tests/native/check-excel.ps1`: aprobado, Excel 16.0. Filas incluyendo cabecera:
  carga 35 = 36/771/351/2; carga 100 = 101/2201/1001/2. El libro del diálogo real
  tiene 5/6/9/5 filas. No se guardaron modificaciones desde Excel.

## Repetición y pendientes

Ejecutar las suites UI antes de las nativas: Playwright limpia `test-results/`.
Comandos PowerShell, con Node/pnpm/Rust y WebView2 ya disponibles:

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm tauri:build
$env:CN013_HARDENING='1'
pnpm test:native
powershell.exe -NoProfile -File tests/native/check-excel.ps1
```

Para repetir también los diálogos reales, añadir `CN011_EXPORT_UI=1` y
`CN012_BACKUP_UI=1` al entorno del proceso antes de `test:native`, elegir únicamente
las rutas sintéticas que imprime y cancelar el segundo diálogo Excel. El chequeo
de Excel requiere Microsoft Excel y los tres archivos; sin el checkpoint CN-011
se puede conservar el libro sintético de una ejecución previa, dejando registrada
su procedencia como en esta ejecución. Los callbacks de archivo en la sonda de
recuperación/carga y perfil vacío se simulan; los diálogos y el pre-backup físico
se verifican por separado en el checkpoint CN-012.

Antes de cerrar CN-013 se necesita Windows desechable/equipo de prueba: instalar con
prerrequisitos sin red, guardar datos, reiniciar Windows, actualizar entre releases
reales conservando perfil y comparar las diez stores completas. Probar desinstalar
solo allí, registrando si conserva datos; restaurar el backup externo después.
Ejecutar revisión hablada de lector de pantalla y los escenarios físicos que se
pretenda garantizar. No borrar perfiles para simular una actualización o migración.

Commit sugerido: `test: verify offline persistence and recovery`.
