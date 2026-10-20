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

## ADR-006 — Persistencia v1 y límites de repositorios (CN-003)
**Estado:** implementada y verificada en Windows el 19 de octubre de 2026.

- Dexie 4.4.6 como dependencia de producción; nombre centralizado `classnote`, diez stores v1 sin semillas. Se conserva `org.classnote.desktop`, su origen `http://tauri.localhost`, CSP y configuración del perfil predeterminados de Tauri.
- Unicidad de ciclo por etiqueta y grupo por ciclo/grado/nombre. Turno opcional fuera de identidad v1. Texto recortado sin normalizar mayúsculas/acentos. Booleanos sin índices.
- Repositorios con operaciones explícitas de alta/consulta, contexto de ciclo/grupo/matrícula y validación de `unknown`. Todas las comprobaciones relacionales y escrituras comparten transacción. En esta base pequeña se incluyen las diez stores en cada transacción para simplificar su composición; esto serializa escrituras y deberá medirse antes de optimizar ámbitos.
- Matrícula dentro del ciclo; asistencia dentro de ciclo y matrícula con extremos inclusivos. No hay CRUD de módulos, borrado, estadísticas ni restauración.
- Provider + hook sobre servicio único; apertura compartida entre invocaciones repetidas de StrictMode, carga/error/reintento sin almacenamiento alternativo. Dashboard aún ficticio y sin conexión a los datos guardados.
- Se reutiliza Node Test Runner con soporte de TypeScript de Node 24; `fake-indexeddb` 6.2.6 solo en desarrollo. No se necesitan Vitest ni dexie-react-hooks. Las pruebas UI siguen con Playwright/Edge. CN-002 y CI conservan su alcance pendiente.
- Prueba nativa mediante CDP local y perfil temporal indicado únicamente en variables del proceso de prueba. Código de fixtures/sonda en `tests/`, compilado en memoria; no entra en `dist/` ni requiere APIs/permisos de Tauri. Cierre real y reapertura del ejecutable con igualdad de las diez tablas verificados. Detalles, evidencia y límites: [PERSISTENCE.md](docs/PERSISTENCE.md).

## Decisiones pendientes
- Nombre y ubicación final del perfil persistente WebView2 (pruebas por instalador/actualización).
- Recuperación ante corte eléctrico y fallos de disco (CN-013); restauración transaccional: ADR-015.
- Licencia MIT elegida para v0.1.0: ADR-016.
- Políticas exactas de métricas de asistencia y faltas justificadas.
- Experiencia de desinstalación y preservación de datos.

## ADR-007 — Contexto de trabajo y archivo (CN-004)

- Provider pequeño sobre StorageProvider y repositorios explícitos; una instantánea transaccional contiene ciclos, grupos y selección. Las operaciones UI se serializan con bloqueo inmediato y controles deshabilitados durante carga/escritura. No se lanzan consultas independientes por ciclo que puedan resolver fuera de orden.
- Configuración mantiene su propio ciclo de consulta; no altera la selección global. Los consumidores reciben schoolYearId/groupId explícitos y los repositorios no consultan silenciosamente preferencias.
- appSettings usa dos claves escalares: work.schoolYearId y work.groupId (UUID o null). Sin preferencias iniciales, ni localStorage/sessionStorage, ni cambios de esquema/dependencias.
- Archivo y saneamiento de selección comparten transacción. Un ciclo archivado no modifica archived de sus grupos. Reactivar nunca selecciona automáticamente un registro. Registros archivados se consultan pero requieren reactivación antes de editar.
- Ediciones conservan UUID/createdAt; guardar sin cambios conserva updatedAt. Cambiar propietario de grupo se rechaza. Reducir fechas verifica matrículas y asistencias dentro de la escritura transaccional; no se añaden restricciones temporales a los demás módulos.

## ADR-008 — Ficha global frente a baja de matrícula (CN-005)

- Student conserva identidad en distintos ciclos/grados; Enrollment conserva cada pertenencia. No se trasladan referencias ni se fusionan homónimos. El alta conjunta es atómica.
- Baja del grupo solo desactiva esa matrícula. Archivo global exige confirmación nominal con cantidad de matrículas activas y desactiva ficha y dichas matrículas atómicamente, sin modificar fechas ni registros educativos. Reactivación global no tiene cascada.
- Una matrícula por alumno/grupo, sin periodos adicionales de reingreso. La reactivación confirma el intervalo y permite retirar la salida expresamente, siempre protegiendo asistencias inclusivas. No hay traslados ni promoción automática.
- La lista consulta solo el grupo explícito. Las fichas globales se consultan intencionalmente para alta/matriculación o detalle; permiten distinguir homónimos mediante UUID, fecha de creación y pertenencias. No se añaden datos personales.
- El cambio de contexto desmonta formularios/detalles y avisa; las escrituras reciben el destino explícito. Respuestas antiguas se ignoran. Bloqueo inmediato previene doble envío; un fallo de consulta posterior a una escritura confirmada no invita a repetir el alta.
- Esquema v1, dependencias, permisos, perfil, identifier y CSP sin cambios. No hay CI ni módulos de seguimiento nuevos.

## ADR-009 — Asistencia por día, borradores y concurrencia (CN-006)

- Se conserva Dexie v1. El día usa fecha local real y contexto explícito; la población depende solo del intervalo inclusivo de matrícula, incluso inactiva o con ficha archivada. La ausencia de salida no se infiere de updatedAt.
- «Sin registrar» pertenece a UI y no produce filas. Se permite captura parcial; notas sin estado siguen pendientes. No existe borrado de asistencia en esta etapa.
- Guardado diario transaccional sobre operaciones existentes; validaciones temporales, relaciones, archivo de ciclo/grupo y escrituras comparten transacción. Solo se envían cambios, conservando UUID/createdAt y actualizando updatedAt en correcciones. Confirmación única con cantidad de correcciones.
- Concurrencia optimista por instantánea de campos e identidad, no solo timestamps. Rechazo explícito del lote completo ante conflicto; valores ya idénticos son idempotentes. Sin sobrescritura silenciosa de filas intactas.
- Borrador exclusivamente en memoria, asociado a ciclo/grupo/fecha. Guardas pequeñas para navegación hash/historial y selector de contexto; sin router adicional ni almacenamiento alternativo. Consultas obsoletas descartadas y doble envío bloqueado. Errores posteriores al commit piden releer, sin volver a enviar escrituras.
- Recuentos diarios separados para los cuatro estados y pendientes. Porcentajes por periodo aplazados hasta definir denominadores, días sin captura y tratamiento de retardos. Sin reglas SEP o feriados.

## ADR-010 — Población dinámica y entregas parciales (CN-007)

- Se conserva Dexie v1. Tareas por grupo con fechas locales reales dentro del ciclo, entrega opcional no anterior a asignación y títulos repetidos permitidos. Grupo propietario e identidad inmutables; cambio de asignación exige conservar la población de todas las entregas existentes.
- Destinatarios derivados del intervalo inclusivo de matrícula en la asignación, sin instantánea persistida. Estados históricos no excluyen destinatarios. Correcciones posteriores de historial pueden producir incidencias: se muestran identificadas, conservan datos y bloquean edición incompatible hasta corregir la causa. No se deducen salidas de auditoría.
- Sin Submission significa Pendiente sin captura, sin escritura al abrir y sin vencimiento automático. Un comentario con Pendiente sí permite guardar. Solo filas modificadas; filtros no pierden borradores ni excluyen cambios del guardado. Recuentos globales identificados como vista previa durante edición.
- Guardado transaccional e índice único existente; validación de contexto, relaciones/población y campos dentro de la escritura. Conflictos por instantáneas de valores/identidad/auditoría más tarea leída. Idempotencia para valores iguales, corrección confirmada una vez por lote, sin sobrescritura silenciosa ni borrados.
- UI reutiliza guarda de navegación/contexto de CN-006; formularios y entregas exclusivamente en memoria, respuestas obsoletas ignoradas y doble envío bloqueado. Fallo después del commit permite únicamente releer. Sin dependencias, permisos, CSP, router ni módulos adicionales. Alcance y evidencia: docs/ASSIGNMENTS.md.

## ADR-011 — Lecturas independientes y semana civil (CN-008)

- Se conserva Dexie v1 y el índice no único readingLogs.[enrollmentId+date]. Cada alta es una lectura independiente, incluso con contenido idéntico el mismo día. Doble envío se bloquea inmediatamente en el formulario; no se deduplica por contenido ni se impone un máximo diario acumulado.
- Minutos enteros entre 0 y 1440 por entrada. Fecha real local dentro del ciclo y matrícula inclusivos; historial inactivo/archivado válido sin inferir salida. Escrituras con IDs explícitos validan referencias e intervalos dentro de transacción; sin cambios de políticas de otros módulos.
- Edición conserva propietario/UUID/createdAt y compara instantánea completa, no solo timestamps. Sin cambios normalizados no escribe. Corrección confirmada, conflicto explícito sin sobrescritura y borrador protegido mediante guarda existente. Commit confirmado seguido de lectura fallida solo permite releer.
- Semana gregoriana completa de lunes a domingo por aritmética civil sin UTC. Resumen del grupo independiente del historial filtrado, con suma y número de entradas incluidos ceros. Sin métricas adicionales, campos nuevos, dependencias ni permisos. Evidencia y límites: docs/READING.md.

## ADR-012 — Observaciones privadas, propiedad y borrado (CN-009)

- Dexie v1 intacta, sin dependencias, permisos ni cambios de perfil/origen. studentNotes conserva fecha civil local, matrícula, categoría cerrada y texto. No conecta con dashboard, resumen ni reportes. Privada significa nota local del docente; no implica cifrado ni autenticación adicionales.
- Historial del grupo explícito, incluidas matrículas inactivas/fichas archivadas relacionadas válidamente. Nuevas notas y correcciones dentro del ciclo/matrícula inclusivos; grupo/ciclo archivados requieren reactivación para escribir. Notas anteriores conservadas; no se amplía la política de otros módulos ni se inventan migraciones.
- Edición con propietario inmutable y comparación optimista completa, sin escritura al guardar valores iguales. Borrado individual confirmado con nombre/fecha; compara instantánea para evitar borrar una corrección ajena. No aplica la validación temporal al borrar historia previa, pero sí las referencias/contexto y la propiedad. Cancelar no escribe.
- Formulario en memoria asociado al contexto; reutiliza guarda de navegación/contexto, confirmación nativa accesible y bloqueo de doble envío. Consultas obsoletas descartadas. Commit confirmado seguido de lectura fallida reintenta solo consulta; errores de escritura conservan borrador. Evidencia y límites: docs/OBSERVATIONS.md.

## ADR-013 — Resumen de lectura por contexto y periodos explícitos (CN-010)

- Inicio usa una instantánea readonly de Dexie con ciclo/grupo/día explícitos; componentes sin acceso a tablas. Mocks retirados también de la barra lateral. Sin esquema, permisos, dependencias ni escrituras nuevas.
- Matrículas y asistencia de hoy reutilizan los intervalos inclusivos de CN-006, incluso historia inactiva/archivada; fuera del ciclo se explica la ausencia de población/asistencia. Cuatro estados separados y pendientes de captura, sin porcentajes.
- Agenda de presentación: siete días de asignaciones hasta hoy y siete días de entregas desde hoy, ambos inclusivos. Hasta cinco filas, total visible y acceso al listado completo. Pendientes según CN-007 y población en assignedDate; incidencias conservadas y señaladas. Sin nueva política de evaluación/vencimiento.
- Lecturas de la semana civil completa de CN-008: minutos y registros, incluidos ceros; ausencia de entradas explícita. Fechas locales, refresco al cambiar día, estados de carga/error/reintento y respuestas obsoletas descartadas. Alcance y límites: [DASHBOARD.md](docs/DASHBOARD.md).

## ADR-014 — Reporte de contexto y destino elegido (CN-011)

- Instantánea de solo lectura para ciclo/grupo explícitos, sin schema nuevo.
  Alumnos incluye todas las matrículas sin aplicar rango; asistencia y lecturas por
  fecha, tareas por asignación, extremos inclusivos. Fechas como texto DD/MM/AAAA.
  Pendientes derivados sin escritura; entregas históricas del grupo conservadas.
- ExcelJS genera cuatro hojas con cadenas neutralizadas, excluyendo observaciones
  privadas/configuración. No es respaldo restaurable.
- Comando Rust recibe bytes, abre diálogo y escribe en su resultado local; sin
  ruta suministrada por JS ni permisos generales de filesystem. Plugin dialog solo
  en Rust y API core en frontend; Rust mínimo 1.90. Sin cambios de origen/perfil/CSP.
- Contrato, dependencias, permisos y evidencia: [EXCEL_EXPORT.md](docs/EXCEL_EXPORT.md).
- El adaptador NativeFileDialogs inicializa únicamente el estado Rust del plugin:
  no instala su script que transforma window.confirm en Promise ni expone sus IPC.
  Conserva las confirmaciones existentes; serde_json se declara explícitamente para
  la firma Plugin, sin nueva librería en runtime respecto al Tauri transitivo.

## ADR-015 — Respaldo versionado y reemplazo atómico (CN-012)

- dexie-export-import 4.4.1 exporta las diez tablas, incluidas vacías, dentro de un
  sobre JSON ClassNote v1 con appVersion 0.1.0, schemaVersion 1 y createdAt UTC.
  Compatibilidad exacta inicial, sin importar estructuras futuras ni migraciones
  ficticias. Se conserva Dexie v1, UUID, auditoría, origen y perfil WebView2.
- Entrada unknown estricta, conteos y reglas de campos/referencias/intervalos;
  importación en base temporal aislada con índices v1, igualdad exacta y validación
  repetida. Solo se admite Typeson undef en opcionales conocidos. Datos incompatibles
  o incidencias históricas inválidas se rechazan, sin reparaciones silenciosas.
- Previsualización, confirmación expresa y respaldo previo obligatorio elegido y
  guardado antes de tocar la base activa. Cancelación/error abortan; archivos no se
  eliminan. Comparación de la base con la instantánea respaldada dentro de la
  transacción final impide perder cambios ocurridos durante el diálogo.
- Reemplazo en una transacción rw de diez tablas, con rollback total ante excepción.
  Carga posterior separada del commit: ante error solo se reintenta lectura. Contexto
  inválido se descarta con el mecanismo existente, sin seleccionar sustituto.
- Se reutiliza el adaptador Rust de CN-011 con open_backup/save_backup, sin rutas
  suministradas por JS ni permisos generales. Archivos UTF-8 limitados a 100 MiB;
  guardado mediante temporal exclusivo + sync_all + rename en el directorio elegido.
  Sin nuevas dependencias Rust, capabilities ni cambios de CSP. El respaldo no está
  cifrado. No promete durabilidad ante corte, instalación o desinstalación.
- Contrato, pruebas, evidencia y límites: [BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md).
- Auditoría: se validan ambos timestamps UTC y se conservan exactamente. No se
  introduce una restricción de orden entre createdAt y updatedAt: una corrección
  del reloj local puede producir modificación anterior a creación; el modelo de
  escritura actual tampoco impone monotonicidad.

## ADR-016 — Licencia y distribución local v0.1.0 (CN-014)

**Estado:** aceptada por decisión explícita del usuario el 20/10/2026.

- Licencia MIT, titular `ClassNote contributors`; texto estándar en `LICENSE`.
  La licencia se muestra en NSIS y se distribuye con las guías en la instalación.
  No cambia las licencias de las dependencias de terceros.
- Se conserva producto 0.1.0, `org.classnote.desktop`, origen, perfil WebView2
  predeterminado, Dexie v1, permisos y CSP. Solo se añaden metadatos y recursos
  documentales del bundle, sin dependencias nuevas.
- NSIS x64 por usuario, idioma español, sin firma ni publicación. WebView2 no se
  incluye ni descarga (`skip`): debe estar disponible antes de ejecutar ClassNote.
- CN-013 se considera completada por instrucción del usuario. Se conserva intacta
  su matriz histórica y evidencia, incluidos los casos no ejecutados; esa decisión
  no convierte sus pendientes técnicos en pruebas aprobadas de CN-014.
- Procedimiento, aceptación y límites de distribución: [RELEASE_0.1.0.md](docs/RELEASE_0.1.0.md).
