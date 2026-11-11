# Reels Iglesia — Plan 10: listos para producción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registro de errores con «Copiar diagnóstico», actualizaciones automáticas, borrar prédicas y exportados a la Papelera, control de espacio, instalador 0.2.0 con su lista para una PC limpia, y la prueba con un culto real.

**Architecture:** Módulos nuevos del proceso principal con dependencias inyectadas para probarlos sin Electron: `registro.ts` (archivo diario), `sistema/diagnostico.ts`, `actualizar.ts` (envuelve `electron-updater`), `ocupado.ts` (qué está trabajando), `datos/espacio.ts` y `datos/borrar.ts` (Papelera con `shell.trashItem`). El renderer suma secciones en Ajustes, un aviso de actualización en la barra de arriba y acciones de borrar en Prédicas y Exportados.

**Tech Stack:** el del plan 9 (Electron 35, React 18, TypeScript, electron-builder, Vitest, Playwright) + `electron-updater` (versión exacta).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md`, sección 21.

## Global Constraints

- Registro en `%APPDATA%\Reels Iglesia\registros\reels-AAAA-MM-DD.log`; 7 días; tope 5 MB por archivo (después, una sola línea «registro lleno»).
- El registro nunca anota el texto de la prédica, respuestas de Claude, prompts ni variables de entorno; las rutas sí. Todo mensaje se recorta a 300 caracteres.
- El registro nunca hace fallar la app: si no puede escribir, se calla.
- Actualizaciones: proveedor GitHub `DannyMovilla/reels-iglesia`; revisar 10 s después de abrir y cada 6 h; no revisar si `!app.isPackaged`; nunca reiniciar con una tarea en curso. Versión **0.2.0**.
- `GH_TOKEN` solo en la PC de quien publica; nunca en el código ni en el instalador.
- Borrar siempre a la Papelera de Windows (`shell.trashItem`); nunca borrar el video original; nunca una ruta fuera de la carpeta de datos; nunca una prédica con una tarea en curso.
- «Liberar espacio» borra solo `tmp/` y `voz-*.m4a` (estas solo con el video original disponible) y salta las prédicas ocupadas.
- Toda la interfaz y todos los errores en español sencillo. Versiones npm exactas. Procesos hijos sin shell.
- Trabajar en una rama `plan-10`. No reconstruir `out/` con la app abierta.

## Review Focus

1. La carpeta de registros no se puede escribir (disco lleno, sin permiso) → la app sigue funcionando y no muestra errores por eso. Prueba en Task 1.
2. Un mensaje de error que trae el texto de una respuesta de Claude (p. ej. JSON inválido con la respuesta adentro) → en el registro queda recortado a 300 caracteres. Prueba en Task 1.
3. Sin internet al revisar actualizaciones → estado «error» con el mensaje en español, sin reintentos en bucle ni avisos repetidos. Prueba en Task 5.
4. La Papelera rechaza la carpeta (un archivo abierto en otro programa) → error en español y la prédica sigue completa, sin medio borrar. Prueba en Task 7.
5. «Liberar espacio» mientras se exporta un reel de esa prédica → esa prédica se salta (su `tmp/` y su voz están en uso). Prueba en Task 6.

---

## Estructura de archivos

```
src/main/registro.ts              # escribir, recortar, rotar, tope; leerUltimas(n)
src/main/rutas.ts                 # (mod) carpetaRegistros()
src/main/ipc.ts                   # (mod) manejar(): ipcMain.handle con registro de errores y duración
src/main/procesos/lineas.ts       # (mod) final del stderr al registro si el hijo falla
src/main/cola/cola.ts             # (mod) inicio/fin/duración de cada tarea al registro
src/main/index.ts                 # (mod) errores no capturados, render-process-gone, actualizador, limpieza de tmp
src/main/sistema/diagnostico.ts   # texto de «Copiar diagnóstico»
src/main/ocupado.ts               # proyectoOcupado(id), hayTrabajo()
src/main/actualizar.ts            # Actualizador (envuelve electron-updater)
src/main/datos/espacio.ts         # tamaños, liberar, limpiar tmp viejo
src/main/datos/borrar.ts          # resumen, borrar prédica, borrar reels
src/main/entregas/traducir.ts, frases.ts  # (mod) exportan qué prédicas tienen trabajo en curso
src/main/exportar/tarea.ts        # (mod) el clip guarda el nombre de sus reels
src/shared/api.ts, src/preload/index.ts   # (mod) canales nuevos
src/renderer/main.tsx             # (mod) errores de la ventana al registro
src/renderer/pantallas/Ajustes.tsx        # (mod) Versión, Diagnóstico, Espacio
src/renderer/componentes/BarraTitulo.tsx  # (mod) aviso de actualización
src/renderer/pantallas/Predicas.tsx       # (mod) tamaño, «Video no encontrado», borrar
src/renderer/pantallas/Exportados.tsx     # (mod) borrar reel / borrar todos
electron-builder.yml, package.json        # (mod) publish, versión, scripts
docs/superpowers/notas/prueba-pc-limpia.md, prueba-culto-real.md
```

---

### Task 1: Registro

**Files:**
- Create: `src/main/registro.ts`
- Modify: `src/main/rutas.ts`
- Test: `tests/main/registro.test.ts`

**Interfaces:**
- Produces:
  - `carpetaRegistros(): string` (rutas.ts): con `REELS_IGLESIA_DATOS` → `<datos>/registros`; si no → `join(app.getPath("appData"), "Reels Iglesia", "registros")`.
  - `type Nivel = "info" | "aviso" | "error"`.
  - `registrar(nivel: Nivel, origen: string, mensaje: string): void` — síncrono (`appendFileSync`), nunca lanza.
  - `limpiarRegistrosViejos(dias = 7): void`.
  - `leerUltimas(n: number): string[]` — de los archivos más recientes hacia atrás.
  - `configurarRegistro(o: { carpeta: string; ahora?: () => Date; tope?: number }): void` (para pruebas; por defecto `carpetaRegistros()`, `new Date`, 5 MB).
  - Formato de línea: `2026-11-10T21:04:05.123Z error ipc proyectos:borrar: <mensaje>` (mensaje sin saltos de línea, recortado a 300 caracteres con «…»).

- [ ] **Step 1: Pruebas (fallan)** con una carpeta temporal y `ahora` fijo:
  - escribe en `reels-2026-11-10.log` una línea con el formato exacto;
  - un mensaje de 1 000 caracteres con saltos de línea queda en una sola línea de ≤ 300 caracteres terminada en «…» (Review Focus 2);
  - con `tope: 200`, al pasarse escribe una sola vez «registro lleno» y después nada más ese día;
  - `limpiarRegistrosViejos(7)` borra `reels-2026-11-01.log` y deja `reels-2026-11-04.log`;
  - `leerUltimas(3)` devuelve las 3 últimas líneas, uniendo ayer y hoy si hace falta;
  - con `carpeta` dentro de un archivo (no se puede crear), `registrar` no lanza (Review Focus 1).
- [ ] **Step 2: Correr** `npx vitest run --project unit tests/main/registro.test.ts` — FAIL (no existe).
- [ ] **Step 3: Implementar** `registro.ts` y `carpetaRegistros`.
- [ ] **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** `feat: registro de la app en un archivo por día`.

---

### Task 2: Qué se anota en el registro

**Files:**
- Modify: `src/main/ipc.ts`, `src/main/procesos/lineas.ts`, `src/main/cola/cola.ts`, `src/main/index.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/main.tsx`
- Test: `tests/main/registro-eventos.test.ts`, `tests/main/cola/cola.test.ts`, `tests/main/procesos/lineas.test.ts` (los que ya existan, ampliados)

**Interfaces:**
- Consumes: `registrar` (Task 1).
- Produces:
  - `envolverManejador(canal: string, fn: (...a: any[]) => unknown, o?: { largo?: boolean }): (...a: any[]) => Promise<unknown>` (en `registro.ts`): si `fn` lanza, `registrar("error", "ipc", "<canal>: <mensaje>")` y vuelve a lanzar; con `largo`, anota `inicio <canal>` y `fin <canal> en N s`.
  - En `ipc.ts`, `const manejar = (canal, fn, o?) => ipcMain.handle(canal, envolverManejador(canal, fn, o))` reemplaza cada `ipcMain.handle`. Son `largo`: `entregas:traducir`, `entregas:frases`, `entregas:mp3`, `entregas:pdf`, `entregas:imagenesFrases`.
  - `ejecutarConProgreso`: si `codigo !== 0`, `registrar("aviso", "proceso", "<basename(cmd)> salió con <codigo>: <últimas 20 líneas de stderr unidas con " | ">")`.
  - `Cola`: al pasar a `corriendo` → `info cola inicio <tipo> <proyectoId>`; al terminar → `info|error cola <estado> <tipo> <proyectoId> en N s` (+ error).
  - `ApiReels.registrarError(texto: string): void` (canal `registro:ventana`, `ipcRenderer.send`); `main.tsx` registra `window.addEventListener("error")` y `("unhandledrejection")` y lo llama con `mensaje @ archivo:línea`.
  - `index.ts`: al arrancar `info app inicio <versión> electron <versión> <os.release()>`; `process.on("uncaughtException")` y `("unhandledRejection")` → `error`; `ventana.webContents.on("render-process-gone", (_, d) => error ventana se cerró: <d.reason>)`; `limpiarRegistrosViejos()`.

- [ ] **Step 1: Pruebas (fallan):**
  - `envolverManejador("x:y", lanza "No hay transcripción.")` rechaza con el mismo error y el registro tiene `error ipc x:y: No hay transcripción.`;
  - con `largo`, quedan dos líneas `inicio x:y` y `fin x:y en 0 s`;
  - `ejecutarConProgreso("node", ["-e", "console.error('a\\nb'); process.exit(3)"])` deja `aviso proceso node salió con 3: a | b`;
  - una tarea de la cola que falla deja `error cola error exportar p1 en N s: <mensaje>`.
- [ ] **Step 2: Correr** las pruebas — FAIL.
- [ ] **Step 3: Implementar** (en `ipc.ts`, reemplazar cada `ipcMain.handle(` por `manejar(`; `ipcMain.on` no cambia).
- [ ] **Step 4: Correr** `npx vitest run --project unit` — PASS y `npm run typecheck` sin errores.
- [ ] **Step 5: Commit** `feat: errores, procesos y tareas quedan en el registro`.

---

### Task 3: «Copiar diagnóstico»

**Files:**
- Create: `src/main/sistema/diagnostico.ts`
- Modify: `src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/pantallas/Ajustes.tsx`
- Test: `tests/main/sistema/diagnostico.test.ts`, `tests/renderer/Ajustes.test.tsx`

**Interfaces:**
- Consumes: `leerUltimas` (Task 1), `verificarSistema` (existente, con `revisarClaude: false`), `EstadoSistema`.
- Produces:
  - `textoDiagnostico(d: { version: string; electron: string; windows: string; cpu: string; ramGb: number; gpu: string; estado: EstadoSistema; lineas: string[] }): string` con secciones «Reels Iglesia <v>», «Sistema», «Chequeos» (una línea `✔/✘ <detalle>` por chequeo), «Registro (últimas N líneas)».
  - IPC `sistema:diagnostico` → `string` (arma `d` con `os`, `app.getGPUInfo("basic")` y `leerUltimas(200)`); `sistema:abrirRegistros` → `shell.openPath(carpetaRegistros())`.
  - `ApiReels.diagnostico(): Promise<string>`, `ApiReels.abrirRegistros(): Promise<void>`.
  - Ajustes: grupo «Diagnóstico» con «Copiar diagnóstico» (al copiar, «Copiado» por 2 s; si falla el portapapeles, el error en español) y «Abrir carpeta de registros».

- [ ] **Step 1: Pruebas (fallan):**
  - `textoDiagnostico` contiene la versión, «Windows», «✘ FFmpeg no está instalado.» para un chequeo fallido, y las 200 líneas en orden;
  - Ajustes: clic en «Copiar diagnóstico» llama `navigator.clipboard.writeText` con lo que devuelve `diagnostico()` y muestra «Copiado»; «Abrir carpeta de registros» llama `abrirRegistros()`.
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar.** **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** `feat: copiar diagnóstico desde Ajustes`.

---

### Task 4: Qué está trabajando

**Files:**
- Create: `src/main/ocupado.ts`
- Modify: `src/main/entregas/traducir.ts`, `src/main/entregas/frases.ts`
- Test: `tests/main/ocupado.test.ts`

**Interfaces:**
- Produces:
  - `traduccionesEnCurso(): string[]` (traducir.ts) y `frasesEnCurso(): string[]` (frases.ts): ids de prédicas de sus `enCurso`.
  - `crearOcupado(d: { tareas: () => Tarea[]; entregas: () => string[] }): { proyectoOcupado(id: string): boolean; hayTrabajo(): boolean }`. Una tarea cuenta si está `pendiente` o `corriendo`; las de Con IA (`proyectoId` `ia:<id>`) cuentan para `hayTrabajo` y para `proyectoOcupado("ia:<id>")`.
  - En `index.ts`: `const ocupado = crearOcupado({ tareas: () => cola.lista(), entregas: () => [...traduccionesEnCurso(), ...frasesEnCurso()] })`, que se pasa a Task 5, 6 y 7.

- [ ] **Step 1: Pruebas (fallan):** una tarea `corriendo` de p1 → `proyectoOcupado("p1")` y `hayTrabajo()`; una `ok` no cuenta; una traducción en curso de p2 → `proyectoOcupado("p2")`; nada → `hayTrabajo()` falso.
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar.** **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** `feat: saber qué prédicas tienen trabajo en curso`.

---

### Task 5: Actualizaciones automáticas

**Files:**
- Create: `src/main/actualizar.ts`
- Modify: `package.json` (versión `0.2.0`, dependencia `electron-updater` exacta — la última 6.x publicada hace más de dos semanas, `npm view electron-updater versions`; script `"publicar": "electron-vite build && electron-builder --win --publish always"`), `electron-builder.yml` (`publish: { provider: github, owner: DannyMovilla, repo: reels-iglesia }`), `src/main/index.ts`, `src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/componentes/BarraTitulo.tsx`, `src/renderer/pantallas/Ajustes.tsx`
- Test: `tests/main/actualizar.test.ts`, `tests/renderer/BarraTitulo.test.tsx`, `tests/renderer/Ajustes.test.tsx`

**Interfaces:**
- Consumes: `hayTrabajo` (Task 4), `registrar` (Task 1).
- Produces:
  - `type EstadoActualizacion = { fase: "inactivo" | "buscando" | "al-dia" | "descargando" | "lista" | "error"; version?: string; pct?: number; error?: string }`.
  - `class Actualizador { constructor(d: { updater: Pick<AppUpdater, "checkForUpdates" | "quitAndInstall" | "on"> & { autoDownload: boolean; autoInstallOnAppQuit: boolean }; empaquetada: boolean; hayTrabajo: () => boolean; alCambiar: (e: EstadoActualizacion) => void; temporizador?: { setTimeout; setInterval } }) ; iniciar(): void; buscar(): Promise<void>; reiniciar(): boolean; estado(): EstadoActualizacion }`.
    - `iniciar`: si `!empaquetada` no hace nada; si no, `buscar` a los 10 000 ms y cada 21 600 000 ms.
    - eventos: `checking-for-update` → buscando; `update-not-available` → al-dia; `download-progress` → descargando (pct redondeado); `update-downloaded` → lista (version); `error` → error con «No pude revisar las actualizaciones. Revisa tu internet.» y `registrar("aviso", "actualizar", …)`.
    - `buscar` no lanza (el error va al estado) y no hace nada si ya está buscando o descargando.
    - `reiniciar`: si `hayTrabajo()` devuelve `false` sin reiniciar; si no, `quitAndInstall(false, true)` y `true`.
  - IPC `actualizar:estado` → `EstadoActualizacion`; `actualizar:buscar`; `actualizar:reiniciar` → `boolean`; evento `actualizar:cambio`. `ApiReels.estadoActualizacion()`, `buscarActualizacion()`, `reiniciarParaActualizar()`, `alCambiarActualizacion(cb): () => void`, `versionApp(): Promise<string>` (`app:version`).
  - BarraTitulo: con fase `lista`, «La versión X está lista: se instala al cerrar» y «Reiniciar ahora»; si `reiniciar` devuelve `false`, el texto cambia a «Se instalará al terminar lo que está haciendo».
  - Ajustes → grupo «Versión»: «Reels Iglesia 0.2.0», botón «Buscar actualizaciones» y el estado en palabras («Buscando…», «Estás al día», «Descargando 42 %», «Lista: se instala al cerrar», o el error).

- [ ] **Step 1: Pruebas (fallan)** con un `updater` falso (EventEmitter) y temporizadores falsos:
  - sin empaquetar, `iniciar` no llama `checkForUpdates`;
  - empaquetada: llama a los 10 000 ms y otra vez a los 21 610 000 ms;
  - eventos → estados (incluido `pct: 42` desde `percent: 41.7`);
  - `error` → fase `error` con el texto exacto; una segunda `buscar` mientras busca no llama otra vez (Review Focus 3);
  - `reiniciar` con trabajo → `false` y sin `quitAndInstall`; sin trabajo → `quitAndInstall(false, true)`;
  - BarraTitulo muestra el aviso con fase `lista` y el cambio de texto si `reiniciarParaActualizar` resuelve `false`;
  - Ajustes muestra la versión y «Estás al día».
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar** (`npm install --save-exact electron-updater@<versión>`; en `index.ts` crear el Actualizador con `autoUpdater`, `autoDownload = true`, `autoInstallOnAppQuit = true`, y llamar `iniciar()` tras crear la ventana).
- [ ] **Step 4: Correr** `npx vitest run --project unit` y `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat: actualizaciones automáticas desde GitHub (versión 0.2.0)`.

---

### Task 6: Espacio

**Files:**
- Create: `src/main/datos/espacio.ts`
- Modify: `src/main/index.ts`, `src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/pantallas/Predicas.tsx`, `src/renderer/pantallas/Ajustes.tsx`, `src/renderer/estilos/pantallas.css`
- Test: `tests/main/datos/espacio.test.ts`, `tests/renderer/Predicas.test.tsx`, `tests/renderer/Ajustes.test.tsx`

**Interfaces:**
- Consumes: `proyectoOcupado` (Task 4), `listarProyectos`/`leerProyecto` (con `videoDisponible`), `carpetaProyecto`, `carpetaDatos`.
- Produces:
  - `tamanoCarpeta(ruta: string): Promise<number>` (bytes, recursivo, 0 si no existe).
  - `liberarEspacio(id: string, d: { ocupado: (id: string) => boolean }): Promise<{ liberado: number; saltada: boolean }>`: si ocupada → `{ liberado: 0, saltada: true }`; borra `tmp/` y, si `videoDisponible`, `voz-*.m4a` y `voz.m4a`.
  - `liberarTodo(d): Promise<{ liberado: number; saltadas: number }>`.
  - `limpiarTmpViejos(dias = 7, ahora = Date.now()): Promise<number>`: archivos y carpetas de `proyectos/*/tmp/` con `mtime` más vieja que `dias`; se llama al abrir (`index.ts`, sin esperar) y salta prédicas ocupadas.
  - `formatoTamano(bytes: number): string` (en `src/shared/`): «820 KB», «12,4 MB», «1,2 GB» (coma decimal).
  - IPC `espacio:proyectos` → `Record<string, number>`, `espacio:total` → `number`, `espacio:liberar` (id | null) → `{ liberado; saltadas }`. `ApiReels.espacioProyectos()`, `espacioTotal()`, `liberarEspacio(id?: string)`.
  - Prédicas: la tarjeta suma «1,2 GB» y, si `!p.videoDisponible`, «Video no encontrado» (y la portada no pide el video).
  - Ajustes → grupo «Espacio»: «La app ocupa 3,4 GB en Documentos\Reels Iglesia», botón «Liberar espacio» → «Liberé 820 MB» (+ «N prédicas se saltaron porque están trabajando»).

- [ ] **Step 1: Pruebas (fallan)** con una carpeta de datos temporal:
  - `tamanoCarpeta` suma archivos anidados;
  - `liberarEspacio` borra `tmp/` y `voz-limpia.m4a` con el video presente; con el video borrado conserva las voces;
  - ocupada → `saltada: true` y no toca nada (Review Focus 5);
  - `limpiarTmpViejos(7)` borra un archivo de hace 8 días y deja uno de hace 2;
  - `formatoTamano(1_234_567_890)` = «1,2 GB», `(12_400_000)` = «12,4 MB»;
  - Prédicas muestra el tamaño y «Video no encontrado»; Ajustes muestra el total y «Liberé 820 MB».
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar.** **Step 4: Correr** — PASS.
- [ ] **Step 5: Commit** `feat: cuánto ocupa cada prédica y liberar espacio`.

---

### Task 7: Borrar prédicas y reels

**Files:**
- Create: `src/main/datos/borrar.ts`
- Modify: `src/main/exportar/tarea.ts`, `src/main/ia/exportar.ts` (si marca estado), `src/shared/tipos.ts` (`ClipSpec.exportados?: string[]`), `src/main/ipc.ts`, `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/pantallas/Predicas.tsx`, `src/renderer/pantallas/Exportados.tsx`, `src/renderer/estilos/pantallas.css`
- Test: `tests/main/datos/borrar.test.ts`, `tests/renderer/Predicas.test.tsx`, `tests/renderer/Exportados.test.tsx`

**Interfaces:**
- Consumes: `proyectoOcupado` (Task 4), `tamanoCarpeta` y `formatoTamano` (Task 6), `slugTitulo`, `textosNombre` (tarea.ts), `carpetaCreacion` (ia/almacen).
- Produces:
  - `type Papelera = (ruta: string) => Promise<void>` (en `index.ts`: `shell.trashItem`).
  - `dentroDeDatos(ruta: string): boolean` — `path.relative(carpetaDatos(), ruta)` no empieza con `..` ni es absoluta.
  - `resumenBorrado(id: string): Promise<{ clips: number; reels: number; bytes: number }>`.
  - `borrarProyecto(id: string, d: { papelera: Papelera; ocupado: (id: string) => boolean }): Promise<void>`: valida id; ocupado → «Espera a que termine lo que está haciendo esta prédica.»; si la papelera lanza → «No pude mandar la prédica a la Papelera. Cierra los programas que tengan abiertos sus archivos y prueba de nuevo.» (la carpeta queda como estaba).
  - `borrarReels(proyectoId: string, mp4s: string[] | "todos", d: { papelera: Papelera; ocupado }): Promise<{ bytes: number }>`: para cada MP4 manda a la Papelera el MP4, su `-portada.jpg` y su `textosNombre(mp4)` (este solo si ningún otro MP4 restante lo comparte); `proyectoId` puede ser `ia:<id>`. Después, cada clip `exportado` sin reels restantes vuelve a `editado` (reels del clip = `clip.exportados` si existe; si no, los MP4 que coinciden con `^<slugTitulo(titulo)>(-\d+)?-(9x16|4x5|1x1)\.mp4$`); en Con IA la creación vuelve a `borrador` si no le queda ningún MP4. Un nombre con `/`, `\` o `..` → «Archivo no válido.».
  - `tarea.ts`: al exportar, `exportados: [...(c.exportados ?? []), nombre]` en el clip.
  - IPC `datos:resumenBorrado`, `datos:borrarProyecto`, `datos:borrarReels`. `ApiReels.resumenBorrado(id)`, `borrarProyecto(id)`, `borrarReels(proyectoId, mp4s | "todos")`.
  - Prédicas: cada tarjeta tiene un botón «Más opciones» (ícono `EllipsisVertical`) con «Borrar prédica»; el aviso dice «Se van a la Papelera la transcripción, N clips, M reels exportados y las frases (X). El video original del culto no se borra.» con «Borrar» y «Cancelar»; el error, en español en el aviso.
  - Exportados: en cada reel un botón «Borrar» (ícono `Trash2`, con confirmación «¿Mandar este reel a la Papelera?»); en cada prédica «Borrar todos» con «Se van a la Papelera N reels (X).».

- [ ] **Step 1: Pruebas (fallan)** con datos temporales y una papelera falsa que mueve a otra carpeta:
  - `resumenBorrado` cuenta clips, reels y bytes;
  - `borrarProyecto` manda la carpeta de la prédica y no toca el video original (que está fuera);
  - ocupada → el error exacto y nada se mueve;
  - papelera que lanza → el error exacto y la carpeta sigue (Review Focus 4);
  - `borrarProyecto("../x")` → «Proyecto no válido.»; `borrarReels(id, ["../a.mp4"])` → «Archivo no válido.»;
  - `borrarReels` de `fe-9x16.mp4` con `fe-4x5.mp4` presente: se va la portada, se queda `fe-textos.txt`, el clip «Fe» sigue `exportado`; borrando también `fe-4x5.mp4` se va el txt y el clip pasa a `editado`;
  - un clip viejo sin `exportados` se reconoce por el nombre;
  - `ia:<id>` sin MP4 restantes → la creación vuelve a `borrador`;
  - Prédicas: el menú, el aviso con el texto exacto y que «Borrar» llama `borrarProyecto` y recarga; Exportados: «Borrar» y «Borrar todos» con su confirmación.
- [ ] **Step 2: Correr** — FAIL. **Step 3: Implementar.** **Step 4: Correr** `npx vitest run --project unit` y `npm run typecheck` — PASS.
- [ ] **Step 5: Commit** `feat: borrar prédicas y reels a la Papelera`.

---

### Task 8: Instalador 0.2.0 y lista para la PC limpia

**Files:**
- Modify: `tests/e2e/instalado.spec.ts`
- Create: `docs/superpowers/notas/prueba-pc-limpia.md`

- [ ] **Step 1:** Ampliar `instalado.spec.ts`: después de exportar, existe `<datos>/registros/reels-<hoy>.log` con una línea `info app inicio 0.2.0`, y Ajustes muestra «Reels Iglesia 0.2.0».
- [ ] **Step 2:** Con la app cerrada, correr `npm run dist` y `npx playwright test tests/e2e/instalado.spec.ts`. Expected: `dist/Reels Iglesia Setup 0.2.0.exe` y `latest.yml` con `version: 0.2.0`; la prueba PASS.
- [ ] **Step 3:** Escribir `prueba-pc-limpia.md`: requisitos (Windows 10/11 sin Python, FFmpeg, Node ni Claude; internet); pasos numerados con «qué deberías ver» y una casilla para anotar: instalar (aviso de SmartScreen → «Más información» → «Ejecutar de todas formas»), abrir, asistente de primer uso (instalar FFmpeg, instalar Python, crear entorno, iniciar sesión en Claude), primera prédica con un video corto, exportar un reel, Entregas (SRT), Ajustes → «Copiar diagnóstico» y pegarlo en la nota; qué hacer si algo falla (copiar diagnóstico y abrir la carpeta de registros).
- [ ] **Step 4: Commit** `test: instalador 0.2.0 y lista de verificación para una PC limpia`.

---

### Task 9: Prueba con un culto real (con la persona)

**Files:**
- Create: `docs/superpowers/notas/prueba-culto-real.md`

- [ ] **Step 1:** Pedir a la persona la ruta de un culto de 1 a 2 horas y que tenga la sesión de Claude iniciada. Con la app en desarrollo, crear la prédica, procesarla, exportar 3 reels (9:16 y 4:5), sacar frases y crear SRT, PDF y MP3.
- [ ] **Step 2:** Sacar del registro (`inicio`/`fin … en N s`) los tiempos de cada paso y anotarlos en la nota con la PC (CPU, GPU, RAM), la duración del culto y lo que se vio mal.
- [ ] **Step 3:** Por cada problema: si se arregla con un valor (constante), prueba que falla primero y el ajuste; si necesita lógica nueva, anotarlo como pendiente en la nota.
- [ ] **Step 4: Commit** `docs: prueba con un culto real`.
