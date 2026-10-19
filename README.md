# ClassNote

Agenda escolar de escritorio para docentes de primaria, diseñada para funcionar sin conexión.

**Estado: etapa 02 / CN-001A.** App Shell en español con ocho secciones, navegación
adaptable y dashboard de demostración con datos ficticios centralizados.
Todavía no registra alumnos, asistencias, tareas ni otros datos. No hay base de datos,
cuentas, servidor de producción, sincronización ni servicios externos.

El arranque nativo y la generación del instalador Windows con Tauri fueron verificados
después de resolver el bloqueo inicial de Windows (error 4551). El frontend y las
verificaciones de calidad pasaron; consulta [CN-001](docs/BOOTSTRAP.md).

## Preparar Windows

1. Windows 11 x64 como plataforma inicial. Windows 10 queda pendiente de validación.
2. [Node.js](https://nodejs.org/) 22.12 o superior; probado con Node 24.21.0.
3. pnpm 12.6.0: `npm install --global pnpm@12.6.0`.
4. [Rust estable mediante rustup](https://rustup.rs/), toolchain
   `stable-x86_64-pc-windows-msvc`. Probado con Rust/Cargo 1.99.1.
5. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/):
   seleccionar **Desarrollo para el escritorio con C++**, MSVC x64/x86 y Windows SDK.
6. [Microsoft Edge WebView2 Runtime Evergreen](https://developer.microsoft.com/microsoft-edge/webview2/):
   necesario tanto para desarrollo como para ejecutar la aplicación instalada.

Consulta los [prerrequisitos de Tauri 2](https://v2.tauri.app/start/prerequisites/).
La primera instalación y compilación requieren internet para descargar dependencias
de pnpm, crates de Rust y herramientas NSIS. La app distribuida no usa estos servicios.

Abre una terminal nueva y comprueba:

```powershell
node --version
pnpm --version
rustc --version
cargo --version
```

Si Rust está instalado pero no se reconoce, agrega su carpeta solo a la sesión actual:

```powershell
$env:PATH = "$env:USERPROFILE/.cargo/bin;$env:PATH"
```

## Instalar y ejecutar

Desde la raíz del repositorio:

```powershell
pnpm install --frozen-lockfile
pnpm tauri:dev
```

Se inicia Vite en `127.0.0.1:1420` y se abre la ventana de escritorio. Si el puerto
está ocupado, cierra la instancia anterior; no se cambia silenciosamente de puerto.
Finaliza el desarrollo con `Ctrl+C`. Para trabajar solo en la interfaz: `pnpm dev`.
El servidor Vite se usa para desarrollo y no forma parte de la app distribuida.

## Comandos

| Comando             | Función                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `pnpm typecheck`    | TypeScript estricto sin emitir archivos                                |
| `pnpm lint`         | ESLint sin advertencias                                                |
| `pnpm format:check` | Comprobar Prettier                                                     |
| `pnpm format`       | Aplicar formato                                                        |
| `pnpm test`         | Compilar, comprobar distribución offline y probar la interfaz con Edge |
| `pnpm test:ui`      | Compilar y ejecutar seis pruebas de interfaz con Edge instalado        |
| `pnpm build`        | Compilar frontend en dist/                                             |
| `pnpm preview`      | Revisar el frontend compilado en un servidor local                     |
| `pnpm check`        | Lint, formato, tipos, build y pruebas                                  |
| `pnpm tauri:dev`    | Desarrollo en ventana Tauri                                            |
| `pnpm tauri:build`  | Ejecutable Windows e instalador NSIS                                   |
| `pnpm tauri info`   | Diagnóstico del entorno                                                |

Las comprobaciones de distribución usan el runner de Node: recursos locales, CSP
y ausencia de capabilities nativas. Playwright usa Microsoft Edge instalado para
probar navegación, teclado, ventanas estrechas y navegación sin red después de cargar
los recursos. No descarga navegadores. No sustituye pruebas del instalador o de
WebView2. Vitest/Testing Library y CI siguen pendientes en CN-002.

Formato de Rust:

```powershell
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Ejecutable: `src-tauri/target/release/classnote.exe`.
Instalador: `src-tauri/target/release/bundle/nsis/`.
Los artefactos no se incluyen en Git.

## Instalación sin internet

El equipo de destino debe tener **WebView2 Runtime** antes de instalar ClassNote.
Para equipos sin internet, prepara previamente el instalador independiente Evergreen
de Microsoft de la arquitectura correspondiente y transfiérelo junto con ClassNote.
El instalador de ClassNote no descarga ni incluye WebView2; sin este requisito la app
no puede arrancar. Consulta la [distribución Windows de Tauri](https://v2.tauri.app/distribute/windows-installer/).

La app empaqueta JS, CSS e iconos y usa fuentes del sistema. No hay CDN, telemetría,
actualizador ni plugins de red. CSP bloquea conexiones en producción; desarrollo
permite el origen local y WebSocket de Vite. Esto no controla el tráfico que Windows
o WebView2 puedan generar por su cuenta.

## Estructura

```text
src/
  app/                   # Shell, navegación hash, estilos e icono local
  features/dashboard/    # Dashboard y mocks sin persistencia
  features/ModulePlaceholder.tsx # Vista compartida por módulos pendientes
  components/layout/     # Sidebar y encabezado
  components/ui/         # Acceso rápido reutilizable
  domain/                # Reglas y tipos futuros
  db/                    # Reservado; sin tablas ni Dexie
  services/              # Servicios futuros
  lib/tauri/             # Adaptadores nativos futuros
src-tauri/
  src/                   # Arranque nativo Rust
  icons/                 # Fuente SVG y dos iconos Windows
  Cargo.toml
  Cargo.lock
  build.rs
  tauri.conf.json
tests/offline-build.test.mjs
tests/ui/navigation.spec.ts
playwright.config.ts
docs/BOOTSTRAP.md
docs/APP_SHELL.md
index.html
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
vite.config.ts
tsconfig.json
eslint.config.js
.prettierrc.json
.prettierignore
.editorconfig
.gitignore
```

Las carpetas reservadas solo contienen `.gitkeep`. Los módulos escolares se añadirán
en sus tickets. Los componentes no accederán directamente a IndexedDB.

## Identidad y dependencias

Nombre: **ClassNote**. Paquete npm/binario: `classnote`.
Identificador Tauri: `org.classnote.desktop`, identidad técnica sin afirmar propiedad
de un dominio. Revisar antes de distribuir públicamente y conservar entre versiones
para evitar cambios accidentales de identidad y perfil de datos.

Runtime npm: React, React DOM y Lucide React (iconos SVG locales).
Runtime nativo: Tauri 2 sin plugins. Playwright es solo una herramienta de pruebas.
Herramientas: TypeScript, Vite, plugin React, Tailwind y plugin Vite, CLI de Tauri,
ESLint, typescript-eslint, plugins React Hooks/Refresh, globals,
eslint-config-prettier, Prettier y tipos Node/React.
`pnpm-lock.yaml` y `src-tauri/Cargo.lock` fijan versiones resueltas.
`pnpm-workspace.yaml` registra las excepciones de antigüedad de paquetes que pnpm
generó al resolver typescript-eslint; no hay otras aplicaciones en el proyecto.

Dexie, ExcelJS y dexie-export-import están aprobados para etapas posteriores y
todavía no se instalan. No hay cambios de schema ni migraciones.

## Documentación

- [Arquitectura](ARCHITECTURE.md) y [decisiones](DECISIONS.md).
- [Modelo de datos](DATA_MODEL.md), todavía sin implementación.
- [Roadmap](ROADMAP.md) y [plan de pruebas](TESTING.md).
- [Seguridad](SECURITY.md) y [contribución](CONTRIBUTING.md).
- [Validaciones y supuestos de esta etapa](docs/BOOTSTRAP.md).
- [App Shell, decisiones y validaciones de etapa 02](docs/APP_SHELL.md).
- `AGENTS.md`, `MVP.md` y `TASKS.md` son documentos locales de planeación que el
  .gitignore existente excluye; pueden no existir en un clon nuevo.

Sin escritura de datos, no aplica todavía validar persistencia. Perfil WebView2,
actualizaciones y restauración se verificarán al implementar almacenamiento.
Ser offline no significa tener cifrado.

## Licencia

Pendiente de seleccionar explícitamente. No se atribuye una licencia hasta añadir
el archivo LICENSE autorizado.
