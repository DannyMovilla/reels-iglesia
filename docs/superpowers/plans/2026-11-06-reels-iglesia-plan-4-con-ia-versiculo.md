# Reels Iglesia — Plan 4: «Con IA», reel de un versículo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde la sección «Con IA», crear un reel corto con un versículo RVR1960 (escrito por Claude y confirmado por la persona), una frase de reflexión, fondo de la marca o propio, música y cierre, y exportarlo como los demás reels.

**Architecture:** Un tipo nuevo `Creacion` guardado en `<datos>/ia/<id>/creacion.json`. Una consulta a `claude -p` llena la creación. `construirReelVersiculo` (función pura en `src/shared/reel/versiculo-reel.ts`) arma la composición HyperFrames reutilizando el cierre, la música y los estilos del plan 3. Exportar es una tarea nueva de la cola (`exportar-ia`) que reutiliza preparar carpeta, render, normalización, portada y textos.

**Tech Stack:** el mismo del plan 3 (Electron 35, React, HyperFrames 0.9.17, GSAP, FFmpeg, `claude -p`).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (sección 15).

## Global Constraints

- RVR1960 siempre; la app no incluye el texto bíblico; versículo sin confirmar → no se exporta.
- Una sola consulta a Claude por creación (más reintentos manuales); sin claves de pago.
- Español sencillo en toda la interfaz.
- Audio final −14 LUFS ±1, pico ≤ −1 dBTP; misma curva de música (sin voz: la música queda en su volumen de "pausa").
- Fondos animados: bloques del catálogo de HyperFrames (Apache 2.0) con la librería `shaders` (MIT), copiados a `resources/escenas/` y acreditados en `NOTICE.md`; un solo shader por reel (ver `docs/superpowers/notas/2026-11-06-prueba-fondos-animados.md`).
- Tiempo de lectura del versículo: 0,5 s + 0,3 s por palabra, entre 4 y 12 s; reflexión 0,5 s + 0,28 s por palabra, entre 3 y 7 s.

## Review Focus

1. Versículo largo (Salmo 23 entero, 100+ palabras) → se reparte en tarjetas sucesivas legibles (máx. 28 palabras por tarjeta), nunca texto diminuto ni cortado. Prueba en Task 3.
2. Foto vertical u horizontal de cualquier tamaño, o video más corto que el reel → llena el cuadro sin deformarse; el video se repite. Prueba en Task 3.
3. Claude devuelve una referencia inexistente o vacía → error claro en español y la creación queda editable a mano. Prueba en Task 2.
4. Volver a abrir una creación después de cerrar la app → todo igual, incluido el estado de confirmación. Prueba en Task 1.
5. Exportar dos veces la misma creación → archivos sin pisarse ("-2"). Prueba en Task 4.

---

### Task 1: Tipo `Creacion` y almacén

**Files:** Create `src/main/ia/almacen.ts`; Modify `src/shared/tipos.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/main/ipc.ts`; Test `tests/main/ia/almacen.test.ts`.

**Interfaces — Produces:**
- `Creacion = { id; creado; entrada: { tipo: "versiculo" | "tema"; texto }; versiculo: { ref; texto; confirmado }; gancho; reflexion; palabrasClave: string[]; musica: ClipSpec["musica"]; subtitulos: { estilo: EstiloSub }; fondo: { tipo: "escena" | "degradado" | "imagen" | "video"; escena?: Escena; archivo?: string }; redes: Redes; formatos: Formato[]; estado: "borrador" | "exportado" }`
- `crearCreacion(entrada): Promise<Creacion>`, `leerCreacion(id)`, `guardarCreacion(c)`, `listarCreaciones()`, `copiarFondo(id, origen): Promise<string>` (a `<datos>/ia/<id>/fondo.<ext>`), `borrarCreacion(id)`.

- [ ] Pruebas: crear → leer igual tras "reiniciar" (Review Focus 4); `copiarFondo` con ruta con `#` y espacios; lista ordenada por fecha; un JSON roto no rompe la lista.
- [ ] Implementar. Commit `feat: creaciones de «Con IA»`.

### Task 2: Claude escribe la creación

**Files:** Create `src/main/ia/claude.ts`; Test `tests/main/ia/claude.test.ts`, `tests/fixtures/claude/falso-claude.mjs` (modo `versiculo`).

**Interfaces — Produces:** `promptVersiculo(entrada): string`; esquema zod `RespuestaVersiculo` (ref, texto, gancho, reflexion, palabras_clave, animo, redes); `escribirCreacion(id, ctx): Promise<void>` (una consulta, un reintento si el JSON no valida, reutiliza `preguntar`/`extraerJson` de `src/main/claude/analizar.ts`).

- [ ] Pruebas: respuesta válida llena la creación con `confirmado: false`; referencia vacía → "Claude no encontró ese versículo. Escríbelo a mano o prueba con otra referencia." y la creación queda editable (Review Focus 3); el prompt pide RVR1960 palabra por palabra, una o dos frases de reflexión fieles al texto y sin clichés de IA.
- [ ] Implementar. Commit `feat: Claude escribe el reel de versículo`.

### Task 2b: Biblioteca de escenas animadas

**Files:** Create `src/shared/reel/escenas.ts`, `resources/escenas/` (godrays, sun-burst, aurora, fractal-noise, mesh-gradient, lens-flare + `lib/shaders.iife.js`); Modify `NOTICE.md`, `electron-builder.yml` (extraResources), `src/main/vista.ts` (servir `recursos/escenas/*`), `src/main/exportar/preparar.ts`; Test `tests/shared/reel/escenas.test.ts`.

**Interfaces — Produces:** `type Escena = "luz" | "amanecer" | "aurora" | "nubes" | "atardecer" | "destello"`; `ESCENAS: Record<Escena, { nombre: string; bloque: string; shader: string; props(color: string): Record<string, unknown> }>` (props con el color de la marca y un fondo oscuro); `htmlEscena(escena, marcaColor, ancho, alto): string` (canvas `data-shader` + `data-shader-props`, 1 por documento, con velo oscuro y viñeta para que el texto se lea).

- [ ] Pruebas: cada escena genera un canvas con su shader y props válidas (color de la marca, tamaño del formato); solo un canvas por composición; sin URLs de internet; `NOTICE.md` menciona HyperFrames y shaders (MIT).
- [ ] Claude elige la escena en la misma consulta (`escena` en `RespuestaVersiculo`, con un tema por escena en el prompt); por defecto «luz».
- [ ] Implementar. Commit `feat: escenas animadas para el reel de versículo`.

### Task 3: Composición del reel de versículo

**Files:** Create `src/shared/reel/versiculo-reel.ts`; Modify `src/shared/reel/estilos.css.ts`; Test `tests/shared/reel/versiculo-reel.test.ts`.

**Interfaces — Produces:** `tarjetasVersiculo(texto): string[]` (≤ 28 palabras, cortando en signos de puntuación cuando se puede); `tiemposReelVersiculo(c): { gancho; tarjetas: {desde, hasta}[]; referencia; reflexion; cierre; duracion }`; `construirReelVersiculo(e: { creacion; marca; formato; recursos; modo; fondoSrc?: string; musica?: { src } }): { html; duracion; alto }`.

- [ ] Pruebas: tiempos según Global Constraints; Salmo 23 → varias tarjetas ≤ 28 palabras (Review Focus 1); fondo escena (el canvas de la escena) y degradado sin archivo; texto con animación cinética (palabras que suben y se iluminan, adaptadas de los componentes del catálogo); imagen con `object-fit: cover` + oscurecido; video `muted` con `data-media-start` y repetido hasta cubrir el reel (Review Focus 2); palabras clave en color de marca; "RVR1960" visible; cierre con @; música con carril de volumen; sin `left/top` animados; sin URLs de internet.
- [ ] Implementar. Commit `feat: composición del reel de versículo`.

### Task 4: Exportar desde la cola

**Files:** Create `src/main/ia/exportar.ts`; Modify `src/shared/tipos.ts` (`TipoTarea += "exportar-ia"`, `Tarea.creacionId`), `src/main/index.ts`, `src/main/ipc.ts`, `src/main/proyectos/almacen.ts` (`listarExportados` incluye creaciones); Test `tests/main/ia/exportar.test.ts`.

- [ ] Pruebas: bloquea sin versículo confirmado; copia fondo y música a la carpeta del reel; normaliza; portada + textos; segundo export → "-2" (Review Focus 5); marca la creación "exportado".
- [ ] Implementar. Commit `feat: exportar el reel de versículo`.

### Task 5: Pantalla «Con IA»

**Files:** Create `src/renderer/pantallas/ConIA.tsx`, `src/renderer/componentes/EditorVersiculo.tsx`; Modify `Riel.tsx` (Con IA deja "Pronto"), `App.tsx`, `pantallas.css`; Test `tests/renderer/ConIA.test.tsx`.

- [ ] Pruebas: lista de creaciones y "Nuevo reel de versículo" (versículo o tema) → llama a Claude con progreso; editor: gancho, texto RVR1960 + "Confirmar texto", reflexión, fondo (Degradado / Elegir foto o video), música (modo, ánimo, volumen), formatos, pestaña Publicar (reutiliza la del inspector), vista previa en vivo y "Exportar"; sin confirmar, "Exportar" deshabilitado con el motivo.
- [ ] Implementar. Commit `feat: sección Con IA`.

### Task 6: Prueba completa

- [ ] Suite unitaria + integración (render real de un reel de versículo con escena «luz», con fondo degradado y con foto, con y sin `--gpu`; −14 ±1 LUFS) + E2E (crear con Claude simulado, confirmar, exportar). Revisión final por un revisor nuevo; una pasada de arreglos; subir a GitHub con permiso.
