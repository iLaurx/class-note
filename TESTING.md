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
Se documentarán los comandos efectivos después de `CN-001`/`CN-002`. No inventar reportes de ejecución antes de la inicialización.
