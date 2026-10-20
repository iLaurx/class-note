# CN-010 — Resumen docente del grupo

Inicio consulta datos reales del ciclo y grupo elegidos en el contexto persistente.
Sin ambos IDs no consulta un resumen ni elige grupo; indica que hay que seleccionarlo.
Se retiraron dashboard.mock.ts, el aviso de demostración y los datos ficticios de
la barra lateral. Las ocho secciones y los cuatro accesos rápidos conservan sus destinos.

## Periodos y reglas

- Alumnos: matrículas cuyo intervalo inclusivo contiene el día local actual y cuyo
  ciclo contiene ese día. Incluye historia inactiva y fichas archivadas, como Asistencia;
  no infiere salidas de status ni updatedAt. Fuera del ciclo se muestra una explicación.
- Asistencia: solo hoy, cuatro estados separados y sin registrar. Justificadas no
  suman presentes. Ausencia de captura no equivale a falta. Sin matrícula o sin
  captura hay texto explícito, sin porcentajes, promedios ni metas.
- Agenda: asignación entre hoy menos seis días y hoy, o entrega entre hoy y hoy más
  seis días; ventanas inclusivas de siete días identificadas en pantalla. Orden por
  entrega (o asignación cuando no hay entrega), después UUID; muestra hasta cinco
  tareas e informa el total coincidente. El enlace lleva al listado real de Tareas.
- Pendientes: estado pending persistido o ausencia de Submission, según CN-007.
  Población por fecha de asignación, usando includesDate; no por alumnos de hoy.
  Incompleta y No entregada conservan sus estados y no se convierten en pending.
  Entregas fuera de la población no cuentan; se avisa cuántas incidencias hay para
  consultarlas en Tareas. No se borran ni reinterpretan registros.
- Lecturas: semana civil completa de lunes a domingo que contiene hoy, mediante
  readingWeek de CN-008. Suma minutos y cuenta entradas de las matrículas del grupo,
  incluidos registros de cero minutos. Sin entradas se muestra un estado vacío.
- Hoy se obtiene por componentes locales, nunca desde toISOString ni parseo UTC;
  se revisa cada 30 segundos y al recuperar foco. Al cambiar día se relee el resumen.

## Lectura y consistencia

UI → DashboardSummary → Repositories.loadDashboard → transacción Dexie readonly.
StorageProvider y WorkContextProvider son los existentes. IDs y día explícitos;
validación del ciclo/grupo antes de agregar. Consultas indexadas por grupo,
matrículas y tareas con anyOf, sin una llamada de repositorio por alumno/tarea.
Las lecturas se filtran a la semana antes de materializarlas. Cálculos separados
en dashboardDomain.ts reutilizan includesDate, attendanceCounts y readingWeek.

Cada contexto/día monta una instancia nueva. La limpieza del efecto ignora las
respuestas anteriores, incluida StrictMode. Durante el cambio de contexto no se
muestra el resumen antiguo. Carga y error tienen estado visible; Reintentar resumen
repite solo lectura. Los errores de apertura/contexto conservan los reintentos de
los providers. No se añaden escrituras, seeds, almacenamiento alternativo, schema,
permisos, dependencias, fuentes remotas ni cambios de perfil WebView2.

## Verificación

- tests/db/dashboard.test.ts: fechas locales y cambios de año/bisiesto; población
  histórica e inclusiva, asistencia incompleta/justificada, pendientes por asignación,
  aislamiento grupos/ciclos, ventanas de tareas/lecturas y vacíos. Instantánea de las
  diez tablas idéntica antes/después de consultas; versión v1 conservada.
- tests/ui/dashboard.spec.ts: cuatro pruebas; datos sintéticos, contexto alternado
  entre grupos/ciclos, vacío, carga observada, error y reintento por teclado, cuatro
  accesos rápidos, foco y ausencia de desbordamiento a 1100/768/360 px. Contexto
  offline, cero transacciones readwrite al abrir el resumen y cero solicitudes externas.
- tests/ui/navigation.spec.ts: sustituye solo el aviso de demostración; conserva
  navegación, base vacía, error de apertura y regresiones anteriores.
- tests/native/persistence.mjs: mismo release/perfil temporal, cierre completo de
  proceso y WebView2 y reapertura; resumen por UI antes/después y diez tablas iguales
  al consultarlo. Fecha fijada únicamente en el reloj del contexto de prueba para
  mantener los fixtures reproducibles; no cambia reloj de Windows ni código de app.
- Evidencia local sintética excluida de Git: test-results/dashboard-{1100,768,360}.png,
  native/dashboard-{before-restart,after-restart}.png y native/result.json.

Resultados finales verificados el 19/10/2026:

| Comando           | Resultado                                                       |
| ----------------- | --------------------------------------------------------------- |
| pnpm lint         | Aprobado, cero advertencias                                     |
| pnpm format:check | Aprobado                                                        |
| pnpm typecheck    | Aprobado                                                        |
| pnpm test         | 55 dominio/DB + 2 distribución + 55 UI aprobadas                |
| pnpm build        | Aprobado; también ejecutado por test y Tauri                    |
| pnpm tauri:build  | Release x64 e instalador NSIS de 1.991.736 bytes                |
| pnpm test:native  | Aprobado; cierre completo y reapertura del mismo release/perfil |

La evidencia nativa registra PIDs distintos 31904 y 28496, 39 registros de dominio
antes del cierre, diez tablas exactamente conservadas y cero solicitudes externas.
El resumen recupera cuatro matrículas, dos presentes, un retardo, una justificada,
cero sin registrar, dos tareas con pendientes y 35 minutos/3 lecturas. Consultar el
dashboard antes y después del reinicio deja idéntica la instantánea completa.
Se inspeccionaron las capturas UI de 1100/768/360 px y las dos nativas del resumen.

Incidencias: el primer intento UI restringido quedó esperando al preview local y se
canceló; la suite completa con acceso local autorizado pasó. La primera revisión de
TypeScript detectó variables duplicadas en Sidebar durante la edición; se corrigió
antes de la suite final. Solo se observaron avisos NO_COLOR/FORCE_COLOR del runner,
sin errores de la aplicación. Rust se añadió al PATH del proceso de compilación;
no se cambió configuración global, red del equipo ni perfiles personales.

## Archivos modificados

- src/features/dashboard/Dashboard.tsx y dashboardDomain.ts; eliminado dashboard.mock.ts.
- src/db/repositories.ts; src/app/App.tsx; src/components/layout/Sidebar.tsx.
- tests/db/dashboard.test.ts; tests/ui/dashboard.spec.ts; tests/ui/navigation.spec.ts;
  tests/native/persistence.mjs.
- docs/DASHBOARD.md, DECISIONS.md, TESTING.md y TASKS.md. Este último sigue ignorado
  localmente; no se modificó .gitignore ni se forzó su inclusión. DATA_MODEL.md conserva
  su contenido porque no cambia el esquema ni el contrato de datos persistidos.

## Límites

El resumen se actualiza al entrar, cambiar contexto/día o reintentar; no incorpora
suscripciones a cambios educativos hechos simultáneamente en otra ventana. Las
ventanas de agenda son una selección de presentación, no una política de evaluación
ni de vencimiento automático. La cifra de matrículas deriva de fechas, no de status.
No hay nuevas garantías de persistencia: se verifica que esta lectura no escribe y
que funciona con datos existentes tras reabrir el release. El aislamiento offline
no acredita instalación inicial sin red ni tráfico global de Windows; actualización,
desinstalación, reinicio del equipo, respaldo/restauración y auditoría de lector de
pantalla siguen fuera de esta etapa. CN-002 y CN-013 permanecen pendientes.

Commit sugerido: feat: add teacher dashboard.
