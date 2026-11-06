# Prueba técnica del plan 3 (Task 1)

Fecha: 2026-11-06 · Material: culto real (1:50:20–1:51:30) y composición de la prueba del plan 2.

## D2 — Voz limpia + música con carril de volumen: **funciona**

- Video `muted` + `data-has-audio="false"`, y un `<audio id="vozN" src="voz.m4a" data-media-start="…">`
  por parte. `voz.m4a` = tramo del culto con `highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15`
  (70 s en 3 s).
- Sincronía de la voz contra el audio original: desfase 20 ms, correlación 0,91 → imperceptible.
- La música con `data-automation` (carril `volume`, puntos `{t, v}`) baja bajo la voz (ya medido en el
  plan 2: −31,3 dB → −45,3 dB). No hace falta `sidechaincompress`.
- Render 38 s: 117 s con `--gpu --workers 4` (igual que antes).

## D3 — Normalización final: **dos pasadas loudnorm + alimiter**

- Antes: −10,1 LUFS, pico −1,0 dBFS (demasiado fuerte para redes).
- `loudnorm=I=-14:TP=-1:LRA=11` (medición) → segunda pasada con `measured_*`, `offset`, `linear=true`
  + `alimiter=limit=0.891:level=false`, video con `-c:v copy`, AAC 192k 48 kHz.
- Después: **−14,0 LUFS**, pico −4,8 dBFS. Tiempo extra: 5,5 s por reel de 38 s.

## D4 — Empaquetado: **funciona con asarUnpack**

- `electron-builder` 25.1.8, `--dir`: `asarUnpack` de `node_modules/hyperframes/**`,
  `node_modules/@hyperframes/**`, `node_modules/gsap/**`, `node_modules/@fontsource/**`;
  `extraResources`: `python/`, `modelos/`.
- Sin "Modo de desarrollador" de Windows, la firma (`winCodeSign`) falla al extraer enlaces simbólicos:
  `win.signAndEditExecutable: false` (el ícono se pone con `win.icon` igualmente en NSIS).
- Desde el `.exe` empaquetado (`ELECTRON_RUN_AS_NODE=1` + CLI en `app.asar.unpacked`) el render del
  reel de prueba terminó bien en 115 s.
- Chrome de HyperFrames vive en la caché del usuario (`~/.cache/hyperframes/chrome` o
  `~/.cache/puppeteer/chrome-headless-shell`), no en la app: el asistente de primer uso debe correr
  `hyperframes browser ensure` (descarga ~100 MB una vez).
- Carpeta empaquetada: 444 MB.

## D5 — Música libre

- FreePD (la fuente pensada) **cerró**.
- CC0 confirmado: HoliznaCC0 en Free Music Archive y colecciones CC0 de OpenGameArt; estilo
  mayormente lo-fi/ambiental/juegos, poco piano o cuerdas "inspiradoras".
- **Decisión de la persona:** solo pads generados + pistas propias (no se incluye música en la app).

## D1 — Catálogo de HyperFrames (descargado con permiso, 125 KB)

| Bloque | Tecnología | Uso |
|---|---|---|
| caption-highlight, caption-pill-karaoke, caption-kinetic-slam, caption-neon-accent | CSS + GSAP | Se portan como estilos de subtítulo (Task 8). |
| organic-light-leak-overlay | CSS (gradientes + blur, `mix-blend-mode: screen`) | Transición "luz" (Task 9). |
| grain-overlay | CSS | Textura de grano (Task 9). |
| instagram-follow, tiktok-follow | CSS + GSAP | Cierre "Síguenos" (Task 9). |
| lt-soft-pill | CSS + GSAP | Rótulo del predicador (Task 9). |
| flash-through-white | **WebGL** (shader) | **Descartado**: se mantiene el destello CSS actual (no depende de la GPU del render headless). |

- Todos cargan GSAP y fuentes desde CDN: al portarlos se usan GSAP local y `@fontsource` (como el resto).
- El catálogo no trae licencia por bloque; es parte del repositorio de HyperFrames (Apache 2.0):
  crédito en `NOTICE.md`.
