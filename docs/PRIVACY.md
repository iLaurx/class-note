# Información de privacidad — ClassNote 0.1.0

ClassNote guarda localmente los registros que introduce la docente: ciclos,
grupos, nombres y apellidos, matrículas, asistencia, tareas y entregas, lecturas,
observaciones y selección de contexto. Los identificadores UUID y fechas de
creación/modificación forman parte de la base. No pide cuentas, contraseñas,
datos de tutores ni contacto de familias.

La aplicación no tiene servidor, sincronización entre equipos, telemetría,
publicidad ni recuperación remota. No envía los registros a sus desarrolladores.
Los recursos de producción se incluyen en la aplicación; no hay CDN ni actualizador
automático. Estas características no controlan las comunicaciones del sistema
operativo, WebView2, antivirus o herramientas externas.

Los datos están en IndexedDB, base `classnote`, dentro del perfil WebView2 del
usuario de Windows y origen `http://tauri.localhost`. La ruta predeterminada
esperada es `%LOCALAPPDATA%\org.classnote.desktop\EBWebView`; debe comprobarse
en la instalación concreta. Los perfiles temporales de pruebas no son esa ruta.
El ejecutable no contiene la base y copiarlo a otro equipo no traslada los datos.

**ClassNote no añade cifrado de la base, contraseña ni control de acceso propio.**
No promete protección frente a otras personas con acceso al equipo, su sesión,
privilegios administrativos, malware o copias del perfil. «Observación privada»
significa que es una nota local de la docente, no que esté cifrada o inaccesible
para terceros. Protege la sesión de Windows, el dispositivo y sus unidades.

Un reporte Excel contiene datos del grupo; un respaldo JSON contiene todos los
ciclos y grupos, incluidas observaciones y preferencias. Ambos se guardan donde
la docente elige y **no están cifrados por ClassNote**. No los dejes en carpetas
públicas, equipos compartidos, repositorios ni servicios de nube sin autorización
y protección adecuadas. Si eliges una carpeta sincronizada por otro programa,
ese programa puede subirlos independientemente de ClassNote. El respaldo previo
a restaurar también contiene información sensible y necesita el mismo cuidado.

Archivar un alumno, grupo o ciclo conserva su historial. No equivale a borrar sus
datos. Restaurar reemplaza la base completa tras confirmación y respaldo previo;
las copias exportadas permanecen en sus destinos. No hay un plazo automático de
retención ni borrado integral desde la interfaz. La docente y su institución
deben definir el acceso, conservación y eliminación que corresponda a su uso.

Guarda copias completas frecuentes fuera del perfil y comprueba su recuperación.
No se garantiza conservación ante eliminación del perfil, desinstalación,
actualización no verificada, fallo de disco o corte eléctrico. No hay copia remota
del desarrollador desde la que recuperar registros perdidos.

Para pedir ayuda o informar un fallo, usa solo datos sintéticos. No compartas
bases, respaldos, Excel, capturas o nombres reales de menores. No se ha habilitado
un canal de soporte privado de distribución; no publiques información sensible
en canales públicos. Este documento describe el comportamiento del producto;
no sustituye el aviso institucional ni establece cumplimiento legal por sí mismo.
