# Recorrido móvil de HAUSET

La experiencia móvil usa una composición específica hasta 650 px. Busca presentar primero la oferta y una escena explorable, después las soluciones y el equipo, y finalmente una consulta preparada para WhatsApp. Estas decisiones se documentan a partir del código; la comprobación visual y funcional corresponde a las pruebas del despliegue.

## Decisiones

- **Tres capítulos:** el índice conecta Soluciones, El equipo y Tu proyecto y señala la sección activa. Permite recorrer la página o ir directamente al contenido buscado.
- **Escenas manuales:** Llegar, Desconectar y Salir comparten una galería horizontal y botones. La selección actualiza el ambiente y el interés del CTA. La galería no avanza sola.
- **Detalle a petición:** iluminación adicional, planos e historia usan elementos `details`. En móvil comienzan cerrados y se abren mediante sus controles; un enlace a contenido interior también puede abrir su contenedor.
- **Consulta continua:** el CTA inferior lleva al asistente conservando el interés. Las elecciones y los campos opcionales se mantienen en memoria mientras la página permanece abierta. El resumen se puede revisar y editar antes de continuar a WhatsApp.
- **Adaptación al dispositivo:** los márgenes seguros reservan espacio alrededor del CTA inferior. `prefers-reduced-motion` limita animaciones y desplazamientos animados.

## Dónde editar

| Archivo                            | Responsabilidad                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/styles/mobile.css`            | Composición móvil, galería, índice, paneles desplegables, CTA inferior y márgenes seguros. |
| `src/styles/experience.css`        | Estilos compartidos y composición de escritorio.                                           |
| `src/layouts/Layout.astro`         | Orden de carga de estilos: `mobile.css` se importa después de `experience.css`.            |
| `src/components/Experience.astro`  | Textos, imágenes y controles de las tres escenas.                                          |
| `src/components/Solutions.astro`   | Servicios y planos desplegables.                                                           |
| `src/components/TeamStory.astro`   | Equipo real, historia desplegable y acceso al video.                                       |
| `src/components/QuoteWizard.astro` | Preguntas, campos opcionales y revisión de la consulta.                                    |
| `src/pages/index.astro`            | Índice de capítulos y CTA inferior.                                                        |
| `src/scripts/main.ts`              | Sincronización de escenas, desplegables, capítulo activo y estado del asistente.           |
| `src/scripts/room-3d.ts`           | Sala en Three.js dentro del diálogo; en móvil usa un lienzo 4:3 y el nivel `lite`.         |
| `src/scripts/plan-3d.ts`           | Maqueta 3D del plano de automatización; en móvil ocupa un cuadrado.                        |
| `src/styles/three-d.css`           | Lienzos 3D, botón «Vista ligera / Vista 3D», etiquetas y alturas móviles.                  |

Para cambiar el corte de 650 px, coordiná las reglas de `mobile.css`, `matchMedia` en `main.ts` y los atributos `media` de las imágenes. Conservá nombres de anclas y atributos `data-*` que conectan controles y scripts. Al sustituir imágenes, actualizá textos alternativos y su procedencia en `ASSETS.md`.

## Referencias de diseño

Se examinaron [Apple Home](https://www.apple.com/home-app/) para la agrupación de controles y escenas y [Pentagram](https://www.pentagram.com/) para la presentación editorial de proyectos. La interpretación de estas referencias y los componentes de HAUSET son decisiones propias del proyecto. Las referencias no acreditan un aumento de consultas, ventas o contratos.

## Comprobaciones al editar

Revisá gestos y botones de escena, navegación del índice, apertura de detalles, visibilidad del CTA inferior y conservación de respuestas al volver. Comprobá también teclado, movimiento reducido, orientación, márgenes seguros y el mensaje final de WhatsApp. Esta lista define qué probar; no certifica resultados de pruebas.
