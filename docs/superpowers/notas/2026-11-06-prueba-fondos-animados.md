# Prueba: fondos animados del catálogo de HyperFrames para «Con IA»

Fecha: 2026-11-06 · Bloques (Apache 2.0) + librería `shaders` 4.0.0 (MIT) que traen.

| Fondo | Con `--gpu` | Movimiento (dif. media entre 0,8 s y 2,2 s) | Idea |
|---|---|---|---|
| godrays | sí | 11,9 | luz, gloria, presencia |
| sun-burst | sí | 17,3 | amanecer, esperanza (suavizar: los rayos de fábrica son duros) |
| aurora | sí | 6,7 | paz, adoración |
| fractal-noise | sí | 6,4 | nubes, cielo (teñir) |
| mesh-gradient | sí | 2,6 | degradado elegante con la marca |
| lens-flare | sí | 1,0 | luz cálida |
| starfield | sí (puntos tenues) | 0,03 | combinar con aurora o subir densidad |

- Sin `--gpu` también renderiza (godrays: mismo brillo) → sirve en PCs sin NVIDIA.
- **Un solo shader por documento:** la librería toma el primer `canvas[data-shader]`; en un reel va un solo fondo.
- Colores y parámetros por `data-shader-props` (JSON) en el canvas; vienen en 1920×1080 → se pasan a
  1080×1920 / 1350 / 1080 en el canvas y el contenedor.
- Render de 3 s de fondo: ~30 s con 2 workers.
- Hoja de muestra: `2026-11-06-fondos-hyperframes.png` (colores de fábrica, salvo godrays en ámbar).
