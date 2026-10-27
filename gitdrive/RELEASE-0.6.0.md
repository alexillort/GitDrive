# GitDrive 0.6.0

## Archivos ignorados visibles en el explorador

- Los archivos y carpetas que Git no sube aparecen en *Archivos* con la etiqueta **«Ignorado · regla»** (por ejemplo `Ignorado · *.mp4`). Al pasar el ratón se ve el archivo y la línea donde está la regla (`.gitignore`, línea 19).
- Los archivos dentro de una carpeta ignorada muestran la regla de la carpeta (por ejemplo `uploads/`).
- Las excepciones con `!` se respetan: lo que vuelven a incluir no aparece como ignorado.
- Los archivos ya versionados nunca aparecen como ignorados, porque se suben aunque una regla los nombre. Las carpetas vacías tampoco (Git no guarda carpetas vacías).

## Aviso de multimedia ignorada

- Al **abrir** un repositorio, **clonarlo**, **convertir** una carpeta o **respaldar**, GitDrive busca imágenes, vídeo, audio, diseño y modelos 3D que se estén quedando fuera. Revisa `png jpg gif webp psd svg exr tga mp4 mov avi mkv webm wav mp3 ogg flac fbx obj blend glb gltf stl usd`, entre otros.
- Si encuentra alguno, muestra cada regla responsable con su archivo y línea, el número de archivos, los MB y algunos ejemplos.
- **Incluir** desactiva esa regla comentándola en su archivo: `# GitDrive: incluido para subir · *.mp4`. Para deshacerlo basta con quitar el comentario. Los archivos aparecen entonces en *Cambios*, y los de más del límite pasan a Git LFS al respaldar.
- **Incluir todo** desactiva todas las reglas listadas. **Ahora no** oculta el aviso de ese repositorio hasta reiniciar la app.
- No se avisa de lo que ocultan las reglas de protección de Ajustes ni de carpetas de dependencias (`node_modules`, `venv`, `.venv`, `env`, `__pycache__`…): ahí la exclusión es intencionada.
- Si la regla está fuera del repositorio (configuración global de Git), GitDrive no la modifica e indica dónde está.
- Si la regla es de una carpeta (por ejemplo `uploads/`), al incluirla se sube **todo** su contenido, no solo la multimedia.

## Otros

- *Carpetas vinculadas* y el resto del menú lateral quedan alineados a la izquierda cuando el texto ocupa dos líneas.

## Verificación

Las 40 pruebas pasan: 36 anteriores y 4 nuevas en `tests/ignored.test.mjs`, que cubren reglas por extensión, carpetas, excepciones `!`, carpetas de dependencias, carpetas vacías e Incluir. También pasa la compilación TypeScript/React. En el navegador se probó con el `.gitignore` de INV4048: etiquetas, aviso e Incluir.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows y WebView2. No tiene firma digital de editor.

# GitDrive 0.6.1

- Todos los botones alinean a la izquierda el texto que ocupa varias líneas: nombres largos de rama (por ejemplo `open-media-grabber`), menú lateral, recientes, etc. Los botones de una sola línea no cambian.
