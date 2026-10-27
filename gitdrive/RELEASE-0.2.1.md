# GitDrive 0.2.1

- Corregido el arranque del motor Node desde unidades virtuales o sustituidas como F:. La carga de módulos conserva sus rutas; las comprobaciones de rutas y enlaces de archivos del usuario siguen activas.
- Opciones visibles para GitHub, GitLab y otros servidores al vincular o clonar.
- Entrada abreviada equipo/repositorio y URLs completas HTTPS/SSH, incluidos servidores propios.
- Comprobación de acceso al repositorio antes de vincularlo. Vincular configura origin; Consultar, Bajar y Subir realizan las operaciones remotas.
- Autenticación mediante las credenciales de Git existentes en el equipo. No implementa un inicio de sesión OAuth propio ni enumera repositorios de la cuenta. Para repositorios privados, configura Git Credential Manager o SSH; no incluyas tokens en las URLs.
- Mantiene Blue Glass, DM Sans local, editor, papelera, ramas, commits y sincronización de carpetas de la versión 0.2.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows y WebView2. No tiene firma digital de editor.

Las 17 pruebas y la compilación TypeScript/React pasan, incluyendo comprobación de acceso, clonación, conflictos y recuperación. Las pruebas de remotos usan repositorios locales; no validan credenciales personales de GitHub/GitLab.

Las herramientas de compilación de esta sesión están en F:\GitDrive-build. No son necesarias para usar el instalador. La configuración de PATH del sistema no se modificó.
