# CN-009 — Observaciones privadas por alumno

Alcance exclusivo: alta, consulta, edición y eliminación individual de notas por matrícula. Dexie v1 conserva diez tablas e índices, identifier, origen, perfil y permisos. Sin dependencias nuevas, contactos, adjuntos, categorías adicionales, métricas ni conexión al dashboard/resumen/reportes. Los datos sintéticos de pruebas nunca se cargan al arrancar el producto.

## Uso y reglas

Seleccionar ciclo/grupo. El historial muestra alumno, fecha, categoría, texto y condición de matrícula/ficha. Incluye matrículas inactivas y fichas archivadas con relación válida. Buscar por nombre/texto ignora mayúsculas y acentos; combinar filtros por matrícula, categoría y extremos inclusivos de fecha. Orden por fecha descendente y UUID ascendente. La consulta no escribe. Se distinguen falta de contexto/matrículas, sin observaciones, sin coincidencias, carga y error recuperable.

Registrar exige matrícula del grupo, fecha civil local real YYYY-MM-DD dentro del ciclo y matrícula inclusivos, categoría Académica/Participación/Conducta/Otra y texto no vacío recortado. Sin salida registrada limita el fin del ciclo. No hay conversión de fechas escolares a UTC ni unicidad por día. Editar conserva propietario (selector deshabilitado), UUID y createdAt. Guardar valores normalizados iguales conserva updatedAt y no escribe. Corregir historial solicita confirmación nominal y fecha original.

Eliminar abre confirmación nativa de Windows/navegador con alumno y fecha, accesible por teclado. Cancelar no escribe. Confirmar elimina solo esa nota sin cascadas; la relación y el contexto se vuelven a validar y se rechaza una instantánea obsoleta. No exige que una nota anterior siga dentro del intervalo actual para poder retirarla. No hay borrado de alumno/matrícula ni restauración/deshacer prometidos.

## Implementación y recuperación

UI en src/features/notes/{Observations,NoteForm}.tsx; reglas/proyección en notesDomain.ts; operaciones explícitas en src/db/repositories.ts. UI no accede a tablas. Se reutilizan StorageProvider, WorkContextProvider, estilos, fecha local, presentación de alumnos y useDraftGuard. La guarda compartida tiene un único propietario activo: listado durante operaciones o formulario durante el borrador. Cada operación recibe IDs explícitos de ciclo/grupo/matrícula; validaciones de referencias y escritura comparten transacción Dexie. Consultas de grupo transaccionales y respuestas obsoletas descartadas al cambiar contexto.

Edición/borrado comparan valores, identidad y auditoría de la instantánea; conflictos explícitos incluso con timestamps iguales. Borrador solo en memoria, protegido en navegación, historial y cambio de ciclo/grupo. Bloqueos inmediatos impiden doble envío y cambio de destino durante escrituras. Errores de escritura conservan campos; después del commit se informa guardado/eliminación y un fallo posterior ofrece reintentar únicamente lectura. Descartar formulario relee la información actual para resolver conflictos. No hay almacenamiento alternativo.

Privadas significa notas locales del docente, sin publicación ni conexión a otras funciones; no implica cifrado ni protección adicional frente a usuarios de Windows. Aplican SECURITY.md y sus reglas para perfil y respaldos.

## Verificación

- tests/db/notes.test.ts: cinco casos integrados con fixtures aislados: alta, recorte, edición/no-op/identidad, concurrencia, categorías/fechas/referencias/contexto, extremos inclusivos, historial inactivo/archivado, aislamiento, filtros/orden, cancelación sin escritura, borrado sin cascadas y rollback real después de alta/edición/eliminación.
- tests/ui/notes.spec.ts y tests/helpers/notes-flow.ts: formularios, búsqueda/filtros, protección de borrador ante navegación/historial/ciclo/grupo, confirmaciones canceladas/aceptadas, errores de escritura/consulta y consulta posterior al commit, doble envío, conflicto entre ventanas. Siete pruebas; UI offline, labels/teclado/foco y ausencia de desbordamiento a 1100/768/360 px. Se conserva la suite previa y se actualiza solo el placeholder de Observaciones.
- tests/native/persistence.mjs: crea/edita notas por UI, cierra completamente ejecutable/WebView2 y reabre mismo release/perfil aislado; compara diez tablas exactas con identidad/auditoría/relaciones; verifica historial recuperado y alta/eliminación cancelada/confirmada offline posteriores.
- Evidencia local excluida de Git: `test-results/notes-*.png`, `notes-form-*.png`, `native/notes-after-restart.png` y `native/result.json`. Ejecutar nativa al final porque UI limpia test-results.

Resultados verificados el 19/10/2026: lint (cero advertencias), format:check, typecheck y build aprobados. pnpm test completo: 52 dominio/DB + 2 distribución + 51 UI aprobadas, incluidas siete UI de CN-009. Se inspeccionaron seis capturas de listado/formulario a 1100/768/360 px, sin desbordamiento horizontal; teclado, foco y labels comprobados. La compilación release e instalador NSIS x64 (1.992.441 bytes) también aprobaron. pnpm test:native final aprobado con PIDs distintos (33060 y 30512), perfil WebView2 temporal aislado, origen http://tauri.localhost y red del contexto aislada. Cierre completo/reapertura conserva exactamente diez tablas con 39 registros de dominio, UUID, auditoría y relaciones. Recupera las dos notas creadas por UI, incluida la corregida, además de la nota del fixture de otro grupo. Una nueva nota offline posterior incrementa el conteo, cancelar eliminación conserva la tabla exacta y confirmar elimina solo esa nota; alumnos/matrículas y notas anteriores permanecen iguales. Se inspeccionó native/notes-after-restart.png. CN-009 completa con evidencia; CN-002/CN-013 mantienen su alcance pendiente.

| Comando             | Resultado final                                  |
| ------------------- | ------------------------------------------------ |
| `pnpm lint`         | Aprobado, cero advertencias                      |
| `pnpm format:check` | Aprobado                                         |
| `pnpm typecheck`    | Aprobado                                         |
| `pnpm test`         | 52 dominio/DB + 2 distribución + 51 UI aprobadas |
| `pnpm build`        | Aprobado                                         |
| `pnpm tauri:build`  | Release e instalador NSIS x64 generados          |
| `pnpm test:native`  | Aprobado, cierre completo y reapertura real      |

La primera ejecución UI restringida no alcanzó el preview local y se canceló. El reintento con acceso autorizado a Edge/localhost aprobó los seis casos iniciales. Después se añadió la prueba de borrado con fallo de escritura, conflicto y lectura fallida posterior al commit; la suite final completa aprobó los siete casos de CN-009. Advertencias NO_COLOR/FORCE_COLOR del runner sin fallos de aplicación. El primer empaquetado generó el release pero falló al descargar NSIS por DNS (11001); el reintento autorizado produjo el instalador. Rust se añadió solo al PATH del proceso. La revisión final ajustó la propiedad de la guarda de navegación al alternar listado/formulario; una repetición detectó que el bloqueo también impedía cambios rápidos de grupo durante consultas (50 UI aprobadas y una fallida a 360 px). Se separó el estado de eliminación del de carga: solo el borrado bloquea navegación; las consultas permiten cambiar contexto y descartan respuestas obsoletas. Una comprobación de lint detectó lectura de ref durante render en el ajuste intermedio; se sustituyó por estado explícito. La suite completa y la prueba nativa finales aprobaron sobre la corrección.

## Archivos de la etapa

- Aplicación: src/features/notes/{Observations.tsx,NoteForm.tsx,notesDomain.ts}, src/db/repositories.ts y src/app/App.tsx.
- Pruebas: tests/db/notes.test.ts, tests/helpers/notes-flow.ts, tests/ui/notes.spec.ts, tests/ui/navigation.spec.ts y tests/native/persistence.mjs.
- Documentación: docs/OBSERVATIONS.md, DATA_MODEL.md, DECISIONS.md, TESTING.md y TASKS.md (local, ignorado por Git). No se modifican AGENTS.md, .gitignore ni el módulo de lecturas. Trabajo directo en main sin commit/push ni operaciones de ramas.

## Límites

Aislamiento offline corresponde al contexto de pruebas y no modifica la red del equipo ni prueba ausencia de tráfico de Windows. Cierre/reapertura de proceso no equivale a instalación/primer inicio offline, reinicio de Windows, actualización/desinstalación, recuperación ante corte, backup/restauración ni auditoría de lector de pantalla. El borrador no persiste ante cierre forzado y beforeunload depende del host. CN-002 y CN-013 conservan sus pendientes.

Commit sugerido: `feat: add student observations`.
