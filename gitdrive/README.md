# GitDrive 0.7.1 · Blue Glass

Consulta las [novedades de 0.7.0 y 0.7.1](RELEASE-0.7.0.md): apertura de repositorios estable, inicio limpio, barra lateral plegable y ruta Workspace › repositorio › rama. Versiones anteriores: [0.6](RELEASE-0.6.0.md), [0.5.0](RELEASE-0.5.0.md), [0.4.0](RELEASE-0.4.0.md), [0.3.0](RELEASE-0.3.0.md), [0.2.1](RELEASE-0.2.1.md).

Aplicación local-first con React, TypeScript y Tauri 2. Incluye explorador Git, ramas, gestión de archivos con papelera, commits seleccionados, historial y sincronización remota manual.

La versión 0.2 añade paleta azul con degradados y cristal, DM Sans incluida, clonación, selector nativo de carpetas, editor protegido contra cambios externos, actualización automática del estado y sincronización bidireccional de carpetas externas.

Lee la [guía de funciones, seguridad y sincronización](CHANGELOG-0.2.md).

## Windows: modo navegador

Requisitos: Node.js 22 o posterior y Git for Windows en PATH.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Abre http://127.0.0.1:4317. También puedes usar Start-GitDrive.cmd.

## Windows: escritorio

La distribución nativa incluye Node.js. Requiere Git for Windows y Microsoft Edge WebView2. Usa un repositorio existente, crea uno en una carpeta vacía o clona un remoto.

Para desarrollar o volver a compilar, instala Rust MSVC, Microsoft C++ Build Tools y Windows SDK, según los [prerrequisitos oficiales de Tauri](https://v2.tauri.app/start/prerequisites/).

```powershell
npm.cmd ci
npm.cmd run tauri dev
npm.cmd run tauri build
```

El instalador NSIS se genera en src-tauri/target/release/bundle/nsis, o bajo CARGO_TARGET_DIR si se configura otro disco. El motor Node se prepara automáticamente durante el empaquetado.

## Verificación

```powershell
npm.cmd test
npm.cmd run build
```

40 pruebas sobre repositorios y carpetas reales verifican operaciones Git, edición, clonación, sincronización local, conflictos y recuperación. La autenticación remota depende de Git Credential Manager o SSH previamente configurado.

## Estructura

- src/: interfaz y diseño.
- backend/engine.mjs: Git y gestión de archivos.
- backend/sync.mjs: comparación y sincronización de carpetas.
- backend/protect.mjs: reglas .gitignore, Git LFS y revisión antes de subir.
- backend/server.mjs: servidor loopback para navegador.
- backend/cli.mjs: protocolo JSON del motor nativo.
- src-tauri/: aplicación de escritorio y selector de carpetas.
- scripts/prepare-runtime.mjs: copia del runtime para distribución.

Los commits son locales hasta pulsar Subir. En vivo solo refresca el estado; la sincronización externa y remota se aplica manualmente. Las limitaciones y la ubicación de las copias de seguridad están detalladas en la guía 0.2.
