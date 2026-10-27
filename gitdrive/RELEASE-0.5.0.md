# GitDrive 0.5.0

Protección al respaldar, basada en `gitnube.sh` (`manage_gitignore` y `track_large_files`).

## .gitignore automático

- Antes de cada **Respaldar y subir** y al **convertir una carpeta en repositorio**, se añaden a `.gitignore` las reglas que falten. Se comparan línea a línea, sin duplicar ni tocar las que ya existían, y se respeta el salto de línea del archivo.
- Reglas por defecto, las de `gitnube.sh`: `[Ll]ibrary/ [Tt]emp/ [Oo]bj/ [Bb]uild/ [Bb]uilds/ [Ll]ogs/ [Mm]emoryCaptures/ [Uu]serSettings/ Crashes/ _TRASH_*/ .vs/ .vscode/`, **más `node_modules/`**. Las dependencias se regeneran con `npm install` y fueron la causa del error HTTP 408.
- Se editan en **Ajustes → Protección al respaldar** (una por línea). Se guardan en `%APPDATA%\GitDrive\settings.json`.

## Git LFS para archivos grandes

- Los archivos de más de **100 MB** (configurable de 1 a 2000), nuevos o versionados y no excluidos por `.gitignore`, pasan a Git LFS antes del commit. Igual que en el script, se rastrea `*.extensión`, o la ruta si el archivo no tiene extensión. Después se añade `.gitattributes` y se renormalizan los que ya estaban en el índice.
- Se ejecuta `git lfs install --local`, así que el `push` sube también los objetos LFS.
- En los commits seleccionados desde *Cambios* también se aplica LFS a los archivos grandes.
- Si Git LFS no está instalado y hay archivos grandes, el respaldo se detiene con un aviso.

## Revisión antes de subir y «Corregir y subir»

- Antes de subir se revisan los commits que no están en el remoto: tamaño total, archivos de más del límite fuera de LFS y archivos que las reglas excluyen.
- Si hay problemas, **no se sube nada** y aparece un aviso con **Corregir y subir**. Esa opción:
  - rehace los commits pendientes en uno solo, `Respaldo corregido · fecha`, que conserva los mensajes originales;
  - quita del commit los archivos que las reglas excluyen;
  - pasa a LFS los archivos grandes y sube.
- Los archivos en disco no se tocan, y los commits que ya están en el remoto tampoco.
- El botón **Subir** hace la misma revisión y remite a «Respaldar y subir».

## Otros cambios

- Mensajes claros para los fallos de subida: tiempo agotado (HTTP 408, conexión cortada) con los MB pendientes, archivo rechazado por superar 100 MB y falta de acceso.
- Subir, bajar, consultar y clonar tienen hasta 30 minutos en lugar de 2.
- Se corrigieron textos confusos («No había cambios nuevos localmente…») y los plurales.
- Ejemplos de identidad: `username` / `email`.

## Verificación

Las 36 pruebas pasan: 30 anteriores y 6 nuevas en `tests/protect.test.mjs`. Las nuevas reproducen el caso de `node_modules` con un binario grande ya commiteado, la corrección y la subida con LFS a un remoto local. También pasa la compilación TypeScript/React. En el navegador se probaron el aviso, «Corregir y subir» y los Ajustes nuevos.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows (incluye Git LFS) y WebView2. No tiene firma digital de editor.
