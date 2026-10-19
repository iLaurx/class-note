# CN-003 — Dexie v1 y persistencia offline

Implementado y validado el 19 de octubre de 2026. Alcance exclusivo CN-003: base
tipada, repositorios e inicialización. No hay formularios escolares ni dashboard real.

## Archivos entregados

- Dominio: `src/domain/models.ts`, `src/domain/validation.ts`.
- Persistencia: `src/db/database.ts`, `errors.ts`, `repositories.ts`, `storage.ts`.
- Arranque/UI: `src/main.tsx`, `src/app/App.tsx`, `StorageProvider.tsx`,
  `StorageNotice.tsx`, `useStorage.ts`, `styles.css`.
- Pruebas: `tests/db/fixtures.ts`, `tests/db/persistence.test.ts`,
  `tests/ui/navigation.spec.ts`, `tests/native/probe.ts`, `tests/native/persistence.mjs`.
- Herramientas: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.prettierrc.json`.
- Documentación: `DATA_MODEL.md`, `DECISIONS.md`, `TESTING.md`, `TASKS.md` y este archivo.
  `TASKS.md` ya está excluido por la regla existente de `.gitignore`; se actualiza
  localmente sin modificar esa política. No se crean ramas, commits ni PRs.

## Arquitectura y archivos

`StorageProvider` inicializa `StorageService`; `useStorage` expone estado, reintento
y repositorios solo cuando la base está lista. `StorageNotice` muestra carga mediante
`role=status`, error mediante `role=alert` y un botón de reintento accesible. La base
no se considera lista hasta resolver `open()`. El servicio comparte la promesa de
apertura ante efectos repetidos de StrictMode; no crea registros en ningún arranque.
El provider no cierra la base en la limpieza del efecto: la instancia vive durante
la sesión de la app y no depende del montaje/desmontaje de vistas.

Flujo: UI → hook/provider/servicio → `Repositories` → `ClassNoteDatabase` → IndexedDB.
Tipos y reglas puras están en `src/domain/`; infraestructura y transacciones, en
`src/db/`. Los componentes no importan Dexie ni acceden directamente a sus tablas.
No hay fallback en memoria ni escritura a localStorage/sessionStorage.

Los repositorios ofrecen altas explícitas para las diez entidades y consultas por
ciclo, grupo o matrícula según corresponda. Alumnos se consultan por UUID global;
configuración por clave. No hay CRUD genérico ni operaciones de borrado/edición.
Cada operación transaccional cubre las diez tablas para permitir composición segura
en esta primera versión. Las lecturas también validan contexto dentro de transacción.
El lote de asistencias por matrícula es una operación de infraestructura para probar
atomicidad; no implementa la UI ni los resúmenes de CN-006.

## Esquema e invariantes

Nombre estable `classnote`, diez stores declaradas exclusivamente en `db.version(1)`.
Esquema, campos e índices completos: [DATA_MODEL.md](../DATA_MODEL.md). No existía
persistencia en la etapa anterior; no se inventa v0 ni v2. No se cambia identifier,
origen, perfil predeterminado, permisos nativos ni CSP de Tauri.

Los IDs se generan como UUID; todos los registros de dominio tienen auditoría ISO
UTC. Fechas escolares permanecen como texto local YYYY-MM-DD, validado por calendario
sin conversión UTC. Entrada externa `unknown`, campos requeridos recortados, estados
y categorías cerrados, grado entero 1–6 y minutos enteros no negativos. Configuración
admite escalares JSON, sin objetos libres ni valores numéricos no finitos.

Turno opcional fuera de identidad del grupo v1. Unicidad sensible a mayúsculas/acentos.
Asistencia dentro de ciclo y matrícula, ambos extremos inclusivos, incluida salida.
La matrícula debe estar dentro del ciclo. Entregas solo para tareas del mismo grupo
de la matrícula. Varias lecturas en un día son válidas. No se añaden métricas ni
políticas temporales de otros módulos. Las restricciones únicas las impone IndexedDB;
las referencias se comprueban dentro de la transacción de escritura.

Errores de validación y duplicados tienen textos en español; otros fallos se traducen
a un mensaje genérico sin registros personales, stack, nombres o valores de entrada.
Un fallo no dispara `delete`, `clear`, recreación ni semillas. El reintento intenta
abrir la misma base. No se añaden logs de datos.

El dashboard conserva sus mocks y su aviso explícito: nunca se insertan. Abrir una
instalación/perfil nuevo deja cero registros en las diez tablas, incluso configuración.
La UI comunica almacenamiento local, protección de la sesión de Windows y necesidad
de respaldos externos, indicando que el flujo de respaldo aún está en preparación.
No promete cifrado ni recuperación remota.

## Dependencias y herramientas

- Producción: Dexie 4.4.6.
- Desarrollo: fake-indexeddb 6.2.6, solo pruebas.
- Se reutilizan Node Test Runner y Playwright existentes. Node 24 ejecuta tests TS
  con `--experimental-strip-types`; TypeScript comprueba también las pruebas con
  `allowImportingTsExtensions` y `noEmit`. No se añade Vitest, CI ni hooks Dexie.
- `pnpm-lock.yaml` actualizado. ExcelJS y dexie-export-import quedan para sus etapas.
- Prettier conserva el final de línea detectado (`endOfLine: auto`): los archivos
  existentes con CRLF de Windows ya tenían el formato correcto. Se evita reescribir
  catorce archivos ajenos al cambio únicamente por sus finales de línea.

## Versionado y conservación

Para un cambio futuro de esquema: conservar v1, añadir `version(n)` incremental,
declarar los cambios y usar `upgrade` si hay conversión de datos. Añadir prueba desde
una base de versión anterior poblada, verificar UUID, relaciones y valores antes de
publicar. Nunca editar destructivamente una versión publicada para arreglar un fallo.
CN-003 prueba reapertura v1 con datos, no una migración entre versiones inexistentes.

IndexedDB vive en el perfil WebView2, no junto al ejecutable. Eliminar ese perfil
puede eliminar los datos. No se ha probado conservación tras actualización,
desinstalación ni limpieza de Windows; esas comprobaciones siguen en CN-013.

## Reproducción de la prueba nativa

Requisitos: Windows con WebView2, Node 24, pnpm y toolchain Tauri/MSVC/Rust.

```powershell
pnpm tauri:build
pnpm test:native
```

El script `tests/native/persistence.mjs` realiza lo siguiente:

1. Compila en memoria `tests/native/probe.ts`, sus fixtures sintéticos y los
   repositorios reales mediante Vite en modo librería. Este código no es importado
   desde `src/`, no entra en `dist/` ni en el instalador. No levanta servidor Vite.
2. Crea un directorio nuevo en `test-results/native/webview2-*` y un puerto local
   disponible. Lanza `src-tauri/target/release/classnote.exe` con variables del proceso
   `WEBVIEW2_USER_DATA_FOLDER` y `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` para perfil
   aislado y CDP ligado a loopback. No modifica registro ni variables globales.
3. Se conecta con Playwright al WebView2 real, espera el estado listo, confirma el
   perfil creado y el origen `http://tauri.localhost`. Aísla la red del contexto CDP
   y comprueba `navigator.onLine === false`. No toca la red del equipo.
4. Comprueba las diez tablas vacías. Ejecuta la sonda mediante Runtime.evaluate del
   depurador: alta/consulta con los repositorios reales, una fila en cada tabla
   (nueve registros de dominio y una configuración). Captura la instantánea completa.
5. Desconecta el depurador, solicita cierre normal de la ventana del PID lanzado,
   espera su salida y confirma que no quedan procesos WebView2 asociados al perfil.
6. Lanza de nuevo el mismo ejecutable/perfil con un PID distinto, vuelve a aislar la
   red del contexto y compara exactamente la instantánea completa. Comprueba una
   escritura/lectura adicional y navegación por las ocho vistas sin solicitudes
   externas observadas. Cierra también esta instancia.

Las variables de WebView2 son mecanismos documentados por
[Microsoft Playwright para pruebas de WebView2](https://github.com/microsoft/playwright/blob/main/docs/src/webview2.md).
El depurador y el perfil sintético se habilitan exclusivamente desde el proceso de
pruebas; el producto conserva su configuración. No se usan perfiles personales y no
se eliminan perfiles del usuario. La prueba deja el perfil aislado para inspección.

Evidencia local excluida de Git: `test-results/native/result.json`, `first-launch.png`
y `after-restart.png`. El JSON registra ejecutable, perfil, PIDs distintos, origen,
fecha UTC, tablas conservadas, igualdad exacta, escritura posterior y solicitudes.
Las capturas muestran la UI real de demostración; los datos sintéticos de DB se
comprueban mediante la sonda, pues los formularios aún no existen.

## Validación y límites

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: correctos.
- `pnpm test`: 12 DB/dominio + 2 distribución + 7 UI, todas aprobadas.
- `pnpm build`: correcto, recursos locales.
- `pnpm tauri:build`: correcto; ejecutable release e instalador NSIS x64 de 1,89 MiB.
- `pnpm test:native`: correcto; reapertura con valores/UUID/relaciones de diez tablas
  conservados y escritura posterior offline. Inspección visual de captura WebView2
  tras reinicio: navegación, aviso local y diseño de demostración conservados.

El entorno restringido bloqueó el servidor local de la primera suite UI; se canceló
y repitió con acceso autorizado. El primer empaquetado falló al descargar NSIS por
DNS (11001); el reintento con acceso autorizado terminó correctamente. No se cambió
ninguna política de seguridad ni configuración de red del equipo.

La desconexión CDP se activa después de cargar la UI: no prueba primer arranque
nativo sin internet ni tráfico de fondo de WebView2/Windows. Las pruebas de Edge y
fake-indexeddb son evidencia adicional y no sustituyen el cierre/reinicio nativo.
Quedan para hardening: instalación offline en otro equipo, reinicio de Windows,
actualización, desinstalación, durabilidad ante corte abrupto, respaldo/restauración
y lector de pantalla. No se afirma conservación en esos escenarios. CN-002 sigue
pendiente; esta etapa no añade CI ni funcionalidades docentes posteriores.

Commit sugerido: `feat(db): add Dexie schema and repositories`.
