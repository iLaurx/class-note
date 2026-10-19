# CN-004 — Ciclos escolares y grupos

Alcance exclusivo: gestión no destructiva de ciclos y grupos y contexto global persistente. Configuración sustituye su placeholder; las ocho secciones y el dashboard de demostración continúan. No hay dependencias nuevas, esquema nuevo, cambios de permisos/CSP ni operaciones Git de escritura.

## Flujos

1. En Configuración, crear ciclo con etiqueta y fechas locales reales; consultar sus grupos y crear grado 1–6, nombre y turno opcional.
2. «Ver grupos de…» cambia solo la consulta de administración. El selector global «Contexto de trabajo» elige ciclo y grupo explícitamente. Cambiar ciclo retira el grupo anterior.
3. Editar conserva identidad e historial. Para cambiar ciclo de un grupo hay que crear otro. Errores conservan el formulario para corregir; reintentar contexto recupera lecturas fallidas.
4. Archivar solicita confirmación con nombre, conservación del historial y advertencia si retira la selección. Cancelar no llama al repositorio. «Mostrar archivados» permite consultar y reactivar. Un ciclo archivado bloquea edición/reactivación de sus grupos hasta reactivar el ciclo.
5. No se selecciona automáticamente ningún ciclo o grupo tras crear, reactivar o descartar referencias inválidas.

## Implementación

- src/features/school-years/: listado, formularios y coordinación UI de gestión.
- src/features/groups/: formulario de grupo.
- src/app/WorkContextProvider.tsx, useWorkContext.ts y WorkContextSelector.tsx: instantánea transaccional sobre StorageProvider, estado de carga/error, bloqueo inmediato de operaciones repetidas y selección persistida.
- src/db/repositories.ts: actualización, unicidad, validación relacional, archivo/reactivación y preferencias atómicas. Los componentes no importan Dexie ni tablas.
- La lectura inicial ignora promesas de efectos desmontados; las acciones se serializan. Listas de grupos se derivan de una única instantánea con IDs explícitos, sin respuestas antiguas de consultas por ciclo.
- Las claves estables work.schoolYearId y work.groupId se documentan en DATA_MODEL.md. Dexie v1 permanece intacta.

## Validación

Validado el 19 de octubre de 2026:

| Comando           | Resultado                                               |
| ----------------- | ------------------------------------------------------- |
| pnpm lint         | Aprobado, sin advertencias                              |
| pnpm format:check | Aprobado                                                |
| pnpm typecheck    | Aprobado                                                |
| pnpm test         | 18 dominio/DB + 2 distribución + 13 UI aprobadas        |
| pnpm build        | Aprobado, recursos locales                              |
| pnpm tauri:build  | Release x64 e instalador NSIS generados                 |
| pnpm test:native  | Aprobado, dos procesos distintos y mismo perfil aislado |

Las pruebas UI verifican dos ciclos con dos grupos por ciclo a 1100/768/360 px, edición, cancelación sin ninguna escritura, archivo/reactivación, referencias coherentes tras cambios rápidos y errores de lectura/escritura con recuperación. Se inspeccionaron las capturas móvil y nativa; no hay desbordamiento horizontal. Se conservan las pruebas previas de ocho secciones, teclado, diez tablas inicialmente vacías y cero peticiones externas.

Evidencia local: test-results/native/result.json registra PIDs, perfil, origen, fecha, instantánea exacta de diez tablas, 15 registros de dominio, dos ciclos y cuatro grupos creados por UI, selección/edición recuperadas y relaciones conservadas tras archivo/reactivación. Las capturas first-launch.png y after-restart.png provienen de WebView2 real. El proceso y todos los WebView2 del perfil se cierran antes de reabrir; no se sustituye por recarga del navegador. Ejecutar test:native después de la suite UI porque Playwright limpia test-results al comenzar.

Incidencias resueltas: la ejecución restringida de UI no alcanzó localhost y se repitió con acceso local autorizado; se corrigieron nombres accesibles de los selectores y la espera de montaje antes de la primera pulsación de teclado. Rust no estaba en PATH del proceso: se añadió C:\Users\ele\.cargo\bin solo al entorno de compilación, sin cambios del sistema. El empaquetado y todas las pruebas finales terminaron correctamente. Advertencias NO_COLOR/FORCE_COLOR corresponden al runner.

Archivos modificados: src/app/App.tsx, styles.css, WorkContextProvider.tsx, WorkContextSelector.tsx, useWorkContext.ts; src/main.tsx; src/db/repositories.ts; src/features/school-years/SchoolManagement.tsx, SchoolYearForm.tsx; src/features/groups/GroupForm.tsx; tests/db/school-management.test.ts; tests/helpers/school-flow.ts; tests/ui/navigation.spec.ts, school-management.spec.ts; tests/native/persistence.mjs; DATA_MODEL.md, DECISIONS.md, TESTING.md, TASKS.md y este documento. TASKS.md continúa excluido de Git por la regla existente.

## Límites

El aislamiento de red se aplica al contexto de prueba después de cargar recursos locales; no modifica la red del equipo ni demuestra instalación inicial offline, tráfico del sistema operativo, reinicio de Windows, actualización o desinstalación. Esos escenarios siguen en CN-013. CN-002 permanece pendiente.
