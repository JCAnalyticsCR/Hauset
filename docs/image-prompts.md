# Prompts y procedencia de imágenes

Las fotografías reales del equipo fueron aportadas por el usuario. Se preservaron sin retoques semánticos y se codificaron a WebP. Las escenas siguientes son visualizaciones ilustrativas con IA que usan esas fotos como referencias de identidad; no representan fotografías de una instalación real ni un proyecto entregado.

Generación: 22 de octubre de 2026. Herramienta integrada `image_gen.imagegen` (`image_gen__imagegen` en la sesión), sin CLI ni llamadas propias a una API. `transparent_background: false` en las tres llamadas.

Los PNG originales y las referencias se conservan localmente en `output/imagegen/`; los assets optimizados y este documento permiten distribuir el sitio sin los PNG pesados. La conversión WebP solo redujo dimensiones y codificó formato, sin modificaciones semánticas.

## Portada: hero-experience

- Salidas: `public/images/hero-experience.webp` (1600 × 900), `public/images/hero-experience-mobile.webp` (900 × 507).
- Referencia 1: fotografía real de dos integrantes sentados, `founders-real-original.png` (versión web: `public/images/founders-real.webp`).
- Referencia 2: logo original HAUSET, `public/images/logo.png`.
- PNG completo local: `output/imagegen/hero-experience-original.png`.

Prompt exacto enviado:

```text
Use case: identity-preserve, photorealistic-natural. Asset type: wide cinematic website hero, landscape 16:9. Input image 1 is the identity reference of two real HAUSET team members: preserve both men's recognizable faces, hairlines, beard style, skin tone, body proportions and approximate age. Do not genericize them. Their original seated event pose and surroundings need not be preserved. Input image 2 is the original HAUSET logo for the small shirt embroidery only. Create an editorial photograph-like illustrative visualization of these same two men naturally reviewing a tablet together on the right quarter of the frame, relaxed and approachable, in a contemporary tasteful Costa Rican home at dusk. Show both faces clearly enough for recognition, medium-wide distance; not small full-body dots. They wear clean charcoal HAUSET polos similar to the reference, with subtle accurate white HAUSET embroidery; no third-party logos and no lanyards or trade-show badges. One gently points at the tablet, the other smiles naturally. Architecture: a whole warm, lived-in open-plan living room with restrained walnut details, textured off-white walls, a low neutral linen sofa, beautifully controlled practical warm recessed ceiling lighting, wide glass doors to a lush tropical green garden, blue dusk outside. Natural materials and realistic real-world scale. Composition: wide 16:9, left two thirds mostly unoccupied architecture and calm darker wall/room for later HTML headline, people grouped in right quarter without being cropped off. Camera at eye level, premium architectural documentary photograph, 35mm natural perspective, gently graded deep charcoal and warm practical light, authentic skin texture. No synthetic glow, no shiny sterile showroom, no cyberpunk, no neon, no floating smart-home UI, no oversized light bloom, no extra people. Do not put any headline, captions, labels, interface, watermark or invented text on the image. This is an illustrative generated scene, not evidence of a completed project.
```

## Instalación: installation-story

- Salida: `public/images/installation-story.webp` (1200 × 675).
- Referencia 1: fotografía real del integrante de pie en una exposición, `technician-real-original.png` (versión web: `public/images/technician-real.webp`).
- Referencia 2: fotografía real de cinco integrantes, `team-real-original.png` (versión web: `public/images/team-real.webp`); se usó como referencia al integrante del extremo izquierdo.
- Referencia 3: logo original HAUSET, `public/images/logo.png`.
- PNG completo local: `output/imagegen/installation-story-original.png`.

Prompt exacto enviado:

```text
Use case: identity-preserve, photorealistic-natural. Asset type: wide landscape 16:9 documentary-style illustrative website photograph. Input image 1 is the primary identity reference: preserve the recognizable face, hairline, skin tone, body build and age of the standing HAUSET technician. Input image 2 supplies one colleague: use the man at the far left of the five-worker group, preserving his recognizable face, hairstyle and short beard. Input image 3 is the HAUSET logo for subtle polo embroidery. Create a natural candid photograph-like illustrative visualization during a low-voltage smart-home installation visit. The same technician from image 1 is the main subject, right of center, calmly reviewing a tablet beside a neatly installed open low-voltage network cabinet at safe shoulder level; friendly confident natural half-smile, body turned three quarters toward camera so face is recognizable. The same far-left colleague from image 2 appears left foreground in partial profile, listening, face visible. Both wear charcoal HAUSET polos with subtle accurate white HAUSET embroidery. No third-party logos, badges, lanyards or unrelated trade-show background. Show tidy thin Ethernet patch cables, a small patch panel and network switch, one white wireless access point resting on a sideboard ready for fitting. This is low-voltage networking work only, no exposed mains, no power tools, no ladder, no sparks. Setting is a tasteful warm contemporary Costa Rican home's technical corner opening onto a softly visible living room with walnut details, off-white plaster, neutral linen, garden daylight and warm practical ceiling light. Consistent with a premium but lived-in home, not a sterile factory. Camera at eye level, medium-wide framing showing the two men and working area, 35mm documentary photography, realistic soft shadows and skin texture, restrained colors. No fake interface panels, no neon accents, no watermarks, no captions or text beyond small HAUSET embroidery, no extra people, no hyper-polished AI appearance. This is an illustrative generated scene, not documentation of a completed client project.
```

## Experiencia móvil: mobile-home

- Salida: `public/images/mobile-home.webp` (900 × 1200).
- Referencia 1: fotografía real de los dos integrantes sentados, `output/imagegen/founders-real-original.png` (versión web: `public/images/founders-real.webp`).
- Referencia 2: logo original HAUSET, `public/images/logo.png`.
- PNG completo local: `output/imagegen/mobile-home-original.png`.
- Composición vertical 3:4: rostros centrados en la mitad superior, demostración con tablet y gesto hacia iluminación, mesa oscura libre en el tercio inferior. Visualización ilustrativa con IA, no documentación de un cliente.

Prompt exacto enviado:

```text
Use case: identity-preserve, photorealistic-natural. Asset type: a new premium cinematic vertical mobile website image, portrait 3:4 aspect ratio. Input image 1 supplies the identity of the SAME TWO HAUSET men: preserve both recognizable faces, hairlines, distinct beards, skin tone, body proportions, and approximate age. Input image 2 supplies only HAUSET embroidery reference. Create a natural candid editorial photograph-like illustrative visualization of these same two men demonstrating smart home control together in a tasteful contemporary Costa Rican home at warm blue-hour dusk. The stockier curly-haired man holds a small tablet while the slim wavy-haired man beside him naturally gestures toward softly lit ceiling lights, both with subtle approachable smiles. Their faces must be unobstructed and situated together in the upper half, approximately at 28 to 40 percent of image height, clearly recognizable at mobile screen scale. They wear charcoal black HAUSET polos with small accurate white HAUSET embroidery, no badges or lanyards, no third-party branding. Composition: portrait 3:4, camera at eye level, two men in center and upper third, shown waist-up or seated medium distance; don't crop their heads, hands or tablet. Lower third is a calm darker foreground with walnut coffee table and shadowed neutral linen sofa, intentional uncluttered negative space for later real HTML interface. Do not put any interface or text there. The home feels real and lived-in: warm walnut slatted details, textured off-white walls, modest beautiful low sofa, restrained recessed lighting, glass doors revealing a lush green tropical garden under dusky blue sky. Premium architectural documentary photography, natural 35mm perspective, authentic skin texture, gentle film-like contrast, warm amber practical light, graphite shadows and deep garden green, believable realistic anatomy and scale. Avoid sterile shiny AI showroom, oversized luxury, hyper-polished skin, neon, sci-fi, glowing lines, graphic overlays, floating controls, extra people, captions, watermarks, signs, and all added text beyond the tiny HAUSET uniform embroidery. This is an AI-generated illustrative visualization, never evidence of an actual client project.
```
