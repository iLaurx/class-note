# CN-007 — Tareas y entregas

Alcance exclusivo: crear/editar tareas por grupo y registrar entregas individuales. Sin calificaciones, adjuntos, eliminación, acciones masivas, Excel, respaldo, CI ni módulos adicionales. Dexie v1 conserva todas sus stores e índices; no hay migración, dependencias, permisos ni cambios de CSP.

## Flujos y reglas

- Seleccionar ciclo/grupo. Crear tarea con título obligatorio recortado, descripción opcional, asignación y entrega opcional. Fechas reales locales dentro del ciclo y entrega igual o posterior a asignación. Hoy solo se propone cuando pertenece al ciclo. Los títulos repetidos se permiten.
- La edición conserva UUID, createdAt y groupId. Sin cambios normalizados no escribe. No traslada tareas ni borra entregas/comentarios. Cambiar asignación exige que todas las entregas persistidas continúen dentro de la población; de lo contrario rechaza la operación completa.
- Listado aislado por grupo, búsqueda de título sin distinción de acentos/mayúsculas y rango inclusivo de asignación. Orden por asignación descendente con UUID como desempate estable. Sin contexto, carga, grupo vacío, sin coincidencias y error con reintento se distinguen.
- Población dinámica: joinedAt <= assignedDate y, cuando existe salida, assignedDate <= leftAt. Incluye matrículas inactivas y fichas archivadas con aviso discreto; no infiere salidas. Esta etapa no guarda una instantánea de destinatarios: corregir el historial puede cambiar la población.
- Entregas incompatibles con la población, incluso referencias de otro grupo o faltantes, aparecen como incidencias identificables con matrícula/entrega, estado y comentario. No se ocultan ni eliminan y su edición queda bloqueada hasta corregir la causa. Se excluyen de los recuentos de población.
- Ausencia de Submission se muestra Pendiente y «Aún no tiene registro guardado». Abrir detalle no escribe. No se interpreta como No entregada ni cambia automáticamente por vencimiento.
- Estados: Pendiente, Entregada, Incompleta y No entregada; comentario opcional. Un comentario con Pendiente se puede guardar. Solo se envían filas modificadas, incluidas las ocultas por filtros; volver al valor inicial normalizado no crea una escritura.
- Recuentos de toda la tarea: cuatro estados, sin captura y total de población. Durante edición se identifican como vista previa (sin captura descuenta las nuevas filas que se guardarían). Filtros por estado/nombre no alteran los recuentos ni pierden borradores. El botón comunica el total de cambios de toda la tarea.
- Cambiar tarea, formulario, sección, ciclo, grupo o historial ofrece continuar editando o descartar explícitamente. Se reutiliza la guarda de CN-006, sin router, guardado automático ni almacenamiento de borradores. Durante escritura se bloquean navegación y doble envío.

## Persistencia, conflictos y errores

Casos y validación en assignmentDomain.ts y Repositories. UI y coordinación en src/features/assignments/. Cada operación captura contexto y tarea explícitos; consultas desmontadas/obsoletas no publican respuestas.

Lectura del detalle y población dentro de una transacción de solo lectura. Guardado de entregas valida contexto activo, tarea, matrícula/población, estado/comentario e instantánea dentro de la misma transacción de escritura. El índice único assignmentId+enrollmentId protege duplicados también bajo concurrencia. Un fallo intermedio revierte inserciones/correcciones del lote completo. No hay borrado ni reinterpretación de datos históricos.

Se comparan identidad, valores y auditoría leídos, además de la tarea que originó el borrador. No se depende únicamente de timestamps. Valores ya idénticos son idempotentes. Las correcciones conservan UUID y createdAt; updatedAt cambia únicamente cuando cambian valores. Una confirmación por lote indica cuántas entregas existentes se corregirán; cancelar no escribe. Filas intactas no se envían ni sobrescriben.

Error de escritura conserva el borrador. Conflicto ofrece revisar entregas guardadas tras descartar explícitamente. Un fallo únicamente en la consulta posterior al commit informa que se guardó, retira los controles de guardado y ofrece repetir solo la lectura. El alta/edición de tarea también distingue confirmación de escritura de error al releer el listado.

## Pruebas y evidencia

- tests/db/assignments.test.ts: reglas temporales/relacionales, alta/edición, títulos repetidos, población inclusiva histórica, lectura sin escritura, incidencias por historial corregido y referencias previas incompatibles/faltantes, comentario pendiente, estados, identidad/auditoría, idempotencia, rollback real intermedio y validación tardía, concurrencia/conflictos, aislamiento, cambio de asignación incompatible y funciones de borrador/recuentos/filtros.
- tests/ui/assignments.spec.ts y tests/helpers/assignment-flow.ts: alta/edición, búsqueda y rango, cuatro estados/comentarios, filtros con cambios ocultos, cancelar/confirmar corrección, protección de formularios y entregas, conflictos entre ventanas, fallos recuperables de escritura/lectura, contexto rápido, teclado y 1100/768/360 px offline. Se actualiza la expectativa del placeholder en navegación y se conservan las pruebas previas.
- tests/native/persistence.mjs: mismo ejecutable release y perfil WebView2 aislado; crea dos tareas y edita una y captura/corrige entregas por UI. Comprueba aislamiento entre tareas/grupos, cierra completamente el proceso y WebView2, reabre el mismo ejecutable/perfil y compara exactamente las diez tablas (UUID, valores, auditoría y relaciones). Recupera estados/comentarios/recuentos por UI y corrige otra entrega offline conservando identidad.
- Evidencia local excluida de Git: test-results/assignments-{1100,768,360}.png y test-results/native/{result.json,first-launch.png,assignments-after-restart.png}. La suite UI limpia test-results: ejecutar test:native al final.

Resultados finales verificados el 19/10/2026:

| Comando           | Resultado                                                 |
| ----------------- | --------------------------------------------------------- |
| pnpm lint         | Aprobado, cero advertencias                               |
| pnpm format:check | Aprobado                                                  |
| pnpm typecheck    | Aprobado                                                  |
| pnpm test         | 40 dominio/DB + 2 distribución + 38 UI aprobadas          |
| pnpm build        | Aprobado, recursos locales                                |
| pnpm tauri:build  | Release x64 e instalador NSIS generados (1.987.035 bytes) |
| pnpm test:native  | Aprobado, cierre completo y reapertura real               |

La evidencia nativa registra procesos distintos (42180 y 26812), origen http://tauri.localhost, 34 registros de dominio antes del cierre e igualdad exacta de las diez tablas después de reabrir el mismo perfil temporal. Las dos tareas creadas por UI, incluida una editada, y sus cuatro entregas conservan datos y comentarios; los recuentos UI recuperados son 1 Pendiente, 1 Entregada, 1 Incompleta, 1 No entregada, 0 sin captura y 4 matrículas. La quinta entrega y tercera tarea del fixture sintético pertenecen a otro grupo. La corrección adicional offline posterior conserva UUID, createdAt y cantidad de entregas, y guarda el comentario nuevo con estado Pendiente.

Se inspeccionaron visualmente las capturas a 1100/768/360 px y el detalle de tareas de WebView2 tras reinicio, sin desbordamiento horizontal. Pruebas de teclado/foco y labels incluidas; no se afirma una auditoría completa con lector de pantalla.

Incidencias resueltas: el primer pnpm test restringido se canceló al no avanzar el servidor local; la ejecución con Edge/localhost autorizado pasó. Se precisaron nombres accesibles de selectores y descripción, y se corrigieron fixtures de filtros/historial y esperas de consulta posterior al commit. El primer empaquetado generó el release pero falló al descargar NSIS por DNS (11001); el reintento autorizado generó el instalador. Rust se añadió solo al PATH del proceso de compilación. No se modificó la red ni se usaron perfiles personales. La suite final completa y la prueba nativa terminaron correctamente.

CN-007 completa según los criterios verificados. CN-002 y CN-013 continúan pendientes.

## Archivos de la etapa

- src/features/assignments/: Assignments.tsx, AssignmentForm.tsx, AssignmentDetail.tsx, assignmentDomain.ts, useSubmissions.ts y useDraftGuard.ts.
- src/db/repositories.ts; src/app/App.tsx y styles.css.
- tests/db/assignments.test.ts; tests/helpers/assignment-flow.ts; tests/ui/assignments.spec.ts y navigation.spec.ts; tests/native/persistence.mjs.
- DATA_MODEL.md, DECISIONS.md, TESTING.md, TASKS.md y este documento. TASKS.md mantiene su regla existente de exclusión de Git.

## Límites

La prueba offline aísla la red del contexto de pruebas una vez cargados los recursos locales; no modifica la red del equipo ni usa perfiles personales. No acredita primer arranque/instalación sin red, tráfico global de Windows, reinicio del sistema, actualización, desinstalación, corte abrupto, backups/restauración ni lector de pantalla. Borradores solo en memoria; salida normal depende del soporte del host a beforeunload, y navegación interna tiene protección explícita. CN-002 y CN-013 permanecen pendientes.

Commit sugerido: `feat: manage assignments and submissions`.
