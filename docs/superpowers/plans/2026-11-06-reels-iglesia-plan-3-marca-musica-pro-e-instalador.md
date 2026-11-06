# Reels Iglesia — Plan 3: marca, música, reels más pro e instalador

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la iglesia configure su marca y estilo una vez, que cada reel salga con música adecuada, audio limpio, cortes ágiles, subtítulos y efectos más vistosos, textos y portada para cada red, y que la app se instale y prepare sola en otro PC.

**Architecture:** Todo lo nuevo del reel vive en funciones puras de `src/shared/reel/` (probadas sin Electron) que alimentan `construirComposicion`. El audio pesado se hace con FFmpeg y Python fuera del render: la voz limpia se calcula una vez por proyecto (nuevo paso de la cola) y el MP4 final pasa por una mezcla/normalización con FFmpeg. Claude devuelve en el mismo análisis el ánimo de la música y los textos por red. La marca y el estilo de la iglesia viven en `marca.json`.

**Tech Stack:** Electron 35 + React 18 + TypeScript, HyperFrames 0.9.17 (+ bloques de su catálogo, Apache 2.0), FFmpeg (`afftdn`, `loudnorm`, `alimiter`, `sidechaincompress` si hace falta), Python (numpy para pads, yt-dlp), electron-builder (NSIS), Vitest, pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (secciones 5, 7, 14).

## Global Constraints

- Versículos siempre Reina-Valera 1960; la app nunca incluye texto RVR1960; exportar sigue bloqueado con versículos sin confirmar.
- Sin claves de API de pago: Claude solo vía `claude -p` con la suscripción; una llamada de análisis por proyecto (ánimo y textos por red van en esa misma llamada).
- Solo se incluye en la app música CC0; los bloques del catálogo de HyperFrames se copian con su licencia Apache 2.0 y crédito en `NOTICE.md`.
- Textos de la interfaz y errores en español sencillo para una persona no técnica.
- Audio final: −14 LUFS integrados (±1), pico verdadero ≤ −1 dBTP.
- Cortes de pausas: pausas > 0,7 s quedan en 0,25 s; muletillas sueltas: "eh", "ehh", "em", "emm", "mm", "mmm".
- Límites de redes: Instagram texto 2200 y 30 hashtags; TikTok texto 2200; Facebook texto 5000; YouTube Shorts título 100 y texto 5000.
- Mezcla: música a 0,5 de volumen los primeros 1,8 s, baja al volumen del clip (por defecto 0,12) bajo la voz, sube a 2× ese volumen (máx. 0,3) en pausas de voz > 1,2 s, se desvanece en el último 1,0 s.
- Trabajo en `main` (decisión de la persona); no se sube a GitHub sin preguntar.
- Descargar archivos de internet durante la implementación (pistas CC0, bloques del catálogo, modelo RNNoise si se usa) requiere preguntar a la persona antes, con nombre, fuente y tamaño.

## Review Focus

1. Proyectos y clips creados con los planes 1–2 (sin `musica.animo`, `redes`, `cortes`, estilo nuevo) → se abren y exportan igual, con valores por defecto. Prueba en Task 2 (`completarClip`).
2. Clip con cortes de pausas cuyo versículo, apertura o palabra clave cae justo en un tramo quitado → la tarjeta y los subtítulos siguen sincronizados con la voz y la tarjeta nunca queda sobre un hueco. Prueba en Task 7.
3. Voz muy baja o saturada (grabación real del templo) → el reel queda en −14 ±1 LUFS y ≤ −1 dBTP. Prueba de integración en Task 5.
4. Enlace privado, sin internet o que no es video → error claro en español y no se crea un proyecto a medias. Prueba en Task 13.
5. App instalada sin el repositorio (sin `.venv` en la carpeta de la app, ruta con espacios) → el asistente prepara Python en una carpeta escribible y exportar funciona. Prueba en Task 15.

---

### Task 1: Prueba técnica (catálogo, mezcla, empaquetado, música CC0)

**Files:**
- Create: `docs/superpowers/notas/2026-11-06-prueba-plan-3.md`, `spike/plan3/` (temporal)

**Interfaces:**
- Produces: decisiones D1–D5 en la nota, que las tareas 5, 6, 8, 9 y 15 leen.

- [ ] **Step 1: D1 catálogo.** Con permiso de la persona, `hyperframes add` de `caption-highlight`, `caption-pill-karaoke`, `caption-kinetic-slam`, `caption-neon-accent`, `organic-light-leak-overlay`, `flash-through-white`, `grain-overlay`, `instagram-follow`, `tiktok-follow`, `lt-soft-pill` en `spike/plan3/`. Renderizar cada uno con `--gpu` y sin GPU. Anotar: cuáles renderizan sin WebGL/WebGPU (los shaders que fallen en headless se descartan), licencia de cada bloque, y qué CSS/GSAP hay que portar.
- [ ] **Step 2: D2 mezcla.** Componer 10 s con `<video muted>` + `<audio>` de voz (del fixture) + `<audio>` de música con carril de volumen (data-automation, como en el plan 2). Medir con `ffmpeg -af ebur128` que la música baja bajo la voz. Si el carril no funciona en render, decidir mezcla con FFmpeg después del render (`sidechaincompress`).
- [ ] **Step 3: D3 normalización.** Sobre el MP4, `loudnorm=I=-14:TP=-1:LRA=11` en dos pasadas + `alimiter`; medir resultado (−14 ±1 LUFS, ≤ −1 dBTP) y tiempo extra.
- [ ] **Step 4: D4 empaquetado.** `electron-builder --dir` con `asarUnpack` de `node_modules/hyperframes/**` y dependencias; desde el `.exe` empaquetado, renderizar el fixture. Anotar qué hay que desempaquetar y dónde queda Chrome headless de HyperFrames.
- [ ] **Step 5: D5 música CC0.** Verificar una fuente CC0 (FreePD u otra) con licencia escrita; listar 30–40 pistas candidatas por ánimo (`reflexivo`, `esperanza`, `victoria`, `adoracion`, `tension`) con tamaño total. Preguntar a la persona antes de descargar.
- [ ] **Step 6: Commit** `docs: prueba técnica del plan 3`.

### Task 2: Tipos nuevos y compatibilidad con proyectos viejos

**Files:**
- Modify: `src/shared/tipos.ts`
- Create: `src/shared/clip.ts`
- Test: `tests/shared/clip.test.ts`

**Interfaces:**
- Produces:
  - `type Animo = "reflexivo" | "esperanza" | "victoria" | "adoracion" | "tension"`
  - `type EstiloSub = "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon"`
  - `ClipSpec.subtitulos.estilo: EstiloSub`
  - `ClipSpec.musica: { modo: "auto" | "pista" | "pad" | "ninguna"; pista: string | null; animo: Animo; tonalidad: string; volumen: number }`
  - `ClipSpec.cortes: { pausas: boolean; muletillas: boolean }`
  - `ClipSpec.efectos: { transicion: "destello" | "luz" | "ninguna"; grano: boolean; rotulo: boolean }`
  - `ClipSpec.redes: Redes` con `Redes = { instagram: { texto: string; hashtags: string[] }; tiktok: { texto: string; hashtags: string[] }; facebook: { texto: string }; youtube: { titulo: string; texto: string } }`
  - `Marca` += `logoEscala: number` (0,5–1,5), `redes: { instagram?: string; tiktok?: string; facebook?: string; youtube?: string }`, `predicador?: string`, `estilo: EstiloIglesia`
  - `EstiloIglesia = { subtitulos: { estilo: EstiloSub; tamano: "s" | "m" | "l" }; musica: { modo: ClipSpec["musica"]["modo"]; volumen: number }; cortes: ClipSpec["cortes"]; efectos: ClipSpec["efectos"]; cierre: boolean; formatos: Formato[] }`
  - `Proyecto.predicador?: string`
  - `completarClip(c: unknown, estilo: EstiloIglesia): ClipSpec` y `ESTILO_POR_DEFECTO: EstiloIglesia` en `src/shared/clip.ts`

- [ ] **Step 1: Write the failing tests**
  - `completarClip` con un clip del plan 2 (`musica: {pista: "auto", volumen: 0.12}`, sin `cortes/efectos/redes`) → `musica.modo === "auto"`, `musica.animo === "esperanza"` si categoría Esperanza, `"reflexivo"` si no hay mapeo; `cortes`/`efectos` del estilo; `redes.instagram.texto === descripcion`, `redes.instagram.hashtags === hashtags`, `redes.youtube.titulo === titulo` recortado a 100.
  - Un clip ya completo pasa sin cambios (`toEqual`).
  - `ESTILO_POR_DEFECTO` = subtítulos pop/m, música auto 0,12, cortes `{pausas: true, muletillas: true}`, efectos `{transicion: "destello", grano: false, rotulo: true}`, cierre true, formatos `["9:16","4:5"]`.
- [ ] **Step 2: Run** `npx vitest run --project unit tests/shared/clip.test.ts` — Expected: FAIL (módulo no existe).
- [ ] **Step 3: Implement** tipos y `completarClip`. Mapeo categoría→ánimo: Esperanza→esperanza, Exhortación/Llamado→victoria, Reflexión/Enseñanza→reflexivo, Testimonio→adoracion.
- [ ] **Step 4: Usar `completarClip`** al leer `clips.json` (`leerJson` de clips en `ipc.ts` y en el ejecutor de exportar) y en `leerMarca` completar `estilo`, `logoEscala: 1`, `redes: {}`.
- [ ] **Step 5: Run** suite unit + `tsc` de node y web — Expected: PASS.
- [ ] **Step 6: Commit** `feat: tipos del plan 3 y compatibilidad con proyectos anteriores`.

### Task 3: Pantalla Marca y estilo de la iglesia

**Files:**
- Create: `src/renderer/pantallas/Marca.tsx`
- Modify: `src/main/proyectos/almacen.ts`, `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/api.ts`, `src/renderer/App.tsx`, `src/renderer/componentes/Riel.tsx`, `src/renderer/componentes/Inspector.tsx`, `src/renderer/pantallas/Editor.tsx`, `src/shared/reel/composicion.ts`
- Test: `tests/main/proyectos/marca.test.ts`, `tests/renderer/Marca.test.tsx`, `tests/shared/reel/composicion.test.ts`

**Interfaces:**
- Consumes: `Marca`, `EstiloIglesia` (Task 2).
- Produces: `ApiReels.guardarMarca(m: Marca): Promise<void>`, `ApiReels.elegirLogo(): Promise<string | null>` (copia el PNG/JPG/SVG a `<datos>/marca/logo.<ext>` y devuelve la ruta), `ApiReels.aplicarEstilo(proyectoId: string): Promise<void>` (aplica `marca.estilo` a todos los clips no exportados), `estiloDesdeClip(c: ClipSpec): EstiloIglesia` en `src/shared/clip.ts`.

- [ ] **Step 1: Failing tests**
  - `guardarMarca` + `leerMarca` ida y vuelta; `elegirLogo` con un archivo de 2 MB copia a `marca/logo.png` y una ruta con `#` funciona.
  - Marca.test: cambiar nombre, color e invitación y la vista previa (cierre renderizado con `construirComposicion` en modo vista sobre cuadro de ejemplo) muestra el nombre; el deslizador "Tamaño del logo" va de 50 % a 150 %.
  - composicion.test: `logoEscala` 1,5 → el `img` del cierre tiene `width` 1,5× el base y `object-fit: contain` (el logo nunca se recorta).
  - Inspector: botón "Guardar como estilo de la iglesia" llama `guardarMarca` con `estiloDesdeClip(clip)`; "Aplicar a todos los clips" llama `aplicarEstilo`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.** Riel: "Marca" deja de ser "pronto". Campos: nombre, color (input color + hex), invitación, logo (botón + vista), tamaño del logo, @ de redes, predicador por defecto. Guardado con debounce 400 ms y guardado inmediato antes de salir. `normalizarClips` recibe `estilo` y lo aplica a los clips nuevos.
- [ ] **Step 4: Run** unit + E2E arranque — Expected: PASS.
- [ ] **Step 5: Commit** `feat: pantalla Marca y estilo de la iglesia`.

### Task 4: Voz limpia por proyecto

**Files:**
- Create: `src/main/procesos/audio.ts`
- Modify: `src/main/pipeline/tareas.ts`, `src/shared/tipos.ts` (`TipoTarea` += `"audio"`, `NombrePaso` += `"audio"`), `src/renderer/componentes/PanelProceso.tsx`
- Test: `tests/main/procesos/audio.test.ts`, `tests/main/pipeline/tareas.test.ts`

**Interfaces:**
- Produces: `argsVozLimpia(video: string, inicio: number, fin: number, salida: string): string[]` (FFmpeg: `-ss`, `-t`, `-vn`, filtro `highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15`, AAC 192k, 48 kHz); archivo `<proyecto>/voz.m4a` cuyo segundo 0 = `rango.inicio`.
- Cadena de la cola: transcribir → audio → caras → analizar. Proyectos viejos sin `voz.m4a`: el exportador lo crea antes del render.

- [ ] **Step 1: Failing tests:** argumentos exactos con ruta con espacios y `#`; cadena de tareas incluye `audio` y PanelProceso muestra "Limpiando el audio"; proyecto viejo sin `pasos.audio` se lee como `pendiente`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit + integración `transcribir` — PASS.
- [ ] **Step 5: Commit** `feat: voz limpia por proyecto`.

### Task 5: Mezcla y normalización final

**Files:**
- Create: `src/shared/reel/musica.ts`, `src/main/exportar/mezcla.ts`
- Modify: `src/shared/reel/composicion.ts`, `src/main/exportar/tarea.ts`, `src/main/exportar/preparar.ts`
- Test: `tests/shared/reel/musica.test.ts`, `tests/integracion/exportar.test.ts`

**Interfaces:**
- Consumes: D2/D3 (Task 1), `voz.m4a` (Task 4), `Parte` con varios tramos (Task 7 la amplía; esta tarea usa la lista de partes tal cual).
- Produces: `curvaMusica(voz: { desde: number; hasta: number }[], duracion: number, volumen: number): { t: number; v: number }[]` (tiempos del reel, reglas de Global Constraints); `argsNormalizar(entrada: string, salida: string, medido?: MedicionLoudnorm): string[]`; `normalizarAudio(mp4: string): Promise<void>` (dos pasadas loudnorm + alimiter, reemplaza el MP4 de forma atómica).
- En la composición: videos con `muted`/`data-has-audio="false"`, un `<audio>` de voz por parte (`src="voz.m4a"`, `data-media-start = inicioVideo − rango.inicio`) y un `<audio>` de música con la curva (según D2).

- [ ] **Step 1: Failing tests**
  - `curvaMusica([{desde:0.5,hasta:6},{desde:8,hasta:20}], 22, 0.12)` → v=0,5 en t∈[0,1,8]; v=0,12 en t=4; v=0,24 en t=7 (pausa de 2 s); v=0 en t=22; nunca > 0,5.
  - `argsNormalizar` con medición → `loudnorm=I=-14:TP=-1:LRA=11:measured_I=…:linear=true` y `alimiter=limit=0.891`.
  - Integración (fixture TTS + pista CC0 corta de `tests/fixtures/musica-prueba.mp3` generada con FFmpeg `sine`): MP4 con `ebur128` integrado en [−15, −13] y pico verdadero ≤ −1,0 dBTP.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit + integración — PASS.
- [ ] **Step 5: Commit** `feat: mezcla de música bajo la voz y audio normalizado`.

### Task 6: Banco de música y pads

**Files:**
- Create: `resources/musica/` (pistas CC0 + `catalogo.json`), `python/pads.py`, `python/test_pads.py`, `src/shared/reel/pistas.ts`, `src/main/musica/banco.ts`, `src/renderer/pantallas/Musica.tsx`
- Modify: `src/main/exportar/tarea.ts`, `src/renderer/componentes/Inspector.tsx` (pestaña Estilo: modo, ánimo, pista, tonalidad, volumen), `Riel.tsx`, `App.tsx`, `NOTICE.md`
- Test: `tests/shared/reel/pistas.test.ts`, `tests/main/musica/banco.test.ts`, `python/test_pads.py`, `tests/renderer/Musica.test.tsx`

**Interfaces:**
- Consumes: `Animo`, `ClipSpec.musica` (Task 2), D5 (Task 1).
- Produces:
  - `Pista = { id: string; archivo: string; titulo: string; autor: string; licencia: string; animo: Animo; duracion: number; propia: boolean }`
  - `elegirPista(animo: Animo, pistas: Pista[], recientes: string[], duracionReel: number): Pista | null` — misma ánimo, no usada en los últimos 3 reels del proyecto, duración ≥ reel o la más larga; `null` si no hay ninguna de ese ánimo.
  - `listarPistas(): Promise<Pista[]>` (banco + `<datos>/musica/` con `musica.json` para ánimo de las propias); `ApiReels.agregarPista()`, `ApiReels.cambiarAnimo(id, animo)`.
  - `python pads.py --duracion S --tonalidad Re --animo esperanza --semilla N --salida x.wav`: WAV 48 kHz estéreo, pico ≤ −6 dBFS, acordes I–V–vi–IV (esperanza/victoria) o i–VI–III–VII (reflexivo/tension) con envolventes de 4 s y reverberación simple; misma semilla → mismo archivo.
  - Exportar: modo auto → `elegirPista` o, si `null`, pad; modo pad → pad; la pista o el pad se copia a la carpeta temporal como `musica.<ext>`.

- [ ] **Step 1: Failing tests**
  - `elegirPista` con 3 pistas "esperanza" y recientes = [a, b] → c; sin pistas del ánimo → null.
  - `test_pads`: duración 30 s ±0,05; pico ≤ −6 dBFS; dos corridas con semilla 7 → bytes iguales; tonalidad "La" cambia la frecuencia fundamental (FFT del primer acorde ≈ 220/440 Hz).
  - Musica.test: lista el banco con ánimo, reproducir/pausar, "Agregar mis pistas", cambiar ánimo de una propia; las del banco muestran "CC0 · autor".
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (con permiso, descargar las pistas de D5; registrar autor/licencia en `catalogo.json` y `NOTICE.md`). **Step 4: Run** unit + pytest — PASS.
- [ ] **Step 5: Commit** `feat: banco de música CC0 y pads de adoración`.

### Task 7: Cortes de pausas y muletillas

**Files:**
- Create: `src/shared/reel/cortes-voz.ts`
- Modify: `src/shared/reel/tiempo.ts`, `subtitulos.ts`, `versiculo.ts`, `composicion.ts`, `src/renderer/componentes/LineaTiempo.tsx`, `Inspector.tsx`
- Test: `tests/shared/reel/cortes-voz.test.ts`, `tests/shared/reel/motor.test.ts`, `tests/shared/reel/composicion.test.ts`

**Interfaces:**
- Produces: `tramosDelClip(c: ClipSpec, palabras: Palabra[]): { inicio: number; fin: number }[]`; `partesDelReel(c, palabras?)` devuelve una parte `"clip"` por tramo (en orden, contiguas en el reel); `videoAReel(partes: Parte[], t: number): number | null` (`null` si `t` cae en un tramo quitado).
- Subtítulos, versículo, apertura y palabras clave usan `videoAReel`. Un versículo cuyo `en` cae en un tramo quitado se mueve al inicio del tramo siguiente.

- [ ] **Step 1: Failing tests**
  - Palabras con pausa de 1,5 s entre 10,0 y 11,5 → dos tramos; el hueco en el reel queda en 0,25 s.
  - "eh" suelto (entre pausas > 0,15 s) se quita; "eh" dentro de "eh… Dios" no se quita si está pegado a la palabra siguiente (< 0,05 s); "este" nunca se quita.
  - `cortes: {pausas: false, muletillas: false}` → un solo tramo igual a [inicio, fin] (compatibilidad).
  - Review Focus 2: versículo con `en` dentro de una pausa quitada → la ventana empieza en el siguiente tramo y no hay subtítulos durante la tarjeta.
  - composición: un `<video>`/`<audio>` de voz por tramo con su `data-media-start`; la duración total baja exactamente lo quitado.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit — PASS.
- [ ] **Step 5: Commit** `feat: cortes de pausas y muletillas`.

### Task 8: Estilos de subtítulos del catálogo

**Files:**
- Create: `src/shared/reel/estilos-sub.ts`
- Modify: `src/shared/reel/estilos.css.ts`, `composicion.ts`, `Inspector.tsx`, `NOTICE.md`
- Test: `tests/shared/reel/composicion.test.ts`, `tests/renderer/Inspector.test.tsx`

**Interfaces:**
- Consumes: D1 (Task 1), `EstiloSub` (Task 2).
- Produces: `ESTILOS_SUB: Record<EstiloSub, { nombre: string; css: string; animarPalabra(id: string, t: number, clave: boolean): string[] }>`; los 4 nuevos portados de `caption-highlight` (resaltado), `caption-pill-karaoke` (karaoke), `caption-kinetic-slam` (impacto), `caption-neon-accent` (neón).

- [ ] **Step 1: Failing tests:** cada estilo produce HTML que pasa `hyperframes lint` (sin left/top animados); palabra clave usa el color de marca en los 7 estilos; la regla del versículo oculta subtítulos en los 7; el Inspector muestra 7 opciones con nombre en español y una mini vista.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit + `hyperframes check` de una composición por estilo — PASS.
- [ ] **Step 5: Commit** `feat: más estilos de subtítulos`.

### Task 9: Efectos (transición, grano, rótulo, cierre con redes)

**Files:**
- Create: `src/shared/reel/efectos.ts`
- Modify: `composicion.ts`, `estilos.css.ts`, `Inspector.tsx`, `src/renderer/pantallas/NuevaPredica.tsx` (campo opcional "Predicador"), `NOTICE.md`
- Test: `tests/shared/reel/composicion.test.ts`, `tests/renderer/NuevaPredica.test.tsx`

**Interfaces:**
- Consumes: D1, `ClipSpec.efectos`, `Marca.redes`, `Proyecto.predicador ?? Marca.predicador`.
- Produces: transición "destello" (actual, flash blanco 0,3 s) o "luz" (light leak portado, 0,8 s) al pasar de la apertura al clip; `grano` = overlay de grano a 6 % de opacidad durante todo el video; `rotulo` = nombre del predicador 3 s desde el inicio del clip (después de la apertura), en la franja libre opuesta al gancho, nunca con la tarjeta del versículo; cierre: con `marca.redes.instagram` o `.tiktok` muestra la tarjeta "Síguenos" animada con el @.

- [ ] **Step 1: Failing tests:** cada efecto apagado → no aparece su elemento; rótulo sin nombre → no aparece; rótulo y versículo en el mismo segundo → el rótulo termina antes de la tarjeta; cierre con @ → texto "@iglesia" visible; NuevaPredica guarda `predicador`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit — PASS.
- [ ] **Step 5: Commit** `feat: efectos, rótulo del predicador y cierre con redes`.

### Task 10: Ánimo y textos por red en el análisis de Claude

**Files:**
- Modify: `src/main/claude/prompt.ts`, `esquema.ts`, `normalizar.ts`, `tests/fixtures/claude/respuesta-ok.json`, `tests/fixtures/claude/falso-claude.mjs`
- Create: `src/shared/redes.ts`
- Test: `tests/main/claude/*.test.ts`, `tests/shared/redes.test.ts`

**Interfaces:**
- Produces: respuesta de Claude por clip += `animo` (enum de `Animo`, sin tildes tolerado como en categoría) y `redes: {instagram:{texto,hashtags}, tiktok:{texto,hashtags}, facebook:{texto}, youtube:{titulo,texto}}`; `LIMITES_REDES` con los valores de Global Constraints; `recortarRedes(r: Redes): Redes` (corta en el último espacio antes del límite y deja ≤ 30 hashtags en Instagram).
- El prompt pide textos cercanos, en español de la iglesia, sin clichés de IA (lista corta de patrones a evitar tomada de la skill humanizer: "no es X, es Y", tríadas forzadas, "sumérgete", emojis en cada línea) y siempre fieles a lo que dijo el predicador.

- [ ] **Step 1: Failing tests:** esquema acepta `animo: "Adoración"` → `adoracion`; respuesta sin `redes` sigue siendo válida (se completa con `completarClip`); `recortarRedes` con título de 140 caracteres → ≤ 100 y termina en palabra completa; 40 hashtags → 30; el prompt incluye los límites y la lista de ánimos.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit — PASS.
- [ ] **Step 5: Commit** `feat: ánimo de la música y textos por red desde el análisis`.

### Task 11: Pestaña Publicar por red

**Files:**
- Modify: `src/renderer/componentes/Inspector.tsx`, `src/renderer/estilos/pantallas.css`
- Test: `tests/renderer/Inspector.test.tsx`

**Interfaces:**
- Consumes: `ClipSpec.redes`, `LIMITES_REDES` (Task 10).
- Produces: pestaña Publicar con selector Instagram / TikTok / Facebook / YouTube; campos editables; contador `n / límite` que se pone en rojo al pasarse; botón "Copiar" (texto + hashtags) con aviso "Copiado".

- [ ] **Step 1: Failing tests:** cambiar de red muestra su texto; escribir más del límite pone el contador en estado de error y `aria-invalid`; "Copiar" escribe en el portapapeles el texto + hashtags separados por línea en blanco.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: textos por red en la pestaña Publicar`.

### Task 12: Portada y textos junto al MP4

**Files:**
- Modify: `src/main/exportar/tarea.ts`, `src/main/proyectos/almacen.ts` (`listarExportados` agrupa MP4 + portada + textos), `src/renderer/pantallas/Exportados.tsx`
- Test: `tests/main/exportar/tarea.test.ts`, `tests/integracion/exportar.test.ts`

**Interfaces:**
- Produces: tras el render, `argsPortada(mp4: string, t: number, salida: string)` (FFmpeg `-ss t -frames:v 1 -q:v 2`) con `t` = mitad del gancho visible (min(1,2, duración del gancho/2)); `<slug>-<formato>-portada.jpg`; `<slug>-textos.txt` (una sección por red, se escribe una vez por clip).

- [ ] **Step 1: Failing tests:** después de exportar hay `…-9x16.mp4`, `…-9x16-portada.jpg` (1080×1920) y `…-textos.txt` con los 4 encabezados; Exportados muestra la portada como miniatura.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (también arreglar el guion doble de `nombreSalida`: recortar a 60 y luego quitar guiones de los bordes). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: portada y textos al exportar`.

### Task 13: Nueva prédica desde enlace (yt-dlp)

**Files:**
- Create: `src/main/descargas/ytdlp.ts`, `tests/fixtures/falso-ytdlp.mjs`, `python/requirements.txt` (si no existe; += `yt-dlp`)
- Modify: `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/api.ts`, `src/renderer/pantallas/NuevaPredica.tsx`
- Test: `tests/main/descargas/ytdlp.test.ts`, `tests/renderer/NuevaPredica.test.tsx`

**Interfaces:**
- Produces: `descargarVideo(url: string, carpeta: string, op: { senal: AbortSignal; alProgreso(pct: number, texto: string): void }): Promise<string>` (ejecuta `python -m yt_dlp -f "bv*[height<=1080]+ba/b[height<=1080]" --merge-output-format mp4 --newline -o "<carpeta>/%(title).80s.%(ext)s" url`, lee `[download]  45.3%`, devuelve la ruta final); errores traducidos: privado/requiere sesión, no es un video, sin internet, cancelado. `ApiReels.descargarVideo(url)`, evento de progreso, `ApiReels.cancelarDescarga()`. Destino: `<datos>/videos/`.
- NuevaPredica: dos pestañas "Archivo" / "Enlace"; con enlace, barra de progreso y "Cancelar"; al terminar sigue igual que si se hubiera elegido el archivo.

- [ ] **Step 1: Failing tests** (con `falso-ytdlp.mjs` modos ok, privado, no-video, sin-red, lento): progreso 0→100 y ruta devuelta; cada error en español; cancelar borra el archivo parcial y no crea proyecto (Review Focus 4); enlace que no es URL → botón deshabilitado con ayuda.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit — PASS.
- [ ] **Step 5: Commit** `feat: nueva prédica desde un enlace`.

### Task 14: Asistente de primer uso

**Files:**
- Create: `src/renderer/pantallas/PrimerUso.tsx`, `src/main/sistema/preparar.ts`
- Modify: `src/main/sistema/verificar.ts`, `src/main/rutas.ts`, `src/main/ipc.ts`, `src/renderer/App.tsx`, `src/renderer/pantallas/Ajustes.tsx`
- Test: `tests/main/sistema/preparar.test.ts`, `tests/renderer/PrimerUso.test.tsx`

**Interfaces:**
- Produces: `rutaEntorno()` = `<LOCALAPPDATA>/Reels Iglesia/venv` (o `REELS_PYTHON`); `prepararEntorno(op: {alProgreso, alLinea, senal})` (busca `py -3.12`/`python` ≥ 3.10, crea el venv, `pip install -r python/requirements.txt` con progreso por paquete); `instalarFfmpeg()` (`winget install --id Gyan.FFmpeg -e --accept-source-agreements`, solo tras el clic de la persona); la sesión de Claude reutiliza `abrirInicioSesionClaude`. La verificación de Claude ya no gasta una consulta: usa `claude auth status` si existe; si no, solo al pulsar "Comprobar".
- PrimerUso aparece al abrir si falta algo; cada fila: estado, explicación de una línea, botón de acción, "Comprobar de nuevo". Se puede saltar.

- [ ] **Step 1: Failing tests:** sin Python → fila con enlace a python.org y botón "Instalar con winget"; venv ok + FFmpeg falta → solo FFmpeg pendiente; `prepararEntorno` con un ejecutor falso emite progreso por paquete y traduce "No space left" / sin internet; todo ok → la app abre en Prédicas.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit + E2E arranque — PASS.
- [ ] **Step 5: Commit** `feat: asistente de primer uso`.

### Task 15: Instalador de Windows

**Files:**
- Create: `electron-builder.yml`, `build/icon.ico`, `tests/e2e/instalado.spec.ts`
- Modify: `src/main/rutas.ts` (`raizApp` = `process.resourcesPath` empaquetado), `package.json` (script `dist`), `.gitignore`
- Test: `tests/e2e/instalado.spec.ts`

**Interfaces:**
- Consumes: D4 (Task 1), `rutaEntorno` (Task 14).
- Produces: `npm run dist` → `dist/Reels Iglesia Setup <versión>.exe` (NSIS, por usuario, sin admin); `extraResources`: `python/`, `modelos/`, `resources/musica/`; `asarUnpack` según D4.

- [ ] **Step 1: Failing test:** `instalado.spec.ts` lanza `dist/win-unpacked/Reels Iglesia.exe` con datos en una carpeta temporal con espacios y `REELS_PYTHON` del venv de desarrollo; crea proyecto con el fixture, procesa con Claude simulado y exporta un 9:16 (Review Focus 5).
- [ ] **Step 2: Run** — FAIL (no hay build). **Step 3: Implement.** **Step 4: Run** `npm run dist` + el E2E — PASS; instalar el `.exe` a mano una vez y anotar el resultado en el ledger.
- [ ] **Step 5: Commit** `feat: instalador de Windows`.

### Task 16: Pendientes menores que afectan a la persona

**Files:** según cada punto.

- [ ] Cada punto con su prueba que falla primero:
  1. Video movido: botón "Ubicar el video" que acepta el mismo archivo en otra ruta (mismo tamaño) y actualiza el proyecto.
  2. Versículo cuyo momento quedó fuera del corte: se apaga solo y el inspector avisa "Quedó fuera del corte".
  3. Errores del render en español: mapear FFmpeg ausente, Node, disco lleno, Chrome que no abre; el detalle técnico va en "Ver detalle".
  4. `dimensionesVideo` fallida no queda en caché.
  5. Composiciones de vista previa: se libera la anterior al registrar una nueva.
  6. Estado "exportado" no se pisa con una edición pendiente.
  7. Caras: con `proc.returncode != 0` a mitad, repetir en CPU; stderr del intento en CPU al registro.
  8. Campo de tiempo rechaza "1:75:00".
  9. `*.tsbuildinfo` fuera de Git; ventana con `sandbox: true` si el preload lo permite.
- [ ] Run suite completa — PASS. Commit `fix: pendientes de los planes 1 y 2`.

### Task 17: Prueba final con el culto real

- [ ] Con la persona: crear la prédica desde el enlace de Facebook del culto (o el archivo), procesar con Claude real, revisar 3 clips (música, cortes, estilos, textos), exportar 9:16 y 4:5. Medir LUFS de los MP4 y anotar en el ledger. Ajustar solo constantes (no lógica) si algo suena o se ve mal; cada ajuste con su prueba.
