# Plan de pruebas

## CN-014 — preparación de v0.1.0 (20/10/2026)

CN-013 se considera completada por decisión explícita del usuario para esta
entrega. La sección siguiente y HARDENING.md son la matriz histórica preservada;
sus casos no ejecutados no pasan a aprobados por esta decisión.

Resultados nuevos, artefactos y límites: [RELEASE_0.1.0.md](docs/RELEASE_0.1.0.md).
Evidencia excluida de Git: `src-tauri/target/cn014-evidence/`. Antes de ejecutar
la suite UI se copiaron allí `cn013-native/` y `cn013-pending/`, conservando los
resultados anteriores. No se repite la carga 35/100 de CN-013.

El runner existente admite dos opciones solo de pruebas: `CN_NATIVE_EXE` para
el ejecutable instalado y `CN_NATIVE_OUTPUT` para evidencia separada. Si se omiten,
mantiene sus rutas anteriores. Siempre crea perfil WebView2 temporal, no usa el
perfil personal ni modifica identifier/origen/schema/capabilities del producto.

Después de `pnpm test`, la verificación del binario instalado se reproduce así:

```powershell
$env:CN_NATIVE_EXE = (Resolve-Path 'src-tauri/target/cn014-evidence/installed/classnote.exe').Path
$env:CN_NATIVE_OUTPUT = Join-Path (Get-Location) 'src-tauri/target/cn014-evidence/native-delivery'
$env:CN011_EXPORT_UI = '1'
$env:CN012_BACKUP_UI = '1'
pnpm test:native
Remove-Item Env:CN_NATIVE_EXE, Env:CN_NATIVE_OUTPUT, Env:CN011_EXPORT_UI, Env:CN012_BACKUP_UI
```

Operar los diálogos reales en los destinos sintéticos que imprime el runner;
cancelar la segunda exportación Excel cuando se indique. No publicar los perfiles,
archivos ni capturas. La instalación de prueba se realiza solo si no hay ClassNote
ya instalado, con `/S /NS /D=<carpeta aislada absoluta>`; escribe su registro NSIS
por usuario pero no accesos directos. No ejecutar esto sobre otra instalación.
El uso offline se aplica por CDP después de cargar la aplicación, por lo que no
verifica instalación inicial totalmente desconectada ni tráfico global de Windows.

Resultado nuevo: lint/formato/tipos, `pnpm test` (63 DB + 2 distribución + 64 UI),
`pnpm tauri:build` y nativa aprobados. NSIS instalado en carpeta aislada, binario
x64 y metadatos 0.1.0 sin firma; cierre/reapertura y restauración con tres PIDs
distintos (registrados en native-delivery/backup-result.json), diez stores exactas/UUID/auditoría/relaciones/selección, copia
previa física y rollback comprobados. Excel guardado y cancelado en diálogos reales,
cuatro hojas y ninguna fórmula al reabrir con ExcelJS. Capturas inspeccionadas.
CN-014 queda pendiente únicamente de la aceptación del recorrido por una persona
no técnica; no se presenta automatización como prueba humana.

## CN-013: matriz vigente y ejecución Windows (20/10/2026)

**CN-013 pendiente de cierre.** Matriz por caso (aprobado/fallido/pendiente),
evidencias, causa de fallos y límites: [HARDENING.md](docs/HARDENING.md).
Ese registro actualiza los resultados históricos de los módulos que siguen abajo.

Seguimiento de pendientes (20/10/2026): instalación/primer inicio offline, reinicio
del SO, actualización instalada, desinstalación y lector de pantalla siguen
**pendientes**. VirtualBox existe fuera de PATH, pero solo registra una VM Linux
guardada; no hay Windows desechable accesible identificado. Narrador está instalado
en el host (10.0.26100.8972); NVDA no se encontró en rutas estándar. No se ha
verificado su salida hablada en un entorno desechable. Solo está disponible el
instalador 0.1.0 x64 (2.356.497 bytes), sin segunda versión real para actualizar.
**Migración histórica: no aplicable hasta que exista una versión publicada con
schema previo.** No es una prueba fallida ni una migración por inventar.
Procedimientos P1–P5 y comparación completa de diez tablas/UUID/auditoría/relaciones/
selección: [HARDENING.md](docs/HARDENING.md). Evidencia de inventario separada en
`test-results/cn013-pending/`. Esta continuación solo modifica documentos; se
comprueban contenido, enlaces, formato y diff, sin repetir las suites aprobadas.

Suite global final: **63 DB + 2 distribución + 64 UI aprobadas**. Los dos fallos
de consulta simulada de Lecturas/Observaciones se reprodujeron y corrigieron solo
en pruebas: esperar la consulta del resumen de Inicio antes de activar el fallo
de lectura de un solo uso. Tres repeticiones por caso aprobadas, sin relajar
aserciones. Lint/formato/typecheck/build/tauri:build y test:native aprobados.

`CN013_HARDENING=1 pnpm test:native` amplía el release con 35/100 alumnos, 22 días
de asistencia y diez tareas por grupo, consulta y corrección por UI, Excel con
texto peligroso, errores/rollback/reintento, respaldo previo y restauración a otro
perfil nuevo vacío. Cierre completo/reapertura de ambos perfiles con comparación
exacta de diez stores, UUID, relaciones y auditoría. Evidencia local:
`native/hardening-result.json`, `hardening-before.json`, `hardening-after.json`,
`clean-restore-result.json`, `clean-*.json`, XLSX y capturas de carga/restauración.
Sonda y fixtures solo en tests, sin cambios de schema/dependencias/permisos.

Checkpoints nativos CN-011/CN-012 con diálogos reales también aprobados; resultados
preservados en `native/dialog-persistence-result.json`, `excel-result.json` y
`backup-result.json`. `tests/native/check-excel.ps1` abre tres XLSX sintéticos con
Microsoft Excel separado, invisible y solo lectura: cuatro hojas, ninguna fórmula.
No usa perfiles personales. UI limpia test-results; ejecutar nativas al final.

Pendientes: instalación/primer arranque offline, actualización entre versiones,
reinicio de Windows, desinstalación, salida hablada de lector de pantalla y tráfico
global/fallos físicos. Migración histórica no aplicable mientras no exista una
versión publicada con schema previo. Un perfil vacío
del release no acredita instalación limpia. CN-002 permanece pendiente.

## CN-012: respaldo completo y restauración

- tests/db/backup.test.ts: diez tablas vacías/relacionadas, igualdad exacta de
  valores/UUID/auditoría, conteos, corrupción/truncado/versiones, referencias y campos,
  índices únicos en base temporal, cancelaciones y errores previos, conflicto durante
  guardado, rollback real intermedio, selección válida/inválida y recuperación previa.
- tests/ui/backup.spec.ts: cinco pruebas de previsualización, confirmación y
  guardado previo obligatorio, cancelaciones sin escrituras/éxito, fallos recuperables,
  relectura posterior sin reimportación, offline y 1100/768/360 px con foco/teclado.
- Checkpoint nativo `$env:CN012_BACKUP_UI='1'; pnpm test:native`: exportar desde UI
  en destino sintético elegido, cerrar/reabrir mismo release/perfil aislado, restaurar
  con diálogo real y respaldo previo, cerrar/reabrir por tercera vez y verificar las
  diez tablas exactas, selección y relaciones mediante UI. Evidencia y límites:
  [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md). Ejecutar después de la suite UI.
- No cambia schema, origen, perfil, red del equipo ni capacidades generales; no usa
  datos reales. Instalación/actualización/desinstalación y corte quedan en CN-013.

Resultados CN-012 (20/10/2026): lint, formato, typecheck, build y tauri:build aprobados.
63/63 DB y 2/2 distribución; suite UI 62/64 (5/5 CN-012). Fallos pendientes en
notes.spec.ts:235 y reading.spec.ts:209, al esperar error simulado de consulta inicial;
reproducidos aisladamente, sin cambiar módulos ni pruebas ajenos. No se declara
aprobada la suite global. Prueba nativa final con CN012_BACKUP_UI=1 aprobada: tres
PIDs distintos (33124/26844/23740), rollback real intermedio en WebView2 sin pérdida,
exportación/restauración desde diálogos y respaldo previo real validado, tercera
apertura con igualdad exacta de diez tablas y relaciones/selección por UI, offline
y cero solicitudes externas observadas. Capturas de tres resoluciones y nativas
inspeccionadas. Incidencias corregidas de foco y auditoría/reloj, archivos y límites:
[BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md). CN-002/CN-013 permanecen pendientes.

## CN-011: reporte Excel

- tests/db/excel-export.test.ts: tres pruebas integradas, XLSX real reabierto con
  ExcelJS; cuatro hojas/valores/orden, fechas locales/rango inclusivo, opcionales,
  acentos/ceros, vacíos/pendientes, aislamiento y neutralización de fórmulas.
- tests/ui/reports.spec.ts: cuatro pruebas de rango, teclado, tres resoluciones,
  offline, error/reintento/cancelación sin falso éxito y doble envío. Fixtures/IPC
  solo en tests. Se actualiza únicamente placeholder de Reportes en navegación.
- Prueba nativa existente ampliada con checkpoint opcional CN011_EXPORT_UI=1:
  elegir destino sintético y cancelar segundo diálogo; abrir XLSX con ExcelJS,
  verificar filas y snapshot idéntico de diez tablas tras reinicio del release.
  Capturas y archivo en test-results/native, fuera de Git. Ejecutar después de UI.
- Resultados exactos, incidencias ambientales, apertura compatible y límites:
  [EXCEL_EXPORT.md](docs/EXCEL_EXPORT.md). Mantener todos los checks anteriores.

Resultados CN-011 (20/10/2026): lint/formato/typecheck/build y empaquetado aprobados;
58 DB + 2 distribución aprobadas. Diagnóstico UI con Chrome: 49/59 (incluidas 4/4
CN-011); pendientes ambientales por inyección AdGuard/conexión en consola, sin
relajar aserciones. Test:native con checkpoint aprobado, cierre/reapertura real y
snapshot exacto, diálogo de guardado/cancelación y XLSX verificado con ExcelJS y
Microsoft Excel (cuatro hojas inspeccionadas). Detalle de intentos, corrección de
confirmaciones del plugin y refresco del reloj sintético en EXCEL_EXPORT.md.

## Tests automatizados
- Dominio: validaciones de fechas, minutos, ciclos, estados y conteos.
- Dexie: pruebas con IndexedDB simulado (`fake-indexeddb`) **más** pruebas de integración reales en WebView2.
- Unicidad: asistencia por `(enrollmentId,date)` y entrega `(assignmentId,enrollmentId)`; matrícula duplicada impedida.
- Integridad: una tarea no acepta entregas de otra matrícula/grupo.
- Exportación: datos, orden de columnas, múltiples hojas, acentos, fechas, cero registros y entradas que parecen fórmulas.
- Restauración: archivo correcto, corrupto, versión incompatible, cancelación, reemplazo y fallo a mitad.
- Migración histórica: no aplicable actualmente (solo schema v1); ejecutar desde una versión publicada previa poblada cuando exista una migración real, conservando relaciones.

## Pruebas manuales Windows (release gate)
- [ ] Instalar en equipo Windows 11 sin internet disponible durante primer inicio una vez cumplidos prerequisitos del instalador.
- [x] Ejercitar 35 y 100 alumnos, 22 días laborables y 10 tareas sin red del contexto; carga por repositorios nativos y correcciones desde UI. No es captura humana de toda la carga; véase CN-013.
- [x] Cerrar proceso y volver a abrir; diez stores intactas, UUID/auditoría/relaciones comparados (CN-013).
- [ ] Reiniciar equipo; datos intactos.
- [ ] Actualizar versión de app con datos existentes; datos intactos.
- [ ] Importar backup en instalación de prueba limpia; validar conteos y relaciones.
- [x] Cancelar restauración; base intacta (UI y servicio nativo).
- [x] Simular respaldo inválido; no perder datos (validación en WebView2, archivo/IPC simulado en UI).
- [x] Exportar XLSX y abrir en Microsoft Excel; cuatro hojas sin fórmulas (CN-013).
- [x] Cambiar entre ciclos/grupos; ninguna mezcla de registros (CN-013).
- [x] Aumentar/reducir ventana y navegar con teclado a 1100/768/360 px.
- [ ] Probar salida hablada de lector de pantalla de manera básica.
- [x] Cero solicitudes externas observadas en los flujos UI/WebView2 aislados; no acredita tráfico global de Windows.
- [ ] Revisar comportamiento de desinstalación y limpieza de datos WebView2; documentar riesgos.

## Comandos
Después de CN-001/CN-001A:

- `pnpm typecheck`: TypeScript estricto, incluida la configuración y las pruebas UI.
- `pnpm lint` y `pnpm format:check`: ESLint y Prettier.
- `pnpm build`: frontend distribuible.
- `pnpm test`: build, 63 pruebas de dominio/persistencia con Node, dos comprobaciones de distribución y 64 tests UI (hasta CN-013).
- `pnpm test:db`: 63 pruebas TypeScript con Node Test Runner y fake-indexeddb. Requiere Node 24 o compatible con `--experimental-strip-types`; no descarga runner ni navegador.
- `pnpm test:native`: ejecutable release real, WebView2 con perfil aislado y CDP local, escritura/lectura offline, cierre completo y reapertura. Requiere `pnpm tauri:build` previo; no inicia Vite ni instala ClassNote. Véase [PERSISTENCE.md](docs/PERSISTENCE.md).
- `pnpm test:ui`: build y tests UI con Playwright / Edge instalado, sin descargar navegadores.
- `pnpm tauri:dev`: compilación y arranque nativo.

Las pruebas UI levantan su propio preview de producción en `127.0.0.1:1421`,
sin reutilizar servidores existentes. Requieren sockets locales y permiso de iniciar
Edge; el sandbox puede bloquearlos. Los resultados y capturas van en `test-results/`
(excluido de Git). Las ocho secciones se prueban a 1100, 768 y 360 px, además de
historial, enlaces directos, ruta desconocida, accesos rápidos, foco y teclado.
Se revisan errores de consola y de ejecución en las tres resoluciones.

La prueba offline carga recursos locales, espera apertura correcta de `classnote`,
corta la red del contexto y recorre las ocho secciones. Comprueba diez stores vacías,
ningún mock persistido, ausencia de localStorage/sessionStorage y cero peticiones
externas. Otra prueba provoca un error de IndexedDB y acciona reintento por teclado.
Se mantienen tamaños, foco, historial y enlaces. Las evidencias de etapa 02 en
[APP_SHELL.md](docs/APP_SHELL.md) son históricas: CN-003 sí abre IndexedDB.

## Casos y resultados CN-003

El 19 de octubre de 2026 se ejecutaron correctamente `pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm test` (12 + 2 + 7 aprobadas), `pnpm build`, `pnpm tauri:build`
y `pnpm test:native`. Este último se ejecutó contra WebView2, no Edge independiente.

Cobertura DB: apertura vacía de diez stores, inicialización repetida/carga, altas y
consultas de todas las entidades, reapertura v1 con igualdad de valores/IDs, cinco
índices únicos, referencias inexistentes, entregas cruzadas, aislamiento entre dos
ciclos/grupos, fechas reales, grados/minutos/estados/categorías/campos requeridos,
extremos inclusivos de asistencia, varias lecturas por día, concurrencia, rollback
ante duplicado/fallo de validación a mitad de lote, error y reintento sin pérdida.
Las bases simuladas tienen nombre UUID por prueba y se eliminan solo en tests.

El primer `pnpm test` restringido quedó sin responder al servidor local y se canceló;
se repitió con acceso autorizado y pasó. El primer empaquetado compiló release pero
falló al descargar NSIS (`Host desconocido`, error 11001); el reintento autorizado
generó el instalador. Solo hubo advertencias de NO_COLOR/FORCE_COLOR en la suite UI.

La primera comprobación de formato marcó catorce archivos existentes solo por CRLF.
Se confirmó que su contenido ya tenía el formato correcto y se configuró Prettier
con `endOfLine: auto` para respetar los finales de línea de Windows sin reescribirlos.

La prueba nativa conserva datos tras cerrar el proceso y reapertura en el mismo perfil,
incluida escritura offline posterior y navegación. No cubre primer arranque sin red,
tráfico global de Windows, reinicio del equipo, instalación, actualización, desinstalación
ni respaldo/restauración. Esos criterios manuales y CN-013 siguen pendientes.

## CN-004: gestión escolar y contexto

- tests/db/school-management.test.ts: altas/ediciones, duplicados, fechas/grados, identidad inmutable, guardado sin cambios, reducción de intervalo contra matrículas/asistencias, archivo/reactivación sin cascada, conservación de relaciones, selección válida/inválida y rollback de archivo si falla la escritura de preferencias.
- tests/ui/school-management.spec.ts y tests/helpers/school-flow.ts: primera ejecución vacía, dos ciclos y dos grupos por ciclo, administración independiente, selección/alternancia/recarga, edición, confirmación cancelada, archivo/reactivación, recuperación de duplicados y controles accesibles a 1100/768/360 px. Se mantienen las pruebas previas de navegación, base vacía y red externa.
- tests/native/persistence.mjs reutiliza el ejecutable release y perfil temporal de CN-003. Además de fixtures de diez tablas, crea dos ciclos y cuatro grupos desde UI, selecciona contexto y edita turno offline. Cierra completamente el proceso y WebView2; reabre el mismo ejecutable/perfil, compara valores/UUID de las diez tablas y verifica selección/edición por UI. Prueba archivo/reactivación y conservación de relaciones sintéticas después del reinicio.
- Comandos sin cambios: pnpm lint, pnpm format:check, pnpm typecheck, pnpm test, pnpm build, pnpm tauri:build y pnpm test:native.
- Evidencia local excluida de Git: test-results/school-management-*.png y test-results/native/{result.json,first-launch.png,after-restart.png}.

Resultados CN-004 (19/10/2026): lint, format:check, typecheck, test (18 DB + 2 distribución + 13 UI), build, tauri:build y test:native aprobados. Las pruebas adicionales comprueban cancelación sin escrituras, alternancia rápida sin resultados antiguos y reintento tras fallo de lectura. El reinicio real conserva instantánea exacta de diez tablas, selección y turno editado; archivo/reactivación posterior conserva relaciones. Detalles: docs/SCHOOL_YEARS_GROUPS.md. Ejecutar test:native al final para conservar su evidencia, pues la suite UI limpia test-results al iniciar. CN-002 y CN-013 siguen pendientes.

## CN-005: alumnos y matrículas

- tests/db/students.test.ts: cinco pruebas integradas para alta conjunta y rollback tras fallo de matrícula, homónimos, entradas/fechas, ficha existente en otro ciclo/grado, identidad inmutable, aislamiento, relaciones educativas intactas, unicidad concurrente, contextos archivados, intervalos inclusivos, baja/reactivación y rollback de archivo global. Fixtures sintéticos, bases UUID aisladas.
- tests/ui/students.spec.ts y tests/helpers/student-flow.ts: sin contexto, vacío/sin coincidencias, alta/edición, búsqueda insensible a acentos, ficha existente e historial en otro ciclo/grado, homónimos distinguibles, cambio de contexto durante formulario, baja cancelada/confirmada, fechas, archivo cancelado/confirmado, reactivación sin cascada y matrícula inactiva recuperada desde matriculación. Lectura fallida con reintento, fallo de escritura que conserva formulario y fallo posterior al guardado que no duplica. Teclado, labels, foco y ausencia de desbordamiento a 1100/768/360 px; capturas students-*.png.
- tests/native/persistence.mjs: reutiliza la UI de ciclos y grupos, crea/edita alumno, matricula la misma ficha en grado 2 de otro ciclo, comprueba una ficha y dos matrículas, da de baja solo la del primer grupo y verifica historial por UI antes/después de cierre completo del proceso. Compara instantánea exacta de las diez tablas con UUID/relaciones y selección; contexto CDP aislado offline. Ejecutar después de la suite UI.
- Se conservan pruebas previas de navegación, persistencia, diez tablas vacías y cero solicitudes externas. Sin nuevas dependencias ni modificación de perfiles personales/red del equipo.

Resultados y límites de la ejecución final: docs/STUDENTS_ENROLLMENTS.md. CN-002 y CN-013 siguen pendientes.

Resultados finales CN-005 (19/10/2026): lint, format:check, typecheck, test (23 DB + 2 distribución + 20 UI), build, tauri:build y test:native aprobados. Reinicio nativo real con procesos distintos conserva exactamente diez tablas, ficha editada, dos matrículas de ciclos/grados distintos y baja independiente. Evidencia: test-results/native/result.json y students-after-restart.png; límites e incidencias resueltas en docs/STUDENTS_ENROLLMENTS.md.

## CN-006: asistencia diaria

- `tests/db/attendance.test.ts`: siete pruebas integradas de fechas reales/ciclo, extremos inclusivos, matrículas inactivas/fichas archivadas, estados/notas/relaciones desconocidas, captura parcial, correcciones e identidad, conservación de notas/filas intactas, idempotencia, concurrencia con conflictos explícitos, rollback ante fallos reales a mitad de lote e aislamiento de fechas/grupos/ciclos. Total de dominio/DB: 30.
- `tests/ui/attendance.spec.ts` y `tests/helpers/attendance-flow.ts`: captura individual/parcial/completado, marcar todos con confirmación cancelada/aceptada y notas conservadas, corrección cancelada/confirmada, borradores protegidos ante fecha/ciclo/grupo/sección/historial, errores recuperables, commit seguido de lectura fallida, fechas inválidas y alternancia rápida. Pruebas a 1100/768/360 px, foco/teclado y contexto offline sin solicitudes externas. Se mantienen las comprobaciones anteriores y se retira solo la expectativa del placeholder de Asistencia.
- Prueba nativa ampliada: captura parcial, completar/corregir y aislamiento por UI; cierre completo y reapertura con mismo ejecutable/perfil aislado. Comparación exacta de diez tablas, UUID/auditoría y relaciones; verificación UI de estados/notas/recuentos y nueva escritura de asistencia offline después del reinicio. Evidencia: `test-results/native/result.json` y `attendance-after-restart.png`. Ejecutar después de la suite UI.
- Comandos: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm tauri:build`, `pnpm test:native`. Resultados finales y límites: [ATTENDANCE.md](docs/ATTENDANCE.md). CN-002 y CN-013 siguen pendientes.

Resultados finales CN-006 (19/10/2026): todos los comandos anteriores aprobados; 30 DB/dominio + 2 distribución + 29 UI (incluidas concurrencia entre dos ventanas y fecha inicial vacía fuera del ciclo). Release x64 e instalador NSIS compilados. Prueba nativa con PIDs distintos y perfil aislado conserva exactamente diez tablas, estados, notas, auditoría, UUID y relaciones; verifica otra escritura de asistencia offline después de reabrir. No se sustituye el reinicio por recarga. Se inspeccionaron capturas a 1100/768/360 px y WebView2 tras reapertura; pendientes y límites de hardening documentados en docs/ATTENDANCE.md.

## CN-007: tareas y entregas

- tests/db/assignments.test.ts: diez casos integrados con fixtures sintéticos aislados; altas/ediciones, homónimos, fechas/ciclo, población inclusiva histórica y dinámica, lectura sin escritura, incidencias, pendientes sin registro/comentario pendiente, cuatro estados, identidad, idempotencia, índice único, concurrencia/conflictos, rollback real y validación tardía, aislamiento y cambio de asignación incompatible. Recuentos y borradores/filtros se prueban sin almacenamiento adicional.
- tests/ui/assignments.spec.ts: creación/edición y consulta, filtros de tareas/entregas, estados/comentarios, correcciones canceladas/confirmadas, cambios ocultos conservados, protección de formulario/entregas en navegación/contexto/historial, errores recuperables y consulta fallida después del commit, conflictos entre ventanas y cambios rápidos de contexto. Offline, teclado/foco y 1100/768/360 px; conserva suites anteriores y actualiza placeholder.
- tests/native/persistence.mjs amplía el perfil temporal existente: tareas creadas/editadas por UI, cuatro estados y comentarios, corrección confirmada, otra tarea/grupo aislados; cierre real y reapertura del mismo ejecutable/perfil con igualdad exacta de tablas/UUID/auditoría/relaciones, recuperación UI de datos/recuentos y otra corrección offline. Evidencia: test-results/native/result.json y assignments-after-restart.png.
- Ejecutar pnpm lint, pnpm format:check, pnpm typecheck, pnpm test, pnpm build, pnpm tauri:build y finalmente pnpm test:native. No ejecutar suite UI después de guardar evidencia nativa porque limpia test-results. Resultados y límites: docs/ASSIGNMENTS.md. CN-002/CN-013 siguen pendientes.

Resultados finales CN-007 (19/10/2026): lint, format:check, typecheck, test (40 dominio/DB + 2 distribución + 38 UI), build, tauri:build y test:native aprobados. Dos procesos nativos distintos, igualdad exacta de las diez tablas con 34 registros de dominio al reiniciar, cuatro estados/comentarios y recuentos UI recuperados, y corrección offline adicional conservando UUID/createdAt. Capturas de las tres resoluciones y WebView2 tras reinicio inspeccionadas. Límites e incidencias resueltas en docs/ASSIGNMENTS.md; no cubre hardening CN-013.

## CN-008: lecturas en casa

- `tests/db/reading.test.ts`: siete casos integrados, con bases aisladas y datos sintéticos. Entradas idénticas concurrentes y varias por fecha; cero/1440 por entrada y suma diaria superior al máximo individual; entradas inválidas; fechas reales/ciclo/matrícula y extremos inclusivos; fichas archivadas/matrículas inactivas; referencias y aislamiento por ciclo/grupo/matrícula; edición con propietario/identidad/auditoría conservados, no-op y conflictos; historial estable/filtros y totales semanales, cruces de mes/año y febrero bisiesto. Dexie v1 sin migración.
- `tests/ui/reading.spec.ts` y `tests/helpers/reading-flow.ts`: seis pruebas, incluidas tres resoluciones (1100/768/360 px). Alta/edición, varias entradas del mismo título/día, historial/rango y resumen independiente, cero minutos, cambios rápidos de grupo, offline, teclado/foco, ausencia de desbordamiento/errores/peticiones externas; protección de borradores en navegación/ciclo/grupo/historial, corrección cancelada, error de escritura, doble envío, consulta posterior fallida sin duplicar, error de consulta inicial y conflicto entre ventanas con borrador conservado. Se sustituye solo la expectativa del placeholder de lectura y se mantienen regresiones anteriores.
- `tests/native/persistence.mjs`: lecturas nuevas/editadas por UI, cierre completo de proceso/WebView2 y reapertura del mismo ejecutable/perfil temporal aislado. Igualdad exacta de diez tablas con UUID/auditoría/relaciones; historial y totales UI recuperados; nueva lectura de cero minutos offline posterior y lecturas anteriores intactas. Evidencia en `test-results/native/result.json` y `reading-after-restart.png`.
- Ejecutar `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm tauri:build` y finalmente `pnpm test:native`. La suite UI limpia `test-results`; no ejecutarla después de guardar evidencia nativa. Inspeccionar capturas `reading-*.png` y `reading-form-*.png`. Alcance, resultados finales e incidencias: [READING.md](docs/READING.md).

La prueba offline no modifica la red del equipo ni utiliza perfiles personales. No acredita instalación inicial offline, tráfico del sistema operativo, reinicio de Windows, actualización, desinstalación, recuperación ante corte, backups/restauración ni auditoría de lector de pantalla; CN-002 y CN-013 siguen pendientes.

Resultados finales CN-008 (19/10/2026): lint, format:check, typecheck, test (47 dominio/DB + 2 distribución + 44 UI), build, tauri:build y test:native aprobados. Release x64 e instalador NSIS generados. PIDs nativos distintos (24388 y 11672), 37 registros de dominio y diez tablas exactamente conservadas al reiniciar; historial individual y semana de 35 minutos/3 entradas recuperados por UI; nueva lectura offline de cero minutos incrementa el conteo a 4 y conserva las anteriores. Se inspeccionaron seis capturas a 1100/768/360 px y WebView2 tras reinicio. Incidencias de preview/NSIS y fixtures de UI/semana resueltas; evidencia y límites en docs/READING.md. CN-008 completa, sin cerrar CN-002/CN-013.

## CN-009: observaciones privadas

- tests/db/notes.test.ts: cinco pruebas integradas sintéticas de validación, referencias, fechas inclusivas, categorías, alta/edición, identidad/no-op, aislamiento, historia inactiva/archivada, orden/filtros, conflicto concurrente y borrado confirmado/cancelado sin cascada; rollback real de alta, corrección y eliminación tras fallo posterior dentro de transacción.
- tests/ui/notes.spec.ts y tests/helpers/notes-flow.ts: siete pruebas con tamaños 1100/768/360 px, offline/teclado/foco/labels, formularios/filtros/búsqueda, borrador protegido, confirmaciones, errores recuperables, doble envío, lectura posterior al commit sin duplicación y conflicto entre ventanas. Se mantiene navegación de ocho secciones sustituyendo solo placeholder de Observaciones.
- tests/native/persistence.mjs: alta/edición por UI, cierre completo/reapertura del mismo release/perfil WebView2 aislado, igualdad exacta de diez tablas; historial de notas recuperado y alta/borrado cancelado/confirmado offline posteriores, sin modificar alumnos/matrículas.
- Comandos: pnpm lint, pnpm format:check, pnpm typecheck, pnpm test, pnpm build, pnpm tauri:build y finalmente pnpm test:native. Capturas notes-*.png/notes-form-*.png y native/notes-after-restart.png; resultados finales y límites: docs/OBSERVATIONS.md. No ejecutarlo con perfiles personales ni cambiar la red del equipo. CN-002/CN-013 siguen pendientes.

Resultados finales CN-009 (19/10/2026): lint, format:check, typecheck, test (52 dominio/DB + 2 distribución + 51 UI), build, tauri:build y test:native aprobados. Release x64 e instalador NSIS de 1.992.441 bytes generados. Dos procesos nativos distintos (33060 y 30512), igualdad exacta de diez tablas y 39 registros de dominio tras reinicio, notas creadas/editadas e historial UI recuperado; alta offline posterior y eliminación cancelada/confirmada sin tocar alumnos/matrículas. Capturas finales de seis vistas a 1100/768/360 px y WebView2 tras reinicio inspeccionadas. Incidencias resueltas, evidencia y límites: docs/OBSERVATIONS.md. CN-009 completa, sin cerrar CN-002/CN-013.

## CN-010: resumen docente

- tests/db/dashboard.test.ts: tres pruebas de calendario local, población inclusiva
  histórica, asistencia incompleta/justificada, tareas recientes/próximas y pendientes
  por fecha de asignación; lecturas semanales con ceros, vacíos, aislamiento entre
  ciclos/grupos y diez tablas sin cambios tras consultar. Dexie v1 intacta.
- tests/ui/dashboard.spec.ts: cuatro pruebas de carga, error con reintento por teclado,
  contexto alternado, accesos rápidos y 1100/768/360 px; offline, cero transacciones
  de escritura al consultar Inicio y cero solicitudes externas. Capturas dashboard-*.png.
- tests/native/persistence.mjs: resumen real por UI antes/después de cierre completo y
  reapertura del mismo release/perfil WebView2 aislado. Snapshot exacto antes/después
  de leer el dashboard. Evidencia native/dashboard-*.png y native/result.json.
- Ejecutar pnpm lint, pnpm format:check, pnpm typecheck, pnpm test, pnpm build,
  pnpm tauri:build y finalmente pnpm test:native. UI limpia test-results; no repetirla
  después de guardar evidencia nativa. Resultados finales: [DASHBOARD.md](docs/DASHBOARD.md).
- No afirma nuevas garantías de persistencia ni valida instalación inicial offline,
  tráfico global de Windows, actualización/desinstalación, backups o lector de pantalla.
  CN-002/CN-013 siguen pendientes.

Resultados finales CN-010 (19/10/2026): lint, format:check, typecheck, test (55
dominio/DB + 2 distribución + 55 UI), build, tauri:build y test:native aprobados.
Release x64 e instalador NSIS de 1.991.736 bytes; PIDs nativos 31904 y 28496,
39 registros de dominio y diez tablas exactamente conservadas. Resumen de cuatro
matrículas, asistencia separada por estado, dos tareas y 35 minutos/3 lecturas
recuperado por UI; lectura del dashboard sin cambios en las diez tablas. Cero
solicitudes externas. Capturas de las tres resoluciones y WebView2 antes/después
del reinicio inspeccionadas. Incidencias y límites en docs/DASHBOARD.md. CN-010
completa; CN-002/CN-013 permanecen pendientes.
