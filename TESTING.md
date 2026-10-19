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
- `pnpm test`: build, dos comprobaciones de distribución con Node y seis tests UI.
- `pnpm test:ui`: build y tests UI con Playwright / Edge instalado, sin descargar navegadores.
- `pnpm tauri:dev`: compilación y arranque nativo.

Las pruebas UI levantan su propio preview de producción en `127.0.0.1:1421`,
sin reutilizar servidores existentes. Requieren sockets locales y permiso de iniciar
Edge; el sandbox puede bloquearlos. Los resultados y capturas van en `test-results/`
(excluido de Git). Las ocho secciones se prueban a 1100, 768 y 360 px, además de
historial, enlaces directos, ruta desconocida, accesos rápidos, foco y teclado.
Se revisan errores de consola y de ejecución en las tres resoluciones.

La prueba offline carga recursos locales, corta la red del contexto y recorre todas
las secciones; comprueba cero peticiones externas y cero almacenamiento. No demuestra
primer arranque nativo sin internet ni tráfico del sistema operativo. La persistencia
no aplica a etapa 02: todos los datos son mocks. Ver resultados en
[APP_SHELL.md](docs/APP_SHELL.md).
