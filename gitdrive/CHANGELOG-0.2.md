# GitDrive 0.2 · Blue Glass

Esta guía reemplaza las limitaciones de la versión 0.1 descritas en el README anterior.

## Incluido

- Paleta azul con degradados, superficies de cristal y DM Sans variable empaquetada para funcionar sin internet.
- Clonación desde HTTPS, SSH o una ruta local hacia una carpeta vacía.
- Selector nativo de carpetas en Tauri; entrada de ruta en el navegador.
- Editor UTF-8 hasta 500 KB, con protección frente a cambios externos y confirmación al descartar una edición.
- Actualización del explorador cada 8 segundos mientras la ventana está visible; se puede pausar desde En vivo.
- Comparación y sincronización bidireccional de una carpeta externa con el repositorio.
- Runtime Node incluido en la distribución nativa. El usuario solo necesita Git for Windows y WebView2; Node se requiere para desarrollo y para el modo navegador.

## Carpetas vinculadas

Elige una carpeta independiente del repositorio y pulsa Conectar y comparar. La conexión se asocia a la rama actual. Revisa las direcciones de copia, elige una versión para los conflictos y pulsa Aplicar sincronización. Los archivos modificados en el repositorio quedan pendientes de commit; no se publica nada automáticamente.

Se respetan las reglas .gitignore del repositorio y se excluyen .git, node_modules, .npm-cache y target. Se admiten hasta 10 000 archivos por lado y 50 MB por archivo. Se rechazan enlaces simbólicos, enlaces duros y repositorios anidados.

No se propagan eliminaciones: si desaparece un archivo previamente sincronizado, se pide restaurar la copia existente u omitirlo. No se replican directorios vacíos ni permisos. Los renombres se comparan como archivos en rutas diferentes.

Si el contenido cambió desde la vista previa, se exige analizar de nuevo. Evita editar ambas carpetas durante la aplicación. Las copias se aplican por archivo: si se interrumpe el proceso, las anteriores permanecen aplicadas y se puede analizar de nuevo.

El contenido reemplazado se conserva en `.git/gitdrive-sync-backups/<id>/`. Su `manifest.json` relaciona cada archivo .bak con su ruta y carpeta de destino. Estas copias se recuperan manualmente y no se purgan automáticamente. La papelera de archivos sigue disponible desde la interfaz.

La sincronización es manual: En vivo actualiza el explorador; no copia archivos ni hace commits o pushes automáticamente.

## Desarrollo y compilación

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd start
```

Abre http://127.0.0.1:4317. Para Tauri, con Rust MSVC, herramientas C++ y Windows SDK disponibles:

```powershell
npm.cmd run tauri dev
npm.cmd run tauri build
```

La compilación prepara el runtime Node antes de empaquetar. El instalador NSIS se genera en `src-tauri/target/release/bundle/nsis/`, o bajo `CARGO_TARGET_DIR` si está definido.

Las 17 pruebas cubren el flujo Git original y las nuevas funciones: edición obsoleta, clonación, rutas superpuestas, sincronización bidireccional, ignorados, vistas previas obsoletas, conflictos, copias de seguridad, eliminaciones y vinculación a una rama.

Sigue sin incluir un resolvedor de conflictos Git, rebase/reset forzados ni gestión especializada de submódulos. La resolución de conflictos entre carpetas vinculadas sí está incluida. La autenticación remota usa Git Credential Manager o SSH ya configurados. Abre repositorios de confianza, puesto que Git puede ejecutar hooks.
