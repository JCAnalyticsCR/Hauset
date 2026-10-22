# Recursos visuales

El proyecto contiene fotografías reales del equipo aportadas por el usuario y escenas ilustrativas generadas con esas referencias. Las escenas generadas no documentan proyectos ejecutados por HAUSET ni deben presentarse como tales.

## Equipo real y escenas ilustrativas

| Archivo                                     | Procedencia                                                                        | Dimensiones | Peso   |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ----------- | ------ |
| `public/images/team-real.webp`              | Fotografía aportada por el usuario, cinco integrantes del equipo                   | 1024 × 906  | 121 KB |
| `public/images/founders-real.webp`          | Fotografía aportada por el usuario, dos integrantes sentados                       | 1024 × 877  | 83 KB  |
| `public/images/technician-real.webp`        | Fotografía aportada por el usuario, integrante de pie en exposición                | 908 × 1024  | 78 KB  |
| `public/images/hero-experience.webp`        | Escena generada con la referencia de los dos integrantes y el logo                 | 1600 × 900  | 137 KB |
| `public/images/hero-experience-mobile.webp` | Versión reducida de la escena anterior                                             | 900 × 507   | 65 KB  |
| `public/images/installation-story.webp`     | Escena generada con las referencias del técnico, el equipo y el logo               | 1200 × 675  | 81 KB  |
| `public/images/mobile-home.webp`            | Escena vertical generada con ambos integrantes y el logo para la experiencia móvil | 900 × 1200  | 79 KB  |

Las tres fotografías reales solo se codificaron a WebP; no se retocaron las personas, rostros ni fondos. Sus originales se conservan en `output/imagegen/team-real-original.png`, `output/imagegen/founders-real-original.png` y `output/imagegen/technician-real-original.png`. Las fotos aportadas muestran al equipo en actividades reales; no se infiere de ellas una instalación en una casa determinada.

Las tres escenas nuevas se generaron el 22 de octubre de 2026 mediante la herramienta integrada **`image_gen.imagegen`** (nombre invocable en esta sesión: `image_gen__imagegen`), sin CLI ni llamadas propias a una API. Referencias de identidad: `founders-real-original.png` para la portada y la escena móvil vertical; `technician-real-original.png` y el integrante del extremo izquierdo de `team-real-original.png` para la instalación. Se suministró también el logo original como referencia de bordado. Son visualizaciones con IA y deben identificarse como ilustrativas en su contexto de publicación.

Los PNG generados completos se conservan localmente en `output/imagegen/hero-experience-original.png`, `output/imagegen/installation-story-original.png` y `output/imagegen/mobile-home-original.png`. Las variantes WebP solo se redimensionaron y codificaron con Pillow, sin modificaciones semánticas. Los prompts exactos completos, referencias de identidad, herramienta y procedencia se documentan en [docs/image-prompts.md](docs/image-prompts.md), que se incluye en el proyecto aunque se excluyan los PNG pesados del repositorio.

## Logo

| Archivo                  | Fuente                                                 | Autor  | Tamaño    |
| ------------------------ | ------------------------------------------------------ | ------ | --------- |
| `public/images/logo.png` | [Logo del sitio HAUSET](https://hausetcr.com/logo.png) | HAUSET | 390 × 104 |

El logo corresponde a la marca existente; conviene reemplazar este PNG por el SVG original cuando esté disponible.

## Tipografía

`public/fonts/inter-latin-variable.woff2` contiene Inter variable, alfabeto latino y pesos 100–900. Distribuida a través de Fontsource; licencia SIL Open Font License 1.1, incluida en `public/fonts/OFL-Inter.txt`. Se sirve localmente y no hace solicitudes a Google Fonts al visitar el sitio.

Para reemplazar las referencias por fotografías propias, conservá los nombres o actualizá las rutas en los componentes. Incluí fotografías de proyectos reales solo con autorización y los datos correctos de ubicación y alcance.
