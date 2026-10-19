# Seguridad, privacidad y recuperación

## Contexto
ClassNote maneja registros educativos potencialmente sensibles de **menores de edad**. Ser offline no significa automáticamente cifrado, control de acceso o protección ante otros usuarios de Windows.

## MVP: políticas obligatorias
- No datos reales en Git, fixtures, capturas, issues, PRs ni telemetría.
- No llamadas a CDN/APIs externas en producción; revisar dependencias y funcionalidades de actualización de Tauri.
- Mantener permisos/capabilities Tauri mínimos; diálogo de archivos solo tras acción explícita.
- Validar todos los imports y campos libres; neutralizar entradas que puedan convertirse en fórmulas de Excel.
- Mantener rutas de datos estables y evitar borrado en actualizaciones/desinstalación hasta verificar políticas.
- Advertir que el usuario debe proteger su sesión de Windows y los archivos exportados.
- **No afirmar que los datos están cifrados**; IndexedDB y JSON de respaldo no lo garantizan por sí solos.

## Backups
- Recomendación inicial: respaldo manual frecuente en unidad elegida, con copias adicionales controladas por el docente.
- Antes de restaurar: validar formato/versión, avisar del reemplazo, generar backup previo si es factible y probar recuperación ante error.
- Dejar claro qué se exporta (todos los módulos) y qué no.
- No guardar respaldos en carpetas públicas por defecto.

## Reporte responsable
No publicar datos de menores ni archivos reales al reportar vulnerabilidades. Abrir inicialmente un canal privado de reporte (por configurar cuando exista repositorio) y describir pasos reproducibles con datos sintéticos.

## Antes de distribución pública
Revisar avisos de privacidad y obligaciones legales aplicables en regiones objetivo; políticas de retención/borrado de datos; licencias; seguridad de dependencias; firma de instaladores si es viable.
