# Plan de pruebas

## Tests automatizados
- Dominio: validaciones de fechas, minutos, ciclos, estados y conteos.
- Dexie: pruebas con IndexedDB simulado (`fake-indexeddb`) **más** pruebas de integración reales en WebView2.
- Unicidad: asistencia por `(enrollmentId,date)` y entrega `(assignmentId,enrollmentId)`; matrícula duplicada impedida.
- Integridad: una tarea no acepta entregas de otra matrícula/grupo.
- Exportación: datos, orden de columnas, múltiples hojas, acentos, fechas, cero registros y entradas que parecen fórmulas.
- Restauración: archivo correcto, corrupto, versión incompatible, cancelación, reemplazo y fallo a mitad.
- Migración: abrir datos de schema v1 desde versión futura conservando relaciones.

## Pruebas manuales Windows (release gate)
- [ ] Instalar en equipo Windows 11 sin internet disponible durante primer inicio una vez cumplidos prerequisitos del instalador.
- [ ] Arrancar y registrar 35 alumnos, 1 mes de asistencias y 10 tareas sin red.
- [ ] Cerrar proceso y volver a abrir; datos intactos.
- [ ] Reiniciar equipo; datos intactos.
- [ ] Actualizar versión de app con datos existentes; datos intactos.
- [ ] Importar backup en instalación de prueba limpia; validar conteos y relaciones.
- [ ] Cancelar restauración; base intacta.
- [ ] Simular archivo de respaldo inválido; no perder datos.
- [ ] Exportar XLSX y abrir en Microsoft Excel o visor compatible; verificar cuatro hojas.
- [ ] Cambiar entre ciclos/grupos; ninguna mezcla de registros.
- [ ] Aumentar/reducir ventana, navegar con teclado y probar lector de pantalla de manera básica.
- [ ] Verificar que no se hacen solicitudes externas en operación normal offline.
- [ ] Revisar comportamiento de desinstalación y limpieza de datos WebView2; documentar riesgos.

## Comandos
Después de CN-001/CN-001A:

- `pnpm typecheck`: TypeScript estricto, incluida la configuración y las pruebas UI.
- `pnpm lint` y `pnpm format:check`: ESLint y Prettier.
- `pnpm build`: frontend distribuible.
- `pnpm test`: build, doce pruebas de dominio/persistencia con Node, dos comprobaciones de distribución y siete tests UI.
- `pnpm test:db`: doce pruebas TypeScript con Node Test Runner y fake-indexeddb. Requiere Node 24 o compatible con `--experimental-strip-types`; no descarga runner ni navegador.
- `pnpm test:native`: ejecutable release real, WebView2 con perfil aislado y CDP local, escritura/lectura offline, cierre completo y reapertura. Requiere `pnpm tauri:build` previo; no inicia Vite ni instala ClassNote. Véase [PERSISTENCE.md](docs/PERSISTENCE.md).
- `pnpm test:ui`: build y tests UI con Playwright / Edge instalado, sin descargar navegadores.
- `pnpm tauri:dev`: compilación y arranque nativo.

Las pruebas UI levantan su propio preview de producción en `127.0.0.1:1421`,
sin reutilizar servidores existentes. Requieren sockets locales y permiso de iniciar
Edge; el sandbox puede bloquearlos. Los resultados y capturas van en `test-results/`
(excluido de Git). Las ocho secciones se prueban a 1100, 768 y 360 px, además de
historial, enlaces directos, ruta desconocida, accesos rápidos, foco y teclado.
Se revisan errores de consola y de ejecución en las tres resoluciones.

La prueba offline carga recursos locales, espera apertura correcta de `classnote`,
corta la red del contexto y recorre las ocho secciones. Comprueba diez stores vacías,
ningún mock persistido, ausencia de localStorage/sessionStorage y cero peticiones
externas. Otra prueba provoca un error de IndexedDB y acciona reintento por teclado.
Se mantienen tamaños, foco, historial y enlaces. Las evidencias de etapa 02 en
[APP_SHELL.md](docs/APP_SHELL.md) son históricas: CN-003 sí abre IndexedDB.

## Casos y resultados CN-003

El 19 de octubre de 2026 se ejecutaron correctamente `pnpm lint`, `pnpm format:check`,
`pnpm typecheck`, `pnpm test` (12 + 2 + 7 aprobadas), `pnpm build`, `pnpm tauri:build`
y `pnpm test:native`. Este último se ejecutó contra WebView2, no Edge independiente.

Cobertura DB: apertura vacía de diez stores, inicialización repetida/carga, altas y
consultas de todas las entidades, reapertura v1 con igualdad de valores/IDs, cinco
índices únicos, referencias inexistentes, entregas cruzadas, aislamiento entre dos
ciclos/grupos, fechas reales, grados/minutos/estados/categorías/campos requeridos,
extremos inclusivos de asistencia, varias lecturas por día, concurrencia, rollback
ante duplicado/fallo de validación a mitad de lote, error y reintento sin pérdida.
Las bases simuladas tienen nombre UUID por prueba y se eliminan solo en tests.

El primer `pnpm test` restringido quedó sin responder al servidor local y se canceló;
se repitió con acceso autorizado y pasó. El primer empaquetado compiló release pero
falló al descargar NSIS (`Host desconocido`, error 11001); el reintento autorizado
generó el instalador. Solo hubo advertencias de NO_COLOR/FORCE_COLOR en la suite UI.

La primera comprobación de formato marcó catorce archivos existentes solo por CRLF.
Se confirmó que su contenido ya tenía el formato correcto y se configuró Prettier
con `endOfLine: auto` para respetar los finales de línea de Windows sin reescribirlos.

La prueba nativa conserva datos tras cerrar el proceso y reapertura en el mismo perfil,
incluida escritura offline posterior y navegación. No cubre primer arranque sin red,
tráfico global de Windows, reinicio del equipo, instalación, actualización, desinstalación
ni respaldo/restauración. Esos criterios manuales y CN-013 siguen pendientes.
