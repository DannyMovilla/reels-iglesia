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

## Pinturas clásicas (dominio público)

Las escenas con pinturas de «Con IA» usan estas obras de dominio público, tomadas de Wikimedia Commons y
reducidas a 1600 px de alto (`resources/pinturas/`):

- **El regreso del hijo pródigo**, Rembrandt (hacia 1668). Archivo: Rembrandt Harmensz van Rijn - Return of the Prodigal Son - Google Art Project.jpg — https://commons.wikimedia.org/wiki/File:Rembrandt_Harmensz_van_Rijn_-_Return_of_the_Prodigal_Son_-_Google_Art_Project.jpg
- **La vocación de san Mateo**, Caravaggio (1599–1600). Archivo: Calling-of-st-matthew.jpg — https://commons.wikimedia.org/wiki/File:Calling-of-st-matthew.jpg
- **Cristo en la tormenta en el mar de Galilea**, Rembrandt (1633). Archivo: Rembrandt Christ in the Storm on the Lake of Galilee.jpg — https://commons.wikimedia.org/wiki/File:Rembrandt_Christ_in_the_Storm_on_the_Lake_of_Galilee.jpg
- **La cena de Emaús**, Caravaggio (1601). Archivo: 1602-3 Caravaggio,Supper at Emmaus National Gallery, London.jpg — https://commons.wikimedia.org/wiki/File:1602-3_Caravaggio,Supper_at_Emmaus_National_Gallery,_London.jpg
- **Moisés con las tablas de la ley**, Rembrandt (1659). Archivo: Rembrandt - Moses with the Ten Commandments - Google Art Project.jpg — https://commons.wikimedia.org/wiki/File:Rembrandt_-_Moses_with_the_Ten_Commandments_-_Google_Art_Project.jpg
- **El sermón del monte**, Carl Bloch (1877). Archivo: Bloch-SermonOnTheMount.jpg — https://commons.wikimedia.org/wiki/File:Bloch-SermonOnTheMount.jpg
- **El buen pastor**, Bartolomé Esteban Murillo (hacia 1660). Archivo: BuenPastorMurillo1660.jpg — https://commons.wikimedia.org/wiki/File:BuenPastorMurillo1660.jpg
- **Cristo abrazado a la cruz**, El Greco (hacia 1600). Archivo: Cristo abrazado a la cruz (El Greco, Museo del Prado).jpg — https://commons.wikimedia.org/wiki/File:Cristo_abrazado_a_la_cruz_(El_Greco,_Museo_del_Prado).jpg
- **La cruz en la montaña**, Caspar David Friedrich (1808). Archivo: Caspar David Friedrich - Das Kreuz im Gebirge.jpg — https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Das_Kreuz_im_Gebirge.jpg
- **La transfiguración**, Rafael (1516–1520). Archivo: Transfiguration Raphael.jpg — https://commons.wikimedia.org/wiki/File:Transfiguration_Raphael.jpg
- **Cristo en casa de Marta y María**, Johannes Vermeer (hacia 1655). Archivo: Johannes (Jan) Vermeer - Christ in the House of Martha and Mary - Google Art Project.jpg — https://commons.wikimedia.org/wiki/File:Johannes_(Jan)_Vermeer_-_Christ_in_the_House_of_Martha_and_Mary_-_Google_Art_Project.jpg
