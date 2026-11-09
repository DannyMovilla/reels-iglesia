# Reels Iglesia — Plan 6: entregas de la semana, imagen y detalles

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar los detalles del plan 5, sacarle a cada prédica sus entregas de la semana (SRT, PDF, MP3, subtítulos traducidos) y mejorar la imagen de los reels (zonas seguras exactas, color, fuentes, pinturas clásicas y copiar el estilo de un reel).

**Architecture:** Funciones puras nuevas en `src/shared/` (srt, zonas seguras, looks de color, fuentes, estilo de referencia) con pruebas unitarias; `src/main/entregas/` arma los archivos (SRT, PDF con `webContents.printToPDF`, MP3 con FFmpeg, traducción con `claude -p` por partes). La pestaña «Entregas» del editor junta todo. El color va como filtro SVG `feColorMatrix` sobre el video de la composición; las fuentes como `@font-face` locales; las pinturas como un fondo nuevo de «Con IA».

**Tech Stack:** el mismo del plan 5 (Electron 35, React 18, TypeScript, HyperFrames 0.9.17, GSAP, FFmpeg, `claude -p`, Vitest, Playwright, pytest).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md` (sección 17; reglas del reel en la 7, Claude en la 8, plan 5 en la 16).

## Global Constraints

- Solo la suscripción de Claude (`claude -p`); sin claves de pago. Un reintento automático solo si el JSON no valida.
- RVR1960 en español; en las traducciones, el versículo va en una versión reconocida de ese idioma y nunca se inventa.
- Toda la interfaz y todos los errores en español sencillo.
- SRT: ≤ 2 líneas de ≤ 42 caracteres, 1–7 s por bloque, ≤ 17 caracteres por segundo, sin superponerse.
- MP3: −16 LUFS ±1, pico ≤ −1 dBTP, 128 kbps, etiquetas ID3 (título, artista = predicador o iglesia, álbum = iglesia) y carátula si hay logo.
- Reels: −14 LUFS ±1, pico ≤ −1 dBTP (sin cambios).
- Descargas (fuentes OFL de @fontsource y pinturas de dominio público de Wikimedia Commons) solo con el permiso de la persona; se incluyen en la app y se acreditan en `NOTICE.md`. Sin internet al exportar.
- Todo campo nuevo es opcional; clips, creaciones y marcas viejas se abren igual.
- No reconstruir `out/` con la app abierta.

## Review Focus

1. Una prédica de más de 1 hora → SRT válido (numeración, `HH:MM:SS,mmm`, sin bloques superpuestos ni vacíos) y traducción por partes sin perder ni desordenar bloques. Pruebas en Task 2 y Task 5.
2. Claude devuelve una traducción con menos o más bloques que los enviados, o con un bloque vacío → se reintenta esa parte; si sigue mal, error claro y no se guarda un SRT incompleto. Prueba en Task 5.
3. Un reel viejo (sin `color`, `fuentes`, `zonas`) se ve y exporta igual que antes. Pruebas en Task 6–8.
4. La fuente propia de la iglesia con nombre raro (espacios, tildes, `#`) o que no es una fuente → se copia con un nombre seguro o se rechaza con un error claro. Prueba en Task 8.
5. Un video de referencia sin audio, vertical u horizontal, o muy corto (< 3 s) → el análisis de estilo no se rompe y avisa lo que no pudo medir. Prueba en Task 10.

---

### Task 1: Detalles del plan 5

**Files:** Modify `src/main/ipc.ts`, `src/main/claude/cambios.ts`, `src/renderer/pantallas/Editor.tsx`, `src/renderer/componentes/Inspector.tsx`, `src/renderer/componentes/Transcripcion.tsx`, `src/shared/correcciones.ts`, `src/shared/reel/composicion.ts`, `src/main/proyectos/almacen.ts`; Test `tests/main/claude/cambios.test.ts`, `tests/shared/correcciones.test.ts`, `tests/renderer/Editor.test.tsx`, `tests/renderer/Inspector.test.tsx`, `tests/renderer/Transcripcion.test.tsx`.

- [ ] Pruebas (rojo primero) y arreglo, una por detalle:
  - `proyectos:crearClip` rechaza id no simple, `inicio`/`fin` no finitos o fuera de la prédica con "No pude crear el clip con ese tramo.".
  - `aplicarCambios` con un corte de más de 90 s lo deja en 90 s (ajustado a palabra) con el aviso "Lo dejé en 90 segundos, el máximo para un reel.".
  - Editor: si `crearClip`, `corregir` o `reanalizar` fallan, se ve el mensaje en español (role alert), sin el prefijo de Electron.
  - Editor: el aviso de voz desaparece al elegir un clip con voz Limpia.
  - «Exportar N clips» y «N sugeridos» no cuentan los ocultos.
  - Transcripción: clic en una palabra fuera del clip muestra «Esta parte no está en el clip» con el botón «Crear clip desde aquí» (tramo de 30 s desde esa palabra).
  - Corrección: si `a` trae signos al final ("Dios."), reemplaza los signos de esa palabra; si no, los conserva (como hoy).
  - Inspector: cada tramo quitado se lista con su minuto y su propio «Volver a poner».
  - Comentarios JSDoc de `construirComposicion` y `guardarClip` en su lugar (sin prueba).
- [ ] Commit `fix: detalles del plan 5`.

### Task 2: Subtítulos SRT de la prédica y pestaña «Entregas»

**Files:** Create `src/shared/srt.ts`, `src/main/entregas/entregas.ts`, `src/renderer/componentes/Entregas.tsx`; Modify `Editor.tsx` (pestaña «Entregas» en el centro), IPC/preload/api; Test `tests/shared/srt.test.ts`, `tests/main/entregas/entregas.test.ts`, `tests/renderer/Entregas.test.tsx`.

**Interfaces — Produces:**
- `BloqueSrt = { desde: number; hasta: number; texto: string }` (texto con `\n` entre líneas).
- `bloquesSrt(palabras: Palabra[], opciones?: { maxLinea = 42; maxLineas = 2; maxCps = 17; minDur = 1; maxDur = 7 }): BloqueSrt[]` (corta en `.?!` y luego en `,;:` cuando puede; nunca supera los límites; sin superponerse).
- `textoSrt(bloques, desplazar = 0): string` (numeración desde 1, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, línea en blanco entre bloques, termina en `\n`).
- `leerSrt(texto): BloqueSrt[]` (para las pruebas y la traducción).
- `guardarSrt(proyectoId, opciones: { completo: boolean }): Promise<string>` → `exportados/<slug-proyecto>.srt`, devuelve el nombre.
- `<Entregas proyecto />`: sección «Subtítulos (SRT)» con el interruptor «Tiempos del video completo», botón «Crear SRT» y «Abrir carpeta».

- [ ] Pruebas: límites de líneas/caracteres/cps/duración en una transcripción de 1 h 10 min generada (Review Focus 1); corte en la puntuación; `textoSrt` exacto en un caso pequeño y `leerSrt(textoSrt(b))` igual a `b`; desplazar con el inicio de la prédica; usa la transcripción corregida.
- [ ] Commit `feat: subtítulos SRT de la prédica`.

### Task 3: Transcripción en PDF

**Files:** Create `src/shared/pdf-transcripcion.ts` (HTML imprimible), `src/main/entregas/pdf.ts`; Modify `Entregas.tsx`, IPC; Test `tests/shared/pdf-transcripcion.test.ts`, `tests/integracion/pdf.test.ts`.

**Interfaces — Produces:** `htmlTranscripcion(e: { proyecto; marca; transcripcion; capitulos?: Capitulos | null }): string` (A4, Figtree local en base64 o la fuente del sistema, cabecera con iglesia/título/fecha/predicador, resumen y capítulos si hay, párrafos de ~6 oraciones con `[mm:ss]`, texto escapado); `guardarPdf(proyectoId): Promise<string>` con una `BrowserWindow` oculta y `printToPDF({ pageSize: "A4", printBackground: true })` → `exportados/<slug>-transcripcion.pdf`.

- [ ] Pruebas: el HTML tiene todo lo pedido y escapa `<`, `&`; integración: el PDF existe, empieza con `%PDF` y tiene más de una página para una prédica larga (se cuenta `/Type /Page`).
- [ ] Commit `feat: transcripción en PDF`.

### Task 4: MP3 de la prédica

**Files:** Create `src/main/entregas/mp3.ts`; Modify `Entregas.tsx` (nivel de voz para el MP3), IPC; Test `tests/main/entregas/mp3.test.ts`, `tests/integracion/mp3.test.ts`.

**Interfaces — Produces:** `argsMp3(e: { voz: string; salida: string; medicion: MedicionLoudnorm; titulo; artista; album; anio; caratula?: string }): string[]` (loudnorm lineal a `I=-16:TP=-1.5:LRA=11` + `alimiter`, `-c:a libmp3lame -b:a 128k`, `-id3v2_version 3`, `-metadata title/artist/album/date`, carátula como `attached_pic` si hay logo PNG/JPG); `guardarMp3(proyectoId, nivel: NivelVoz): Promise<string>` (asegura la voz con `asegurarVoz`, mide con la primera pasada de loudnorm y escribe `exportados/<slug>.mp3`).

- [ ] Pruebas: los argumentos exactos con y sin carátula y con título con comillas; integración: −16 ±1 LUFS, pico ≤ −1 dBTP, `ffprobe` muestra las etiquetas y 128 kbps.
- [ ] Commit `feat: MP3 de la prédica`.

### Task 5: Subtítulos traducidos

**Files:** Create `src/main/entregas/traducir.ts`; Modify `Entregas.tsx`, IPC, `tests/fixtures/claude/falso-claude.mjs` (detecta "TRADUCCIÓN DE SUBTÍTULOS"; modos `traduccion-corta` = devuelve un bloque menos); Test `tests/main/entregas/traducir.test.ts`, `tests/renderer/Entregas.test.tsx`.

**Interfaces — Produces:**
- `IDIOMAS = { en: "inglés", pt: "portugués", fr: "francés", it: "italiano", de: "alemán", ko: "coreano", zh: "chino" }`.
- `promptTraduccion(bloques: BloqueSrt[], idioma, indice0: number): string` (marca "TRADUCCIÓN DE SUBTÍTULOS"; pide un arreglo JSON de `{ "n": número, "texto": "…" }` con el mismo número de bloques; mismas reglas de líneas; versículos en una versión reconocida, sin inventar).
- `traducirSrt(proyectoId, idiomas: string[], opciones): Promise<string[]>` (partes de 120 bloques; cada parte valida cantidad, números y textos no vacíos; un reintento por parte; si falla, error "No pude traducir al {idioma}. Prueba de nuevo." y no se escribe el archivo de ese idioma); escribe `exportados/<slug>.<idioma>.srt` con los tiempos del SRT español.
- UI: casillas de idiomas, «Traducir», progreso «Traduciendo al inglés (parte 2 de 4)…».

- [ ] Pruebas: 300 bloques → 3 partes, en orden y con los tiempos originales (Review Focus 1); una parte con un bloque menos → reintento y luego error sin archivo (Review Focus 2); dos idiomas → dos archivos.
- [ ] Commit `feat: subtítulos traducidos`.

### Task 6: Zonas seguras exactas

**Files:** Create `src/shared/reel/zonas.ts`; Modify `composicion.ts`, `versiculo-reel.ts`, `VistaPrevia.tsx`, `EditorVersiculo.tsx`, `pantallas.css`; Test `tests/shared/reel/zonas.test.ts`, `tests/shared/reel/composicion.test.ts`, `tests/renderer/VistaPrevia.test.tsx`.

**Interfaces — Produces:**
- `type Red = "tiktok" | "instagram" | "youtube" | "facebook"`; `ZONAS: Record<Red, Record<Formato, { arriba; abajo; izquierda; derecha }>>` en píxeles de 1080 de ancho (9:16 de 1920 de alto). Valores 9:16: TikTok 160/480/60/140, Instagram 220/420/60/120, YouTube 140/400/60/120, Facebook 200/440/60/120; 4:5 y 1:1: 60/60/60/60 en todas.
- `zonaComun(formato): { arriba; abajo; izquierda; derecha }` (el máximo de cada lado).
- `dentroDeZona(top: number, alto: number, formato): number` (devuelve un `top` que deja el elemento dentro de la zona común).
- Composición: gancho, subtítulos, versículo y rótulo pasan por `dentroDeZona` (la `altura` del clip se respeta mientras quepa).
- Vista previa: selector «Zona segura: TikTok / Instagram / YouTube / Facebook / Ninguna» que dibuja esa zona (reemplaza la de hoy).

- [ ] Pruebas: un clip con `altura: 0.95` queda con los subtítulos dentro de la zona común; un clip con la altura de siempre (0.74) no se mueve (Review Focus 3); el dibujo de cada red usa sus valores.
- [ ] Commit `feat: zonas seguras exactas por red`.

### Task 7: Corrección de color

**Files:** Create `src/shared/reel/color.ts`, `src/main/procesos/color.ts`; Modify `tipos.ts` (`ClipSpec.color?: { look: Look; intensidad: number; balance?: [number, number, number] }`, `EstiloIglesia.color?`), `clip.ts`, `composicion.ts`, `Inspector.tsx` (grupo «Color»), IPC; Test `tests/shared/reel/color.test.ts`, `tests/main/procesos/color.test.ts`, `tests/integracion/color.test.ts`.

**Interfaces — Produces:**
- `type Look = "natural" | "calido" | "frio" | "cine" | "suave" | "bn"`; `MATRIZ_LOOK: Record<Look, number[]>` (matriz 4×5 de `feColorMatrix`, "natural" = identidad).
- `matrizColor(look, intensidad 0–1, balance?): number[]` (mezcla lineal con la identidad y multiplica por las ganancias de balance).
- `htmlFiltroColor(matriz): string` (un `<svg>` con `<filter id="color">`) y en el video `filter: url(#color)` junto con el B/N de la apertura.
- `argsMedirColor(video, inicio, fin)` + `balanceDesde(salida: string): [r, g, b]` (FFmpeg `signalstats` sobre 20 cuadros; ganancias para que el promedio quede gris, limitadas a 0,7–1,4).
- Inspector: look, intensidad y botón «Corregir tono amarillo» (mide, guarda `balance`, se puede quitar).

- [ ] Pruebas: "natural" con intensidad 1 = identidad (Review Focus 3: sin `color`, la composición no tiene filtro); intensidad 0,5 = mitad de camino; balance de un video amarillo (prueba de integración con un video de prueba teñido por FFmpeg) baja el rojo/verde o sube el azul y su promedio queda más cerca del gris.
- [ ] Commit `feat: corrección de color`.

### Task 8: Más fuentes y la fuente de la iglesia

Requiere el permiso de la persona para descargar los paquetes de fuentes.

**Files:** Modify `package.json` (paquetes `@fontsource/*` OFL), `src/shared/reel/fuentes.ts` (nuevo), `estilos.css.ts`, `estilos-sub.ts`, `composicion.ts`, `versiculo-reel.ts`, `src/main/exportar/preparar.ts`, `src/main/vista.ts`, `src/main/proyectos/almacen.ts` (`copiarFuente`), `Marca.tsx`, `Inspector.tsx`, `tipos.ts` (`Marca.fuente?: string`, `EstiloIglesia.fuentes?: { titulos: string; subtitulos: string }`, `ClipSpec.fuentes?`), `NOTICE.md`; Test `tests/shared/reel/fuentes.test.ts`, `tests/main/proyectos/marca.test.ts`, `tests/shared/reel/composicion.test.ts`.

**Interfaces — Produces:**
- `FUENTES: Record<string, { nombre: string; paquete: string; pesos: number[]; uso: "titulos" | "texto" | "ambos" }>` con Montserrat y Figtree (de hoy) más Anton, Bebas Neue, Poppins, Oswald, Playfair Display, Lora, Bricolage Grotesque y Caveat (latin, solo los pesos que se usan).
- `cssFuentes(usadas: string[], base: string, propia?: string): string` (solo las fuentes que usa el reel).
- `copiarFuente(origen): Promise<string>` → `<datos>/marca/fuente.<ext>`; acepta `.ttf .otf .woff .woff2` y revisa la firma del archivo (`\0\1\0\0`, `OTTO`, `wOFF`, `wOF2`); si no, "Ese archivo no es una fuente." (Review Focus 4).
- Marca: «Fuente de la iglesia» (elegir archivo). Inspector y estilo: «Fuente de títulos» y «Fuente de subtítulos» con muestra.

- [ ] Pruebas: un clip sin `fuentes` usa Montserrat/Figtree como hoy (Review Focus 3); el CSS solo trae las fuentes usadas; la fuente propia se sirve en la vista previa y se copia al render; un `.ttf` falso se rechaza; nombre con espacios y `#` se copia con nombre seguro.
- [ ] Commit `feat: más fuentes y la fuente de la iglesia`.

### Task 9: Escenas con pinturas clásicas

Requiere el permiso de la persona para descargar las pinturas.

**Files:** Create `resources/pinturas/` (10–12 obras de dominio público, JPG ≤ 1600 px de alto, con `pinturas.json`: id, título, autor, año, fuente, tema), `src/shared/reel/pinturas.ts`; Modify `tipos.ts` (`Creacion.fondo.tipo += "pintura"`, `fondo.pintura?: string`), `versiculo-reel.ts`, `src/main/ia/claude.ts` (Claude elige la pintura por tema), `src/main/ia/exportar.ts`, `src/main/vista.ts`, `EditorVersiculo.tsx`, `electron-builder.yml`, `NOTICE.md`; Test `tests/shared/reel/pinturas.test.ts`, `tests/shared/reel/versiculo-reel.test.ts`, `tests/main/ia/claude.test.ts`.

**Interfaces — Produces:** `PINTURAS` (leídas de `pinturas.json`); `htmlPintura(id, W, H, D)` (imagen que llena el cuadro sin deformarse, acercamiento y desplazamiento lentos, velo oscuro); `RespuestaVersiculo.pintura` (id válido o se ignora); en el editor, «Pintura clásica» con galería (miniatura, obra y autor).

- [ ] Pruebas: cada pintura del JSON existe y tiene autor, título y fuente; el reel con pintura tiene la imagen, el acercamiento y no anima `left/top`; un id desconocido cae en «luz»; `NOTICE.md` lista cada obra.
- [ ] Commit `feat: escenas con pinturas clásicas`.

### Task 10: Copiar el estilo de un reel

**Files:** Create `src/main/estilo/referencia.ts`, `src/shared/estilo-referencia.ts`, `src/renderer/componentes/CopiarEstilo.tsx`; Modify `src/main/claude/analizar.ts` (`preguntar` acepta argumentos extra), `Inspector.tsx` (botón «Copiar el estilo de un reel»), IPC, `falso-claude.mjs` ("ESTILO DE UN REEL"); Test `tests/main/estilo/referencia.test.ts`, `tests/shared/estilo-referencia.test.ts`, `tests/renderer/CopiarEstilo.test.tsx`, `tests/integracion/referencia.test.ts`.

**Interfaces — Produces:**
- `medirReferencia(video): Promise<{ duracion; cortesPorMinuto: number | null; lufs: number | null; cuadros: string[]; avisos: string[] }>` (FFmpeg: 6 cuadros repartidos, `scdet` para los cortes, `ebur128` si hay audio; sin audio o < 3 s → avisos, nunca error) (Review Focus 5).
- `promptEstilo(medidas)` (marca "ESTILO DE UN REEL"; Claude lee los cuadros con la herramienta Read, `--allowedTools Read`, solo esos archivos).
- `EstiloReferencia = { subtitulos: EstiloSub; tamano; altura; fuenteTitulos; fuenteSubtitulos; color?: string; animo: Animo; intensidad: Intensidad; look: Look; explicacion: string }` con zod (`.catch` por campo, valores fuera de lista → los del clip).
- `aplicarReferencia(clip, e): ClipSpec` (sin tocar contenido: corte, textos, versículos).
- UI: elegir video → «Analizando el estilo…» → tarjeta con lo propuesto y la explicación → «Aplicar a este clip» o «Guardar como estilo de la iglesia».

- [ ] Pruebas: medidas de un video sin audio, uno vertical y uno de 2 s; `aplicarReferencia` no cambia corte ni textos; respuesta con valores raros → se usan los del clip; integración con FFmpeg real para `medirReferencia`.
- [ ] Commit `feat: copiar el estilo de un reel`.

### Task 11: Prueba completa

- [ ] Suite unitaria + integración + pytest + E2E (incluido uno nuevo: crear SRT, PDF y MP3 desde «Entregas», traducir al inglés con el Claude falso, cambiar look y fuente y exportar).
- [ ] Revisión final por un revisor nuevo (modelo más capaz); una pasada de arreglos con prueba en rojo primero; subir a GitHub solo con permiso.
