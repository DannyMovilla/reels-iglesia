# Avisos de terceros

## HyperFrames (Apache License 2.0)

Reels Iglesia usa HyperFrames (https://github.com/heygen-com/hyperframes), © HeyGen, bajo la
Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).

Partes adaptadas de bloques de su catálogo (modificadas: color de la marca, fuentes locales,
integración con los subtítulos palabra por palabra y la regla del versículo):

- `caption-highlight`, `caption-pill-karaoke`, `caption-kinetic-slam`, `caption-neon-accent`
  → estilos de subtítulos Resaltado, Karaoke, Impacto y Neón (`src/shared/reel/estilos-sub.ts`).
- `organic-light-leak-overlay` → transición "Luz"; `grain-overlay` → grano de película (con GSAP en vez de animación CSS);
  `lt-soft-pill` → rótulo del predicador; `instagram-follow` / `tiktok-follow` → idea de la tarjeta "Síguenos"
  del cierre (`src/shared/reel/composicion.ts`, `src/shared/reel/estilos.css.ts`).

## shaders (MIT)

Las escenas animadas de «Con IA» (luz, amanecer, aurora, nubes, atardecer, destello) usan la librería
`shaders` 4.0.0 (© 2026 Shader Effects Inc., MIT), distribuida con los bloques `godrays`, `sun-burst`,
`aurora`, `fractal-noise`, `mesh-gradient` y `lens-flare` del catálogo de HyperFrames (Apache 2.0).
Sus licencias de terceros están en `resources/escenas/shaders.THIRD-PARTY-LICENSES.txt`.

## Efectos de sonido

`resources/efectos/` (whoosh, whoosh-suave, pop) son sonidos propios de Reels Iglesia, generados con
`python/efectos.py` (ruido filtrado y un seno, con numpy). No usan grabaciones ni sonidos de terceros.
