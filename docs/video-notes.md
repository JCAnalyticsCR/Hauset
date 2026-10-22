# Video aportado para el sitio

El archivo original proporcionado por la persona usuaria se conserva sin modificaciones en su ubicación original. El proyecto incluye una copia optimizada para reproducción web, con el contenido completo y el audio original; no se recortaron escenas ni se agregaron efectos.

| Recurso                       | Especificación                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `public/video/team-story.mp4` | 46,267 segundos; vertical 720 × 1280; 30 fps; H.264 `yuv420p`; AAC estéreo a 96 kb/s; 5.807.304 bytes, aproximadamente 5,54 MiB. |
| `public/video/poster.webp`    | Fotograma extraído en el segundo 40; 720 × 1280; 43.936 bytes.                                                                   |

La fuente tenía video VP9 a 1080 × 1920 y audio AAC, con 14.038.216 bytes. La conversión reduce el tamaño aproximadamente un 59 % y usa H.264 para compatibilidad amplia. El MP4 tiene `moov` antes de `mdat` (`faststart`), lo que permite comenzar la reproducción sin descargar el archivo completo.

## Integración

Utilizar `poster`, `preload="none"`, `playsinline` y controles accesibles. Iniciar la reproducción únicamente cuando la persona pulse el botón o los controles, sin autoplay. Mantener el encuadre vertical completo; no estirar ni recortar el rostro para ajustarlo a un contenedor horizontal.

El material inspeccionado muestra a una persona hablando a cámara en distintos espacios, con algunos textos ya integrados en el video. Los fotogramas revisados no permiten confirmar su identidad, cargo o relación con la empresa, ni constituyen una transcripción completa. El nombre técnico del archivo no debe usarse como evidencia de que sea un testimonio o una presentación del equipo. La página debe describirlo conforme al contexto proporcionado por su propietario.

No se generaron subtítulos nuevos, una transcripción ni otra narración. Los textos integrados en la imagen se mantienen tal como estaban. Si se incorpora una pista de subtítulos, debe partir de una transcripción verificada.

## Conversión reproducible

```sh
ffmpeg -i fuente.mp4 -map 0:v:0 -map 0:a:0 -vf scale=720:-2 -c:v libx264 -preset medium -crf 26 -maxrate 1100k -bufsize 2200k -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart -map_metadata -1 public/video/team-story.mp4
ffmpeg -ss 40 -i fuente.mp4 -frames:v 1 -vf scale=720:-2 -quality 80 public/video/poster.webp
```

Se validaron el códec, las dimensiones y la duración con FFprobe; la decodificación completa con FFmpeg finalizó sin errores. Se inspeccionó el poster y fotogramas en los segundos 4, 22 y 40.
