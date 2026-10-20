# CN-013 — Matriz Windows y recuperación

Ejecución del 20/10/2026 sobre `main`, inicialmente limpio. Windows x64, build
26300, ClassNote 0.1.0 / Dexie v1. Solo datos sintéticos y perfiles creados dentro
de `test-results/native/`. No se modificaron red, firewall, perfiles personales,
schema, dependencias, permisos ni configuración global. Sin commit ni push.

**CN-013 permanece pendiente:** los casos aprobados abajo no acreditan los casos
de instalación, actualización, desinstalación o reinicio de Windows. CN-002 sigue
pendiente y fuera de alcance. Esta es la evidencia vigente; las cifras de los
documentos de módulos anteriores describen sus ejecuciones históricas.

## Seguimiento de pendientes — 20/10/2026

Esta continuación no repite las pruebas aprobadas. Solo se inspeccionaron las
herramientas disponibles, el instalador existente, su script generado y el schema.
No hubo cambios de aplicación ni nuevas instalaciones, reinicios, desinstalaciones
o ejecuciones del lector de pantalla. CN-013 sigue abierta.

Instalador disponible: `ClassNote_0.1.0_x64-setup.exe`, versión de archivo/producto
**0.1.0**, 2.356.497 bytes. No se encontró otro instalador de versión distinta en
los artefactos locales ni tags locales de releases. Su generación previa no se
usa como prueba de instalación, actualización o primer inicio offline.

El inventario por ruta encontró VirtualBox **7.2.18r175117**, aunque no está en
PATH. `list vms` inicialmente falló con E_ACCESSDENIED en el entorno restringido;
la consulta autorizada mostró una sola VM Linux, tipo Ubuntu 22.10 de 64 bits,
en estado guardado, y ninguna VM en ejecución. No se inició ni modificó esa VM.
Windows Sandbox no está disponible. No hay un equipo Windows desechable accesible
identificado para los pendientes. WSL no sustituye un invitado Windows.

Narrador existe en el host, versión **10.0.26100.8972**. No se encontró NVDA en
las rutas estándar de Program Files ni un proceso Narrador/NVDA en ejecución.
No se afirma que Narrador falte: falta una sesión Windows de prueba desechable
con verificación de su salida hablada. Leer un árbol UIA no satisface ese caso.

| Pendiente                                  | Instalador / versión                                  | Resultado de esta continuación                                                     | Procedimiento restante                                                |
| ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Instalación limpia y primer inicio offline | 0.1.0 x64, 2.356.497 bytes                            | Pendiente: sin Windows desechable; instalador no ejecutado                         | P1                                                                    |
| Reinicio real de Windows                   | 0.1.0 x64                                             | Pendiente: no se reinició el host ni existe invitado Windows accesible             | P2                                                                    |
| Actualización instalada con datos          | Solo 0.1.0 disponible; segunda versión no disponible  | Pendiente: faltan entorno y dos releases reales                                    | P3                                                                    |
| Desinstalación y conservación              | 0.1.0 x64                                             | Pendiente: sin instalación Windows desechable; solo revisión estática              | P4                                                                    |
| Lector de pantalla                         | 0.1.0 x64; Narrador 10.0.26100.8972 en host           | Pendiente: sin sesión desechable con escucha; NVDA no encontrado en rutas estándar | P5                                                                    |
| Migración histórica                        | Schema v1; sin schema anterior publicado identificado | **No aplicable**, hasta que exista una versión publicada con schema previo         | Revisar la aplicabilidad cuando exista esa versión; no fabricar v0/v2 |

Evidencia de esta continuación, separada de las aprobaciones previas:
`test-results/cn013-pending/environment.json`, `installer-static-review.txt` y
`verification.json`. El JSON registra disponibilidad y motivos; no contiene
resultados de pruebas Windows que no se ejecutaron.

### Preparación y comparación común

Usar un equipo Windows destinado exclusivamente a pruebas o una VM Windows
desechable, con usuario invitado nuevo y datos enteramente sintéticos. Registrar
versión/build de Windows, versión de WebView2, nombres/versiones de instaladores,
ruta real del perfil, fecha y captura de cada paso. El identificador y el origen
deben seguir siendo `org.classnote.desktop` y `http://tauri.localhost`.

En estos casos usar la instalación real y el perfil predeterminado del invitado,
sin `WEBVIEW2_USER_DATA_FOLDER`, CDP ni rutas del host. Identificar la ruta efectiva
de WebView2 en el invitado; no asumir que la ruta temporal del runner es la del
producto instalado. Mantener un snapshot del invitado y respaldos externos a su
perfil antes de las operaciones destructivas.

Crear datos que pueblen las diez stores, al menos dos ciclos/grupos y selección
explícita. Exportar respaldo completo antes y después de reinicio/actualización y
en los puntos indicados de desinstalación. Comparar **todos los registros**, no
solo conteos: agrupar los fragmentos por tabla, ordenar filas por UUID (o `key` en
ajustes) y claves de objetos; conservar campos opcionales, valores y auditoría.
Ignorar solo fecha de exportación/metadatos de aplicación que cambien legítimamente,
sin ignorar `createdAt`/`updatedAt` de entidades ni diferencias en filas.

Tablas: `schoolYears`, `groups`, `students`, `enrollments`, `attendance`,
`assignments`, `submissions`, `readingLogs`, `studentNotes`, `appSettings`.
Comprobar referencias matrícula→alumno/grupo, grupo→ciclo, seguimiento→matrícula y
entrega→tarea del mismo grupo. Comparar exactamente `work.schoolYearId` y
`work.groupId`, y verificar la selección y los historiales en UI. Guardar los dos
archivos y el informe de comparación en evidencia; no declarar preservación si
solo coinciden los conteos. Usar el validador de respaldo compatible con cada
release; no editar versiones del archivo para forzar su aceptación.

### P1 — Instalación limpia y primer inicio realmente offline

1. Preparar el invitado limpio con WebView2 y el instalador 0.1.0 copiados antes
   de aislarlo. No haber iniciado ClassNote ni creado su perfil. Registrar los
   prerrequisitos disponibles y tomar snapshot.
2. Usar un invitado cuya conectividad esté aislada antes del arranque por su
   entorno desechable. No modificar la red, adaptadores ni firewall del host.
   No sustituir este aislamiento por `context.setOffline(true)` después de cargar.
3. Ejecutar el instalador 0.1.0 y primer inicio en el invitado. Registrar pantallas,
   mensajes, ausencia de descarga de requisitos y funcionamiento de las ocho
   secciones. Capturar un alta y guardado sintéticos. Sin runtime preinstalado,
   documentar por separado el resultado y el requisito faltante, sin prometer una
   instalación autónoma: la configuración actual usa `webviewInstallMode: skip`.
4. Registrar tráfico/intentos por proceso desde antes del instalador y primer
   inicio: distinguir ClassNote, sus WebView2, instalador y componentes Windows.
   Guardar captura/informe de procesos. Desconexión sola demuestra que no había
   conectividad, no que no existieron intentos de solicitudes externas. Aprobar
   el criterio de solicitudes de la app solo con observación que cubra ese tramo;
   el tráfico global del sistema requiere su propio registro y no se deduce de CDP.

### P2 — Reinicio de Windows con persistencia

1. En el invitado con 0.1.0 instalado, obtener el respaldo e instantánea previa de
   las diez stores y selección según la comparación común. Cerrar normalmente la
   app; registrar versión instalada, ruta del perfil y hora de arranque del SO.
2. Reiniciar **Windows del invitado** desde su menú. No reiniciar el host ni usar
   recarga, cierre de WebView2, reinicio del ejecutable o snapshot como sustituto.
3. Registrar una nueva hora de arranque del SO. Abrir desde el acceso de la
   instalación con el mismo usuario y perfil, exportar y comparar diez tablas,
   UUID, auditoría, relaciones y selección. Guardar evidencias de reinicio y UI.

### P3 — Actualización entre releases instalados

1. Esperar dos instaladores reales de versiones distintas. Registrar ambas
   versiones y procedencia; no reconstruir un release anterior cambiándole la
   versión, ni contar reinstalación de 0.1.0 como actualización.
2. Instalar el anterior en el invitado y poblar datos/selección. Exportar la base
   completa, registrar identifier/origen/ruta efectiva y cerrar todos los procesos
   de esa instalación. Tomar snapshot y copia externa del respaldo.
3. Ejecutar el instalador de la versión siguiente sobre la instalación anterior,
   sin borrar perfil ni desinstalar manualmente. Capturar las decisiones que
   muestre el instalador y confirmar la versión nueva instalada.
4. Abrir bajo el mismo usuario, exportar y comparar las diez tablas completas,
   UUID, auditoría, relaciones y selección, además de comprobar historial por UI.
   Registrar la ruta antes/después. Cualquier diferencia inesperada falla el caso.
   Si una futura actualización introduce schema nuevo, exigir antes su migración
   real desde datos poblados y reglas documentadas; no inventarla en esta etapa.

### P4 — Desinstalación y conservación sin borrado silencioso

La inspección del NSIS generado encontró una casilla `DeleteAppDataCheckbox`
en la confirmación. El script elimina las carpetas APPDATA/LOCALAPPDATA del bundle
solo si esa casilla está marcada y no está en modo actualización. Esto **no
confirma** su estado inicial, texto visible, accesibilidad ni resultado del
desinstalador compilado; el caso permanece pendiente.

1. Clonar el snapshot de una instalación de prueba poblada. Guardar respaldo e
   instantánea completos fuera del perfil; anotar ruta observada y versión 0.1.0.
2. Abrir el desinstalador interactivo y capturar aviso, casilla y estado inicial.
   Cancelar primero: comprobar instalación y diez stores intactas.
3. En una rama del snapshot, desinstalar dejando sin marcar el borrado de datos.
   Registrar si el perfil conserva archivos. Reinstalar el mismo 0.1.0, abrir y
   comparar exactamente los datos y selección con el respaldo anterior. La mera
   existencia de una carpeta no demuestra conservación de la base.
4. En otra rama desechable, repetir con borrado expresamente marcado, documentando
   el texto de advertencia y alcance. Comprobar el resultado sobre el perfil del
   invitado y que el respaldo externo permanece utilizable. Una pérdida sin aviso
   o consentimiento debe registrarse como fallo, no como aprobado por diseño.
   No ejecutar estas acciones sobre datos o instalaciones del usuario del host.

### P5 — Lector de pantalla básico

En el invitado desechable, iniciar el Narrador incluido (anotar su versión real),
con escucha disponible. No descargar NVDA ni voces para dar por offline el caso.
Si no hay lector/salida de audio verificable, registrar ese requisito y mantenerlo
pendiente. Anotar transcripción u observaciones de lo anunciado, no solo capturas.

Recorrer por teclado el salto al contenido, las ocho secciones, selección de
ciclo/grupo y formulario de alumno; comprobar nombre/rol/estado/foco de controles.
Ejercitar un error de campo requerido y su recuperación, asistencia y guardado
confirmado; abrir/cancelar previsualización de respaldo y una confirmación
destructiva sobre datos sintéticos. Verificar que se anuncien errores, estados y
alcance de la confirmación, que el foco vuelva al control esperado y que no haya
trampas de teclado. Probar el diálogo nativo de archivo. Registrar cada omisión
como fallo reproducible; el árbol UIA o una prueba automatizada de labels no
acredita que se haya escuchado lo anunciado.

### Comprobaciones aplicables a esta continuación

Solo documentación y evidencia de inventario: revisar contenido, estados, enlaces
locales, formato del documento modificado y `git diff --check`. No se repiten lint,
tipos, suites UI/DB, build, tauri:build ni test:native ya aprobados: no cambió código
de aplicación o de pruebas y esas ejecuciones no desbloquean un invitado Windows.
Los resultados anteriores se mantienen como históricos, sin atribuirlos a esta
continuación. Ningún pendiente se marca aprobado por inspección estática.

## Matriz ejecutada

Las rutas de evidencia de esta tabla son relativas a `test-results/`, fuera de Git.

| Caso                                                        | Estado                        | Evidencia y alcance real                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empaquetado Windows                                         | Aprobado                      | `pnpm tauri:build`: release x64 y NSIS de 2.356.497 bytes. Generación, sin instalación.                                                                                                                                                                                                                                                                           |
| Instalación limpia                                          | Pendiente                     | Windows Sandbox no está disponible (`WindowsSandbox.exe` ausente). No hay VM/equipo de prueba aislado disponible; no se ejecutó NSIS sobre la instalación del usuario.                                                                                                                                                                                            |
| Primer inicio sin internet                                  | Pendiente                     | Perfil nuevo con diez stores vacías aprobado en `native/result.json`; el aislamiento CDP se aplica después de cargar UI. No prueba primer inicio/instalación offline ni disponibilidad inicial de WebView2.                                                                                                                                                       |
| Uso con 35 alumnos                                          | Aprobado                      | `native/hardening-result.json`, `workload-35-*.png`: 22 días laborables de septiembre (770 asistencias), diez tareas (350 entregas), alumnos, búsqueda, consulta y correcciones confirmadas de asistencia/entrega desde UI.                                                                                                                                       |
| Uso con 100 alumnos                                         | Aprobado                      | Mismo caso con 2.200 asistencias y 1.000 entregas; `workload-100-*.png`. Sin fallos observados en esta muestra.                                                                                                                                                                                                                                                   |
| Cierre completo/reapertura                                  | Aprobado                      | `native/result.json`, `hardening-before.json`, `hardening-after.json`: procesos distintos, cierre del ejecutable y todos los WebView2 de su perfil, igualdad exacta de diez stores antes de consultar/seleccionar otra vez.                                                                                                                                       |
| Reinicio de Windows                                         | Pendiente                     | No se reinició el equipo compartido de trabajo. Requiere equipo/VM de prueba y comparación posterior con la misma instantánea.                                                                                                                                                                                                                                    |
| Actualización con datos previos                             | Pendiente                     | No hay dos releases instalables de versiones distintas disponibles y un equipo aislado para instalarlas. Reabrir el mismo 0.1.0 no cuenta como actualización. Sin escrituras de actualización ni comparación atribuida a ese caso.                                                                                                                                |
| Migración histórica poblada                                 | No aplicable                  | `src/db/database.ts` solo declara `version(1)`; no existe una versión de schema anterior real. No se inventó v0/v2. Cuando exista, conservar origen/perfil e igualar diez stores/UUID/relaciones/auditoría antes/después.                                                                                                                                         |
| Excel: cuatro hojas, datos y caracteres peligrosos          | Aprobado                      | 3 tests DB Excel y `native/hardening-result.json`: conteos, fechas/rango, estados y cadenas `=`, `+`, `-`, `@`, sin objetos fórmula; XLSX de 35/100 generados en WebView2 y reabiertos con ExcelJS.                                                                                                                                                               |
| Apertura compatible de Excel                                | Aprobado                      | `native/excel-compatible-result.json`: Microsoft Excel 16.0 abre normalmente, sin reparación, solo lectura y macros deshabilitadas, tres libros; cuatro hojas y ninguna fórmula.                                                                                                                                                                                  |
| Guardar/cancelar Excel nativo                               | Aprobado                      | `native/excel-result.json`, `reports-*.png`, `dialog-persistence-result.json`: diálogo real, archivo guardado, cancelación sin éxito ni cambios en diez tablas.                                                                                                                                                                                                   |
| Respaldo válido y reemplazo con pre-backup                  | Aprobado                      | `native/backup-result.json` y `backup-*.png`: diálogos reales, respaldo previo físico validado contra diez stores anteriores, reemplazo y tercera apertura con igualdad exacta/relaciones por UI.                                                                                                                                                                 |
| Restaurar en perfil nuevo vacío                             | Aprobado                      | `native/clean-restore-result.json`, `clean-before.json`, `clean-after-restore.json`, `clean-after-restart.json`: diez stores inicialmente vacías, importación por servicio real en WebView2, pre-backup vacío validado, cierre/reapertura y consulta UI de ambos grupos. No equivale a instalación limpia.                                                        |
| Corrupción/truncado/incompatibilidad                        | Aprobado en validación        | 5 tests DB backup, 5 UI backup y `native/hardening-result.json`: fuente truncada rechazada antes del guardado previo, diez stores intactas. Corrupción por servicio nativo; IPC de archivo corrupto simulado en suite UI, sin abrir un archivo corrupto mediante diálogo Windows en esta ejecución.                                                               |
| Cancelar confirmación/pre-backup                            | Aprobado                      | Suite UI y servicio nativo: no llama guardado si falta confirmación, cancelar destino aborta, diez stores idénticas. Diálogo real de cancelación de Excel comprobado aparte.                                                                                                                                                                                      |
| Fallo intermedio/rollback/reintento                         | Aprobado                      | `native/hardening-result.json`: excepción real en hook de escritura de entregas durante reemplazo; revierte diez tablas. Hook `QuotaExceededError` en escritura de asistencia y error simulado de guardado previo conservan datos; reintento inserta exactamente una asistencia; restauración posterior recupera instantánea anterior. No se llenó el disco real. |
| Cancelaciones destructivas, conflictos y borradores         | Aprobado                      | 63 DB y 64 UI: archivo, baja, correcciones y borrado de nota cancelados; concurrencia, rollback y lectura posterior al commit sin duplicar. Flujos nativos anteriores conservados.                                                                                                                                                                                |
| Aislamiento de ciclo/grupo                                  | Aprobado                      | Suites DB/UI y selección/consulta nativa de grupos distintos antes/después de reabrir/restaurar.                                                                                                                                                                                                                                                                  |
| Teclado y 1100/768/360 px                                   | Aprobado                      | Suite UI, capturas de módulos, foco/labels/salto al contenido/sin desbordamiento. Inspección visual de backup 360, formulario notas 360, lectura 768, reporte 1100 y vistas nativas de carga/restauración. Contraste legible en capturas; sin auditoría colorimétrica exhaustiva.                                                                                 |
| Lector de pantalla                                          | Pendiente                     | Se comprobó árbol accesible de diálogos Windows, pero no se evaluó salida hablada de Narrador/NVDA. Requiere sesión accesible con escucha y revisión manual.                                                                                                                                                                                                      |
| Desinstalación/preservación                                 | Pendiente                     | Sin entorno Windows desechable aislado; no se ejecutó desinstalador ni se tocaron perfiles personales. No se afirma que los datos sobrevivan: exportar y proteger un respaldo fuera del perfil antes de desinstalar.                                                                                                                                              |
| Ausencia de solicitudes externas de la app                  | Aprobado en flujos observados | 2 tests de distribución, UI y `externalRequests: []`/`externalPageRequests: []` en resultados nativos. Contextos offline después de carga local; CSP del producto sin cambios.                                                                                                                                                                                    |
| Tráfico global del sistema / corte eléctrico / disco dañado | Pendiente                     | CDP no aísla Windows ni observa todo su tráfico. No se cambiaron red/firewall ni se provocó corte/daño físico. Atomicidad transaccional no prueba esos escenarios.                                                                                                                                                                                                |

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
