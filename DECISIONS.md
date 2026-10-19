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
- Mecanismo robusto de backup/restauración atómica y estrategia ante interrupciones.
- Licencia MIT vs otra, antes de publicar.
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
