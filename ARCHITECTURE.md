# Arquitectura técnica — ClassNote

## Decisión base
App instalable Windows: **Tauri 2** aloja UI **React + Vite + TypeScript** dentro de **WebView2**. **Dexie.js** accede a **IndexedDB** en el perfil persistente de WebView2. **ExcelJS** genera `.xlsx`. **dexie-export-import** crea/importa backups estructurados. No hay backend, servidor o cuenta.

```text
Windows / Tauri 2 (WebView2)
  UI: React + Tailwind + componentes
    ↓ acciones / hooks
  Dominio: validación + casos de uso + estadísticas
    ↓ repositorios (interfaces)
  Infraestructura: Dexie / IndexedDB
    ↘ exportadores ExcelJS
    ↘ backups dexie-export-import + diálogo/ruta archivo Tauri
```

## Responsabilidades
- `src/app/`: rutas, providers, shell, navegación.
- `src/features/{school-years,groups,students,attendance,assignments,reading,notes,reports}/`: UI + casos de uso, por módulo.
- `src/domain/`: tipos, invariantes y reglas puras compartidas.
- `src/db/`: schema Dexie, migraciones, acceso repositorios, transacciones.
- `src/services/export/`: conversores a hojas Excel; independiente de UI.
- `src/services/backup/`: exportar/importar; comprobación de versión/estructura; transacciones o estrategia segura de restauración.
- `src/lib/tauri/`: adaptadores de diálogo/sistema de archivos, permisos mínimos.
- `src/components/ui/`: elementos visuales reutilizables.

## Reglas
1. UI no conoce detalles de IndexedDB; exponer hooks/servicios y probar lógica separadamente.
2. Todas las dependencias de datos apuntan a repositorios, no a componentes.
3. `useLiveQuery` solo en capa de hooks de lectura cuando aporte valor; no disparar escrituras dentro de renders.
4. `schoolYearId/groupId/enrollmentId` explícitos en operaciones; evitar depender silenciosamente del grupo seleccionado.
5. Para bulk attendance, operación transaccional con unicidad para evitar duplicados.
6. Los archivos exportados se guardan mediante flujo de archivo Tauri compatible con permisos/capabilities y sin escritura fuera de lo elegido por el usuario.
7. Migraciones Dexie incrementales y probadas desde una base con datos; no usar `delete()`/`clear()` para resolver migraciones.

## Nota crítica sobre persistencia en Tauri
La BD Dexie reside en almacenamiento WebView2 (perfil web). No es un archivo SQLite junto al `.exe`; puede perderse si se elimina el perfil de la app. Configurar y validar que el directorio de datos sea estable entre versiones y actualizaciones; verificar comportamiento de instalador/desinstalador. Mantener backups fuera del perfil de datos y probar restauración. Evitar confiar en export JSON como único resguardo hasta probarlo de extremo a extremo.

## Excel
- Exportaciones de proyección a partir de consultas validadas, no volcado directo de la BD.
- Columnas estables y nombres de hojas breves, únicos, seguros para Excel.
- Neutralizar valores que comiencen con `=`, `+`, `-`, `@` u otros patrones interpretables como fórmula en celdas de usuario, también al generar CSV futuro.
- Usar fechas como texto ISO o fecha de Excel documentada; priorizar consistencia y zonas horarias locales.
- Generación de libros grandes en UI no debe congelar app; evaluar worker si métricas reales lo requieren.

## Arquitectura de backup
Exportar base con metadatos (`appVersion`, `schemaVersion`, `createdAt`) y archivo de datos. Validar metadatos/versiones, mostrar resumen, requerir confirmación y crear respaldo previo antes de restaurar. Restauración debe ser atómica o garantizar recuperación tras interrupción; probar fallo parcial. **No tratar un `.xlsx` como backup completo.**

## Estructura inicial sugerida
```text
src/app/ src/components/ui/ src/domain/ src/db/
src/features/school-years/ src/features/groups/
src/features/students/ src/features/attendance/
src/features/assignments/ src/features/reading/
src/features/notes/ src/features/reports/
src/services/export/ src/services/backup/ src/lib/tauri/
src-tauri/ tests/ docs/
```
