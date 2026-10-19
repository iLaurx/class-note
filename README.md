# ClassNote

**Agenda escolar de escritorio, offline-first y open source para docentes.**

Estado: **planificación / preimplementación**. Nada de lo descrito aquí implica que una función ya exista.

ClassNote permite organizar ciclos escolares, grupos, alumnos, asistencias, tareas, lecturas en casa y observaciones. Sus datos permanecen en el equipo. Exporta reportes a Excel y ofrece respaldos restaurables.

## Principios
- Funciona totalmente sin conexión después de instalarse.
- Sin cuentas, servidor, telemetría ni sincronización en el MVP.
- Registro diario en pocos clics y navegación accesible en español.
- Privacidad por diseño: datos reales de menores nunca en repositorios, capturas o fixtures.
- Respaldo y restauración son funcionalidades prioritarias, no extras.

## Stack elegido
Tauri 2 · React · TypeScript · Vite · Tailwind CSS · Dexie.js/IndexedDB · ExcelJS · dexie-export-import · Vitest/Testing Library · Playwright (evaluar viabilidad de E2E para Windows WebView2).

## Documentación
- [MVP](MVP.md) — alcance y criterios de aceptación.
- [Instrucciones para agentes](AGENTS.md) — reglas para contribuciones con agentes.
- [Arquitectura](ARCHITECTURE.md) — módulos, límites y decisiones técnicas.
- [Modelo de datos](DATA_MODEL.md) — entidades, índices e invariantes.
- [Plan de ejecución](TASKS.md) — tareas secuenciales y commits.
- [Roadmap](ROADMAP.md) — siguientes versiones.
- [Pruebas](docs/TESTING.md) — matriz de calidad.
- [Decisiones](docs/DECISIONS.md) — ADRs.
- [Seguridad](SECURITY.md) y [Contribución](CONTRIBUTING.md).

## Inicio del desarrollo
1. Leer `AGENTS.md`, `MVP.md`, `ARCHITECTURE.md` y `DATA_MODEL.md`.
2. Ejecutar los tickets de `TASKS.md` uno a uno; no adelantar features.
3. La primera etapa debe inicializar Tauri 2 + React + Vite + TypeScript y dejar scripts comprobables.
4. No copiar comandos ficticios: registrar comandos reales en `package.json` tras inicializar.

## Licencia
