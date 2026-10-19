# CN-001A — App Shell y navegación (etapa 02)

Alcance: estructura visual con ocho secciones, dashboard demostrativo y placeholders
sin formularios, operaciones de dominio, almacenamiento ni APIs nativas.

## Decisiones y divergencias

- TASKS.md no contenía la etapa solicitada. Se agregó CN-001A como única tarea;
  CN-010 sigue reservado al dashboard alimentado por Dexie. El prompt explícito
  de etapa 02 autoriza mocks y excluye persistencia aunque el MVP completo la requiera.
- DECISIONS.md y TESTING.md existen en la raíz, no en docs/. Se conservó su ubicación.
- Navegación hash con enlaces HTML y `useSyncExternalStore`, sin React Router:
  ocho vistas estáticas no necesitan otra dependencia. Soporta historial, enlaces
  directos, recarga, indicador activo y recuperación ante enlaces desconocidos.
- `navigation.ts` centraliza destinos, iconos y textos de los módulos pendientes;
  `dashboard.mock.ts` centraliza datos sintéticos. La fecha mostrada es de ejemplo,
  no la fecha actual del equipo. No hay modelos definitivos ni schema/migraciones.
- `ModulePlaceholder` es una vista compartida: evita siete componentes idénticos.
  Cada sección tiene título, descripción y texto de preparación propios.
- Sidebar de escritorio con scroll en ventanas bajas; menú completo en cuadrícula
  a 900 px o menos. Cards en una columna a 580 px o menos. Enlace para saltar al
  contenido, foco al encabezado tras navegar y estados `aria-current`/focus visibles.
- Fuentes de Windows y recursos locales; no hay CDN, peticiones externas ni nuevos
  permisos de Tauri. Se conservó la CSP. El indicador offline expresa que no se
  requiere red; no pretende detectar la conexión del equipo ni prometer cifrado.
- Icono de pestaña local en `src/app/mark.svg`. Vite emite assets como archivos
  para comprobar su existencia en la prueba de distribución.

## Dependencias

- `lucide-react` 1.59.0: iconos SVG consistentes, empaquetados localmente y con
  importación de los usados. No descarga recursos en ejecución.
- `@playwright/test` 1.64.1 (desarrollo): pruebas de interacción usando Microsoft Edge
  instalado. Reutiliza las pruebas de distribución con Node; no introduce Vitest,
  Testing Library ni CI fuera de esta etapa. pnpm-lock.yaml registra la resolución.

## Validación ejecutada

- `pnpm typecheck`: correcto.
- `pnpm lint`: correcto, sin advertencias.
- `pnpm format:check`: correcto tras normalizar formato de cinco archivos existentes
  (.prettierrc.json, docs/BOOTSTRAP.md, pnpm-workspace.yaml, tauri.conf.json y
  offline-build.test.mjs); no cambió su comportamiento.
- `pnpm build`: correcto (también ejecutado por `pnpm test`).
- `pnpm test`: dos pruebas Node de distribución y seis pruebas Playwright aprobadas.
  Navegación por las ocho vistas a 1100/768/360 px sin desbordamiento horizontal,
  consola sin errores, enlaces rápidos, atrás/adelante, recarga, enlace desconocido,
  salto al contenido, teclado y navegación offline sin almacenamiento.
- Inspección visual de capturas locales a 1100 × 760 y 360 × 760: cards y menú
  adaptables, texto y avisos de demostración visibles.
- `pnpm tauri:dev`: compiló Rust en 23,43 s y ejecutó `target/debug/classnote.exe`.
  Se comprobó proceso con ventana «ClassNote» y `Responding: True`.

El primer intento restringido de las pruebas y Tauri no pudo conectarse a localhost
por bloqueo de sockets del sandbox. Se repitieron con acceso local autorizado.
La primera suite UI detectó un 404 por favicon ausente; se agregó el icono local
y se repitió exitosamente la suite. Solo hay advertencias del runner acerca de
NO_COLOR/FORCE_COLOR, no errores de consola de la aplicación.

## Límites y etapa 03

Las comprobaciones visuales e interacciones se hicieron en Edge; el arranque y estado
de ventana nativa no equivalen a una inspección visual o automatización en WebView2.
No se regeneró ni ejecutó el instalador. Primer arranque nativo sin red y validación
con lector de pantalla quedan pendientes. Persistencia/reinicio no aplican a mocks.

Antes de la siguiente etapa, confirmar su ticket: el backlog mantiene CN-002
(calidad/CI) y después CN-003 (Dexie). Al introducir datos reales, reemplazar mocks
mediante hooks/servicios, añadir selector real de contexto con estado vacío y probar
invariantes y persistencia real en WebView2. Conservar navegación independiente de
datos y no confundir la fecha demostrativa con asistencia del día.

Commit sugerido: `feat: add ClassNote app shell and navigation`.
