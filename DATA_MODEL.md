# Modelo de datos preliminar (Dexie / IndexedDB)

> Diseño objetivo, sujeto a evolución **mediante migraciones explícitas**. IDs UUID strings; fechas de día `YYYY-MM-DD`; `createdAt/updatedAt` ISO UTC.

## Entidades

| Store | Campos principales | Unicidad e índices lógicos |
|---|---|---|
| `schoolYears` | `id`, `label`, `startDate`, `endDate`, `archived` | `id`, `&label` |
| `groups` | `id`, `schoolYearId`, `grade`, `name`, `shift?`, `archived` | `id`, `schoolYearId`, `&[schoolYearId+grade+name]` (considerar turno si distingue grupos) |
| `students` | `id`, `firstName`, `lastName`, `active` | `id`, `lastName` (nombres **no** únicos) |
| `enrollments` | `id`, `studentId`, `groupId`, `joinedAt`, `leftAt?`, `status` | `id`, `groupId`, `studentId`, `&[studentId+groupId]` |
| `attendance` | `id`, `enrollmentId`, `date`, `status`, `note?` | `id`, `[enrollmentId+date]` **único** |
| `assignments` | `id`, `groupId`, `title`, `description?`, `assignedDate`, `dueDate?` | `id`, `[groupId+assignedDate]` |
| `submissions` | `id`, `assignmentId`, `enrollmentId`, `status`, `comment?`, `updatedAt` | `id`, `&[assignmentId+enrollmentId]` |
| `readingLogs` | `id`, `enrollmentId`, `date`, `title`, `minutes`, `comment?` | `id`, `[enrollmentId+date]` (admite varias lecturas por día) |
| `studentNotes` | `id`, `enrollmentId`, `date`, `category`, `body` | `id`, `[enrollmentId+date]` |
| `appSettings` | `key`, `value` | `&key` |

**Nota:** en tabla el índice `&` denota unique de Dexie; la implementación concreta deberá asegurar índices compuestos según la API real. No declarar unique sobre todo `[enrollmentId+date]` sin marcar `&` en el schema final.

## Invariantes de negocio
- Ciclo: `startDate <= endDate`; grupo pertenece a un solo ciclo.
- Grado entre 1 y 6 en MVP; no inferir grado del ciclo.
- Cada registro debe pertenecer a matrícula de grupo/ciclo coherente.
- Asistencia única por matrícula/fecha; solo fechas coherentes con ciclo y matrícula según política definida.
- Entrega única por tarea/matrícula, y la matrícula debe ser del grupo dueño de la tarea.
- Para grupos con nombre repetido, definir si `shift` integra la identidad antes de migrar.
- `minutes` de lectura entero no negativo; validar máximos plausibles en UI.
- No eliminar estudiante/ciclo/grupo con datos asociados sin flujo explícito (usar archivo/estado).
- Historial se conserva al cambiar de grado, pues `students` y `enrollments` son separados.
- Estados `attendance`: `present | absent | late | excused`.
- Estados `submission`: `pending | submitted | incomplete | not_submitted`.
- Categorías notas: `academic | participation | behavior | other`.

## Ejemplo de esquema orientativo (NO copiar sin ajustar)
```ts
import Dexie, { type Table } from 'dexie';

export class ClassNoteDB extends Dexie {
  students!: Table<Student, string>;
  enrollments!: Table<Enrollment, string>;
  attendance!: Table<Attendance, string>;
  constructor() {
    super('classnote');
    this.version(1).stores({
      students: '&id, lastName',
      enrollments: '&id, studentId, groupId, &[studentId+groupId]',
      attendance: '&id, &[enrollmentId+date], date',
      // añadir el resto de stores al implementar T02
    });
  }
}
```

**Los tipos `Student`, `Enrollment`, `Attendance` del ejemplo todavía no están definidos.** El agente debe crearlos en tarea específica. Referencias entre stores no son claves foráneas reales de IndexedDB: validar integridad en capa de dominio y transacciones.

## Migraciones
- Versionar store definitions mediante `db.version(n).stores(...).upgrade(...)` cuando haga falta.
- Testear apertura de base anterior, migración y conservación de datos, sin recrearla.
- No modificar el tipo/semántica de un campo sin conversión documentada.
