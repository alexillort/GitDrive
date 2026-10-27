# GitDrive 0.7.0

## Abrir otro repositorio, sin volver al anterior

- Corregido: al volver al inicio o abrir otro repositorio, a veces reaparecía el anterior. Una actualización automática (cada 8 s o al recuperar el foco de la ventana) que terminaba tarde sobrescribía la pantalla. Ahora cada apertura o vuelta al inicio invalida las respuestas pendientes del repositorio anterior.
- Volver al inicio olvida el repositorio abierto: el campo de ruta queda vacío y, al reiniciar la app, se empieza en el inicio. Si el último repositorio guardado ya no existe, la app abre el inicio con un aviso claro, sin la ruta vieja escrita.

## Inicio más limpio

- En el inicio, la barra lateral solo muestra la marca, el botón para plegarla y tu identidad. Archivos, Cambios, Historial, Carpetas vinculadas, Papelera y Ramas aparecen al abrir un repositorio.
- «Recientes» ya no está en la barra lateral: tus repositorios se eligen en el inicio (*Tus repositorios*).
- Dentro de un repositorio, la tarjeta superior dice «Cambiar de repositorio» y lleva al inicio.

## Barra lateral plegable

- Botón junto al logo para plegarla o desplegarla. Plegada muestra solo los iconos, con su nombre al pasar el ratón, y el número de cambios sobre el icono de Cambios.
- La preferencia se recuerda entre sesiones.

## Ruta superior

- `Workspace › nombre del repositorio › rama`. **Workspace** lleva al inicio.

## Verificación

Las 40 pruebas pasan y la compilación TypeScript/React también. En el navegador se probó con dos repositorios: volver al inicio con una actualización en curso y esperar más de 8 s (sigue en el inicio), abrir el otro repositorio, último repositorio inexistente al arrancar, migas y barra plegada.

El instalador está compilado para Windows x64 e incluye Node.js. Requiere Git for Windows y WebView2. No tiene firma digital de editor.

# GitDrive 0.7.1

- **Barra lateral sin saltos**: al plegarla o desplegarla, los iconos se quedan exactamente en el mismo sitio (verificado al píxel) y solo cambia el ancho. Los textos se desvanecen sin partirse en líneas. Plegada, cada icono queda en una caja cuadrada de 44 px, como la de ajustes.
- El botón para plegar la barra está ahora en la cabecera, junto a la ruta, y ya no se sale de la barra.
- En el inicio la barra lateral se pliega sola (logo y ajustes). Al abrir un repositorio vuelve como la dejaste.
- «GitDrive · beta» aparece encima del perfil. Junto al logo solo queda «GitDrive».
- La ruta superior muestra `Workspace › repositorio`. La rama sigue visible a la derecha del título.
- Los nombres largos de rama se recortan con «…» en lugar de partirse en líneas (el nombre completo aparece al pasar el ratón).
- Si el sistema tiene activada la reducción de movimiento, la barra cambia sin animación.
