# Respaldo completo y restauración — CN-012

## Revalidación CN-013 (20/10/2026)

Matriz vigente y límites: [HARDENING.md](HARDENING.md). Suite global 63 DB + 2
distribución + 64 UI aprobadas; corregidos los dos fallos históricos de pruebas
de consulta de Lecturas/Observaciones mediante sincronización con Inicio, sin
modificar módulos de aplicación ni aserciones de recuperación.

Checkpoint CN-012 con diálogos reales aprobado en perfil temporal nuevo:
exportación, respaldo previo físico validado, reemplazo, rollback intermedio y
tercera apertura con diez stores exactas/relaciones recuperadas por UI.
`native/backup-result.json` y `dialog-persistence-result.json` preservan esa ejecución.
Hardening final añade carga 35/100, fuente truncada rechazada antes de respaldo
previo, cancelación de confirmación/guardado, fallo de almacenamiento simulado,
rollback y reintento sin pérdida; compara valores, UUID y auditoría de diez stores.
Otro perfil nuevo vacío importa el respaldo y conserva todo tras cierre/reapertura.
Evidencia: `native/hardening-result.json`, `clean-restore-result.json`, instantáneas
`hardening-*.json`, `clean-*.json` y capturas nativas. Los callbacks de archivo de
la sonda son simulados; el pre-backup físico se comprueba en el checkpoint UI.

Se conserva contrato v1 y todas las implementaciones de CN-012. Un perfil nuevo
no acredita instalación limpia. Actualización/desinstalación/reinicio de Windows,
corte y daño físico siguen pendientes; no se borraron perfiles personales ni se
cambió la red. Guardar copias fuera del perfil antes de desinstalar; su conservación
durante desinstalación aún no está verificada.

## Uso

En Configuración, **Guardar respaldo completo** abre un diálogo para elegir el
destino JSON. Incluye las diez tablas de todos los ciclos y grupos, también las
vacías, observaciones privadas y preferencias. No es el reporte Excel de CN-011.
Contiene registros educativos locales sin cifrado: proteger el archivo y la sesión
de Windows, guardar copias fuera del perfil de ClassNote y conservarlas.

**Elegir respaldo para restaurar** abre exclusivamente el archivo elegido. Tras
validarlo, muestra fecha UTC, versión de aplicación/formato/esquema y conteos de las
diez tablas. La docente debe confirmar expresamente el reemplazo de TODOS los datos
locales y elegir destino para un respaldo previo completo. Cancelar selección,
confirmación, previsualización o guardado previo no reemplaza datos ni muestra éxito.
Un error conserva la previsualización y permite volver a confirmar o cancelar.

## Contrato y límites

JSON UTF-8 con `format: classnote-backup`, `formatVersion: 1`, `appVersion: 0.1.0`,
`schemaVersion: 1`, `createdAt` ISO UTC y `data` con el export completo de
`dexie-export-import` 4.4.1. Se conserva Dexie v1; no hay migración. Esta primera
versión acepta únicamente esas versiones exactas: las futuras necesitan una decisión
explícita de compatibilidad. No importa Excel, formatos futuros ni datos reparados.

Se validan entradas como unknown: sobre/campos exactos, diez tablas declaradas y
presentes con índices v1 exactos, conteos, UUID, auditoría UTC válida, texto normalizado,
fechas civiles reales e intervalos, estados/categorías, minutos/grados, escalares de
ajustes y todas las referencias. Se admite solamente la anotación Typeson `undef`
en campos opcionales conocidos, conservando los valores undefined existentes.
Otros tipos especiales o campos desconocidos se rechazan. Archivos truncados o JSON
inválido fallan antes de la escritura activa.

Las preferencias de selección pueden referir contextos inexistentes/archivados.
Se restauran como parte del archivo y el mecanismo existente `loadWorkspace` conserva
el ciclo válido, descarta grupo inválido o deja ambos sin selección, sin elegir otro
grupo. No se reasignan registros educativos. Los archivos con historia fuera de los
intervalos actuales, incluso incidencias que módulos anteriores pueden conservar
tras correcciones, se rechazan para restauración; no se recortan silenciosamente.
El respaldo previo exporta fielmente la base actual aunque tenga esas incidencias.

## Integridad y recuperación

UI → servicio de respaldo de StorageService → Dexie. La UI nunca accede a tablas.
El export y su instantánea para conflictos comparten transacción readonly de diez
stores. El addon se carga desde recursos empaquetados al usarlo.

Antes de reemplazar, el servicio importa con `importInto` en una base nueva
`classnote-restore-validation-UUID`, declarada con el mismo schema v1. La importación
comprueba índices únicos; se verifica igualdad de todas las filas y se repiten las
reglas sobre los datos de la base temporal. Se elimina únicamente esa base temporal
al terminar. No se borra/recrea la base activa ni se cambia nombre/origen/perfil.

Después de guardar el respaldo previo, una transacción rw que incluye las diez
stores compara la base actual con la instantánea respaldada. Cambios concurrentes
cancelan el reemplazo. Solo dentro de esa transacción limpia e inserta todas las
tablas; cualquier excepción revierte limpieza, inserciones y selección. No hay
escrituras parciales ni cascadas. El archivo previo permanece en el destino elegido.

Tras commit, recarga contexto y remonta la administración escolar; las demás vistas
leen el contexto restaurado al navegar. Fallo de lectura posterior informa que el
reemplazo sí ocurrió y ofrece únicamente reintentar contexto; no repite importación.
Bloqueo inmediato de doble envío y guarda de navegación durante procesamiento y
previsualización, sin guardar automáticamente borradores.

## Archivos nativos y privacidad

Se reutiliza NativeFileDialogs de CN-011, sin modificar confirmaciones síncronas.
Comandos propios `open_backup` y `save_backup`: JS recibe contenido o envía texto,
nunca proporciona rutas. El diálogo Rust elige exclusivamente un archivo local.
Sin permisos generales de fs/dialog en JS, sin nuevas capabilities ni dependencias
Rust; identifier/origen/CSP/perfil intactos. Sin carpeta pública predeterminada.

Lectura y escritura limitadas a 100 MiB; lectura acotada incluso si el archivo crece.
El guardado escribe un temporal exclusivo junto al destino, sincroniza, cierra y
renombra. Solo devuelve true tras completar; si falla elimina únicamente su temporal.
No elimina el archivo de respaldo elegido. Un destino existente requiere la
confirmación de reemplazo del diálogo. No hay logs de contenido ni envío remoto.

El procesamiento y comparación usan memoria proporcional al respaldo: 100 MiB es
un límite de entrada, no una promesa de rendimiento para bases de ese tamaño.
Atomicidad IndexedDB no acredita recuperación ante corte eléctrico, disco dañado,
limpieza de perfil, instalación, actualización o desinstalación; siguen en CN-013.

## Verificación reproducible

- `tests/db/backup.test.ts`: bases UUID aisladas y fake-indexeddb, export/import de
  diez tablas vacías y relacionadas con igualdad exacta, conteos, versiones,
  corrupción/truncado, referencias, invariantes, duplicados, cancelación, disco fallido,
  conflicto durante pre-backup, fallo real al escribir entregas con rollback total,
  selección válida/inválida y recuperación desde respaldo previo.
- `tests/ui/backup.spec.ts`: UI en 1100/768/360 px, foco/teclado y sin desbordamiento,
  export/previsualización/restauración offline, cancelaciones, error de archivo y de
  guardado, lectura posterior fallida sin repetir importación. IPC simulado solo en tests.
- `tests/native/persistence.mjs`: conserva regresiones y añade checkpoint
  `$env:CN012_BACKUP_UI='1'; pnpm test:native`. En los diálogos reales elegir las
  rutas sintéticas impresas: respaldo-webview2-ID.json y respaldo-previo-webview2-ID.json en
  test-results/native. Exporta en primer proceso; cierra completamente y reabre mismo
  release/perfil aislado; restaura tras cambios adicionales, valida respaldo previo,
  cierra y reabre por tercera vez. Compara diez tablas exactas y relaciones por UI.
  No hay puente de pruebas en producto ni perfiles personales.

Ejecutar lint, format:check, typecheck, test, build, tauri:build y finalmente
test:native. UI limpia test-results, por eso la evidencia nativa se genera al final.
Capturas `backup-preview-*.png` y `native/backup-*.png`; resultados nativos y archivos
sintéticos quedan fuera de Git. El aislamiento offline es del contexto WebView2,
no modifica la red del equipo ni demuestra ausencia de tráfico de Windows.

## Resultados de ejecución

Resultados finales del 20/10/2026:

- `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` y
  `pnpm tauri:build`: aprobados. Release x64 e instalador NSIS de 2.357.454 bytes.
  Advertencia de tamaño del fragmento ExcelJS de CN-011, sin error de compilación.
- `pnpm test`: 63/63 dominio/DB y 2/2 distribución aprobados; UI 62/64, incluidas
  las 5/5 de CN-012. Siguen fallando notes.spec.ts:235 y reading.spec.ts:209 al esperar
  el aviso de error de consulta inicial tras el ensayo entre ventanas. Se reprodujeron
  en ejecución aislada; son pruebas existentes, sus archivos/módulos no se tocaron.
  No se afirma que la suite global esté verde ni se atribuye el fallo al entorno
  sin evidencia. El alcance CN-012 tiene sus verificaciones aprobadas.
- Tras el último ajuste, `pnpm test:db`: 63/63, incluida ficha archivada, matrícula
  inactiva, selección inválida y conservación de auditoría con reloj corregido.
- `CN012_BACKUP_UI=1 pnpm test:native`: aprobado en release, perfil
  `test-results/native/webview2-TmcFic`, PIDs 33124 → 26844 → 23740. Exportación real,
  cierre/reapertura completa, rollback real provocado al insertar entregas, selección
  anterior intacta y reemplazo real desde archivo con respaldo previo guardado.
  El respaldo previo se reabrió/validó y coincidió exactamente con la base anterior.
  Tercera apertura conserva las diez tablas exactas, UUID/auditoría/relaciones y
  selección; alumnos, asistencia, tareas/entregas, lecturas y notas recuperados por UI.
  Contexto WebView2 offline, cero solicitudes externas observadas. Evidencia:
  `native/backup-result.json`, `native/result.json` y capturas `native/backup-*.png`.
- Archivos sintéticos finales conservados: `respaldo-webview2-TmcFic.json` (11.881
  bytes) y `respaldo-previo-webview2-TmcFic.json` (12.393 bytes). Sin perfiles
  personales ni cambios de red. Capturas de 1100/768/360 px y vistas nativas tras
  restaurar/reabrir inspeccionadas.

Incidencias resueltas durante la verificación: primer preview restringido quedó
bloqueado; al cancelarlo se liberó su puerto y se repitió con acceso autorizado.
NSIS no pudo descargarse por DNS en el entorno restringido; el empaquetado autorizado
terminó correctamente. Un reintento UI detectó foco antes de habilitar Cancelar a
360 px; ahora el efecto enfoca después de terminar la validación. La primera prueba
nativa rechazó el respaldo previo por imponer updatedAt >= createdAt: el reloj
sintético se había atrasado. Se retiró esa restricción ajena al modelo, validando
ambos timestamps UTC y preservándolos exactamente, con prueba de regresión. La
repetición nativa completa pasó, incluido rollback y tercera apertura.

CN-012 completa con esta evidencia; no cierra CN-002, los dos fallos de UI existentes
ni las garantías de instalación/actualización/desinstalación/corte de CN-013.
