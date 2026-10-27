# GitDrive 0.4.0

## Deshacer y apartar cambios

- **Deshacer** (vista Cambios): devuelve los archivos seleccionados a su último commit. Los archivos nuevos se retiran de la carpeta. Nada se pierde: lo deshecho va a **Apartados**.
- **Apartar todo**: deja la carpeta como en el último commit y guarda todos los cambios aparte.
- **Apartados**: lista de cambios deshechos o guardados aparte, con su rama y su fecha. **Recuperar** los vuelve a aplicar y **Eliminar** los borra para siempre (pide escribir ELIMINAR). Los apartados son locales y nunca se suben. Internamente usan `git stash`.

## Cambiar de rama con cambios sin commit

Ya no se bloquea. Al crear una rama o cambiar de rama con cambios pendientes, GitDrive pregunta qué hacer:

- **Apartarlos en la rama actual**: se guardan aparte y **vuelven solos** cuando regresas a esa rama. Cada rama conserva su trabajo a medias sin mezclarse con las demás.
- **Llevarlos a la otra rama**: siguen sin commit, ahora en la otra rama. Si chocan con archivos de la otra rama, GitDrive no cambia nada y lo avisa.

## Ramas como carpetas (espacios)

Una rama puede abrirse **en su propia carpeta**, como si fuera otro disco. Por defecto se usa `<Proyecto> (<rama>)`, junto al repositorio, o una carpeta vacía que elijas fuera de él. Internamente usa `git worktree`.

- Al crear una rama, «En su propia carpeta» es la opción por defecto. Para una rama existente, usa el icono de carpeta junto a su nombre.
- En la barra lateral, las ramas con carpeta propia llevan un icono de carpeta. Al pulsarlas se abre su carpeta como otro espacio, y la de origen sigue igual. Cada carpeta tiene sus propios cambios, commits, papelera y carpeta vinculada, y aparece en *Tus repositorios* y *Recientes* con el nombre de su rama.
- Una misma rama no puede estar abierta en dos carpetas a la vez (regla de Git).
- **Cerrar carpeta** (la X de una rama con carpeta) borra esa carpeta del disco, pero **la rama y sus commits se conservan**. Si tiene cambios sin commit, se rechaza. Los archivos ignorados por .gitignore de esa carpeta se pierden al cerrarla.

## Verificación

Las 30 pruebas pasan: 25 anteriores y 5 nuevas en `tests/spaces.test.mjs`, con repositorios reales. También pasa la compilación TypeScript/React. El flujo completo se probó en el navegador: carpeta propia para una rama, Deshacer, Recuperar, y apartar al cambiar de rama con restauración automática al volver.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows y WebView2. No tiene firma digital de editor.
