# CN-005 — Alumnos y matrículas

Alcance exclusivo: fichas globales, pertenencia al grupo, búsqueda, detalle e historial. El dashboard mantiene su demostración y avisos. No hay resúmenes, contactos, importaciones, promoción automática, CI, backend ni dependencias nuevas.

## Uso

1. Seleccionar ciclo/grupo en Contexto de trabajo. Alumnos consulta únicamente ese grupo; búsqueda local y filtro de matrículas inactivas son independientes del contexto.
2. «Agregar alumno» permite buscar primero las fichas globales. Crear nombre/apellidos y fecha de ingreso guarda ficha y matrícula atómicamente. Los homónimos se permiten; UUID, creación e historial ayudan a distinguirlos.
3. «Matricular alumno existente» busca fichas de todos los grupos. Una ficha activa se matricula sin duplicarla. Una matrícula ya activa se informa y bloquea; una inactiva se reactiva confirmando el intervalo. Un alumno archivado puede reactivarse explícitamente en este flujo.
4. «Ver ficha» muestra estado global e historial, ciclos/grupos/grados/turnos/fechas y avisos de archivo. Editar ficha conserva identidad. Las acciones de matrícula solo apuntan al grupo seleccionado; para actuar sobre otra pertenencia hay que cambiar el contexto.
5. «Corregir fechas», baja y reactivación validan días reales dentro del ciclo y todas las asistencias dentro del intervalo inclusivo. Baja requiere confirmar y no inventa salida. Reactivar permite conservar, corregir o vaciar salida de forma explícita.
6. «Archivar alumno» confirma nombre y número de matrículas activas afectadas. Desactiva ficha y matrículas en una transacción, conserva fechas e historial. Reactivar ficha deja matrículas inactivas. Cancelar cualquier confirmación/formulario no escribe.

Un cambio de contexto cierra formularios/detalles; el aviso visible explica la invalidación. Los datos anteriores no se presentan bajo el nuevo grupo. Errores de escritura conservan campos; fallo de consulta tras guardado confirmado cierra el formulario e informa para reintentar solo la consulta.

## Implementación y límites

UI y coordinación en src/features/students/ (Students, StudentForm, useStudents y presentación/tipos). Integración en src/app/App.tsx y estilo de radio en styles.css. Casos transaccionales y consultas en src/db/repositories.ts, reutilizando StorageProvider/WorkContextProvider. Componentes sin Dexie/tablas. Capturas y perfil de pruebas contienen exclusivamente datos ficticios.

Se mantiene Dexie v1: sin cambios de stores, índices ni semántica persistida y sin migración necesaria. No se modifica identifier, CSP, permisos ni configuración del perfil. No hay borrado físico ni almacenamiento alternativo. Una matrícula por alumno/grupo representa un intervalo; periodos separados de reingreso requieren diseño posterior. No se impiden pertenencias simultáneas a grupos distintos.

La prueba offline aísla el contexto de pruebas después de cargar recursos locales. No demuestra primer arranque/instalación sin red, tráfico del sistema operativo, actualización, desinstalación, reinicio de Windows ni lector de pantalla. CN-002 y CN-013 continúan pendientes.

## Verificación

Verificado el 19/10/2026:

| Comando           | Resultado                                                       |
| ----------------- | --------------------------------------------------------------- |
| pnpm lint         | Aprobado, cero advertencias                                     |
| pnpm format:check | Aprobado                                                        |
| pnpm typecheck    | Aprobado                                                        |
| pnpm test         | 23 dominio/DB + 2 distribución + 20 UI aprobadas                |
| pnpm build        | Aprobado, recursos locales                                      |
| pnpm tauri:build  | Release e instalador NSIS x64 generados                         |
| pnpm test:native  | Aprobado, cierre completo y reapertura del mismo perfil aislado |

Evidencia local excluida de Git: test-results/native/result.json, first-launch.png, after-restart.png y students-after-restart.png. El JSON confirma procesos 41440 y 41024, perfil webview2-zgrlwH, origen http://tauri.localhost, 18 registros de dominio e igualdad exacta de las diez tablas. studentContinuity registra un UUID de ficha y dos UUID de matrícula/grupo diferentes, con ingresos 2026-08-01 y 2026-09-01; primera inactiva sin salida inventada y segunda activa. Se recuperaron selección y edición, historial UI de grados 1 y 2, y escritura adicional offline posterior. Cero solicitudes externas observadas. Se inspeccionaron las capturas de 360/768 px y del historial en WebView2 tras reinicio, sin desbordamiento horizontal.

La primera suite UI restringida no alcanzó el servidor local y se canceló; la ejecución con acceso local autorizado permitió completar las pruebas. Tres pruebas nuevas fallaron inicialmente por la consulta del label del selector de grado; usar su rol/nombre accesible resolvió el selector y la suite completa final pasó. El primer empaquetado compiló el ejecutable pero no pudo descargar NSIS por DNS (11001); repetir con acceso autorizado generó el instalador de 1,89 MiB. Rust se añadió solo al PATH del proceso de compilación. No se modificó la red ni el entorno global del equipo.

Archivos: src/features/students/{Students.tsx,StudentForm.tsx,useStudents.ts,studentFormState.ts,studentPresentation.ts}; src/app/{App.tsx,styles.css}; src/db/repositories.ts; tests/db/students.test.ts; tests/helpers/student-flow.ts; tests/ui/{students.spec.ts,navigation.spec.ts}; tests/native/persistence.mjs; DATA_MODEL.md, DECISIONS.md, TESTING.md, TASKS.md y este documento. TASKS.md sigue excluido de Git por la regla existente. Sin operaciones Git de escritura.

CN-005 completa según su aceptación comprobada. CN-002 y CN-013 permanecen pendientes. Commit sugerido: `feat: manage students and enrollments`.
