# ClassNote v0.1.0 — entrega local Windows

Fecha: 20/10/2026. Licencia MIT, ClassNote contributors. Sin firma, publicación,
subida a internet ni actualización automática.

## Notas de versión

Primera entrega Windows x64: ciclos y grupos; alumnos y matrículas; asistencia;
tareas y entregas; lecturas; observaciones y resumen de Inicio. Ocho secciones
en español, almacenamiento local Dexie/IndexedDB v1 y protección de borradores.
Sin cuenta, backend ni sincronización.

Excel con cuatro hojas (Alumnos, Asistencia, Tareas, Lecturas) por grupo y rango;
no es restaurable ni incluye observaciones privadas. Respaldo JSON completo de
diez tablas, validación, previsualización, confirmación y copia previa obligatoria.
Sin cifrado añadido. Incluye [instalación](INSTALLATION.md), [privacidad](PRIVACY.md)
y licencia en el directorio instalado; NSIS muestra MIT.

## Compilación reproducible

Desde la raíz del checkout en Windows x64, con Node 24.21.0, pnpm 12.6.0,
Rust/Cargo 1.99.1 MSVC, Build Tools C++/Windows SDK y WebView2 disponibles:

```powershell
pnpm install --frozen-lockfile
pnpm tauri:build
```

Conservar `pnpm-lock.yaml` y `src-tauri/Cargo.lock`. La primera compilación puede
requerir internet para dependencias y herramientas NSIS. El uso offline del
producto no implica compilación inicial offline. No se afirma reproducibilidad
binaria bit a bit entre equipos.

- Ejecutable: `src-tauri/target/release/classnote.exe`.
- Instalador: `src-tauri/target/release/bundle/nsis/ClassNote_0.1.0_x64-setup.exe`.
- Evidencia nueva excluida de Git: `src-tauri/target/cn014-evidence/`.
- CN-013 preservada allí antes de las nuevas pruebas: `cn013-native/` y `cn013-pending/`.

El ejecutable suelto debe acompañarse de licencia y documentos si se distribuye;
el instalador incorpora estos recursos. No incluye WebView2, Node ni Rust.

## Verificación CN-014

Resultados nuevos del 20/10/2026, separados de las
pruebas históricas de `docs/HARDENING.md` del repositorio. CN-013 se considera completada
por decisión del usuario; su matriz conserva límites y casos no ejecutados:
primer inicio totalmente offline, reinicio del SO, actualización entre releases
reales, desinstalación y lector de pantalla. No se rehace esa etapa. CN-002 sigue
fuera de alcance.

| Comprobación nueva       | Resultado / evidencia relativa a `src-tauri/target/cn014-evidence/`                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calidad                  | `lint.log`, `format.log`, `typecheck.log`: aprobados                                                                                                                                                                                     |
| Suite completa           | `test-authorized.log`: 63 DB + 2 distribución + 64 UI aprobadas                                                                                                                                                                          |
| Frontend y empaquetado   | `build-delivery.log`: `pnpm tauri:build` aprobado; ejecuta `pnpm build`                                                                                                                                                                  |
| Metadatos y arquitectura | `artifacts.json`: producto ClassNote, versión archivo/producto 0.1.0, copyright ClassNote contributors, NotSigned; SHA-256 y tamaños registrados                                                                                         |
| NSIS                     | Lanzador PE x86 (0x014C), payload x64 configurado; ejecutable instalado PE AMD64 (0x8664), diferencia esperada del marcador Tauri UNK/NSS; resto de bytes iguales                                                                        |
| Instalación              | `install-result.json`: NSIS `/S /NS /D=...`, código 0, licencia y tres guías presentes; sin instalación previa ni accesos directos                                                                                                       |
| Uso y reapertura         | `native-delivery/result.json`: binario instalado, perfil nuevo aislado, 39 registros de dominio, diez tablas exactas, UI y nuevas escrituras offline tras cierre real                                                                    |
| Excel nativo             | `native-delivery/excel-result.json`: guardar y cancelar reales; XLSX reabierto con ExcelJS, cuatro hojas, sin fórmulas; base intacta                                                                                                     |
| Respaldo y restauración  | `native-delivery/backup-result.json`: exportación, previsualización, confirmación, copia previa física validada y restauración; rollback intermedio real; tercera apertura conserva diez tablas, UUID, auditoría, relaciones y selección |
| Capturas                 | `native-delivery/backup-preview.png`, `native-delivery/backup-after-restart.png` y `native-delivery/reports-*.png` inspeccionadas                                                                                                        |

Se reutilizó `pnpm test:native` con `CN_NATIVE_EXE` y `CN_NATIVE_OUTPUT` apuntando
al instalado y a evidencia separada; `CN011_EXPORT_UI=1` y `CN012_BACKUP_UI=1`
habilitan los diálogos reales. Comandos completos: `TESTING.md` del repositorio.
No se repitió la carga de 35/100 ni la apertura por Microsoft Excel de CN-013.
Su evidencia se conserva como histórica; en CN-014 la apertura nueva usa ExcelJS.

Incidencias: el primer build generó el ejecutable pero falló al intentar descargar
NSIS (error DNS 11001). Un intento durante la preparación falló porque aún faltaba
el documento de release referenciado; se añadió antes del build aprobado. La
primera suite en entorno restringido quedó esperando el servidor local y se
canceló; el reintento autorizado completó 64/64 UI, sin relajar pruebas. Vite
mantiene la advertencia de tamaño del fragmento ExcelJS y Playwright la de color
de consola; no son errores. Los logs de intentos y del resultado final se conservan.

### Límites y aceptación pendiente

La instalación nueva es real pero silenciosa, en una ruta del proyecto, bajo el
usuario de Windows actual; registra ClassNote en Windows. El perfil de datos es
temporal e independiente. No se usó una VM ni un usuario Windows nuevo. No
demuestra el recorrido interactivo del asistente por una persona no técnica.
La evidencia no debe borrarse mientras la instalación de prueba siga registrada.

La comparación binaria se registra en `binary-comparison.json`: Tauri cambia el marcador
`__TAURI_BUNDLE_TYPE_VAR_UNK` a `__TAURI_BUNDLE_TYPE_VAR_NSS` dentro del NSIS.
Los SHA-256 del ejecutable suelto y el instalado se registran por separado, sin
exigir igualdad de esos tres bytes de identificación del paquete.

El aislamiento offline del WebView2 se aplica por CDP después de cargar la UI:
no demuestra instalación o primer inicio totalmente desconectados ni ausencia
de tráfico del SO/runtime. Windows 10, actualización entre releases reales,
desinstalación con datos personales, reinicio del SO, fallos físicos y lector
de pantalla no se validaron en CN-014. No se promete cifrado ni conservación
ante actualización/desinstalación.

**CN-014 permanece pendiente de aceptación por una persona no técnica** que,
siguiendo INSTALLATION.md, instale interactivamente en un equipo de prueba con
WebView2 disponible, use la aplicación sin internet y guarde un respaldo.
Registrar entorno, fecha y evidencia sintética de ese recorrido antes de marcar
la tarea completa. La preparación técnica y los documentos sí están verificados.

## Checklist de publicación

- [x] Licencia MIT elegida y texto estándar con titular correcto.
- [x] Identidad, origen, perfil, schema v1, CSP y permisos conservados.
- [x] Guías de instalación, WebView2, actualización, respaldos y privacidad.
- [x] Compilación final y arquitectura/metadatos de ambos artefactos verificados.
- [x] Instalación y uso básico con perfil aislado y datos sintéticos verificados.
- [x] Excel y respaldo/restauración comprobados; evidencia nueva preservada.
- [ ] Persona no técnica completa instalación, uso offline y respaldo.
- [ ] Antes de publicar: revisar avisos/licencias de dependencias y compatibilidad.
- [ ] Antes de publicar: decidir firma, canal de soporte y distribución.
- [ ] Publicación expresamente autorizada por el usuario.

Los tres últimos pasos no forman parte de esta preparación. La aprobación de
CN-013 no sustituye la aceptación del flujo de instalación de CN-014.
