# CN-001 — Inicialización de ClassNote

Alcance: etapa 01, base Tauri 2 + React + TypeScript estricto + Vite + Tailwind CSS,
pnpm, ESLint y Prettier. Sin módulos escolares ni persistencia. CN-002 conserva CI
y las pruebas de componentes y dominio; la calidad mínima fue solicitada en etapa 01.

## Decisiones

- Una funcionalidad `welcome`, compuesta desde `app`, y carpetas reservadas para
  las capas de arquitectura. No hay repositorios ficticios ni SDK nativo JavaScript.
- React y React DOM son las únicas dependencias npm de ejecución. Tauri sin plugins.
- Tailwind usa su plugin oficial Vite, sin configuración PostCSS adicional.
- Identificador estable `org.classnote.desktop`, sin afirmar propiedad del dominio.
  Ruta y conservación del perfil de datos quedan para las pruebas de persistencia.
- CSP separada para producción y desarrollo. Producción bloquea red; sin comandos
  personalizados ni capabilities. Los permisos se añadirán con su caso de uso.
- Instalador NSIS en español, por usuario. WebView2 debe instalarse previamente:
  `webviewInstallMode: skip` evita descargas durante instalación de ClassNote.
- Iconos Windows derivados de `src-tauri/icons/app.svg` con CLI Tauri.
- Dos comprobaciones de distribución con Node Test Runner, sin otro framework.
- Sin cambios de schema, migraciones o dependencias de almacenamiento.
- DECISIONS.md y TESTING.md están en la raíz aunque AGENTS.md indica docs/.
  Se leyeron los archivos reales y no se movieron.

## Validaciones de etapa 01

Entorno: Windows x64, Node 24.21.0, pnpm 12.6.0, Rust/Cargo 1.99.1 MSVC estable,
Visual Studio 18 Build Tools con C++ x64/x86, WebView2 155.0.4283.62.
Rust estaba instalado fuera de PATH; se agregó solo al entorno de validación.

- `pnpm typecheck`: correcto (también ejecutado por build/test).
- `pnpm lint`: correcto, sin advertencias.
- `pnpm format:check`: correcto.
- `pnpm build`: correcto, recursos locales en dist/.
- `pnpm test`: dos pruebas aprobadas, ninguna omitida.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: correcto.

- `pnpm install --frozen-lockfile`: correcto, instalación reproducible sin modificar
  el lockfile.
- Vista previa de producción: pantalla comprobada visualmente en navegador local,
  con nombre, aviso offline y estado inicial sin captura de datos.
- `pnpm tauri info`: detecta todos los prerrequisitos de escritorio. La ausencia de
  `@tauri-apps/api` es deliberada: no se invoca ninguna API nativa desde JavaScript.
- Primer intento de `pnpm tauri:dev`: Vite inicia correctamente, pero Rust falla antes
  de abrir una ventana nativa. Windows bloquea la carga de
  `src-tauri/target/debug/deps/webview2_com_macros-*.dll`, error de sistema **4551**.
- Primer intento de `pnpm tauri:build`: frontend correcto; Rust falla antes de generar el ejecutable
  o instalador. Windows bloquea el build script de `getrandom` en
  `src-tauri/target/release/build/`, también con error **4551**.

## Bloqueo inicial y repetición del arranque

El evento **3077** de `Microsoft-Windows-CodeIntegrity/Operational` confirma que
la biblioteca generada no cumple los requisitos de firma empresarial o la política
de integridad de código del equipo. No falta instalar Rust, MSVC ni WebView2.
El agente no desactivó controles, agregó exclusiones ni cambió políticas.

El usuario indicó haber resuelto el bloqueo y solicitó repetir el arranque.
El nuevo `pnpm tauri:dev` compiló correctamente el perfil de desarrollo en 43,21 s
y ejecutó `target/debug/classnote.exe`. Se comprobó el proceso `classnote`, con
ventana titulada **ClassNote** y estado `Responding: True`. Se dejó abierto para
revisión del usuario. Esto confirma el arranque nativo; no constituye inspección
visual del contenido dentro de WebView2 ni prueba del instalador.

La repetición de `pnpm tauri:build` finalizó correctamente (código de salida 0).
Rust compiló el perfil release en 54,35 s y Tauri generó el ejecutable y un bundle
NSIS Windows x64 de 1,85 MiB:

- `src-tauri/target/release/classnote.exe`.
- `src-tauri/target/release/bundle/nsis/ClassNote_0.1.0_x64-setup.exe`.

La primera generación descargó las herramientas oficiales de NSIS y verificó sus
hashes. Los artefactos están excluidos de Git. No se ejecutó el instalador ni se
modificó una instalación de usuario. CN-001 cumple arranque y empaquetado; se marca
completado en TASKS.md. No se crearon commits ni push, ni se avanzó a etapa 02.

Persistencia no aplica: no hay escritura de datos. Instalar en otra computadora
sin internet, cerrar/reabrir la app y analizar tráfico de WebView2 siguen pendientes;
no se consideran cubiertos por las comprobaciones estáticas o la vista previa.
