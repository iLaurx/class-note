# CN-008 — Lecturas en casa

Alcance: alta y edición de lecturas por matrícula, historial individual y resumen semanal del grupo seleccionado. Sin eliminación, promedios, metas, rachas, Excel, respaldos, dashboard ni observaciones. Se conservan Dexie v1, sus diez tablas, índices, identifier, origen, perfil WebView2, permisos y dependencias.

## Reglas y consulta

- Fecha local real `YYYY-MM-DD` dentro del ciclo y del intervalo de matrícula, con ambos extremos inclusivos. Sin salida registrada, el límite superior es el fin del ciclo. Las matrículas inactivas y fichas archivadas admiten registros históricos válidos; la UI identifica su condición e intervalo sin inferir fechas de auditoría.
- Título o texto leído obligatorio, recortado y no vacío. Comentario opcional recortado. Minutos enteros de **0 a 1440 por entrada**, validados también en el repositorio. No existe máximo diario acumulado adicional.
- Varias lecturas por matrícula y fecha, incluso con título y contenido idénticos, crean entradas independientes. No hay unicidad por matrícula/fecha ni deduplicación de contenido. El bloqueo inmediato del formulario impide el doble envío de una misma operación.
- Historial de una matrícula del grupo explícito, con rango inclusivo opcional. Fecha descendente y UUID ascendente como desempate estable. Rangos inválidos muestran error. Se distinguen falta de contexto, grupo sin matrículas, historial sin coincidencias, carga y fallo de consulta con reintento.
- Semana: **lunes a domingo**, ambos incluidos, calculada mediante aritmética del calendario gregoriano sobre fechas civiles; sin conversión UTC, zona horaria ni desplazamientos de horario de verano. La fecha elegida identifica la semana completa, incluso cuando cruza mes, año o los límites del ciclo. Las fechas inicial/final siempre se muestran.
- Resumen de todas las matrículas del grupo: suma de minutos y cantidad de registros por alumno y total del grupo. Cuenta todas las entradas, incluidas las repetidas y las de cero minutos. Una matrícula sin lecturas muestra cero derivado de sus datos. El resumen es independiente de los filtros del historial y lo indica expresamente.

## Persistencia, edición y recuperación

`src/features/reading/readingDomain.ts` concentra reglas y cálculos. `Reading.tsx` coordina consultas y vistas; `ReadingForm.tsx` gestiona el borrador. Se reutilizan StorageProvider, WorkContextProvider, nombres de alumnos, fechas locales, estilos existentes y `useDraftGuard` de tareas con mensaje específico del módulo.

Cada escritura recibe schoolYearId/groupId/enrollmentId explícitos. Contexto activo, referencias (incluida ficha), pertenencia y fechas se verifican dentro de la misma transacción que escribe. Las consultas de grupo obtienen matrículas, fichas y lecturas en una instantánea de solo lectura. Se ignoran respuestas obsoletas al desmontar/cambiar contexto. No se persisten borradores ni se usa almacenamiento alternativo.

Editar conserva UUID, createdAt y matrícula propietaria; fecha, título, minutos y comentario se pueden corregir. Sin cambios normalizados se conserva updatedAt y no se escribe. Las correcciones solicitan confirmación con alumno y fecha original; cancelar no escribe. Se compara la instantánea completa de identidad, campos y auditoría dentro de la transacción: una edición concurrente se rechaza, conservando el borrador, incluso si comparte timestamp. Cancelar el formulario exige descartar explícitamente y relee los datos guardados para revisar el conflicto.

Los errores de escritura conservan campos. Después de un commit confirmado se cierra el formulario y se comunica «La lectura se guardó». Si falla la consulta posterior, se ofrece **solo repetir la lectura** y no se vuelve a enviar el alta. Cambiar sección, ciclo, grupo o historial con borrador exige continuar editando o descartar. Mientras se escribe, la guarda bloquea la navegación.

No se modifican políticas de edición de ciclos/matrículas de otras etapas. Los registros anteriores se conservan y se consultan; al corregir una lectura se vuelve a validar contra las relaciones e intervalos actuales. No hay borrado, ajuste automático ni migración de registros anteriores.

## Verificación

- `tests/db/reading.test.ts`: entradas idénticas concurrentes sin colisión; cero y 1440, suma diaria superior a 1440; rechazo de negativos, decimales, no finitos, títulos vacíos, fechas irreales y fuera de ciclo/matrícula; extremos inclusivos e historia archivada; propietario inmutable; identidad/auditoría, no-op y conflictos; referencias y aislamiento entre matrículas/grupos/ciclos; orden/filtros; semanas entre meses/años y febrero bisiesto; límites semanales y conteo de ceros.
- `tests/helpers/reading-flow.ts` y `tests/ui/reading.spec.ts`: alta/edición, títulos repetidos, historial, filtros y totales independientes, semana entre años, aislamiento con cambios rápidos de grupo, protección de borradores y corrección cancelada, doble envío, errores recuperables, lectura fallida después del commit y conflicto entre ventanas. UI offline a 1100/768/360 px, teclado/foco, labels, errores de ejecución, solicitudes externas y capturas de formulario/listado. Se conserva la suite anterior y se actualiza la expectativa del placeholder.
- `tests/native/persistence.mjs`: amplía el flujo existente del ejecutable release con lecturas creadas/editadas por UI. Cierra por completo proceso y WebView2, reabre el mismo ejecutable/perfil aislado y compara las diez tablas exactamente (valores, UUID, auditoría, relaciones). Verifica historial y totales recuperados y una nueva lectura de cero minutos offline posterior al reinicio.
- Evidencias sintéticas locales excluidas de Git: `test-results/reading-{1100,768,360}.png`, `reading-form-{1100,768,360}.png`, `native/reading-after-restart.png` y `native/result.json`. Ejecutar la prueba nativa después de UI, que limpia test-results.

Resultados finales verificados el 19/10/2026:

| Comando             | Resultado                                                 |
| ------------------- | --------------------------------------------------------- |
| `pnpm lint`         | Aprobado, cero advertencias                               |
| `pnpm format:check` | Aprobado                                                  |
| `pnpm typecheck`    | Aprobado                                                  |
| `pnpm test`         | 47 dominio/DB + 2 distribución + 44 UI aprobadas          |
| `pnpm build`        | Aprobado, recursos locales                                |
| `pnpm tauri:build`  | Release x64 e instalador NSIS (1.990.169 bytes) generados |
| `pnpm test:native`  | Aprobado, cierre completo y reapertura real               |

La evidencia nativa registra procesos distintos (24388 y 11672), origen `http://tauri.localhost`, 37 registros de dominio antes del cierre e igualdad exacta de las diez tablas después de reabrir. Hay cuatro lecturas previas: una del fixture en otro grupo y tres del grupo trabajado por UI, incluida una editada. El historial individual recupera dos entradas; la semana 2026-10-19 a 2026-10-25 muestra 35 minutos y 3 registros del grupo. La nueva lectura offline de cero minutos después del reinicio incrementa únicamente el conteo a 4 y conserva exactamente todas las lecturas anteriores, incluidos UUID, auditoría y relaciones.

Se inspeccionaron visualmente las seis capturas de formulario/listado a 1100/768/360 px y `native/reading-after-restart.png`; sin desbordamiento horizontal. Las pruebas verifican labels, foco y teclado. No se afirma una auditoría completa con lector de pantalla.

Incidencias resueltas: el entorno restringido bloqueó el preview local y falló la descarga NSIS por DNS (11001); los reintentos autorizados terminaron correctamente. Se precisaron etiquetas accesibles de los selectores y la sincronización/fixture de la prueba del historial: volver a una entrada con el mismo hash no cambia de sección ni requiere descartar un borrador. También se corrigió una expectativa de semana vacía, pues el domingo 1 de noviembre pertenece a la semana que comienza el 26 de octubre. Las ejecuciones finales completas pasaron; no se modificó la red del equipo ni se utilizaron perfiles personales.

CN-008 completa con evidencia de aceptación. CN-002 y CN-013 conservan sus pendientes.

## Límites

El aislamiento offline del contexto de pruebas no modifica la red del equipo ni demuestra ausencia de tráfico de Windows. El reinicio de proceso no acredita instalación/primer inicio sin internet, reinicio de Windows, actualización, desinstalación, corte abrupto ni respaldo/restauración. No se usan perfiles personales. Borradores exclusivamente en memoria; cierre externo depende del soporte de beforeunload del host. La comprobación básica de teclado y contraste no equivale a una auditoría con lector de pantalla. CN-002 y CN-013 mantienen su alcance pendiente.

Commit sugerido: `feat: track home reading`.
