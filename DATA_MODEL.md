# Modelo de datos implementado — Dexie v1 (CN-003)

> Implementación: `src/domain/models.ts` y `src/db/database.ts`. Base estable `classnote`, esquema `db.version(1)`. IDs UUID generados internamente; fechas de día `YYYY-MM-DD` locales y reales; todas las entidades de dominio incluyen `createdAt/updatedAt` ISO UTC. `appSettings` no lleva ID ni auditoría.

## Entidades

| Store | Campos principales | Unicidad e índices lógicos |
|---|---|---|
| `schoolYears` | `id`, `label`, `startDate`, `endDate`, `archived` | `id`, `&label` |
| `groups` | `id`, `schoolYearId`, `grade`, `name`, `shift?`, `archived` | `id`, `schoolYearId`, `&[schoolYearId+grade+name]` |
| `students` | `id`, `firstName`, `lastName`, `active` | `id`, `lastName` (nombres **no** únicos) |
| `enrollments` | `id`, `studentId`, `groupId`, `joinedAt`, `leftAt?`, `status` | `id`, `groupId`, `studentId`, `&[studentId+groupId]` |
| `attendance` | `id`, `enrollmentId`, `date`, `status`, `note?` | `id`, `&[enrollmentId+date]` |
| `assignments` | `id`, `groupId`, `title`, `description?`, `assignedDate`, `dueDate?` | `id`, `groupId`, `[groupId+assignedDate]` |
| `submissions` | `id`, `assignmentId`, `enrollmentId`, `status`, `comment?` | `id`, `assignmentId`, `enrollmentId`, `&[assignmentId+enrollmentId]` |
| `readingLogs` | `id`, `enrollmentId`, `date`, `title`, `minutes`, `comment?` | `id`, `[enrollmentId+date]` (admite varias lecturas por día) |
| `studentNotes` | `id`, `enrollmentId`, `date`, `category`, `body` | `id`, `[enrollmentId+date]` |
| `appSettings` | `key`, `value` | `key` (clave primaria única) |

`&` indica índice único; todas las claves primarias son únicas sin marcador adicional. Los índices compuestos permiten consultas por su prefijo: por ejemplo `enrollmentId` en asistencia, lecturas y notas. Ningún booleano está indexado. Las diez stores comienzan vacías, incluida configuración. Los mocks nunca se insertan.

## Invariantes de negocio
- Ciclo: `startDate <= endDate`; grupo pertenece a un solo ciclo.
- Grado entre 1 y 6 en MVP; no inferir grado del ciclo.
- Cada registro debe pertenecer a matrícula de grupo/ciclo coherente.
- Matrícula con fechas dentro del ciclo: `startDate <= joinedAt <= leftAt <= endDate` cuando hay salida; sin salida, el límite superior es el fin del ciclo. Asistencia única por matrícula/fecha; debe pertenecer al ciclo y al intervalo de matrícula. Ambos extremos son inclusivos, incluida `leftAt`. Se admite registrar historia de una matrícula inactiva dentro de su intervalo.
- Entrega única por tarea/matrícula, y la matrícula debe ser del grupo dueño de la tarea.
- `shift` es opcional y no forma parte de la identidad del grupo en v1. Nombres y etiquetas se recortan en los extremos; su unicidad es sensible a mayúsculas/acentos, sin normalización adicional.
- `minutes` de lectura entero entre 0 y 1440 por entrada, validado en UI y repositorio. Sin límite diario acumulado adicional ni deduplicación por contenido.
- No eliminar estudiante/ciclo/grupo con datos asociados sin flujo explícito (usar archivo/estado).
- Historial se conserva al cambiar de grado, pues `students` y `enrollments` son separados.
- Estados `attendance`: `present | absent | late | excused`.
- Estados `enrollment`: `active | inactive`, obligatorios al crear. Los indicadores `archived` y `active` son booleanos; por defecto falso y verdadero respectivamente.
- Estados `submission`: `pending | submitted | incomplete | not_submitted`.
- Categorías notas: `academic | participation | behavior | other`.

## Esquema implementado
```ts
schoolYears: 'id, &label'
groups: 'id, schoolYearId, &[schoolYearId+grade+name]'
students: 'id, lastName'
enrollments: 'id, studentId, groupId, &[studentId+groupId]'
attendance: 'id, &[enrollmentId+date]'
assignments: 'id, groupId, [groupId+assignedDate]'
submissions: 'id, assignmentId, enrollmentId, &[assignmentId+enrollmentId]'
readingLogs: 'id, [enrollmentId+date]'
studentNotes: 'id, [enrollmentId+date]'
appSettings: 'key'
```

Los tipos están definidos y las referencias se validan en repositorios dentro de la misma transacción que la escritura; IndexedDB no proporciona claves foráneas. Las lecturas y notas admiten varias entradas por matrícula/fecha. La fecha de entrega de tarea, si existe, no precede a la asignación. Las políticas temporales implementadas en CN-007 y CN-008 se describen abajo; notas conserva únicamente la validación de fecha real.

`appSettings.value` admite valores JSON escalares (`string | number | boolean | null`), con números finitos. No se permiten objetos arbitrarios ni se escriben preferencias iniciales. Las entradas de creación se reciben como `unknown`, se validan y se reconstruyen; IDs y auditoría externos no se copian.

## Migraciones
- Versionar store definitions mediante `db.version(n).stores(...).upgrade(...)` cuando haga falta.
- Testear apertura de base anterior, migración y conservación de datos, sin recrearla.
- No modificar el tipo/semántica de un campo sin conversión documentada.
- CN-003 introduce la primera versión; no hay v0 ni migración ficticia. Se prueba reapertura v1 con datos relacionados y conservación exacta de valores/IDs. Un cambio futuro conserva la declaración v1, añade una versión mayor y prueba la migración desde v1 poblada antes de publicarse.

## CN-004: preferencias y modificaciones sin migración

Se conserva Dexie v1 y todos sus índices. appSettings incorpora, solo tras acción del usuario o saneamiento de una referencia guardada inválida:

| Clave | Valor |
|---|---|
| work.schoolYearId | UUID string de ciclo activo o null |
| work.groupId | UUID string de grupo activo del ciclo seleccionado o null |

Ambas claves se guardan atómicamente. Un perfil sin acciones mantiene las diez tablas vacías. Al abrir se descartan referencias inexistentes, archivadas, no escalares válidas o incompatibles; se conserva el ciclo válido cuando solo falla el grupo. No se elige reemplazo.

Actualización explícita de ciclos y grupos: entrada unknown, unicidad comprobada en aplicación más índices únicos de v1, UUID/createdAt inmutables. updatedAt cambia solo si hay cambios persistidos. No se edita un archivado ni un grupo de ciclo archivado. El ciclo propietario del grupo es inmutable. Turno continúa fuera de la identidad; no se normalizan mayúsculas/acentos.

Las fechas nuevas del ciclo deben contener joinedAt, leftAt y las asistencias de sus matrículas, incluidos grupos archivados. Comprobación y escritura comparten transacción. No se recorta, elimina ni reasigna historia. Archivo conserva todas las relaciones y no cambia estados individuales de grupos al archivar su ciclo. Archivo del contexto seleccionado sanea las preferencias en la misma transacción.

## CN-005: identidad, matrículas y archivo sin migración

Se conservan stores e índices de Dexie v1. Student es la ficha global única; los nombres y apellidos recortados son requeridos, admiten homónimos y conservan mayúsculas/acentos. Editar conserva UUID y createdAt; updatedAt registra el guardado. La búsqueda ignora mayúsculas/acentos solo en la proyección UI.

Crear ficha con matrícula es una transacción única. Crear/reactivar matrícula exige alumno, grupo y ciclo activos. La identidad studentId/groupId de una matrícula es inmutable; continuar en otro ciclo/grado crea otra Enrollment para el mismo Student. El índice único studentId+groupId impide duplicados incluso concurrentes. No se restringen matrículas en grupos distintos.

joinedAt y leftAt opcional deben ser fechas reales dentro del ciclo, ordenadas. Corregirlas o reactivar verifica las asistencias existentes dentro del intervalo inclusivo resultante en la misma transacción. No se borran ni recortan relaciones. La baja cambia solo status de esa matrícula y no inventa leftAt. La reactivación conserva UUID y exige confirmar fechas; retirar leftAt es explícito.

Archivar Student usa active=false y cambia sus matrículas activas a inactive en una sola transacción, conservando fechas y todas las relaciones. Reactivar Student no reactiva matrículas. No hay borrado físico, reasignación, fusión ni periodos múltiples: una matrícula por alumno/grupo representa un único intervalo; reingresos separados quedan fuera de CN-005.

## CN-006: captura parcial y correcciones sin migración

Dexie v1 y el índice único attendance.enrollmentId+date permanecen intactos. El listado del día incluye todo intervalo inclusivo del grupo, sin excluir estados históricos inactivos ni Student.active=false. La salida ausente permanece indefinida, incluso tras archivo/baja.

«Sin registrar» es UI, nunca un quinto estado persistido ni una falta implícita. Guardar parcialmente inserta solo filas seleccionadas; no elimina registros al vaciar un selector. Estado y nota se validan desde unknown. El ciclo/grupo debe admitir escritura y cada fecha debe pertenecer al ciclo/matrícula en la misma transacción que guarda el lote.

Corregir conserva id/createdAt y cambia updatedAt únicamente cuando hay valores distintos; no se tocan filas intactas ni otras fechas/grupos. Comparación optimista de identidad, auditoría, estado y nota detecta cambios concurrentes; el conflicto revierte el lote completo. Los valores ya iguales son idempotentes. La instantánea esperada y las confirmaciones son parámetros de operación y no campos nuevos de asistencia.

No hay schema nuevo ni migración necesaria. Los recuentos diarios separan present, absent, late, excused y filas sin registrar; estas últimas solo se derivan del listado del día. No hay métricas por periodo ni política que equipare excused a present.

## CN-007: tareas y entregas sin migración

Dexie v1 permanece intacta, incluido el índice único submissions.[assignmentId+enrollmentId]. Tarea pertenece a grupo/ciclo activo para escribir; título recortado obligatorio (no único), descripción opcional, asignación local real dentro del ciclo y entrega opcional entre asignación y fin del ciclo. Editar conserva identidad/grupo/createdAt; updatedAt solo cambia al modificar valores. Cambiar asignación rechaza entregas persistidas fuera de la población resultante, dentro de la misma transacción.

Población dinámica por intervalo inclusivo de matrícula en assignedDate; ignora estados de actividad para la pertenencia histórica y no infiere leftAt. Sin instantánea de destinatarios. Corregir el historial puede cambiarla: entregas incompatibles se conservan, aparecen como incidencias y se bloquean para editar. No se reinterpreta ni elimina ninguna entrega.

Ausencia de Submission es Pendiente sin captura, solo en UI; no produce filas al consultar ni se convierte en No entregada por vencimiento. Comentario con Pending se puede persistir. Guardado atómico de filas modificadas, instantáneas optimistas por identidad/valores/auditoría y tarea leída, correcciones confirmadas conservando UUID/createdAt e idempotencia ante valores iguales. Sin campos nuevos, migración, porcentajes ni calificaciones.

## CN-008: lecturas por matrícula sin migración

Dexie v1 conserva readingLogs y su índice compuesto no único enrollmentId+date. Fecha real local dentro del ciclo y matrícula, extremos inclusivos; fichas archivadas/matrículas inactivas admiten historia sin deducir salida. Título recortado obligatorio; minutos enteros de 0 a 1440 por entrada, sin máximo diario acumulado; comentario opcional. Lecturas idénticas son registros distintos.

Alta/edición validan contexto activo, ficha, referencias e intervalo dentro de la transacción. Matrícula propietaria, UUID y createdAt inmutables; updatedAt cambia solo si cambian campos. Edición con instantánea de identidad, valores y auditoría exige conflicto explícito ante cambios concurrentes; no hay borrado. Las correcciones posteriores de ciclos/matrículas no introducen cascadas ni reinterpretación; al editar lectura se valida el intervalo actual.

Historial individual por fecha descendente y UUID ascendente; rango inclusivo. Semana gregoriana local completa de lunes a domingo, sin UTC, incluso al cruzar mes/año. Totales por matrícula y grupo incluyen todas las entradas y ceros, independientes del filtro del historial. Son proyecciones, no campos nuevos ni métricas persistidas. Detalles: docs/READING.md.
