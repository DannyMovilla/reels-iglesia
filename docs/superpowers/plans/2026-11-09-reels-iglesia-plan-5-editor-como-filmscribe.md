# Reels Iglesia — Plan 5: el editor como FilmScribe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que editar una prédica se sienta como FilmScribe: pedir cambios a Claude en palabras, cortes más finos (intensidad, repeticiones, tramos a mano, fundidos), lista de clips con buscador/filtros/favoritos, clips a mano, transcripción corregible, capítulos para YouTube, niveles de voz y efectos de sonido.

**Architecture:** La lógica nueva va en funciones puras en `src/shared/` (cortes, filtros, correcciones, cambios de Claude, capítulos) con pruebas unitarias; `src/main/` agrega dos consultas a `claude -p` (cambios de un clip, capítulos) que reutilizan `preguntar`/`extraerJson`/`partirComando`, y archivos nuevos por proyecto (`correcciones.json`, `capitulos.json`, `voz-<nivel>.m4a`). La composición HyperFrames suma fundidos (carril de volumen en cada tramo de voz) y efectos de sonido (`<audio>` con WAV incluidos en `resources/efectos/`).

**Tech Stack:** el mismo del plan 4 (Electron 35, React 18, TypeScript, HyperFrames 0.9.17, GSAP, FFmpeg, `claude -p`, Vitest, Playwright, pytest, numpy).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (sección 16; reglas del reel en la 7 y Claude en la 8).

## Global Constraints

- Solo la suscripción de Claude (`claude -p`); sin claves de pago. Una consulta por pedido; un reintento automático solo si el JSON no valida.
- RVR1960 siempre; Claude nunca agrega versículos al pedir cambios; versículo sin confirmar → no se exporta.
- Toda la interfaz y todos los errores en español sencillo.
- Audio final −14 LUFS ±1, pico ≤ −1 dBTP (incluidos los efectos).
- Pausas: Suave >1,0 s → 0,36 s; Normal >0,7 s → 0,25 s; Fuerte >0,45 s → 0,16 s. Fundido de 10 ms a cada lado de cada corte de voz.
- Repeticiones: mismas 3 palabras (normalizadas) dentro de 8 s; primera toma ≤ 12 palabras; nada se quita sin que la persona lo pida.
- Duración de clips: Cortos 15–30 s, Normales 30–60 s (por defecto), Largos 60–90 s. Instrucción ≤ 300 caracteres.
- Capítulos estilo YouTube: primero en 0:00, al menos 3, cada uno ≥ 10 s.
- Clips y marcas de versiones anteriores se siguen abriendo: todo campo nuevo es opcional y `completarClip` pone el valor por defecto.
- No copiar código del repositorio threads (sin licencia). Los efectos de sonido son propios (generados por `python/efectos.py`).
- No reconstruir `out/` con la app abierta.

## Review Focus

1. Un clip de antes del plan 5 (sin `intensidad`, `lista`, `quitados`, `voz`, `favorito`) → abre y exporta igual que hoy (Normal, lista por defecto, voz Limpia). Prueba en Task 1 y Task 8.
2. Claude devuelve un pedido de cambios con tiempos fuera de la prédica, al revés o que dejan el clip en menos de 5 s → se ajustan (límites de palabra, mínimo 5 s) o se ignoran con aviso, nunca un clip roto. Prueba en Task 6.
3. Una corrección de palabra con mayúscula o signo ("dios," → "Dios,") se aplica conservando la puntuación de cada aparición y no toca palabras parecidas ("diosa"). Prueba en Task 3.
4. Volver a analizar con otra instrucción no borra favoritos, clips a mano, editados ni exportados. Prueba en Task 4.
5. Un tramo quitado a mano que cruza el inicio o el fin del clip, o que se superpone con un corte de pausa → los tramos resultantes no se superponen, no quedan de menos de 0,05 s y subtítulos/versículos siguen sincronizados. Prueba en Task 1.

---

### Task 1: Cortes más finos (intensidad, lista, quitados, repeticiones, fundidos)

**Files:** Modify `src/shared/tipos.ts`, `src/shared/clip.ts`, `src/shared/reel/cortes-voz.ts`, `src/shared/reel/composicion.ts`; Test `tests/shared/reel/cortes-voz.test.ts`, `tests/shared/reel/composicion.test.ts`, `tests/shared/clip.test.ts`.

**Interfaces — Produces:**
- `type Intensidad = "suave" | "normal" | "fuerte"`; `EstiloIglesia.cortes = { pausas: boolean; muletillas: boolean; intensidad?: Intensidad; lista?: string[] }`; `ClipSpec.cortes = EstiloIglesia["cortes"] & { quitados?: { inicio: number; fin: number }[] }`.
- `MULETILLAS_POR_DEFECTO = ["eh", "ehh", "em", "emm", "mm", "mmm"]`; `PARAMETROS_INTENSIDAD: Record<Intensidad, { pausaMaxima: number; margen: number }>` = suave {1.0, 0.18}, normal {0.7, 0.125}, fuerte {0.45, 0.08}.
- `tramosDelClip(c, palabras)` usa la intensidad, la lista y resta `quitados` (recortados al clip, unidos si se tocan).
- `detectarRepeticiones(palabras: Palabra[], inicio: number, fin: number): { inicio: number; fin: number; texto: string }[]` (inicio = primera palabra de la primera toma, fin = inicio de la toma que se queda).
- `FUNDIDO = 0.01`; en la composición, cuando el clip tiene más de un tramo, cada `<audio class="voz">` lleva `data-automation` con volumen 0→1 en 10 ms al empezar y 1→0 en 10 ms al terminar.

- [ ] Pruebas (rojo primero):
  - `tramosDelClip` con intensidad "suave"/"fuerte" corta solo pausas sobre 1,0/0,45 s y deja 0,36/0,16 s; sin `intensidad` = Normal (Review Focus 1).
  - `lista: ["este"]` quita "este" suelto y deja "eh" (la lista reemplaza a la de por defecto).
  - `quitados` que cruza el inicio, el fin y una pausa ya cortada → tramos ordenados, sin superponerse, ninguno < 0,05 s (Review Focus 5).
  - `detectarRepeticiones`: "y Dios te / y Dios te ama" dentro de 8 s → una sugerencia con el tramo de la primera toma; la misma frase a 12 s → nada; primera toma de 15 palabras → nada.
  - Composición con cortes: cada audio de voz tiene un carril con los puntos `[0,0] [0.01,1] [dur-0.01,1] [dur,0]`; sin cortes, sin carril.
  - `completarClip` de un clip viejo deja `intensidad` y `lista` sin tocar (los lee como Normal y la lista por defecto) y no agrega `quitados`.
- [ ] Implementar. Commit `feat: cortes por intensidad, repeticiones, tramos quitados y fundidos`.

### Task 2: Cortes en el inspector y lista de muletillas en Marca

**Files:** Modify `src/renderer/componentes/Inspector.tsx`, `src/renderer/pantallas/Marca.tsx`, `src/renderer/estilos/pantallas.css`; Test `tests/renderer/Inspector.test.tsx`, `tests/renderer/Marca.test.tsx`.

**Interfaces — Consumes:** Task 1 (`Intensidad`, `detectarRepeticiones`, `MULETILLAS_POR_DEFECTO`). El inspector recibe `palabras: Palabra[]` (nueva prop, desde `Editor.tsx`).

- [ ] Pruebas:
  - Grupo "Ritmo": selector Suave / Normal / Fuerte (deshabilitado si "Pausas" está apagado).
  - "Frases repetidas": lista las sugerencias del clip con su texto y botón "Quitar"; al tocarlo, el tramo se agrega a `cortes.quitados` y el botón pasa a "Volver a poner"; sin sugerencias, el texto "No encontré frases repetidas en este clip.".
  - "Tramos quitados a mano: N" con botón "Volver a poner todos" (vacía `quitados`).
  - Marca → "Muletillas que se quitan": chips editables (agregar con Enter, quitar con ×, "Restablecer"); se guardan en `estilo.cortes.lista` y "Aplicar a todos los clips" las copia.
- [ ] Implementar. Commit `feat: cortes sugeridos e intensidad en el inspector`.

### Task 3: Transcripción completa y correcciones

**Files:** Create `src/shared/correcciones.ts`, `src/renderer/componentes/Transcripcion.tsx`; Modify `src/main/proyectos/almacen.ts` (`ArchivoProyecto += "correcciones.json"`, `leerTranscripcion(id)` corregida), `src/main/ipc.ts`, `src/preload/index.ts`, `src/shared/api.ts`, `src/main/exportar/tarea.ts`, `src/main/claude/analizar.ts`, `src/renderer/pantallas/Editor.tsx`; Test `tests/shared/correcciones.test.ts`, `tests/main/proyectos/almacen.test.ts`, `tests/renderer/Transcripcion.test.tsx`.

**Interfaces — Produces:**
- `Correccion = { de: string; a: string; en?: number }` (`en` = segundo de inicio de la palabra para corregir solo esa; sin `en` = todas las apariciones).
- `aplicarCorrecciones(t: Transcripcion, cs: Correccion[]): Transcripcion` (compara la palabra sin tildes, mayúsculas ni signos; conserva los signos de cada aparición; reescribe `w[2]` y el texto `t` de cada segmento).
- `leerTranscripcion(id): Promise<Transcripcion | null>` en el almacén; todo lo que hoy hace `leerJson<Transcripcion>(…, "transcripcion.json")` pasa a usarla (IPC, exportar, analizar).
- API: `leerCorrecciones(id): Promise<Correccion[]>`, `corregir(id, c: Correccion): Promise<Transcripcion>`, `quitarCorreccion(id, indice): Promise<Transcripcion>`.
- `<Transcripcion transcripcion clip? tiempoActual alBuscar(t) alCorregir(c) alSeleccionar(rango|null) />`; el centro del editor tiene pestañas "Vista previa" / "Transcripción" / "Capítulos" (la tercera se llena en Task 7).

- [ ] Pruebas:
  - "dios," → "Dios," en todas: cambia "dios," y "Dios." (conservando "."), no cambia "diosa" (Review Focus 3); con `en` cambia solo esa palabra.
  - Volver a transcribir (nuevo `transcripcion.json`) → `leerTranscripcion` sigue aplicando las correcciones.
  - Exportar y analizar leen el texto corregido (prueba con almacén temporal y la corrección en el subtítulo de la composición).
  - Vista: buscador resalta y cuenta coincidencias ("3 de 12", flechas); clic en una palabra llama `alBuscar` con su tiempo; doble clic abre "Corregir" con "Solo aquí" / "En toda la prédica"; las palabras del clip elegido van marcadas; arrastrar o Mayús+clic selecciona un rango.
- [ ] Implementar. Commit `feat: transcripción completa con buscador y correcciones`.

### Task 4: Lista de clips con filtros, favoritos y clips a mano

**Files:** Create `src/shared/filtro-clips.ts`; Modify `src/shared/tipos.ts` (`ClipSpec.favorito?`, `oculto?`, `origen?: "claude" | "manual"`), `src/shared/clip.ts` (`clipManual`), `src/renderer/componentes/ListaClips.tsx`, `src/renderer/pantallas/Editor.tsx`, `src/main/proyectos/almacen.ts` (`agregarClip`), `src/main/claude/analizar.ts` (conservar clips), IPC/preload/api; Test `tests/shared/filtro-clips.test.ts`, `tests/shared/clip.test.ts`, `tests/main/claude/claude.test.ts`, `tests/renderer/ListaClips.test.tsx`.

**Interfaces — Produces:**
- `FiltroClips = { texto: string; categorias: Categoria[]; duracion: "todas" | "corta" | "media" | "larga"; puntajeMinimo: number; conVersiculo: boolean; favoritos: boolean; ocultos: boolean; orden: "impacto" | "video" | "cortos" | "largos" }`; `FILTRO_INICIAL`; `filtrarClips(clips, f, textoDe?: (c) => string): ClipSpec[]` (duración: corta < 30 s, media 30–60, larga > 60; `ocultos: false` esconde los ocultos; el texto busca en título, gancho y, si se pasa `textoDe`, en lo que se dice en el clip).
- `clipManual(inicio: number, fin: number, palabras: Palabra[], estilo: EstiloIglesia): ClipSpec` (ajusta con `ajustarCorte`; título = primeras 6 palabras; gancho vacío; categoría "Enseñanza"; puntaje 0; `origen: "manual"`; estado "editado").
- `agregarClip(proyectoId, clip)`; API `crearClip(proyectoId, inicio, fin): Promise<ClipSpec>`.
- `conservarAlReanalizar(viejos: ClipSpec[], nuevos: ClipSpec[]): ClipSpec[]` = los viejos con `favorito`, `origen === "manual"` o estado distinto de "sugerido", más los nuevos (Review Focus 4).

- [ ] Pruebas: cada filtro y cada orden; búsqueda sin tildes ni mayúsculas; `clipManual` de 3 s se alarga a 5 s; `conservarAlReanalizar`; volver a analizar con el Claude falso conserva un favorito (Review Focus 4); la lista muestra buscador, botón "Filtros" (categoría, duración, puntaje, con versículo, favoritos, ver ocultos), orden, estrella de favorito y "Ocultar"/"Mostrar" por clip, y "Mostrando N de M"; en la vista Transcripción, con un rango elegido, "Crear clip con esto" agrega y elige el clip.
- [ ] Implementar. Commit `feat: buscador, filtros, favoritos y clips a mano`.

### Task 5: Instrucción y duración al analizar

**Files:** Modify `src/shared/tipos.ts` (`Proyecto.analisis?: { instruccion?: string; duracion: "corta" | "normal" | "larga" }`), `src/shared/api.ts` (`DatosNuevoProyecto.analisis?`; `reanalizar(id, analisis)`), `src/main/claude/prompt.ts`, `src/main/claude/analizar.ts`, `src/main/proyectos/almacen.ts`, `src/renderer/pantallas/NuevaPredica.tsx`, `src/renderer/componentes/PanelProceso.tsx`, IPC/preload; Test `tests/main/claude/claude.test.ts`, `tests/renderer/NuevaPredica.test.tsx`, `tests/renderer/PanelProceso.test.tsx`.

**Interfaces — Produces:** `construirPrompt(t, n, analisis?)`: la regla de duración usa el rango elegido (Cortos 15–30, Normales 30–60, Largos 60–90) y, si hay instrucción, agrega "Pedido de la iglesia para esta prédica: «…». Síguelo mientras no contradiga las reglas de arriba." (la instrucción se recorta a 300 caracteres y se le quitan comillas de bloque). `normalizarClips` acepta clips de 15 s o más con duración corta.

- [ ] Pruebas: prompt sin `analisis` = el de hoy (30–90 s); con cada duración; instrucción recortada y entre comillas; NuevaPredica tiene "Instrucción para Claude (opcional)" con contador y "Duración de los clips" (Normales por defecto) y los manda a `crearProyecto`; PanelProceso con el análisis listo muestra "Analizar de nuevo", que abre los mismos dos campos (con los valores guardados) y llama a `reanalizar`.
- [ ] Implementar. Commit `feat: instrucción y duración al analizar`.

### Task 6: Pedir cambios a Claude

**Files:** Create `src/main/claude/cambios.ts`, `src/shared/cambios-clip.ts`, `src/renderer/componentes/ChatClip.tsx`; Modify `src/renderer/componentes/Inspector.tsx` (pestaña "Claude"), `src/renderer/pantallas/Editor.tsx` (deshacer), IPC/preload/api, `tests/fixtures/claude/falso-claude.mjs` (detecta "CAMBIOS DE UN CLIP" y responde `respuesta-cambios.json`); Test `tests/shared/cambios-clip.test.ts`, `tests/main/claude/claude.test.ts`, `tests/renderer/ChatClip.test.tsx`.

**Interfaces — Produces:**
- Esquema zod `CambiosClaude = { resumen: string; titulo?; gancho?; inicio?: string; fin?: string; apertura_frase?; palabras_clave?: string[]; redes?; animo?; estilo_subtitulos?; quitar?: { desde: string; hasta: string }[] }` (cada campo con `.catch(undefined)`; `resumen` por defecto "Listo.").
- `promptCambios(clip, transcripcion, pedido, historial: { pedido: string; resumen: string }[]): string` (marca "CAMBIOS DE UN CLIP"; transcripción del clip ±60 s con tiempos H:MM:SS.s; el clip actual en JSON sin `redes` largas; reglas: duración 5–90 s, no inventar versículos, no cambiar el sentido de lo que dijo el predicador; últimos 3 intercambios).
- `aplicarCambios(clip, cambios, palabras, rango: { inicio: number; fin: number }): { clip: ClipSpec; avisos: string[] }` (tiempos con `aSegundos` + `ajustarCorte` dentro del rango; inicio ≥ fin o fuera del rango → se ignoran con aviso "No pude usar el nuevo corte: …"; `moverVersiculos`; `quitar` → `cortes.quitados`; apertura con `ubicarFrase`).
- `pedirCambios(proyectoId, clip, pedido, historial, opciones): Promise<CambiosClaude>` (tiempo máximo 3 min, mismos errores de sesión/tiempo que el análisis).
- `<ChatClip clip alAplicar(nuevo, resumen) />`: área de texto, atajos ("Menos de 60 segundos", "Un gancho más fuerte", "Quita lo que no se entiende solo", "Textos más cortos"), historial de esta sesión y "Deshacer" (vuelve al clip de antes del último cambio).

- [ ] Pruebas: `aplicarCambios` con tiempos válidos, al revés, fuera de la prédica y de 2 s (Review Focus 2); `versiculos` nunca cambia salvo por `moverVersiculos`; JSON inválido → un reintento y luego "Claude no devolvió cambios válidos. Prueba con otras palabras."; el prompt lleva el pedido, el historial y la marca; ChatClip muestra "Claude está pensando…", el resumen y "Deshacer" funciona.
- [ ] Implementar. Commit `feat: pedir cambios a Claude en palabras`.

### Task 7: Capítulos y resumen para YouTube

**Files:** Create `src/main/claude/capitulos.ts`, `src/shared/capitulos.ts`, `src/renderer/componentes/Capitulos.tsx`; Modify almacén (`ArchivoProyecto += "capitulos.json"`), IPC/preload/api, `src/main/exportar/tarea.ts` (escribe `capitulos.txt` si existe), `falso-claude.mjs` ("CAPÍTULOS DE UNA PRÉDICA"); Test `tests/shared/capitulos.test.ts`, `tests/main/claude/claude.test.ts`, `tests/renderer/Capitulos.test.tsx`.

**Interfaces — Produces:**
- `Capitulos = { resumen: string; capitulos: { t: number; titulo: string }[] }` (t en segundos de la prédica).
- `limpiarCapitulos(cs, duracion): Capitulo[]` (ordena, primero en 0, quita los que quedan a menos de 10 s del anterior; si quedan menos de 3, error "Claude no encontró al menos 3 partes en la prédica.").
- `textoYoutube(c: Capitulos, opciones: { completo: boolean; inicioRango: number }): string` (`M:SS` o `H:MM:SS` según la duración; completo con `inicioRango > 0` → "0:00 Inicio del culto" y los demás sumando `inicioRango`; el resumen arriba, una línea en blanco y los capítulos).
- `crearCapitulos(proyectoId, opciones): Promise<Capitulos>` (una consulta con la transcripción corregida).
- `<Capitulos proyecto />`: "Crear capítulos" (o "Crear de nuevo"), interruptor "Tiempos del video completo", texto editable, botón Copiar.

- [ ] Pruebas: `limpiarCapitulos` (orden, 0:00, < 10 s, < 3); `textoYoutube` con prédica que empieza en 1:44:44 y con "solo la prédica"; respuesta con JSON en un bloque ```json; exportar deja `capitulos.txt` junto a los reels.
- [ ] Implementar. Commit `feat: capítulos y resumen para YouTube`.

### Task 8: Niveles de voz

**Files:** Modify `src/shared/tipos.ts` (`type NivelVoz = "ligera" | "limpia" | "podcast"`; `ClipSpec.voz?`, `EstiloIglesia.voz?`), `src/shared/clip.ts`, `src/main/procesos/audio.ts`, `src/main/exportar/tarea.ts`, `src/main/pipeline/tareas.ts`, `src/main/ipc.ts` (`urlVoz(proyectoId, nivel)` asegura el archivo), `src/renderer/componentes/Inspector.tsx`, `src/renderer/componentes/VistaPrevia.tsx`; Test `tests/main/procesos/audio.test.ts`, `tests/main/exportar/tarea.test.ts`, `tests/renderer/Inspector.test.tsx`.

**Interfaces — Produces:**
- `FILTRO_VOZ: Record<NivelVoz, string>`: ligera `highpass=f=80,dynaudnorm=f=200:g=15`; limpia = el de hoy; podcast = limpia + `,equalizer=f=3500:t=q:w=1.2:g=3,deesser=i=0.4,acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2`.
- `argsVozLimpia(video, inicio, fin, salida, nivel: NivelVoz = "limpia")`; `archivoVoz(nivel) = nivel === "limpia" ? "voz.m4a" : \`voz-${nivel}.m4a\``.
- Exportar usa `archivoVoz(clip.voz ?? "limpia")` y lo crea con `crearVozSegura` si falta.

- [ ] Pruebas: cada nivel arma su filtro; un clip sin `voz` exporta con `voz.m4a` (Review Focus 1); con "podcast" crea `voz-podcast.m4a` una sola vez; el inspector (grupo "Voz": Ligera / Limpia / Podcast) muestra "Preparando la voz…" mientras la vista previa espera el archivo; integración: FFmpeg real acepta el filtro "podcast" (2 s de tono + ruido).
- [ ] Implementar. Commit `feat: niveles de voz`.

### Task 9: Efectos de sonido

**Files:** Create `python/efectos.py`, `python/test_efectos.py`, `resources/efectos/{whoosh,whoosh-suave,pop}.wav`; Modify `src/shared/tipos.ts` (`EstiloIglesia.efectos.sonidos?: boolean`; `Creacion.sonidos?: boolean`), `src/shared/clip.ts`, `src/shared/reel/composicion.ts`, `src/shared/reel/versiculo-reel.ts`, `src/main/exportar/preparar.ts`, `src/main/vista.ts`, `src/main/ia/exportar.ts`, `electron-builder.yml` (extraResources), `NOTICE.md`, Inspector/EditorVersiculo (interruptor "Efectos de sonido"); Test `tests/shared/reel/composicion.test.ts`, `tests/shared/reel/versiculo-reel.test.ts`, `tests/main/exportar/tarea.test.ts`.

**Interfaces — Produces:**
- `python/efectos.py --salida <carpeta>`: con numpy, 48 kHz mono 16 bits; whoosh 0,6 s (ruido filtrado con barrido de 300 Hz a 4 kHz y envolvente que sube y baja), whoosh-suave (el mismo, −6 dB y 0,8 s), pop 0,12 s (seno 900→500 Hz con caída rápida). Pico ≤ −3 dBFS. Los WAV generados se guardan en el repositorio.
- Composición: con `efectos.sonidos !== false`, `<audio class="efecto">` con `src="recursos/efectos/whoosh.wav"` 0,25 s antes del paso apertura→clip y clip→cierre (volumen 0,5) y `pop.wav` cuando entra el gancho (volumen 0,4). Versículo: `whoosh-suave.wav` en cada cambio de tarjeta y al pasar a la reflexión.
- `archivosRecursos()` incluye `recursos/efectos/*.wav` (desde `resources/efectos` en desarrollo y `process.resourcesPath` instalado); la vista previa los sirve igual.

- [ ] Pruebas: pytest (duración, pico ≤ −3 dBFS, sin silencio total, mismo resultado con la misma semilla); composición con y sin `sonidos`, con apertura y sin cierre (solo los efectos que corresponden); un clip viejo los trae encendidos según el estilo; sin URLs de internet.
- [ ] Generar los WAV, escucharlos en un render de prueba. Commit `feat: efectos de sonido`.

### Task 10: Prueba completa

- [ ] Suite unitaria + integración + pytest.
- [ ] Render real (integración): un clip con cortes Fuerte + un tramo quitado + voz Podcast + efectos; medir con FFmpeg −14 ±1 LUFS y ≤ −1 dBTP, y que en cada corte no haya un salto brusco (pico de diferencia entre muestras vecinas en ±5 ms del corte por debajo del de la voz alrededor).
- [ ] E2E con el Claude falso: corregir una palabra en la transcripción → crear un clip a mano → pedir "menos de 60 segundos" → Deshacer → marcar favorito y filtrar → crear capítulos y copiarlos → exportar 9:16 (aparecen el MP4, la portada, los textos y `capitulos.txt`).
- [ ] Revisión final por un revisor nuevo (modelo más capaz); una pasada de arreglos con prueba en rojo primero; subir a GitHub solo con permiso.
