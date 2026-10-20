# ClassNote

ClassNote v0.1.0 es una aplicación de Windows para docentes de primaria, con
interfaz en español y datos locales. Gestiona ciclos, grupos, alumnos y matrículas,
asistencia, tareas y entregas, lecturas y observaciones. Inicio resume el grupo
seleccionado. No hay cuentas, servidor, sincronización ni actualizador automático.

## Instalar y empezar

Usa `ClassNote_0.1.0_x64-setup.exe` en Windows 11 x64 con **Microsoft Edge WebView2
Runtime** instalado. El instalador es por usuario, está en español y no está
firmado. No incluye ni descarga WebView2. Windows 10 permanece sin validar.

La [guía de instalación y primer uso](docs/INSTALLATION.md) explica cómo preparar
WebView2 para un equipo sin internet, crear un ciclo y grupo, guardar registros,
exportar Excel y respaldar o restaurar. La aplicación instalada no necesita Node,
Rust ni conexión para sus módulos.

Los registros están en IndexedDB dentro del perfil WebView2 del usuario.
**No hay cifrado añadido ni protección propia ante otras personas con acceso al
equipo.** Guarda respaldos frecuentes fuera de ese perfil y protege los JSON y
Excel exportados. Excel es un reporte, no una copia restaurable.
Lee la [información de privacidad](docs/PRIVACY.md).

## Estado de la entrega

Preparación local de v0.1.0, sin publicación. [Notas, resultados y checklist de
release](docs/RELEASE_0.1.0.md). CN-013 se considera completada por instrucción del
usuario; su [matriz histórica](docs/HARDENING.md) conserva evidencia y límites de
las pruebas realmente ejecutadas. CN-002 (CI) permanece pendiente.

## Desarrollo y compilación en Windows

Requisitos: Node.js 22.12 o superior (probado con 24.21.0), pnpm 12.6.0,
Rust estable MSVC (probado con 1.99.1), Visual Studio Build Tools con C++ y
Windows SDK, y WebView2 Runtime. La primera preparación puede requerir internet
para dependencias, crates y herramientas NSIS.

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

Para generar el ejecutable y el instalador desde la raíz:

```powershell
pnpm tauri:build
```

Ejecutable: `src-tauri/target/release/classnote.exe`. Instalador:
`src-tauri/target/release/bundle/nsis/ClassNote_0.1.0_x64-setup.exe`.
Artefactos, perfiles y evidencias quedan fuera de Git. Conservar ambos lockfiles;
no se promete igualdad binaria bit a bit. Verificación: notas de release.

| Comando                       | Función                                          |
| ----------------------------- | ------------------------------------------------ |
| `pnpm dev` / `pnpm tauri:dev` | Interfaz de desarrollo / escritorio Tauri        |
| `pnpm lint`                   | ESLint sin advertencias                          |
| `pnpm format:check`           | Comprobar formato                                |
| `pnpm typecheck`              | TypeScript estricto                              |
| `pnpm test`                   | Build, dominio/DB, distribución y suite UI       |
| `pnpm build`                  | Recursos frontend de producción                  |
| `pnpm tauri:build`            | Release Windows y NSIS                           |
| `pnpm test:native`            | Release real, perfil aislado y cierre/reapertura |

Ejecuta las nativas después de la suite UI, que limpia `test-results`.
Los checkpoints `CN011_EXPORT_UI=1` y `CN012_BACKUP_UI=1` requieren operar diálogos
nativos con destinos sintéticos. [TESTING.md](TESTING.md) explica el procedimiento.
Una prueba de navegador no sustituye instalación o reinicio del ejecutable.

## Arquitectura y documentación

Tauri 2 + React + TypeScript + Vite + Tailwind. Dexie sobre IndexedDB; ExcelJS para
reportes y dexie-export-import para respaldos. Comandos Rust propios abren diálogos,
sin permisos generales de filesystem para JavaScript. Identificador
`org.classnote.desktop`, origen `http://tauri.localhost` y perfil conservados.

- [Arquitectura](ARCHITECTURE.md), [decisiones](DECISIONS.md) y [modelo de datos](DATA_MODEL.md).
- [Pruebas](TESTING.md), [seguridad](SECURITY.md) y [contribución](CONTRIBUTING.md).
- [Excel](docs/EXCEL_EXPORT.md), [respaldo/restauración](docs/BACKUP_RESTORE.md).
- `AGENTS.md`, `MVP.md` y `TASKS.md` son planificación local ignorada por Git;
  pueden no existir en un clon nuevo.

## Licencia

[MIT](LICENSE), Copyright (c) 2026 ClassNote contributors. Las dependencias
conservan sus propias licencias.
