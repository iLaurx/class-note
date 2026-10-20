# CN-006 — Asistencia diaria

Alcance exclusivo de CN-006. UI en `src/features/attendance/`, casos de lectura/guardado en los repositorios existentes e integración pequeña con navegación y contexto. Sin dependencias, stores, índices, migraciones, permisos ni cambios de CSP. Dexie conserva v1. CN-002 y CN-013 siguen pendientes.

## Uso y reglas

1. Seleccionar ciclo y grupo globales. Elegir un día real dentro del ciclo; hoy solo se propone si pertenece al intervalo. Se usan componentes de fecha locales, sin convertir el día a UTC. No hay reglas de fines de semana, feriados o SEP.
2. El listado completo incluye las matrículas del grupo con `joinedAt <= date <= leftAt`, con salida opcional y extremos inclusivos. Incluye matrículas inactivas y fichas archivadas, indicadas en cada fila. Una matrícula inactiva sin salida se presenta como «Sin salida registrada»; no se deduce una baja de la auditoría.
3. Elegir Presente, Falta, Retardo o Falta justificada y una nota opcional. «Sin registrar» solo existe en el borrador: no equivale a falta ni se persiste. Un registro existente no se puede retirar desde ese selector.
4. «Marcar todos presentes» afecta al listado completo, conserva notas y no guarda. Pide confirmación si sustituye otros estados. Guardar permite capturas parciales y comunica cuántas filas quedan sin registrar. Las notas escritas sin estado permanecen pendientes hasta elegir uno.
5. Reabrir el día para completar o corregir. Una confirmación por lote indica cuántos registros existentes cambiarán; cancelar no escribe. Los recuentos separan los cuatro estados, sin registrar y total; los borradores se identifican como vista previa.
6. Cambiar fecha, ciclo, grupo o sección exige descartar explícitamente un borrador o continuar editándolo. Navegación por historial incluida. Durante el guardado se bloquean cambios de destino y doble envío. No hay guardado automático ni borradores en localStorage.

## Transacciones, conflictos y errores

`loadAttendanceDay` obtiene alumnos, matrículas y registros en una lectura transaccional. `saveAttendanceDay` valida entradas unknown, ciclo/grupo escribibles, relaciones, fecha y cada estado/nota dentro de la misma transacción que las escrituras. Reutiliza `createAttendance` para filas nuevas. El índice único v1 protege matrícula/fecha.

Se envían solo filas modificadas con estado. Las correcciones conservan UUID y createdAt; updatedAt cambia al modificar valores. Las filas intactas y sus notas no se sobrescriben. Un fallo de validación, almacenamiento o conflicto revierte todo el lote. No hay borrados.

Cada fila modificada lleva la instantánea leída. Si otro escritor cambió sus valores o identidad, el lote se rechaza expresamente y se conserva el borrador. Comparar valores además de timestamps cubre escrituras durante el mismo milisegundo. Reenviar valores ya idénticos no escribe ni duplica. «Revisar día guardado» permite descartar expresamente y volver a leer antes de resolver el conflicto.

Un fallo de escritura mantiene el borrador; si falla únicamente la consulta después del commit, la UI informa «La asistencia se guardó» y ofrece reintentar solo la lectura, sin repetir el lote. Las notas aún sin estado permanecen pendientes. Cada vista captura schoolYearId, groupId y date; las consultas desmontadas/obsoletas no publican sus resultados.

## Verificación

- `tests/db/attendance.test.ts`: siete casos integrados con fixtures sintéticos para intervalos inclusivos, historia inactiva/archivada, referencias y fechas inválidas, captura parcial/completado, auditoría y notas, idempotencia, conflictos concurrentes, aislamiento y rollback ante fallo real después de una inserción/corrección.
- `tests/ui/attendance.spec.ts` y `tests/helpers/attendance-flow.ts`: captura parcial, notas pendientes, completar, cancelar/confirmar corrección, marcar todos, protección de cambios de destino/historial, errores de escritura/lectura y lectura posterior al commit, alternancia de fechas y tamaños 1100/768/360 px con teclado y red del contexto aislada. Se conservan las pruebas previas.
- `tests/native/persistence.mjs`: crea grupos y alumnos ficticios por UI, captura parcialmente, completa y corrige un día por UI, comprueba otra fecha/grupo, cierra el proceso y todos los WebView2 del perfil aislado y reabre el mismo ejecutable/perfil. Compara las diez tablas completas, UUID, auditoría y relaciones; verifica estados, notas y recuentos por UI y realiza otra escritura de asistencia offline.

La suite UI limpia `test-results`; ejecutar la prueba nativa al final. Evidencia local excluida de Git: `test-results/attendance-*.png`, `test-results/native/result.json`, `first-launch.png` y `attendance-after-restart.png`.

Resultados finales verificados el 19/10/2026:

| Comando             | Resultado                                               |
| ------------------- | ------------------------------------------------------- |
| `pnpm lint`         | Aprobado, cero advertencias                             |
| `pnpm format:check` | Aprobado                                                |
| `pnpm typecheck`    | Aprobado                                                |
| `pnpm test`         | 30 dominio/DB + 2 distribución + 29 UI aprobadas        |
| `pnpm build`        | Aprobado                                                |
| `pnpm tauri:build`  | Release x64 e instalador NSIS de 1,89 MiB generados     |
| `pnpm test:native`  | Aprobado, cierre completo y reapertura con PID distinto |

La evidencia nativa registra PIDs 40740 y 22616, origen `http://tauri.localhost`, contexto offline y conservación exacta de las diez tablas (28 registros de dominio antes del cierre). Se recuperaron por UI cuatro asistencias del grupo, con dos presentes, cero faltas, un retardo y una justificada, total cuatro y cero sin registrar. Las notas históricas y las escritas durante la captura parcial se conservaron. La asistencia sintética de otro grupo quedó aislada. La escritura posterior al reinicio añadió un registro en otra fecha; archivo/reactivación posterior conservó todas las relaciones. Se inspeccionaron las capturas a 1100/768/360 px y la captura nativa tras reinicio.

Incidencias resueltas durante implementación: la ejecución UI restringida no avanzó y se canceló; el reintento autorizado con acceso a Edge/localhost pasó. Se precisó el nombre accesible de los selectores, se conservó «Volver a Inicio» para los accesos rápidos existentes y se ajustó la prueba de historial para ejercer un cambio real de sección. Las suites finales completas quedaron verdes. Para Rust se añadió `C:\Users\ele\.cargo\bin` solo al entorno del proceso de compilación. No se modificó la red del equipo ni los perfiles personales.

## Archivos

- Funcionalidad: `src/features/attendance/Attendance.tsx`, `attendanceDomain.ts`, `useAttendance.ts`.
- Integración: `src/app/App.tsx`, `WorkContextSelector.tsx`, `useNavigation.ts`, `pendingChanges.ts`, `styles.css` y `src/db/repositories.ts`.
- Pruebas: `tests/db/attendance.test.ts`, `tests/helpers/attendance-flow.ts`, `tests/ui/attendance.spec.ts`, `tests/ui/navigation.spec.ts` y `tests/native/persistence.mjs`.
- Documentación: este archivo, `DATA_MODEL.md`, `DECISIONS.md`, `TESTING.md` y `TASKS.md`. `AGENTS.md` ya contiene el flujo autorizado de trabajo directo en main; se conserva el resto. `AGENTS.md` y `TASKS.md` siguen ignorados por la política existente de Git.

## Límites

No se promete recuperación del borrador tras cierre forzado ni persistencia del borrador. El aviso de salida normal depende del soporte del host a beforeunload; la protección de navegación/contexto dentro de la app es explícita. No hay porcentajes por periodo: faltan políticas de denominadores, días sin captura y retardos. Las faltas justificadas no se cuentan como presentes.

El aislamiento de red solo corresponde al contexto de prueba después de cargar recursos locales; no desconecta el equipo ni demuestra ausencia de tráfico de Windows. No cubre instalación inicial offline, reinicio de Windows, actualización, desinstalación, corte abrupto, respaldo/restauración ni lector de pantalla. Esos límites de hardening siguen en CN-013. No se implementan tareas, Excel, backups ni métricas del dashboard.
