# HAUSET · Automatización, seguridad y redes

One page en español para Costa Rica, creada con **Astro 7.4.2**. Genera archivos estáticos para publicar primero en GitHub Pages y permite alojar el mismo sitio en Railway después. No necesita un backend de contacto, correo, base de datos ni credenciales privadas.

El asistente de cotización reúne las necesidades del proyecto y prepara un resumen para WhatsApp. La persona revisa y envía el mensaje desde WhatsApp. No calcula precios numéricos: HAUSET define la cotización según el alcance y la evaluación del proyecto.

La portada presenta una escena del equipo identificada como creada con IA y la invitación «Pasá, te mostramos». Abre una casa interactiva en un modal lateral izquierdo en escritorio y tablet, y desde abajo en móvil. La página también incluye un explorador de soluciones sobre un plano y un asistente de WhatsApp en tres pasos. La sala y el plano de automatización se muestran en 3D con Three.js en dispositivos capaces; la versión SVG se conserva como respaldo y se puede elegir con un botón. El video se abre a petición en otro modal, sin reproducción automática. Las animaciones respetan la preferencia de movimiento reducido del dispositivo.

## Desarrollo

Requiere Node **22.23.4 o superior** y npm. Se recomienda Node 24 LTS, usado también por GitHub Actions y Docker.

```sh
npm ci
npm run dev
```

Para verificar y construir:

```sh
npm run check
npm test
npm run build
npm run preview
```

`package-lock.json` conserva las versiones instaladas. La compilación queda en `dist/`.

### Windows y Docker

En este equipo, el Control de aplicaciones de Windows bloquea el módulo nativo Rolldown del compilador. El proyecto se verificó y compiló mediante el contenedor Linux incluido, sin modificar las protecciones del sistema:

```sh
docker build -t hausetcr .
docker run --rm -p 3000:3000 hausetcr
```

Abrí `http://localhost:3000`. Docker ejecuta la verificación de tipos y la compilación; la imagen final contiene únicamente los archivos estáticos y un servidor Node sin dependencias npm. Para cambiar el dominio durante la compilación:

```sh
docker build --build-arg PUBLIC_SITE_URL=https://hausetcr.com --build-arg PUBLIC_BASE_PATH=/ -t hausetcr .
```

También podés servir una compilación local con `npm start`.

## Publicar primero en GitHub Pages

1. Subí el proyecto a un repositorio de GitHub con rama `main`.
2. En **Settings → Pages → Build and deployment → Source**, elegí **GitHub Actions**.
3. Hacé push a `main` o ejecutá **Publicar en GitHub Pages** en la pestaña Actions.

Este repositorio ya tiene Pages configurado con GitHub Actions. El workflow instala con `npm ci`, genera `dist/` y lo publica. Detecta automáticamente el dominio y la subruta del repositorio: funciona en `https://usuario.github.io/hausetcr/` y en un sitio de usuario `https://usuario.github.io/`.

Podés definir estas variables en **Settings → Secrets and variables → Actions → Variables**:

| Variable           | Uso                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`  | Origen público sin subruta, por ejemplo `https://hausetcr.com`. Si se omite, usa el origen de Pages. |
| `PUBLIC_BASE_PATH` | `/` para dominio propio o `/hausetcr/` para un repositorio. Si se omite, Pages lo detecta.           |

Para usar `hausetcr.com`, configurá el dominio en **Settings → Pages → Custom domain**, ajustá los registros DNS de Cloudflare según las instrucciones de GitHub y activá HTTPS. Este proyecto no modifica DNS.

Referencia: [workflows oficiales de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Alojar después en Railway

1. Creá un servicio Railway desde este repositorio. Railway detecta el `Dockerfile` y construye la imagen.
2. Configurá `PUBLIC_SITE_URL` con el origen definitivo y `PUBLIC_BASE_PATH=/`. Estas variables se incorporan al compilar: reconstruí el despliegue después de cambiarlas.
3. Usá `/api/health` como **Healthcheck Path**. La imagen ya incluye su comando de inicio; Railway asigna `PORT` y el servidor escucha en `0.0.0.0`.
4. Generá un dominio Railway o agregá `hausetcr.com` y los registros DNS que indique Railway. Podés conservar Cloudflare para administrar DNS.

Si elegís Railpack en lugar de Docker, usá `npm run build` como **Build Command** y `npm start` como **Start Command**.

El servidor opcional de `server/index.mjs` solo sirve archivos de `dist/`, sus páginas 404 y `GET /api/health`. Soporta rangos de bytes para adelantar o retroceder el video sin descargar el archivo completo. No recibe consultas ni envía correos. En GitHub Pages se publican únicamente los archivos estáticos; el servidor no se ejecuta.

También se incluye `.railway/railway.ts` como configuración opcional de Infrastructure as Code. Para usarla, instalá Railway CLI y el paquete de autoría `railway` (`npm install --save-dev railway`), vinculá el proyecto con `railway link`, revisá `railway config plan` y aplicá `railway config apply`. Ajustá el nombre `hausetcr` si tu servicio usa otro. La configuración no se aplica automáticamente con el despliegue de GitHub. Se usa el formato actual porque Railway declara obsoletos `railway.json` y `railway.toml` para servicios nuevos.

Referencia: [Infrastructure as Code de Railway](https://docs.railway.com/infrastructure-as-code).

## Decisiones de conversión y validación

El objetivo es facilitar consultas pertinentes que puedan avanzar a una propuesta y, después, a un contrato. El diseño conserva el equipo real y las escenas ilustrativas identificadas, mientras vuelve más explícitos los servicios, la acción principal y el siguiente paso.

| Problema observado                                                      | Cambio práctico                                                                                                                    | Hipótesis a validar                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| El encabezado emocional no explicaba inmediatamente la oferta.          | Servicios y Costa Rica visibles; acción principal «Preparar mi consulta».                                                          | Más personas identifican si HAUSET puede resolver su necesidad.         |
| Las demos y los enlaces de servicios iniciaban recorridos separados.    | Cada acción lleva al asistente con la necesidad preseleccionada y conserva lo ya elegido; WhatsApp directo queda como alternativa. | Menos repetición y más continuidad entre interés y consulta.            |
| La atención podía concentrarse en explorar sin entender cómo contratar. | Llamados a consulta junto al equipo real y una acción persistente cuando el CTA principal sale de pantalla, fuera del asistente.   | El siguiente paso resulta reconocible sin competir con la tarea activa. |
| Una consulta abierta podía omitir contexto útil.                        | Tres pasos con opciones reconocibles y resumen editable; cantón, plazo y mensaje opcionales.                                       | Llegan consultas con contexto suficiente sin exigir datos innecesarios. |

La investigación de [Krajbich, Armel y Rangel (2010)](https://www.nature.com/articles/nn.2635) estudió fijaciones visuales y decisiones simples en laboratorio: sirve de referencia para considerar el papel de la atención, pero no demuestra mejoras de contratación en esta página. Las guías de NN/G sobre [reconocimiento frente a recuerdo](https://www.nngroup.com/articles/recognition-and-recall/) y [divulgación progresiva](https://www.nngroup.com/articles/progressive-disclosure/) fundamentan las opciones visibles y la presentación por pasos. El [metaanálisis de sobrecarga de elección](https://doi.org/10.1086/651235) encontró resultados variables y un efecto medio prácticamente nulo; no justifica una regla universal de «menos opciones, más ventas». La aplicación comercial de estas ideas es una hipótesis del proyecto, sin promesas de aumento de conversión.

### Qué se puede medir

El sitio emite eventos DOM `hauset:conversion` con los nombres `quote_start`, `quote_step`, `quote_review` y `whatsapp_click`. El detalle contiene `{ event, step, property, services }`: el tipo de propiedad usa una categoría fija o `not_selected`, y los servicios son etiquetas de opciones predefinidas. No incluye cantón, mensaje, plazo ni otros campos escritos por la persona. Por defecto no hay un receptor de analítica, almacenamiento ni envío de estos eventos a una red. Una integración futura requiere autorización y la actualización correspondiente de privacidad.

El resumen de WhatsApp incluye `Origen: sitio web HAUSET` para ayudar al equipo a reconocer consultas procedentes de la página. `whatsapp_click` registra la intención de continuar: **no confirma que se abrió una pestaña ni que se envió un mensaje**, y tampoco equivale a una consulta calificada, una cotización o un contrato. El plazo es opcional y permite elegir entre «Por definir», «Quiero avanzar pronto», «Próximos meses» y «Explorando».

### Validación práctica

1. Probar en móvil y escritorio que la necesidad elegida en cada CTA llega al asistente, que volver conserva las selecciones y que el resumen permite corregirlas antes de abrir WhatsApp.
2. Registrar manualmente las conversaciones recibidas con el origen indicado, las que corresponden a servicios y ubicaciones atendibles, las cotizaciones emitidas y los contratos aceptados. No incluir mensajes personales en registros de analítica.
3. Comparar esos resultados entre periodos con fuentes y volumen de tráfico comparables, cuando esos datos estén disponibles. Sin medición de visitas no se calcula una tasa de conversión de visitantes. Las diferencias entre periodos no demuestran causalidad; una prueba controlada sería necesaria para atribuir un cambio al diseño.

## Recorrido móvil

La composición móvil organiza la página en tres capítulos con un índice: **01 Soluciones, 02 El equipo y 03 Tu proyecto**. La portada muestra a las personas en una imagen propia, también en tablet hasta 1.000 px, y abre el simulador solo al tocar «Pasá, te mostramos». La casa ilustrada responde a las escenas «Llegar», «Cine» y «Salir», a los puntos interactivos de luz y cortinas y a sus controles de ajuste.

La escena y los ajustes se conservan al cerrar y reabrir el modal durante la visita. Cerrar devuelve el foco a la invitación; «Sumar esta escena a mi consulta» cierra el modal y continúa en la ficha con la configuración como referencia. El cierre hacia la ficha no devuelve después el foco al botón anterior. «Preparar mi consulta» permite llegar a la ficha directamente.

Los controles extra de iluminación, tono de luz, cortinas y alarma, los planos y la historia de instalación se abren al pedirlos. El CTA inferior aparece cuando la acción principal de portada sale de pantalla y la ficha no está visible; se oculta mientras hay un modal abierto. Los tres pasos conservan las elecciones y los campos opcionales al volver. El diseño contempla movimiento reducido y los márgenes seguros del dispositivo (`safe-area-inset-*`).

Se examinaron [Apple Home](https://www.apple.com/home-app/) como referencia para escenas y controles agrupados, y [Pentagram](https://www.pentagram.com/) para la presentación editorial de proyectos. La composición y las decisiones de HAUSET son propias; su efecto comercial sigue siendo una hipótesis que requiere medición. Los archivos y criterios de edición se describen en [docs/mobile-design.md](docs/mobile-design.md).

## Contenido

La casa interactiva, el explorador y la ficha comparten preferencias mediante eventos locales. La ficha permite revisar el mensaje, copiarlo, descargarlo o guardarlo parcialmente en este navegador de forma voluntaria. Funciones, límites y resultados de la validación de navegador de la portada y del modal: [docs/interactive-tools.md](docs/interactive-tools.md).

- Textos, enlaces, navegación y asistente de cotización: `src/`.
- Vistas 3D de la sala y del plano: `src/scripts/room-3d.ts`, `src/scripts/plan-3d.ts`, `src/scripts/three-stage.ts` y `src/scripts/graphics-tier.ts`. Se cargan aparte y solo cuando hacen falta; `?3d=0` fuerza el respaldo SVG.
- Imágenes y recursos públicos: `public/`. Sustituí las ilustraciones por fotos reales cuando estén disponibles.
- La página de privacidad describe el uso de WhatsApp. Los datos del asistente no se envían a un servidor de HAUSET desde este sitio.
- No se incluyen testimonios sin autorización, cifras de satisfacción sin respaldo ni analítica activa.

El código se aloja en el repositorio público [JCAnalyticsCR/Hauset](https://github.com/JCAnalyticsCR/Hauset). GitHub Pages publica el sitio en [jcanalyticscr.github.io/Hauset](https://jcanalyticscr.github.io/Hauset/) con cada push a `main`. El dominio hausetcr.com todavía muestra el sitio anterior: no se han cambiado DNS y nunca se enviaron correos desde este proyecto.
