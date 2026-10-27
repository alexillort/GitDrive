# GitDrive 0.3.0

- **Tus repositorios**: cada repositorio que abres, creas o clonas queda guardado en `%APPDATA%\GitDrive\workspaces.json` (compartido entre la app de escritorio y el modo navegador). La pantalla de inicio los lista con su remoto, su carpeta vinculada y sus cambios pendientes; se pueden fijar arriba o quitar de la lista sin borrar archivos. La barra lateral muestra los recientes para cambiar de proyecto con un clic. Los repositorios que ya no existen aparecen atenuados.
- **Convertir carpeta en repositorio**: ya no exige una carpeta vacía. Crea el repositorio y un primer commit con todo su contenido, llamado `<nombre de la carpeta> · <AAAA-MM-DD>`. Rechaza carpetas que ya son un repositorio o están dentro de otro.
- **Mensaje automático**: un commit sin mensaje se guarda como `Respaldo automático · AAAA-MM-DD HH:mm`.
- **Respaldar y subir**: un botón que guarda todos los cambios (respetando .gitignore) en un commit y, si hay remoto, lo sube. Si la subida falla, el commit queda guardado en local y se muestra el error.
- **Ajustes · Identidad Git**: nombre y correo del autor de los commits, editables desde la app (botón inferior de la barra lateral). Se guardan en la configuración global de Git. Si faltan al crear un repositorio o un respaldo, la app los pide y después continúa.
- **Ajustes · Avisos de respaldo**: cuando un repositorio lleva cambios sin respaldar más tiempo del elegido (1 h a 3 días, 4 h por defecto, o nunca), aparece un aviso con «Respaldar ahora» o «Recordar más tarde», una notificación de Windows, un punto naranja en Recientes y el contador en el título de la ventana. Se revisan todos los repositorios de la lista cada 10 minutos mientras GitDrive está abierto. La antigüedad se cuenta desde la modificación más antigua pendiente, sin ser anterior al último commit. Preferencias en `%APPDATA%\GitDrive\settings.json`.

Las 25 pruebas (17 anteriores + 8 nuevas en `tests/workspaces.test.mjs`) y la compilación TypeScript/React pasan.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows y WebView2. No tiene firma digital de editor.
