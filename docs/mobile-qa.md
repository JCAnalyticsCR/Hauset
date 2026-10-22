# Verificación de la experiencia móvil

Revisión del 22 de octubre de 2026 sobre la compilación estática local. Se usó el navegador integrado con tamaños de pantalla simulados; no equivale a una prueba en hardware iOS o Android.

## Comprobaciones realizadas

| Comprobación                                  | Resultado                                                                                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pantallas de 320 × 740, 390 × 844 y 430 × 932 | Sin desbordamiento horizontal. La acción principal queda visible en la primera pantalla.                                                                                                   |
| Escritorio de 1440 × 1000                     | Composición completa, un solo H1 y detalles abiertos; galería e índice móviles ocultos.                                                                                                    |
| Escenas                                       | Botones y desplazamiento horizontal sincronizan imagen, estado y selección. El gesto no cambia de página.                                                                                  |
| Iluminación y orientación                     | El valor personalizado de 6% y la escena Salir se conservaron al pasar por 844 × 390 y volver a 390 × 844.                                                                                 |
| Índice                                        | Saltos entre capítulos, indicador activo y numeración circular verificados. El enlace directo a `#proyectos` abre su contenedor.                                                           |
| Detalles                                      | Luz, planos y material adicional comienzan cerrados en móvil y siguen disponibles al abrirlos. Puntos del plano de 44 × 44 px exteriores.                                                  |
| Consulta                                      | La escena de seguridad llega preseleccionada desde la portada. Explorar Redes actualiza el interés del acceso flotante y este lo lleva al asistente.                                       |
| Resumen                                       | Se revisó una consulta con propiedad, servicio, ubicación y plazo opcionales. El selector usa 16 px y el mensaje preparado coincide con el enlace de WhatsApp. No se envió ningún mensaje. |
| Video                                         | Abre bajo demanda en diálogo, reproduce el archivo de 46,27 segundos y se cierra con el control correspondiente.                                                                           |
| Menú                                          | Enlaces amplios, apertura/cierre y retorno del foco al cerrarlo con Escape.                                                                                                                |
| Consola                                       | Sin errores ni advertencias en las vistas revisadas.                                                                                                                                       |

La revisión del código conserva el anuncio accesible de las escenas, el orden visual y de teclado del asistente, las alternativas a los gestos y las reglas de movimiento reducido. Las áreas seguras están implementadas con `env(safe-area-inset-*)`; su comportamiento físico con notch, teclado virtual y preferencias del sistema queda pendiente de comprobar en dispositivos reales.

## Extensión y recursos

Con 390 × 844, opciones iniciales y detalles cerrados, el documento mide aproximadamente **4710 px** de alto. Una compilación anterior guardada (`hausetcr-pages-check`, previa a algunos ajustes de textos de conversión) medía **7410 px** en el mismo tamaño. Es una comparación de extensión del documento, no una prueba de atención, consultas o ventas.

La nueva imagen móvil pesa 80.858 bytes. La compilación entrega unos 52,6 KB de CSS y 11,1 KB de JavaScript sin comprimir para la página; no se añadieron librerías de animación. El video mantiene `preload="none"`.

`astro check` terminó con 0 errores, 0 advertencias y 0 sugerencias; la compilación estática se completó. Las ocho pruebas del servidor estático pasaron. El formato del proyecto se comprobó con Prettier.

Capturas: `preview-mobile.jpg`, `preview-mobile-soluciones.jpg`, `preview-mobile-equipo.jpg` y `preview-desktop.jpg` en esta carpeta.
