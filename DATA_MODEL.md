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
- `minutes` de lectura entero no negativo; validar máximos plausibles en UI.
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

Los tipos están definidos y las referencias se validan en repositorios dentro de la misma transacción que la escritura; IndexedDB no proporciona claves foráneas. Las lecturas y notas admiten varias entradas por matrícula/fecha. La fecha de entrega de tarea, si existe, no precede a la asignación. No se añaden políticas temporales para lecturas/notas/tareas más allá de fechas reales y orden de tarea; sus etapas decidirán los filtros adicionales.

`appSettings.value` admite valores JSON escalares (`string | number | boolean | null`), con números finitos. No se permiten objetos arbitrarios ni se escriben preferencias iniciales. Las entradas de creación se reciben como `unknown`, se validan y se reconstruyen; IDs y auditoría externos no se copian.

## Migraciones
- Versionar store definitions mediante `db.version(n).stores(...).upgrade(...)` cuando haga falta.
- Testear apertura de base anterior, migración y conservación de datos, sin recrearla.
- No modificar el tipo/semántica de un campo sin conversión documentada.
- CN-003 introduce la primera versión; no hay v0 ni migración ficticia. Se prueba reapertura v1 con datos relacionados y conservación exacta de valores/IDs. Un cambio futuro conserva la declaración v1, añade una versión mayor y prueba la migración desde v1 poblada antes de publicarse.
