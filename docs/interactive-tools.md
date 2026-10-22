# Herramientas interactivas de HAUSET

Actualización: 22 de octubre de 2026.

Las tres herramientas funcionan en el navegador y se compilan como sitio estático. No necesitan cuentas, una base de datos ni una API de consultas.

## Casa interactiva

La portada da protagonismo a las personas: presenta una escena del equipo identificada como creada con IA y la invitación «Pasá, te mostramos». La fotografía panorámica se usa por encima de 1.000 px; en tablet y móvil se muestra un retrato separado para conservar a ambos integrantes sin superponerles el simulador. «Preparar mi consulta» sigue disponible como acceso directo a la ficha.

La invitación abre `HomeExperienceDialog.astro`, controlado por `home-experience-dialog.ts` y sus estilos: un panel a la izquierda por encima de 650 px y una hoja desde abajo en móvil. Su contenido tiene desplazamiento propio y bloquea el de la página. Incluye nombre accesible, foco inicial en el botón de cierre, Escape y cierre al tocar el fondo; las transiciones respetan el movimiento reducido.

Dentro del diálogo, `HomeLab.astro`, `home-lab.ts` y `home-lab.css` presentan una sala SVG con estado compartido entre controles y dibujo. La fotografía de portada conserva su iluminación y no cambia con los controles del simulador. En dispositivos capaces, la sala se muestra en 3D (`room-3d.ts`) y la versión SVG queda como respaldo; ver [Vistas 3D](#vistas-3d).

- Llegar, Cine y Salir aplican valores de luz, apertura de cortinas, tono de luz y alarma.
- Los puntos sobre la lámpara y la ventana permiten encender/apagar y abrir/cerrar. Los ajustes finos quedan en un desplegable.
- Cambiar un ajuste manual identifica la escena como personalizada. El dibujo, los valores, las etiquetas accesibles y el resumen se actualizan juntos.
- Cerrar y volver a abrir conserva la escena y los ajustes durante la visita. Al cerrar sin continuar, el foco vuelve al botón de invitación.
- «Sumar esta escena a mi consulta» cierra el diálogo, libera el desplazamiento de la página e incorpora sus valores como referencia en la ficha, que recibe el foco. Una incorporación posterior sustituye la anterior de la casa. No queda una restauración de foco pendiente hacia la invitación.
- El reloj muestra la hora de Costa Rica. La marca «Simulador» permanece visible: no se conecta a equipos ni a una vivienda real.

## Explorador de soluciones

`Solutions.astro`, `solutions.ts`, `solutions-model.ts` y `solutions-lab.css` presentan un plano ilustrativo común a los tres servicios. El explorador de automatización añade una maqueta 3D del mismo plano (`plan-3d.ts`); seguridad y redes conservan el plano SVG.

- Automatización: cuatro zonas independientes y tres escenas que cambian la iluminación del plano.
- Seguridad: selección de acceso, rutina en casa/fuera y visualización de una posible zona ciega. Cambian la posición de cámara, su ángulo ilustrativo y las marcas del plano.
- Redes: comparación entre router central y puntos distribuidos, zona de uso y obstáculos. Cambian los nodos, enlaces y gráfico, además de la explicación cualitativa.
- Cada servicio conserva un enlace de consulta directa, además del botón que incorpora las preferencias elegidas.

El plano no tiene escala ni calcula señal, velocidad, cobertura o cantidades de equipos. Los círculos y ángulos son recursos didácticos, no resultados de una medición o diseño técnico.

## Vistas 3D

La sala del diálogo y el plano de automatización tienen una versión en Three.js (`three@0.186`) que comparte el estado de la versión SVG: las escenas, los controles y los botones de luz siguen siendo los mismos elementos HTML, y el resumen que llega a la ficha no cambia. Archivos: `graphics-tier.ts` (detección), `three-stage.ts` (renderizador, cámara, interpolaciones y punteros), `room-3d.ts` (sala), `plan-3d.ts` (plano) y `three-d.css`.

- **Respaldo.** `detectGraphicsTier()` devuelve `none`, `lite` o `full`. Sin WebGL2, con renderizado por software, con `saveData`, con menos de 2 GB de memoria declarada o si falla la carga del módulo, queda la versión SVG actual y el botón de cambio no aparece. En `lite` (teléfonos, tablets, pocos núcleos o poca memoria) se renderiza a unos 30 cuadros por segundo, sin sombras y con menos partículas. Si la mediana de tiempo por cuadro supera unos 56 ms en tres ventanas seguidas, o si se pierde el contexto WebGL, la vista vuelve sola al SVG y lo anuncia en un `role="status"`.
- **Carga diferida.** Three.js se descarga en un fragmento aparte (unos 138 KB comprimidos) solo al abrir el diálogo o cuando el plano entra en pantalla; la página inicial no lo incluye. El módulo de la sala se precarga al pasar el puntero o enfocar la invitación.
- **Cambio manual.** «Vista ligera» / «Vista 3D» alterna entre ambas versiones conservando el estado. Para probar, `?3d=0` fuerza el respaldo y `?3d=lite` o `?3d=full` fuerzan un nivel. La elección no se guarda.
- **Sala.** La primera apertura entra por la puerta hasta el plano general mientras la lámpara se enciende y las cortinas se abren. «Cine» baja la cámara detrás del sofá y la pantalla ilumina la sala; «Salir» eleva la cámara, cierra todo y arma un perímetro con un barrido. Tocar la lámpara o la ventana equivale a los botones de la sala, que se reposicionan sobre el modelo en cada cuadro. Arrastrar gira la vista dentro de límites; el movimiento del puntero añade un paralaje leve.
- **Plano.** La primera vez que se ve, el plano plano se levanta hasta convertirse en una maqueta. «Llegar» abre la puerta, recorre una estela de pasos y enciende entrada y sala; «Descansar» baja la luz ambiente; «Salir» apaga ambiente por ambiente y pulsa el perímetro. Tocar un ambiente equivale a su botón de luz. Los nombres de los ambientes se muestran solo desde ángulos altos.
- **Movimiento reducido.** Sin vuelo inicial, sin paralaje ni vaivén; las transiciones son cortes y solo se renderiza mientras cambia algo. Los gestos verticales en pantallas táctiles siguen desplazando la página (`touch-action: pan-y`).

Las vistas 3D son ilustrativas: no cambian las escenas ni la compatibilidad descritas en la ficha, y la maqueta no tiene escala.

### Verificación de las vistas 3D

Comprobado el 22 de octubre de 2026 con `astro check` (0 errores, advertencias o sugerencias), las 17 pruebas de `npm test`, `npm run format:check` y `npm run build`. Capturas con Edge sin interfaz y renderizado por software (SwiftShader, forzando `?3d=full` o `?3d=lite`) en 1.440 × 1.000, 1.200 × 900 y 390 × 844: vuelo de entrada, escenas Llegar/Cine/Salir, luz al 35 % con tono frío, cortinas cerradas, cambio a vista ligera y vuelta, plano levantándose, escenas Llegar/Descansar/Salir, apagado de la cocina, respaldo con `?3d=0` (sin lienzo ni botón) y movimiento reducido. Sin desbordamiento horizontal en 390 px y sin errores de consola. No se midió el rendimiento en teléfonos ni GPU reales: con renderizado por software los vuelos tardan más que su duración nominal.

Capturas en esta carpeta: `3d-room-welcome.jpg`, `3d-room-cinema.jpg`, `3d-room-away.jpg`, `3d-plan-overview.jpg`, `3d-plan-llegar.jpg` y `3d-plan-mobile.jpg`.

## Ficha de proyecto

`QuoteWizard.astro`, `quote-wizard.ts`, `quote-model.mjs` y `quote-studio.css` organizan el recorrido en espacio, prioridades y ficha.

La etapa del espacio, área, pisos, zona, plazo y comentario son opcionales. Los números tienen validación de rango y precisión; se permite corregirlos sin perder el resto. Las orientaciones dependen del contexto y servicios elegidos, sin presupuestar ni definir equipos.

El evento local `hauset:project-add` acepta `{ need, source, items }`. Necesidades y origen se validan contra listas permitidas. Las preferencias se reemplazan por pareja origen/servicio, se deduplican y pueden quitarse de la ficha. Se admiten diez ideas, de hasta setenta caracteres cada una. Se muestran avisos si se supera la capacidad.

Vista previa, copia, descarga `.txt` y enlace de WhatsApp parten del mismo mensaje. El enlace se habilita hasta 2.200 caracteres de mensaje y 6.500 de URL codificada; superar estos límites muestra una explicación y conserva la posibilidad de copiar o descargar. No se afirma que abrir WhatsApp equivalga a enviar o contratar.

Guardar es una acción explícita: solo conserva categorías de espacio, etapa, dimensiones, plazo y servicios en `localStorage`, bajo `hauset:quote-draft:v1`. No guarda ubicación, comentario ni etiquetas de ideas. Restaurar es manual; borrar elimina únicamente este borrador. Los fallos del portapapeles y almacenamiento tienen alternativas y mensajes. La página de privacidad describe este comportamiento.

## Verificación

### Portada con invitación y diálogo

La compilación Docker final completó la verificación Astro de 29 archivos con cero errores, advertencias o sugerencias. `npm run format:check` también pasó. La revisión de código comprueba que el cierre hacia la ficha cancela la animación y se realiza antes de emitir `hauset:project-add`.

Se comprobó en el navegador:

- Ambos rostros visibles y ausencia de desbordamiento horizontal en 320 × 740, 390 × 844, 650 × 900, 768 × 1.024, 1.024 × 768 y 1.440 × 1.000 píxeles.
- Apertura del panel a la izquierda en escritorio y desde abajo en móvil, con desplazamiento interior independiente.
- Una escena personalizada con luz al 65%, tono frío y cortinas al 35% conserva los valores al cerrar y reabrir. Cada reapertura comienza con el desplazamiento del panel en cero.
- «Sumar esta escena a mi consulta» incorpora la escena y lleva a la ficha con el foco en su título `h3`, sin retorno tardío a la invitación.
- Escape, el botón de cierre y el fondo cierran el diálogo, devuelven el foco a la invitación y liberan el desplazamiento de la página.
- En horizontal, a 844 × 390 píxeles, Mayús+Tab devuelve el foco al rango de iluminación sin que lo tape el encabezado fijo: el control comienza a 182 px y el encabezado termina a 151 px. El contenedor usa `scroll-padding-top` de 148 px, o 164 px en móvil.
- Cero errores y advertencias en la consola del navegador durante el recorrido.

### Resultados previos de las herramientas

Estos resultados corresponden a la revisión anterior a mover la casa al diálogo; no certifican la nueva composición ni su comportamiento modal.

- `npm test`: 17 pruebas aprobadas, incluidos servidor, límites de consultas, saneamiento, reemplazo de preferencias, borrador y estados del explorador.
- Compilación Docker: verificación Astro de 27 archivos sin errores, advertencias ni sugerencias; salida estática de tres páginas.
- Compilación para `/hausetcr/`: portada y quince recursos/enlaces locales responden correctamente, sin rutas de recursos fuera de la subruta. El workflow de Pages ejecuta tipos y pruebas antes de compilar.
- `npm run format:check`: aprobado.
- Navegador local: escenas, ajustes manuales, reemplazo de escena en la ficha, WiFi distribuido/terraza/muros, seguridad lateral/fuera/zona ciega y traspaso de estas preferencias.
- El mensaje de la vista previa coincide con el texto decodificado del enlace de WhatsApp. Copia confirmada por el navegador; descarga `.txt` realizada y contenido leído. No se abrió ni envió WhatsApp.
- Guardar/restaurar/borrar comprobados. Restaurar conserva ubicación y comentario de la visita; no los persiste en el borrador.
- Área `1e2` se normaliza a `100`; pisos `1.5` bloquean el avance y reciben el foco. El dato corregido permite continuar y el nuevo título recibe el foco.
- Sin desbordamiento horizontal en 320, 390 y 1.440 píxeles. Estado y gráfico conservados al cambiar de tamaño. Controles táctiles de al menos 44 px y animaciones desactivables mediante `prefers-reduced-motion`.
- Teclado: End cambia a la última pestaña del explorador y conserva el foco; Home/End en el rango de iluminación actualizan dibujo y resumen a 0%/100%. El plano de luces mantiene sincronizados botones y ambientes al encender una sola zona.
- Sin errores ni advertencias en la consola del navegador durante el recorrido.

Las pruebas de tamaños se realizaron en el navegador de escritorio, no en dispositivos iOS/Android físicos. No se han medido mejoras de conversión ni se ha comprobado compatibilidad con equipos domóticos reales.
