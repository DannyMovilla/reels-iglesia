# Reels Iglesia — Plan 1: base de la app y procesamiento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app Electron que crea proyectos de prédica, transcribe y detecta caras con Python en una cola, analiza con `claude -p` y muestra los clips sugeridos (etapas 1–3 del diseño).

**Architecture:** Electron (main en Node) con una cola de tareas que lanza procesos hijos (Python, `claude`) y reporta progreso por IPC tipado a un renderer React. Los datos viven en JSON por proyecto en `Documentos/Reels Iglesia/`. El editor, la exportación con HyperFrames, la marca y la música son los planes 2 y 3.

**Tech Stack:** Electron 33.2.1, electron-vite 2.3.0, Vite 5.4.11, React 18.3.1, TypeScript 5.6.3, zod 3.23.8, lucide-react 0.468.0, Vitest 2.1.8, @testing-library/react 16.1.0, @playwright/test 1.49.1; Python 3.12 con faster-whisper y opencv-python-headless (ya en `.venv`).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md`

## Global Constraints

- Plataforma: Windows; textos de la interfaz en español.
- Versiones de dependencias npm exactas (sin `^`/`~`).
- El renderer no ejecuta procesos ni lee archivos: solo usa la API del preload.
- Procesos hijos siempre con `spawn(cmd, args[])` sin `shell: true` (rutas con espacios, paréntesis y acentos).
- Carpeta de datos por defecto: `<Documentos>/Reels Iglesia/` con `marca.json`, `musica/`, `proyectos/<aaaa-mm-dd-slug>/` (`proyecto.json`, `transcripcion.json`, `caras.json`, `clips.json`, `exportados/`, `tmp/`).
- El video original no se copia: se guarda ruta, tamaño y fecha de modificación.
- Claude se usa solo vía `claude -p --output-format json` (suscripción); nunca API key.
- Diseño: tokens de `design/maqueta-editor.html` (`--bg-0 #0a0c16`, `--luz #f2b544`, `--cielo #4fd1c5`, Geist / Geist Mono / Fraunces), íconos Lucide, foco visible, respeta `prefers-reduced-motion`.
- Categorías válidas: Enseñanza, Reflexión, Exhortación, Esperanza, Testimonio, Llamado.
- Formatos por defecto de un clip: `["9:16", "4:5"]`; encuadre por defecto `{ modo: "auto", x: 0.5, zoom: 1.25 }`.

## Review Focus

1. Rutas de video con espacios, paréntesis y acentos (p. ej. `culto (1).mp4` en `Descargas`) → todo el pipeline funciona. Prueba en Task 3.
2. Respuesta de Claude con texto antes/después del JSON o dentro de un bloque de código → se extrae el JSON; si no hay JSON válido tras un reintento, error legible. Prueba en Task 6.
3. La app se cierra con una tarea corriendo → al abrir de nuevo esa tarea aparece "interrumpida" con "Reintentar", no "corriendo" para siempre. Prueba en Task 4.
4. El video original se movió o borró → el proyecto abre, conserva transcripción y clips y marca "video no encontrado". Prueba en Task 2.
5. Rango de prédica inválido (fin ≤ inicio, fin > duración) → mensaje en la pantalla Nueva prédica y no se crea el proyecto. Prueba en Task 2 (validación) y Task 8 (UI).

---

## Estructura de archivos

```
package.json, electron.vite.config.ts, tsconfig*.json, vitest.config.ts, playwright.config.ts
python/transcribir.py              # movido desde la raíz; progreso JSON y carpeta de salida
python/test_transcribir.py
prototipos/pulpito-clips.html      # movido desde la raíz (referencia)
src/shared/tipos.ts                # Proyecto, ClipSpec, Transcripcion, Caras, Tarea, ApiReels
src/main/index.ts                  # ventana sin marco, arranque
src/main/ipc.ts                    # registra los canales de ApiReels
src/main/rutas.ts                  # carpeta de datos y del .venv/python/claude
src/main/proyectos/almacen.ts      # crear/listar/leer/guardar proyectos
src/main/procesos/lineas.ts        # spawn + progreso por líneas JSON
src/main/cola/cola.ts              # cola de tareas con estados y persistencia
src/main/pipeline/tareas.ts        # tareas transcribir / caras / analizar
src/main/claude/prompt.ts          # construye el prompt
src/main/claude/esquema.ts         # zod de la respuesta
src/main/claude/normalizar.ts      # snap a segmentos, frase de apertura, defaults de ClipSpec
src/main/claude/analizar.ts        # ejecuta claude -p, extrae JSON, reintenta
src/main/sistema/verificar.ts      # ffmpeg, python/.venv, CUDA, sesión de claude
src/preload/index.ts               # expone ApiReels
src/renderer/index.html, main.tsx, App.tsx
src/renderer/estilos/tokens.css, base.css
src/renderer/componentes/BarraTitulo.tsx, Riel.tsx, PanelProceso.tsx, ListaClips.tsx, AnilloPuntaje.tsx
src/renderer/pantallas/Predicas.tsx, NuevaPredica.tsx, Editor.tsx, Ajustes.tsx
tests/                             # espejo de src/ (unitarias), tests/e2e/ (Playwright), tests/fixtures/
```

---

### Task 1: Esqueleto Electron con el diseño base

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`, `playwright.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/estilos/tokens.css`, `src/renderer/estilos/base.css`, `src/renderer/componentes/BarraTitulo.tsx`, `src/renderer/componentes/Riel.tsx`
- Move: `pulpito-clips.html` → `prototipos/pulpito-clips.html`; `transcribir.py` → `python/transcribir.py`
- Test: `tests/renderer/Riel.test.tsx`, `tests/e2e/arranque.spec.ts`

**Interfaces:**
- Produces: ventana sin marco (`frame: false`, 1440×900, mínimo 1180×720, fondo `#0a0c16`); `BarraTitulo({ migas: string[]; acciones?: ReactNode })`; `Riel({ actual: "predicas" | "proyectos" | "exportados" | "marca" | "ajustes"; alCambiar(id) })` con "Canciones" y "Con IA" deshabilitados (`aria-disabled="true"`, grupo "Pronto"); botones de ventana por IPC `ventana:minimizar|maximizar|cerrar`.
- Scripts: `npm run dev`, `npm run build`, `npm test` (vitest), `npm run e2e` (build + playwright).

- [ ] **Step 1:** Instalar dependencias con las versiones exactas del Tech Stack y crear los archivos de configuración de electron-vite (main, preload, renderer con `@vitejs/plugin-react@4.3.4`).
- [ ] **Step 2: Test que falla** — `tests/renderer/Riel.test.tsx`:
  ```tsx
  test("Riel marca la sección actual y deshabilita lo que viene pronto", () => {
    render(<Riel actual="predicas" alCambiar={() => {}} />);
    expect(screen.getByRole("link", { name: "Prédicas" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Canciones" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Con IA" })).toHaveAttribute("aria-disabled", "true");
  });
  ```
- [ ] **Step 3:** Run `npm test -- Riel` → FAIL (módulo no existe).
- [ ] **Step 4:** Implementar `tokens.css` copiando los tokens `:root` de `design/maqueta-editor.html`, `base.css`, `BarraTitulo`, `Riel` (Lucide: `mic-vocal`, `folder-open`, `clapperboard`, `palette`, `music`, `wand-sparkles`, `settings`) y `App` con BarraTitulo + Riel + área vacía.
- [ ] **Step 5:** Run `npm test -- Riel` → PASS.
- [ ] **Step 6: Test E2E** — `tests/e2e/arranque.spec.ts`: lanza la app con `_electron.launch({ args: ["out/main/index.js"] })`, espera el texto "Reels Iglesia" en la barra de título y que la ventana tenga título "Reels Iglesia". Run `npm run e2e` → PASS.
- [ ] **Step 7:** Commit `feat: esqueleto Electron con barra de título y riel`.

---

### Task 2: Tipos compartidos y almacén de proyectos

**Files:**
- Create: `src/shared/tipos.ts`, `src/main/rutas.ts`, `src/main/proyectos/almacen.ts`
- Test: `tests/main/proyectos/almacen.test.ts`

**Interfaces:**
- Produces (`src/shared/tipos.ts`):
  ```ts
  type EstadoProyecto = "nuevo" | "transcribiendo" | "caras" | "analizando" | "listo" | "error";
  interface VideoOrigen { ruta: string; tamano: number; modificado: number; duracion: number }
  interface Proyecto { id: string; nombre: string; creado: string; video: VideoOrigen; rango: { inicio: number; fin: number };
    estado: EstadoProyecto; pasos: Record<"transcripcion" | "caras" | "analisis", { estado: "pendiente" | "ok" | "error"; segundos?: number; detalle?: string }>;
    videoDisponible?: boolean }
  interface Segmento { s: number; e: number; t: string; w: [number, number, string][] }
  interface Transcripcion { formato: "pulpito-transcripcion/1"; inicio: number; fin: number; modelo: string; dispositivo: string; segmentos: Segmento[] }
  type Caras = [number, [number, number, number, number][]][];
  interface ClipSpec { /* exactamente los campos de la sección 4.2 del diseño */ }
  ```
- Produces (`almacen.ts`): `carpetaDatos(): string` (de `rutas.ts`, `app.getPath("documents") + "/Reels Iglesia"`, sobreescribible con `REELS_IGLESIA_DATOS` para pruebas); `validarRango(inicio: number, fin: number, duracion: number): string | null` (mensaje de error en español o `null`); `crearProyecto(datos: { nombre: string; video: VideoOrigen; rango: {inicio:number; fin:number} }): Promise<Proyecto>`; `listarProyectos(): Promise<Proyecto[]>` (más nuevo primero); `leerProyecto(id): Promise<Proyecto>` (rellena `videoDisponible` comparando ruta+tamaño); `guardarProyecto(p)`; `leerJson<T>(id, archivo: "transcripcion.json" | "caras.json" | "clips.json"): Promise<T | null>`; `guardarJson(id, archivo, datos)`. `id` = `aaaa-mm-dd-<slug del nombre>`, con sufijo `-2`, `-3` si existe.

- [ ] **Step 1: Tests que fallan** — en una carpeta temporal (`REELS_IGLESIA_DATOS`):
  - `crearProyecto({ nombre: "Culto dominical", ... })` el 2026-11-02 crea `proyectos/2026-11-02-culto-dominical/proyecto.json` con `estado: "nuevo"` y los tres pasos `pendiente`; un segundo con el mismo nombre recibe id `2026-11-02-culto-dominical-2`.
  - `validarRango(10, 5, 100)` → `"El fin de la prédica debe ser después del inicio."`; `validarRango(0, 120, 100)` → `"El fin de la prédica pasa la duración del video (1:40)."`; `validarRango(0, 60, 100)` → `null`.
  - `crearProyecto` con rango inválido rechaza con el mismo mensaje y no crea carpeta.
  - Review Focus 4: tras crear, renombrar el archivo de video → `leerProyecto(id).videoDisponible === false` y `leerJson(id, "clips.json")` sigue devolviendo los clips guardados.
- [ ] **Step 2:** Run `npm test -- almacen` → FAIL.
- [ ] **Step 3:** Implementar `tipos.ts`, `rutas.ts` y `almacen.ts` (fecha inyectable para la prueba; escritura atómica: escribir `*.tmp` y renombrar).
- [ ] **Step 4:** Run `npm test -- almacen` → PASS.
- [ ] **Step 5:** Commit `feat: tipos compartidos y almacén de proyectos`.

---

### Task 3: Procesos con progreso y transcriptor adaptado

**Files:**
- Create: `src/main/procesos/lineas.ts`, `python/test_transcribir.py`, `tests/fixtures/crear-fixture.ps1`
- Modify: `python/transcribir.py` (argumentos y progreso)
- Test: `tests/main/procesos/lineas.test.ts`, `tests/integracion/transcribir.test.ts`

**Interfaces:**
- Produces (`lineas.ts`): `ejecutarConProgreso(cmd: string, args: string[], opciones: { cwd?: string; env?: NodeJS.ProcessEnv; alProgreso?(p: { etapa: string; pct: number; texto?: string }): void; senal?: AbortSignal }): Promise<{ codigo: number; stdout: string; stderr: string }>` — cada línea de stdout que sea JSON con `etapa` se envía a `alProgreso` y no se agrega a `stdout`; aborta matando el proceso (`taskkill /T /F` en Windows).
- Produces (`transcribir.py`): nuevos argumentos `--salida <carpeta>` (escribe `transcripcion.json` y/o `caras.json` ahí en vez de junto al video), `--progreso-json` (imprime una línea `{"etapa": "transcripcion"|"caras"|"modelo", "pct": n, "texto": "..."}` en lugar de la barra), `--solo-transcripcion` y `--solo-caras` (este último toma `--inicio/--fin` de argumentos, sin necesitar `.pulpito.json`). Sin `--salida` conserva el comportamiento actual.

- [ ] **Step 1: Test que falla (Node)** — `ejecutarConProgreso("node", ["-e", script])` donde el script imprime `{"etapa":"x","pct":50}` y `hola`: `alProgreso` recibe `{etapa:"x",pct:50}` y `stdout === "hola\n"`; con `senal` abortada a los 100 ms un `setInterval` infinito termina con código ≠ 0 en < 2 s.
- [ ] **Step 2:** Run `npm test -- lineas` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: Test que falla (Python)** — `python/test_transcribir.py` con pytest: `a_segundos("1:05:30") == 3930`, `a_segundos("65:30") == 3930`; `emitir_progreso("caras", 12.345)` imprime exactamente `{"etapa": "caras", "pct": 12.3}`; parser acepta `--salida`, `--progreso-json`, `--solo-transcripcion`, `--solo-caras`.
- [ ] **Step 4:** Run `.venv\Scripts\python.exe -m pytest python -q` → FAIL. Implementar en `transcribir.py` (`emitir_progreso`, argumentos, rama `--salida`). Run → PASS.
- [ ] **Step 5: Fixture** — `tests/fixtures/crear-fixture.ps1` genera con la voz `Microsoft Sabina Desktop` y FFmpeg un video de ~20 s con habla en español en `tests/fixtures/salida/culto (prueba) ñ.mp4` (nombre con espacio, paréntesis y ñ — Review Focus 1). No se versiona el MP4 (ya ignorado).
- [ ] **Step 6: Test de integración** (marcado `integracion`, se corre con `npm run test:integracion`): ejecutar `transcribir.py "<fixture>" --inicio 0 --salida <tmp> --progreso-json --modelo tiny --dispositivo cpu` con `ejecutarConProgreso`; espera código 0, al menos un progreso de `transcripcion` y de `caras`, y `transcripcion.json` con ≥ 1 segmento que contenga la palabra "Dios".
- [ ] **Step 7:** Commit `feat: procesos con progreso y transcriptor con salida por proyecto`.

---

### Task 4: Cola de tareas

**Files:**
- Create: `src/main/cola/cola.ts`
- Test: `tests/main/cola/cola.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type EstadoTarea = "pendiente" | "corriendo" | "ok" | "error" | "cancelada" | "interrumpida";
  interface Tarea { id: string; proyectoId: string; tipo: "transcribir" | "caras" | "analizar"; estado: EstadoTarea;
    pct: number; texto?: string; error?: string; creada: string; iniciada?: string; terminada?: string }
  type Ejecutor = (t: Tarea, ctx: { alProgreso(pct: number, texto?: string): void; senal: AbortSignal }) => Promise<void>;
  class Cola extends EventEmitter {          // evento "cambio" con Tarea[]
    constructor(archivoEstado: string, ejecutores: Record<Tarea["tipo"], Ejecutor>);
    cargar(): Promise<void>;                 // tareas "corriendo"/"pendiente" guardadas pasan a "interrumpida"
    agregar(proyectoId: string, tipo: Tarea["tipo"]): Tarea;
    reintentar(id: string): void; cancelar(id: string): void; lista(): Tarea[];
  }
  ```
  Ejecuta una tarea a la vez, en orden de llegada; guarda el estado en `archivoEstado` (JSON) en cada cambio.

- [ ] **Step 1: Tests que fallan:** dos tareas agregadas corren en orden y terminan `ok`; un ejecutor que lanza `Error("sin GPU")` deja la tarea en `error` con ese texto y la siguiente igual corre; `cancelar` durante la ejecución aborta la `senal` y deja `cancelada`; **Review Focus 3:** escribir un `archivoEstado` con una tarea `corriendo`, crear `new Cola(...)`, `cargar()` → esa tarea queda `interrumpida` y `reintentar(id)` la vuelve a correr hasta `ok`.
- [ ] **Step 2:** Run `npm test -- cola` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Commit `feat: cola de tareas persistente`.

---

### Task 5: Pipeline de procesamiento e IPC

**Files:**
- Create: `src/main/pipeline/tareas.ts`, `src/main/ipc.ts`
- Modify: `src/main/index.ts` (crear `Cola` en `carpetaDatos()/cola.json`, registrar IPC, avisar al renderer), `src/preload/index.ts`, `src/shared/tipos.ts` (agregar `ApiReels`)
- Test: `tests/main/pipeline/tareas.test.ts`

**Interfaces:**
- Consumes: `ejecutarConProgreso` (Task 3), `Cola` (Task 4), almacén (Task 2), `analizarProyecto` (Task 6, inyectado; hasta entonces un ejecutor que falla con "Análisis no disponible todavía").
- Produces (`tareas.ts`): `crearEjecutores(deps: { python: string; script: string; analizar: (proyectoId: string, ctx) => Promise<void> }): Record<Tarea["tipo"], Ejecutor>` — `transcribir` corre `--solo-transcripcion --salida <proyecto>`; `caras` corre `--solo-caras`; si existe la variable `REELS_WHISPER_MODELO` se agrega `--modelo <valor>` (pruebas usan `tiny`); al terminar cada una actualiza `proyecto.pasos[...]` (`ok`, `segundos`) y `proyecto.estado`; al terminar `transcribir` encola `caras`, y al terminar `caras` encola `analizar`.
- Produces (`ApiReels`, expuesta como `window.reels`):
  ```ts
  interface ApiReels {
    elegirVideo(): Promise<VideoOrigen | null>;               // diálogo + ffprobe para duración
    crearProyecto(d: { nombre: string; video: VideoOrigen; rango: {inicio:number; fin:number} }): Promise<Proyecto>;
    listarProyectos(): Promise<Proyecto[]>; leerProyecto(id: string): Promise<Proyecto>;
    leerClips(id: string): Promise<ClipSpec[]>; leerTranscripcion(id: string): Promise<Transcripcion | null>;
    procesar(id: string): Promise<void>;                     // encola "transcribir"
    tareas(): Promise<Tarea[]>; alCambiarTareas(cb: (t: Tarea[]) => void): () => void;
    reintentar(idTarea: string): Promise<void>; cancelar(idTarea: string): Promise<void>;
    urlVideo(id: string): string;                           // protocolo "reels-video://<id>" servido por main
    verificarSistema(): Promise<EstadoSistema>;             // Task 7
    ventana: { minimizar(): void; maximizar(): void; cerrar(): void };
  }
  ```

- [ ] **Step 1: Tests que fallan** (con `ejecutarConProgreso` falso): `transcribir` llama a Python con `["<script>", "<ruta video>", "--inicio", "6284", "--fin", "9155", "--solo-transcripcion", "--salida", "<carpeta proyecto>", "--progreso-json"]`, reenvía el progreso a `ctx.alProgreso`, deja `pasos.transcripcion.estado === "ok"` y encola `caras`; un código de salida ≠ 0 deja el paso en `error` con las últimas 5 líneas de stderr en `detalle`.
- [ ] **Step 2:** Run `npm test -- tareas` → FAIL. Implementar `tareas.ts`, `ipc.ts`, preload y el protocolo `reels-video://` (sirve el archivo original con soporte de rangos HTTP para el `<video>`). Run → PASS.
- [ ] **Step 3:** Commit `feat: pipeline de procesamiento con IPC`.

---

### Task 6: Análisis con Claude

**Files:**
- Create: `src/main/claude/prompt.ts`, `src/main/claude/esquema.ts`, `src/main/claude/normalizar.ts`, `src/main/claude/analizar.ts`, `tests/fixtures/claude/respuesta-ok.json`, `tests/fixtures/claude/falso-claude.mjs`
- Modify: `src/main/index.ts` (inyectar `analizarProyecto` en los ejecutores)
- Test: `tests/main/claude/*.test.ts`

**Interfaces:**
- Consumes: `Transcripcion`, `ClipSpec`, almacén.
- Produces:
  - `construirPrompt(t: Transcripcion, n: number): string` — mismo texto que `buildPrompt` de `prototipos/pulpito-clips.html`, más `"ganchos_alternativos": [2 strings]` y `"versiculos": [{"ref": "Salmo 51:17", "cita": "palabras exactas del predicador alrededor de la cita"}]` (solo referencias que el predicador menciona o lee; nunca inventar).
  - `RespuestaClaude = z.array(z.object({ titulo, gancho, ganchos_alternativos: z.array(z.string()).max(3).default([]), categoria: z.enum([...6]), inicio: z.string(), fin: z.string(), intro_frase: z.string().optional(), palabras_clave: z.array(z.string()).default([]), versiculos: z.array(z.object({ ref: z.string(), cita: z.string() })).default([]), puntaje: z.number().min(0).max(100), razon, descripcion, hashtags: z.array(z.string()).default([]) }))`.
  - `extraerJson(texto: string): unknown` — JSON completo; si no, el cuerpo de un bloque ```` ```json ````; si no, del primer `[` al último `]`; si nada parsea, lanza `Error("Claude no devolvió una lista de clips válida")`.
  - `normalizarClips(r: z.infer<typeof RespuestaClaude>, t: Transcripcion): ClipSpec[]` — inicio/fin al segmento más cercano (`s` y `e`), descarta clips < 5 s, apertura con la frase ubicada palabra por palabra (≥ 50% de coincidencia, máx. 8 s, −0,15 s / +0,25 s de margen), versículos con `en` = segundo dentro del clip donde empieza la `cita` (si no se ubica: inicio del clip + 3 s) y `texto: ""` (lo llena el plan 2 con RV1909), defaults de la sección Global Constraints, `estado: "sugerido"`, orden por puntaje.
  - `analizarProyecto(id: string, ctx, opciones?: { comando?: string; n?: number }): Promise<void>` — `comando` por defecto: variable `REELS_CLAUDE_COMANDO` o `"claude"` (se separa en ejecutable + argumentos); `n` por defecto 6. Ejecuta `<comando> -p --output-format json` con el prompt por stdin; lee `.result` del JSON de salida; si `is_error` y `result` contiene "Not logged in" → `Error("Claude no tiene sesión iniciada. Abre Ajustes → Iniciar sesión en Claude.")`; si `extraerJson`/zod fallan → un reintento agregando al prompt `"Tu respuesta anterior no era válida: <error>. Responde solo con el arreglo JSON."`; guarda `clips.json` y deja el paso `analisis` en `ok`.

- [ ] **Step 1: Tests que fallan:**
  - `construirPrompt` incluye `[1:44:44 - 1:44:51]` para un segmento `s=6284, e=6291` y menciona `ganchos_alternativos` y `versiculos`.
  - **Review Focus 2:** `extraerJson("Aquí van:\n```json\n[{\"a\":1}]\n```\nBendiciones")` → `[{a:1}]`; `extraerJson("sin json")` lanza el mensaje exacto de arriba.
  - `normalizarClips` con `respuesta-ok.json` y la transcripción de `spike/prueba-hf` (copiada a `tests/fixtures/transcripcion-muestra.json`, sin el video): el clip queda en `inicio 30.93 / fin 63.88`, `apertura.frase` empieza con `"ese quebrantamiento sincero"`, `formatos` = `["9:16","4:5"]`.
  - `analizarProyecto` con `comando: "node tests/fixtures/claude/falso-claude.mjs"` en tres modos (variable `FALSO_CLAUDE_MODO`): `ok` → `clips.json` escrito; `invalido-luego-ok` → éxito tras un reintento (el falso registra 2 llamadas); `sin-sesion` → rechaza con el mensaje de sesión.
- [ ] **Step 2:** Run `npm test -- claude` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Commit `feat: análisis de clips con claude -p`.

---

### Task 7: Verificación del sistema y Ajustes

**Files:**
- Create: `src/main/sistema/verificar.ts`, `src/renderer/pantallas/Ajustes.tsx`
- Test: `tests/main/sistema/verificar.test.ts`, `tests/renderer/Ajustes.test.tsx`

**Interfaces:**
- Produces: `interface EstadoSistema { ffmpeg: Chequeo; python: Chequeo; gpu: Chequeo; claude: Chequeo }`, `interface Chequeo { ok: boolean; detalle: string; accion?: "instalar-ffmpeg" | "crear-venv" | "iniciar-sesion-claude" }`; `verificarSistema(deps?): Promise<EstadoSistema>` (ffmpeg `-version`; `.venv` importa `faster_whisper, cv2`; `ctranslate2.get_cuda_device_count() > 0` → "GPU NVIDIA lista" o "Se usará la CPU (más lento)"; `claude -p "ok" --output-format json` → sesión ok o `accion: "iniciar-sesion-claude"`); IPC `sistema:accion` que para `iniciar-sesion-claude` abre `cmd /k claude` en una ventana nueva con la instrucción "escribe /login".

- [ ] **Step 1: Tests que fallan:** con ejecutores falsos, salida de claude `{"is_error":true,"result":"Not logged in · Please run /login"}` → `claude.ok === false` y `accion === "iniciar-sesion-claude"`; CUDA 0 → `gpu.ok === true` con detalle "Se usará la CPU (más lento)"; `Ajustes` muestra cada chequeo con su detalle y un botón "Iniciar sesión en Claude" solo cuando hace falta.
- [ ] **Step 2:** Run `npm test -- verificar Ajustes` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3:** Commit `feat: verificación del sistema y pantalla de ajustes`.

---

### Task 8: Pantallas Prédicas, Nueva prédica y Editor (lectura)

**Files:**
- Create: `src/renderer/pantallas/Predicas.tsx`, `NuevaPredica.tsx`, `Editor.tsx`, `src/renderer/componentes/PanelProceso.tsx`, `ListaClips.tsx`, `AnilloPuntaje.tsx`
- Modify: `src/renderer/App.tsx` (navegación entre pantallas)
- Test: `tests/renderer/NuevaPredica.test.tsx`, `tests/renderer/ListaClips.test.tsx`, `tests/e2e/flujo-basico.spec.ts`

**Interfaces:**
- Consumes: `window.reels` (`ApiReels`, Task 5), `validarRango` (copiada a `src/shared/validar.ts` para usarla en el renderer).
- Produces:
  - `Predicas`: tarjetas de proyecto (nombre, fecha, estado, n.º de clips) y botón "Nueva prédica"; estado vacío con explicación y el mismo botón.
  - `NuevaPredica`: elegir video → reproductor (`reels-video://`) con "Marcar inicio aquí" / "Marcar fin aquí", campos `H:MM:SS`, nombre (por defecto "Culto dominical · <fecha>"), botón "Procesar prédica" deshabilitado con el mensaje de `validarRango` visible junto a los campos.
  - `Editor` (solo lectura en este plan): `PanelProceso` (pasos con estado, tiempo y "Reintentar" en error/interrumpida) + `ListaClips` (miniatura = cuadro del video en el inicio del clip, título, categoría, versículos, `AnilloPuntaje`, filtro Todos/Con versículo) + reproductor del clip seleccionado en el centro + datos del clip a la derecha. La maqueta `design/maqueta-editor.html` es la referencia visual.

- [ ] **Step 1: Tests que fallan:**
  - **Review Focus 5:** en `NuevaPredica`, inicio `0:50:00` y fin `0:40:00` → se ve "El fin de la prédica debe ser después del inicio." y "Procesar prédica" está deshabilitado.
  - `ListaClips` con 3 clips ordena por puntaje, el filtro "Con versículo" deja solo los que tienen versículos y `AnilloPuntaje` tiene `aria-label="Puntaje 92"`.
- [ ] **Step 2:** Run `npm test -- NuevaPredica ListaClips` → FAIL. Implementar. Run → PASS.
- [ ] **Step 3: E2E** — `tests/e2e/flujo-basico.spec.ts`: con `REELS_IGLESIA_DATOS` temporal, el fixture de Task 3, `REELS_CLAUDE_COMANDO="node tests/fixtures/claude/falso-claude.mjs"` y `REELS_WHISPER_MODELO=tiny`: crear prédica → "Procesar prédica" → esperar (≤ 3 min) los tres pasos en verde → ver ≥ 1 clip en la lista y su título en el panel derecho. Run `npm run e2e` → PASS.
- [ ] **Step 4: Prueba manual con el culto real** — `npm run dev`, crear una prédica con el video de un culto real, marcando el rango de la prédica, con Claude real (requiere sesión iniciada). Esperado: clips sugeridos en la lista.
- [ ] **Step 5:** Commit `feat: pantallas de prédicas, nueva prédica y editor de lectura`.

---

## Siguientes planes (no incluidos aquí)

- **Plan 2 — Editor y exportación:** vista previa en vivo (riesgo del diseño §13), inspector editable, línea de tiempo, constructor de composición en TypeScript (desde `spike/generar.py`), regla del versículo con RV1909 local, apertura, cierre, formatos y cola de render HyperFrames con NVENC.
- **Plan 3 — Marca, música y entrega:** kit de marca, música generada y mezcla bajo la voz, asistente de primer uso que crea el `.venv`, instalador y E2E completo.
