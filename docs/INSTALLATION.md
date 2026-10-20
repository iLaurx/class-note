# Instalar y usar ClassNote 0.1.0

## Antes de instalar

Necesitas Windows 11 de 64 bits y Microsoft Edge WebView2 Runtime Evergreen.
Windows 10 no ha sido validado para esta entrega. No necesitas Node.js, Rust,
Excel ni una cuenta para usar ClassNote. Excel o un visor compatible solo hace
falta para abrir los reportes `.xlsx` fuera de la aplicación.

El archivo de instalación es `ClassNote_0.1.0_x64-setup.exe`. Esta entrega local
no está firmada. Windows puede mostrar una advertencia de editor desconocido;
comprueba su procedencia y la suma SHA-256 entregada por quien lo distribuye.
No desactives las protecciones de Windows para abrir un archivo cuya procedencia
no puedas comprobar. Un bloqueo de la política del equipo requiere apoyo de su
administrador.

El instalador **no incluye ni descarga WebView2**. Si el equipo no lo tiene,
obtén antes el instalador independiente Evergreen x64 desde
[Microsoft WebView2](https://developer.microsoft.com/microsoft-edge/webview2/),
transfiérelo al equipo e instálalo. Prepara ambos archivos mientras tengas acceso
a internet. Instalar dependencias o actualizaciones de Windows es un proceso
separado del uso offline de ClassNote.

## Instalación y primer inicio

1. Cierra ClassNote si está abierto. Ejecuta el instalador y lee la licencia MIT.
2. Sigue las pantallas en español. La instalación es para el usuario actual;
   la ubicación predeterminada es `%LOCALAPPDATA%\ClassNote`.
3. Abre ClassNote desde el acceso creado por el instalador. El primer inicio
   debe mostrar una base vacía; no hay alumnos de ejemplo ni cuenta que activar.
4. En **Configuración**, crea un ciclo escolar con fechas y un grupo. Selecciona
   ese ciclo y grupo como contexto de trabajo.
5. En **Alumnos**, registra una ficha y su matrícula. En **Asistencia**, elige una
   fecha dentro de la matrícula, captura estados y guarda. Espera la confirmación.
6. Puedes crear tareas y capturar entregas, registrar lecturas y observaciones.
   **Inicio** resume los registros del contexto seleccionado. Cambiar de grupo
   no traslada los datos del anterior. Guarda o descarta borradores cuando se avise.
7. Cierra completamente la aplicación y ábrela otra vez con el mismo usuario de
   Windows. Comprueba selección e historial. Haz un respaldo antes de usar datos
   reales; consulta el [aviso de privacidad](PRIVACY.md).

## Uso sin conexión y archivos Excel

Con WebView2 instalado, los módulos y recursos de ClassNote son locales. No hay
login, sincronización, servidor ni actualizador automático. La comprobación de
offline en pruebas no acredita ausencia de tráfico de Windows o del runtime.

En **Reportes**, selecciona ciclo, grupo y rango Desde/Hasta, pulsa **Exportar
Excel** y elige un archivo `.xlsx`. Espera el mensaje de guardado. Cancelar el
diálogo no genera un reporte. El libro contiene Alumnos, Asistencia, Tareas y
Lecturas; no incluye observaciones privadas ni otros grupos. Alumnos incluye las
matrículas del grupo sin filtro temporal. **Excel no sirve para restaurar datos.**

## Respaldar y restaurar

En **Configuración**, pulsa **Guardar respaldo completo**, elige un `.json` fuera
del perfil de la aplicación y espera la confirmación. Incluye todos los ciclos,
grupos, alumnos, registros, observaciones y selección. Hazlo con frecuencia y antes
de actualizar o desinstalar; conserva otra copia en una unidad protegida.
Comprueba periódicamente su restauración en un entorno de prueba sin datos reales.

Para recuperar, pulsa **Elegir respaldo para restaurar**, selecciona el JSON y
revisa fecha, versiones y conteos. Confirmar **reemplaza todos los datos locales**,
no los combina. Debes guardar el respaldo previo obligatorio en otra ubicación
antes del reemplazo. Cancelar cualquiera de esos pasos conserva la base actual.
Si falla, conserva los archivos y sigue el mensaje; si ya se guardó y falla solo
la recarga, reintenta la lectura indicada sin repetir la restauración.

La versión 0.1.0 acepta el formato de respaldo ClassNote v1, esquema v1 y versión
de aplicación 0.1.0, hasta 100 MiB. No acepta Excel ni versiones futuras. No edites
el archivo para forzar compatibilidad. Un archivo dañado o con relaciones inválidas
se rechaza. Detalles técnicos para desarrollo: `docs/BACKUP_RESTORE.md` en el repositorio.

## Dónde quedan los datos

La base `classnote` es IndexedDB dentro del perfil WebView2 de este usuario, no
un archivo junto al ejecutable. Con la configuración predeterminada de Tauri en
Windows se espera bajo `%LOCALAPPDATA%\org.classnote.desktop\EBWebView`, dentro
del almacenamiento del origen `http://tauri.localhost`. La ruta efectiva debe
comprobarse en cada instalación; las pruebas usan perfiles temporales distintos.
No muevas, edites ni borres esa carpeta. No copies archivos sueltos de IndexedDB
como método de respaldo: usa el JSON completo desde Configuración.

Otro usuario o equipo tiene su propio perfil. Eliminar el perfil de Windows,
limpiar datos de aplicaciones o dañar el disco puede hacer perder la base.
Los archivos exportados quedan en las rutas que elegiste, fuera de la base.
Consulta [PRIVACY.md](PRIVACY.md) para conocer sus límites de protección.

## Actualizar o desinstalar

No hay actualización automática. Antes de instalar una versión posterior, guarda
un respaldo completo externo y verifica sus notas de compatibilidad. Cierra la
aplicación y ejecuta el nuevo instalador bajo el mismo usuario y ubicación.
Comprueba los datos después. No borres el perfil ni desinstales primero como
procedimiento de actualización. No se ha probado aún una actualización entre dos
releases reales: no se garantiza conservación por ese proceso ni por desinstalar.

Antes de desinstalar desde Configuración de Windows, exporta y conserva tu
respaldo. Revisa cualquier opción de borrar datos y su alcance. No dependas de
que la desinstalación conserve el perfil. Los archivos exportados necesitan su
propio cuidado y eliminación cuando corresponda.

Resultados verificados y límites de esta entrega: [RELEASE_0.1.0.md](RELEASE_0.1.0.md).
