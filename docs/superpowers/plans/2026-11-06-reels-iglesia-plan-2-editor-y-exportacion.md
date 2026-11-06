# Reels Iglesia — Plan 2: editor y exportación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editar cada clip sugerido con vista previa en vivo y exportarlo como MP4 en 9:16, 4:5 y 1:1 con HyperFrames, con apertura en blanco y negro, subtítulos, tarjeta del versículo (Reina-Valera 1909) y cierre (etapas 4 y 5 del diseño).

**Architecture:** Un "motor de reel" puro en TypeScript (`src/shared/reel/`) convierte `ClipSpec` + transcripción + caras + marca en una composición HTML de HyperFrames. El renderer la muestra con `@hyperframes/player`; el proceso principal la exporta con el CLI de HyperFrames (fijado a 0.9.17) como un nuevo tipo de tarea en la cola existente. La vista previa y el MP4 salen del mismo HTML.

**Tech Stack:** lo del plan 1 + `hyperframes@0.9.17` (CLI, ya probado), `@hyperframes/player` (la versión publicada junto a 0.9.17), `gsap@3.12.5`, fuentes locales `@fontsource/montserrat` y `@fontsource/figtree` (5.x); Biblia Reina-Valera 1909 de eBible.org (`spaRV1909`, dominio público). Las versiones sin número exacto se confirman con `npm view <paquete> versions` en Task 1 y se fijan exactas (ledger).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (secciones 3.2, 5, 6 Editor, 7, 9 y 13).

## Global Constraints

- Todo lo del plan 1 sigue vigente (Windows, español, `spawn` sin shell, versiones exactas, renderer sin acceso a archivos ni procesos).
- Vista previa y exportación usan **la misma** función `construirComposicion`; solo cambia la URL/ruta del video fuente.
- Formatos: 9:16 = 1080×1920, 4:5 = 1080×1350, 1:1 = 1080×1080; H.264, ~10 Mb/s (`--video-bitrate 10M`), audio con pico ≤ −1 dB.
- Archivos de salida: `exportados/<slug-del-titulo>-9x16.mp4`, `-4x5`, `-1x1`.
- Regla del versículo: mientras la tarjeta está visible no hay subtítulos; un bloque que empieza antes se corta al entrar la tarjeta (si quedaría < 0,3 s, se omite); duración de la tarjeta = 0,5 s + 0,3 s por palabra, entre 4 y 8 s; tarjeta debajo de la cara (en 9:16, top 62 % del alto; en 4:5 y 1:1, 60 %).
- Texto bíblico: Reina-Valera 1960 escrito por Claude en el análisis, `confirmado: false` hasta que la persona lo confirma en el inspector; exportar un clip con un versículo activo sin confirmar falla con "Confirma el texto de <ref> antes de exportar." La tarjeta muestra la referencia y "RVR1960". (Cambio del 2026-11-06, ver ledger.)
- Apertura: B/N (`grayscale(1) contrast(1.15) brightness(0.95)`) + viñeta, gancho encima, destello blanco 0,3 s al pasar al clip.
- Gancho: si la cara (mediana del clip) está en la mitad superior del cuadro, centro del gancho al 53 % del alto (solo 9:16); si no, 12 %.
- Subtítulos: estilos `pop` (Montserrat 900, contorno 12 px, palabra dicha con escala 1,18→1 en 0,18 s y color de marca), `caja`, `limpio`; máx. 3 palabras / 16 caracteres (pop/caja) o 6 / 30 (limpio); palabras clave siempre en color de marca.
- Encuadre: zoom por defecto 1,25, cara al 33 % del alto del recorte, zona muerta 0,035 en x / 0,05 en y, corte seco si salta > 0,15.
- Cierre: 2,6 s con inicial o logo, nombre e invitación de `marca.json` (por defecto nombre "Mi iglesia", color `#f2b544`, invitación "Síguenos"). La pantalla Marca y la música son el plan 3.
- Composiciones sin red: GSAP y fuentes se copian a la carpeta de la composición (nada desde CDN).

## Review Focus

1. Clip cuyo inicio o fin cae dentro de una palabra o en una pausa → el corte se ajusta a límites de palabra y el reel nunca empieza ni termina con media palabra. Prueba en Task 3 (`ajustarCorte`).
2. Versículo citado al principio o al final del clip (tarjeta que se saldría del clip o se cruzaría con el cierre) → la tarjeta se recorta para quedar dentro del clip y nunca tapa el cierre. Prueba en Task 3.
3. Exportar con el video original movido o con FFmpeg/GPU ausente → la tarea queda en error con mensaje en español y el resto de la cola sigue; sin GPU NVIDIA se exporta sin `--gpu`. Prueba en Task 6.
4. Editar el clip mientras se exporta → la exportación usa la versión guardada al momento de encolar (instantánea), no cambios posteriores. Prueba en Task 6.
5. Títulos con acentos, signos o emojis y nombres repetidos → archivos de salida válidos en Windows y sin pisarse (`-2`). Prueba en Task 6 (`nombreSalida`).

---

## Estructura de archivos

```
src/shared/reel/tiempo.ts        # partes del reel (apertura + clip + cierre), conversión tiempo-reel ↔ tiempo-video
src/shared/reel/subtitulos.ts    # bloques por estilo + regla del versículo
src/shared/reel/encuadre.ts      # pista de cámara desde Caras, posición del gancho
src/shared/reel/versiculo.ts     # duración de lectura y ventana de la tarjeta
src/shared/reel/cortes.ts        # ajustar inicio/fin a límites de palabra
src/shared/reel/composicion.ts   # construirComposicion → HTML HyperFrames
src/shared/reel/estilos.css.ts   # CSS de la composición (string)
src/main/biblia/biblia.ts        # parsearReferencia, textoVersiculo
resources/biblia/rv1909.json     # generado por scripts/biblia/convertir.py
scripts/biblia/convertir.py
src/main/exportar/preparar.ts    # carpeta de render: index.html + gsap + fuentes
src/main/exportar/render.ts      # spawn del CLI hyperframes con progreso
src/main/exportar/tarea.ts       # ejecutor "exportar" para la cola
src/renderer/componentes/VistaPrevia.tsx, Inspector.tsx, LineaTiempo.tsx, ColaExportacion.tsx
src/renderer/pantallas/Editor.tsx  (se reescribe sobre la versión de lectura)
docs/superpowers/notas/2026-11-06-prueba-hyperframes-2.md
```

---

### Task 1: Prueba técnica de vista previa, video fuente y mezcla

**Files:**
- Create: `spike/plan2/` (desechable, no se versiona salvo la nota), `docs/superpowers/notas/2026-11-06-prueba-hyperframes-2.md`

**Interfaces:**
- Produces: tres decisiones escritas en la nota y en el ledger, que fijan Task 4–7:
  - **D1 Vista previa:** `@hyperframes/player` con `srcdoc` dentro de Electron reproduce un `<video src="reels-video://…">` en sincronía con GSAP (sí/no). Si no: la vista previa usa el motor canvas del prototipo `prototipos/pulpito-clips.html` y HyperFrames queda solo para exportar.
  - **D2 Video fuente del render:** `src` con ruta absoluta al MP4 original de 1 GB + `data-media-start` funciona y tarda < 2× la duración del reel (sí/no). Si no: se corta el tramo con `ffmpeg -ss <inicio-1> -to <fin+1> -c:v h264_nvenc -c:a aac` a `tmp/<clip>/fuente.mp4`.
  - **D3 Mezcla:** `data-fx-carve` con `sources` = ids de los `<video>` baja un `<audio>` de prueba debajo de la voz (medido con `volumedetect` en tramos con y sin voz) (sí/no). Si no: mezcla posterior con FFmpeg `sidechaincompress` (plan 3).

- [ ] **Step 1:** Instalar `hyperframes@0.9.17`, `@hyperframes/player@0.9.17`, `gsap@3.12.5` exactos.
- [ ] **Step 2: D1** — página mínima en el renderer (ruta temporal `#prueba`) con `<hyperframes-player srcdoc=…>` de la composición de `spike/generar.py` cambiando `src` a `reels-video://archivo/<ruta>`. Esperado: al hacer `seek(12)` el cuadro del video y el subtítulo coinciden (captura) y `timeupdate` avanza ~10/s.
- [ ] **Step 3: D2** — `npx hyperframes@0.9.17 render --gpu --workers 4` de la composición con `src` absoluto al culto real y `data-media-start=6600`. Medir tiempo y contar cuadros duplicados con `mpdecimate` (como en el plan 1).
- [ ] **Step 4: D3** — agregar `<audio id="musica" src="tono.wav" data-volume="0.3" data-fx-carve='{"enabled":true,"sources":["v0","v1"],"strength":0.5}'>`; renderizar; `volumedetect` en 1 s sin voz vs 1 s con voz. Esperado si funciona: ≥ 6 dB menos de música con voz.
- [ ] **Step 5:** Escribir la nota con D1–D3, números medidos y capturas; commit `docs: prueba técnica de HyperFrames para el editor`.

---

### Task 2: Biblia Reina-Valera 1909

**Files:**
- Create: `scripts/biblia/convertir.py`, `resources/biblia/rv1909.json`, `src/main/biblia/biblia.ts`, `tests/main/biblia/biblia.test.ts`
- Modify: `src/main/claude/analizar.ts` (llenar `texto` de cada versículo antes de guardar)

**Interfaces:**
- Produces: `parsearReferencia(ref: string): { libro: string; capitulo: number; desde: number; hasta: number } | null`; `textoVersiculo(ref: string): string | null`; JSON `{ "<libro canónico>": { "<cap>": { "<vers>": "texto" } } }` con los 66 libros en nombres españoles canónicos ("Génesis" … "Apocalipsis").
- `convertir.py` descarga `https://ebible.org/Scriptures/spaRV1909_vpl.zip` (formato un versículo por línea: `GEN 1:1 texto`), mapea los códigos USFM (GEN…REV) a nombres españoles y escribe el JSON (UTF-8).

- [ ] **Step 1: Tests que fallan:**
  - `parsearReferencia("Salmo 51:17")` y `("Salmos 51:17")` → `{ libro: "Salmos", capitulo: 51, desde: 17, hasta: 17 }`.
  - `("1 Corintios 13:4-7")` → `{ libro: "1 Corintios", capitulo: 13, desde: 4, hasta: 7 }`; `("1 Co 13:4")`, `("Romanos 8,28")`, `("San Juan 3:16")` también se reconocen.
  - `("Hola 1:1")` y `("Juan")` → `null`.
  - `textoVersiculo("Juan 3:16")` empieza con `"Porque de tal manera amó Dios al mundo"`.
  - `textoVersiculo("Salmos 151:1")` → `null`.
  - Tras `analizarProyecto` con el Claude falso (modo `ok`), `clips[0].versiculos[0].texto` (Salmo 51:17) empieza con `"Los sacrificios de Dios son el espíritu quebrantado"`.
- [ ] **Step 2:** Run `npm test -- biblia claude` → FAIL. Correr `convertir.py`, implementar `biblia.ts` (alias de libros incluyendo abreviaturas comunes, "San", números "1"/"Primera"), enganchar en `analizar.ts`. Run → PASS.
- [ ] **Step 3:** Commit `feat: textos bíblicos de la Reina-Valera 1909`.

---

### Task 3: Motor de reel — tiempos, cortes, subtítulos, versículo y encuadre

**Files:**
- Create: `src/shared/reel/tiempo.ts`, `cortes.ts`, `subtitulos.ts`, `versiculo.ts`, `encuadre.ts`, `tests/shared/reel/*.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Parte { tipo: "apertura" | "clip" | "cierre"; inicioVideo: number; finVideo: number; inicioReel: number; duracion: number }
  partesDelReel(c: ClipSpec): Parte[]               // apertura (si activa) + clip + cierre (2,6 s, sin video)
  duracionReel(c: ClipSpec): number
  ajustarCorte(c: { inicio: number; fin: number }, palabras: Palabra[]): { inicio: number; fin: number } // al inicio/fin de palabra más cercano; mínimo 5 s
  ventanaVersiculo(v: ClipSpec["versiculos"][number], clip: Parte): { desde: number; hasta: number } | null // en tiempo de reel
  duracionLectura(texto: string, ref: string): number   // 0,5 + 0,3 × palabras, entre 4 y 8
  bloquesSubtitulos(c: ClipSpec, palabras: Palabra[], partes: Parte[]): Bloque[] // ya con la regla del versículo aplicada
  interface Bloque { desde: number; hasta: number; palabras: { texto: string; desde: number; hasta: number; clave: boolean }[] }
  pistaCamara(caras: Caras, desde: number, hasta: number): { keys: { t: number; x: number; y: number }[]; caraY: number } | null
  posicionGancho(caraY: number, formato: Formato): number   // fracción del alto (0.53 o 0.12)
  ```
  `Palabra` = `{ s: number; e: number; t: string }` (se exporta desde `tiempo.ts`).

- [ ] **Step 1: Tests que fallan** (valores exactos del diseño):
  - `partesDelReel` con apertura 39,02–44,8 y clip 30,93–63,46 → duraciones `[5.78, 32.53, 2.6]` e `inicioReel` `[0, 5.78, 38.31]`.
  - **Review Focus 1:** `ajustarCorte({inicio: 31.0, fin: 63.6}, palabras)` con la transcripción de muestra → inicio = `s` de la palabra más cercana, fin = `e` de la palabra más cercana; un clip que quedaría < 5 s se extiende al fin de la palabra que alcanza 5 s.
  - `duracionLectura` de 22 palabras → 7,1; de 3 → 4; de 40 → 8.
  - **Review Focus 2:** versículo con `en` = 31 s en un clip de 32,53 s → la ventana termina en el fin del clip (no entra al cierre); con `en` = 0 → empieza en el inicio del clip.
  - Regla del versículo: un bloque de 16,0–17,0 con la tarjeta desde 16,5 queda 16,0–16,5; uno de 16,4–17,0 se omite (< 0,3 s); ninguno empieza dentro de la ventana.
  - `pistaCamara` con caras sintéticas (x = 0,5 y luego 0,8 desde t = 10) produce un par de claves separadas por 0,02 s en t ≈ 10 (corte seco) y no se mueve con oscilaciones de ±0,02.
  - `posicionGancho(0.25, "9:16")` → 0.53; `(0.6, "9:16")` → 0.12; `(0.25, "1:1")` → 0.12.
- [ ] **Step 2:** Run `npm test -- reel` → FAIL. Implementar (portar la lógica de `spike/generar.py` y `prototipos/pulpito-clips.html`). Run → PASS.
- [ ] **Step 3:** Commit `feat: motor de reel (tiempos, cortes, subtítulos, versículo, encuadre)`.

---

### Task 4: Constructor de composición

**Files:**
- Create: `src/shared/reel/composicion.ts`, `src/shared/reel/estilos.css.ts`, `tests/shared/reel/composicion.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces:
  ```ts
  interface Marca { nombre: string; color: string; invitacion: string; logo?: string /* data URL */ }
  interface EntradaComposicion { clip: ClipSpec; transcripcion: Transcripcion; caras: Caras | null; marca: Marca; formato: Formato;
    fuenteVideo: string;               // reels-video://… (vista previa) o ruta/URL para el render (según D2)
    recursos: { gsap: string; fuentes: string } } // rutas relativas o URLs a gsap.min.js y la carpeta de fuentes
  construirComposicion(e: EntradaComposicion): { html: string; duracion: number; ancho: number; alto: number; avisos: string[] }
  ```
  `avisos` incluye "Salmo 51:17 no se encontró en la Reina-Valera 1909" cuando un versículo activo no tiene texto.

- [ ] **Step 1: Tests que fallan** (sobre el HTML con `DOMParser` de jsdom):
  - 9:16 → raíz con `data-width="1080" data-height="1920"` y `data-duration` = `duracionReel`; 4:5 → 1350; 1:1 → 1080.
  - Hay un `<video>` por parte con video, con `data-media-start` = `inicioVideo`, `data-has-audio="true"` y `src` = `fuenteVideo`; el de apertura tiene el filtro B/N; existe `#flash` en el `inicioReel` del clip.
  - Ningún elemento `.sub` tiene `data-start` dentro de la ventana del versículo; existe `.vers` con la referencia y el texto.
  - `#cierre` empieza en `inicioReel` del cierre, dura 2,6 y contiene nombre e invitación de la marca.
  - El gancho tiene `top` = `posicionGancho × alto` menos la mitad de su caja (verificar el número de `top` para 9:16 con caraY 0,25).
  - No hay ninguna URL `http` en el HTML (sin CDN).
  - Un título con `<script>` en el gancho aparece escapado.
- [ ] **Step 2:** Run `npm test -- composicion` → FAIL. Implementar (GSAP con `immediateRender:false` en los pop de palabras; `window.__timelines["main"]`). Run → PASS.
- [ ] **Step 3:** `npx hyperframes@0.9.17 check` sobre una composición generada desde la muestra (`tests/fixtures/transcripcion-muestra.json` + `spike/prueba-hf/culto.mp4` si existe) → 0 errores. Commit `feat: constructor de composición HyperFrames`.

---

### Task 5: Preparar y renderizar con HyperFrames

**Files:**
- Create: `src/main/exportar/preparar.ts`, `src/main/exportar/render.ts`, `tests/main/exportar/render.test.ts`, `tests/integracion/exportar.test.ts`

**Interfaces:**
- Consumes: `construirComposicion` (Task 4), `ejecutarConProgreso` (plan 1), decisión D2.
- Produces:
  - `prepararCarpeta(dir: string, html: string): Promise<void>` — escribe `index.html`, copia `node_modules/gsap/dist/gsap.min.js` y las fuentes `woff2` de `@fontsource` a `dir/recursos/`, más `hyperframes.json` y `meta.json` mínimos.
  - `progresoHyperframes(linea: string): number | null` — interpreta `@hf-progress {"pct":42,...}` → 42.
  - `renderizar(dir: string, salida: string, op: { gpu: boolean; senal: AbortSignal; alProgreso(pct: number): void }): Promise<void>` — ejecuta el CLI de `node_modules/hyperframes` con `render --workers 4 --video-bitrate 10M -o <salida>` y `--gpu` si `op.gpu`; error en español con las últimas líneas si falla.

- [ ] **Step 1: Tests que fallan:** `progresoHyperframes('@hf-progress {"code":"capture","done":10,"total":40,"pct":25}')` → 25; línea sin prefijo → `null`; `renderizar` con un ejecutor falso arma los argumentos esperados con y sin `gpu`.
- [ ] **Step 2:** Run `npm test -- render` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Integración** (`npm run test:integracion`): fixture del plan 1 → clip 0–15 s, 9:16 → MP4 de 1080×1920, duración ≈ `duracionReel` ± 0,1 s, sin cuadros duplicados fuera de la tarjeta de cierre (`mpdecimate`), pico de audio ≤ −1 dB.
- [ ] **Step 4:** Commit `feat: render con HyperFrames`.

---

### Task 6: Tarea "exportar" en la cola

**Files:**
- Create: `src/main/exportar/tarea.ts`, `tests/main/exportar/tarea.test.ts`
- Modify: `src/shared/tipos.ts` (`TipoTarea` agrega `"exportar"`; `Tarea` agrega `clipId?: string; formato?: Formato; salida?: string`), `src/main/cola/cola.ts` (`agregar` acepta datos extra), `src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`

**Interfaces:**
- Produces:
  - `nombreSalida(titulo: string, formato: Formato, existentes: Set<string>): string` — slug sin acentos ni signos, `-9x16|-4x5|-1x1.mp4`, sufijo `-2`… si existe.
  - Ejecutor `exportar`: toma la **instantánea** del clip guardada en la tarea al encolar (Review Focus 4), construye la composición con la fuente según D2, prepara `tmp/<tareaId>/`, renderiza a `exportados/`, marca el clip `estado: "exportado"`, borra `tmp/<tareaId>/`. `gpu` = resultado de `verificarSistema().gpu` contiene "NVIDIA".
  - `ApiReels.exportar(proyectoId: string, clipIds: string[], formatos?: Formato[]): Promise<void>` (una tarea por clip y formato); `ApiReels.abrirCarpetaExportados(proyectoId: string): Promise<void>`; notificación de Windows al terminar la última tarea de exportación de un proyecto ("3 reels listos").
- [ ] **Step 1: Tests que fallan:**
  - **Review Focus 5:** `nombreSalida("¿Oras o solo hablas? 🙏", "9:16", new Set())` → `"oras-o-solo-hablas-9x16.mp4"`; con ese nombre ya en el set → `"oras-o-solo-hablas-2-9x16.mp4"`; título vacío → `"reel-9x16.mp4"`.
  - **Review Focus 4:** encolar, cambiar el gancho en `clips.json`, ejecutar → el HTML renderizado (capturado con un `renderizar` falso) tiene el gancho original.
  - **Review Focus 3:** video original inexistente → la tarea queda en `error` con "No encuentro el video original. Vuelve a ponerlo en su lugar y reintenta." y la siguiente tarea corre; `gpu: false` → los argumentos no incluyen `--gpu`.
- [ ] **Step 2:** Run `npm test -- exportar` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Commit `feat: exportación en la cola`.

---

### Task 7: Editor con vista previa e inspector

**Files:**
- Create: `src/renderer/componentes/VistaPrevia.tsx`, `src/renderer/componentes/Inspector.tsx`, `tests/renderer/Inspector.test.tsx`
- Modify: `src/renderer/pantallas/Editor.tsx`, `src/shared/api.ts` + preload + ipc (`guardarClip(proyectoId, clip)`, `leerCaras(id)`, `leerMarca()`), `src/main/proyectos/almacen.ts` (`leerMarca` con valores por defecto)

**Interfaces:**
- Consumes: `construirComposicion` (Task 4), decisión D1.
- Produces:
  - `VistaPrevia({ entrada: EntradaComposicion; zonaSegura: boolean })` — `<hyperframes-player srcdoc>` (o el motor canvas si D1 = no), botones 9:16 / 4:5 / 1:1, reproducir/pausa, tiempo `0:08.4 / 0:41.2`, capa de zona segura (arriba 9 %, abajo 18 %, derecha 14 % entre 40 % y 82 % del alto) con la etiqueta "Instagram tapa esta zona".
  - `Inspector({ clip, avisos, alCambiar(c: ClipSpec) })` con pestañas **Clip** (título, gancho + 2 alternativas que lo reemplazan al tocarlas, por qué funciona, versículos con interruptor y aviso si falta el texto, apertura con interruptor, cierre con interruptor, formatos), **Estilo** (estilo, tamaño y altura de subtítulos; encuadre auto/fijo, posición, zoom) y **Publicar** (descripción, versículos y hashtags con botón Copiar).
  - Guardado automático con 400 ms de espera (`guardarClip`), marca `estado: "editado"`.
- [ ] **Step 1: Tests que fallan:** tocar una alternativa la pone como gancho y la anterior pasa a las alternativas; apagar el versículo deja `versiculos[0].activo === false`; con `avisos` de versículo no encontrado se ve el aviso; cambiar a "Caja" llama `alCambiar` con `subtitulos.estilo === "caja"`.
- [ ] **Step 2:** Run → FAIL. Implementar con los estilos de `design/maqueta-editor.html`. Run → PASS.
- [ ] **Step 3: E2E** (ampliar `flujo-basico.spec.ts`): tras procesar, el reproductor de vista previa emite `ready`; cambiar el gancho y recargar el proyecto conserva el cambio.
- [ ] **Step 4:** Commit `feat: editor con vista previa e inspector`.

---

### Task 8: Línea de tiempo

**Files:**
- Create: `src/renderer/componentes/LineaTiempo.tsx`, `tests/renderer/LineaTiempo.test.tsx`

**Interfaces:**
- Consumes: Task 3 (`partesDelReel`, `bloquesSubtitulos`, `ventanaVersiculo`, `ajustarCorte`), `VistaPrevia` (tiempo actual y `seek`).
- Produces: `LineaTiempo({ clip, palabras, tiempoActual, alBuscar(t), alCambiarCorte(inicio, fin) })` con carriles **Video** (selección con bordes dorados arrastrables), **Efectos** (apertura B/N, versículo, cierre), **Subtítulos** (bloques; palabras clave en dorado; hueco "ocultos por la cita"); cabezal turquesa; campos Inicio / Fin / Duración; teclado: Espacio reproducir, I/O marcar inicio/fin en el cabezal, ←/→ ±0,1 s, Shift ±1 s. Todo corte pasa por `ajustarCorte`.
- [ ] **Step 1: Tests que fallan:** pulsar `O` con el cabezal en 50,3 llama `alCambiarCorte` con el fin ajustado a fin de palabra; el carril de subtítulos muestra "ocultos por la cita" en la ventana del versículo; un corte que dejaría < 5 s no se aplica y muestra "Un reel necesita al menos 5 segundos.".
- [ ] **Step 2:** Run → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Commit `feat: línea de tiempo con cortes por palabra`.

---

### Task 9: Cola de exportación en la interfaz

**Files:**
- Create: `src/renderer/componentes/ColaExportacion.tsx`, `tests/renderer/ColaExportacion.test.tsx`, `tests/e2e/exportar.spec.ts`
- Modify: `Editor.tsx` (botones "Exportar este clip" y "Exportar N clips" en la barra de título), `Riel`/`App` (sección Exportados lista los MP4 por proyecto con "Abrir carpeta")

**Interfaces:**
- Consumes: `ApiReels.exportar`, `abrirCarpetaExportados`, tareas `exportar`.
- Produces: panel inferior izquierdo "Exportando «título» · 9:16 · 64 % · GPU" + "N en cola", con Cancelar; al terminar, "Listo · Abrir carpeta".
- [ ] **Step 1: Test que falla:** con 3 tareas `exportar` (1 corriendo al 64 %, 2 pendientes) muestra el título, "64 %" y "2 en cola"; Cancelar llama `cancelar(id)`.
- [ ] **Step 2:** Run → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: E2E** `exportar.spec.ts`: proyecto de prueba procesado → "Exportar este clip" (solo 9:16) → esperar "Listo" (≤ 4 min) → existe `exportados/el-quebrantamiento-activa-la-gloria-9x16.mp4` con 1080×1920 (ffprobe).
- [ ] **Step 4:** Commit `feat: cola de exportación y sección Exportados`.

---

### Task 10: Caras más rápidas con decodificación por GPU

**Files:**
- Modify: `python/transcribir.py` (`detectar_caras`), `python/test_transcribir.py`

**Interfaces:**
- Produces: `args_ffmpeg_caras(video, inicio, fin, fps, ancho, alto, gpu: bool) -> list[str]` — con `gpu` agrega `-hwaccel cuda` antes de `-i`; `detectar_caras` intenta con GPU y, si FFmpeg falla en el primer cuadro, repite sin GPU.
- [ ] **Step 1: Tests que fallan:** `args_ffmpeg_caras(..., gpu=True)` contiene `["-hwaccel", "cuda"]` antes de `"-i"`; con `gpu=False` no.
- [ ] **Step 2:** Run `pytest python -q` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Medir con el culto real: `--solo-caras` 1:44:44–2:32:35 con y sin GPU; anotar ambos tiempos en el ledger (esperado: menor con GPU; si no mejora, dejar `gpu=False` por defecto y anotarlo).
- [ ] **Step 4:** Commit `perf: decodificación por GPU al buscar caras`.

---

## Siguiente (plan 3)

Pantalla Marca (logo con y sin fondo, color, invitación), música generada y mezcla bajo la voz (según D3), asistente de primer uso (FFmpeg, `.venv`, sesión de Claude), instalador y los menores pendientes del plan 1.
