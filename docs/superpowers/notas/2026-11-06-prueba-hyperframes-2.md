# Prueba técnica de HyperFrames para el editor (plan 2, tarea 1)

Fecha: 2026-11-06 · Equipo: Windows 11, GTX 1650 Ti (NVENC), HyperFrames 0.9.17

## D1 — Vista previa dentro de la app: **sí, con protocolo propio**

- `@hyperframes/player` con `srcdoc` **no** funciona en Electron: el iframe hereda la CSP de la app
  (`script-src 'self'`), que bloquea los scripts de la composición y el runtime que el reproductor
  descarga de `cdn.jsdelivr.net`.
- Funciona sirviendo la composición por `reels-comp://<id>/index.html` (protocolo propio con su
  propia CSP) e incluyendo en la composición `recursos/hyperframe.runtime.iife.js` (de
  `node_modules/@hyperframes/core/dist`) y `recursos/gsap.min.js`. Con el runtime ya presente,
  el reproductor no intenta descargarlo. La app agrega `frame-src reels-comp:` a su CSP.
- Medido: `ready` con duración 40,65 s; 24 `timeupdate` en 3 s de reproducción; `seek(19)` muestra
  el mismo cuadro que el MP4 exportado (video, tarjeta del versículo y marca).
- El atributo `runtime-src` del reproductor solo acepta http(s) localhost o el mismo origen; no sirve.

## D2 — Render desde el video original: **sí, ruta absoluta + `data-media-start`**

- `src="C:/Users/.../FDownloader...(1280p).mp4"` (1 GB) con `data-media-start` en segundos del
  original: render de 40,6 s en **67 s** (`--gpu --workers 4`), 1080×1920, sin cuadros duplicados
  fuera de la tarjeta final fija. No hace falta cortar el tramo antes.
- El linter marca como **error** mover la cámara con `left`/`top` (se redondea al píxel y tiembla en
  la captura cuadro a cuadro): el constructor debe usar transformaciones (`x`, `y`, `scale`).
- Avisos menores: dar `id` a todos los elementos con tiempo; tweens superpuestos en la cámara
  (usar `overwrite: "auto"`).

## D3 — Música bajo la voz: **carril de volumen, no carve**

- `data-fx-carve` con `sources` = ids de los `<video>` no cambió nada (tono de 6 kHz: −31,6 / −31,3 /
  −31,5 dB con y sin carve). Probablemente solo talla las bandas de la voz o necesita su script.
- `data-automation` con un carril `volume` funciona: el tono pasa de −31,3 dB (v = 1) a −45,3 dB
  (v = 0,2). El plan 3 calcula el carril desde los tiempos de las palabras (entra fuerte, baja bajo
  la voz, sube en pausas), igual que el prototipo.
