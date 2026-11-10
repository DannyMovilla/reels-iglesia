# Reels Iglesia — Plan 8: subtítulos virales, gancho grande y frases para publicar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8 estilos de subtítulo virales con galería animada, 5 estilos de gancho, la plantilla de la iglesia con ambos, y «Frases para publicar» (7 frases textuales de la prédica con imágenes 1080×1350).

**Architecture:** Las animaciones de subtítulos y gancho pasan de cadenas JS a datos (`PasoAnim[]`) que se serializan a la composición HyperFrames (igual que hoy) o se ejecutan con GSAP en la galería del renderer (la CSP `script-src 'self'` prohíbe `eval`). Los 8 estilos nuevos son presets de un motor en `src/shared/reel/`; el gancho tiene su propio módulo. Las frases son una función pura de fidelidad en `src/shared/frases.ts` y una entrega en `src/main/entregas/frases.ts` que consulta `claude -p` y pinta PNG con una ventana oculta (`capturePage`), como el PDF.

**Tech Stack:** el del plan 7 (Electron 35, React 18, TypeScript, HyperFrames 0.9.17, GSAP 3.12.5, FFmpeg, `claude -p`, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md`, sección 19 (reglas del reel en la 7, Claude en la 8, entregas en la 17).

## Global Constraints

- Nada se suma al análisis de la prédica: el prompt de `src/main/claude/prompt.ts` no cambia.
- Solo la suscripción de Claude (`claude -p`); un reintento automático solo si el JSON no valida.
- RVR1960; un versículo sin confirmar no se exporta (ni en reels ni en frases). Claude nunca agrega versículos.
- Toda la interfaz y todos los errores en español sencillo.
- Clips y marcas de versiones anteriores abren y exportan igual: todo campo nuevo es opcional (`estiloGancho` → `tarjeta`, `EstiloIglesia.gancho` → `tarjeta`).
- Los 7 estilos de subtítulo existentes generan exactamente el mismo HTML y JS que antes del plan.
- Los presets no eligen fuente (usan la del clip o la iglesia). Sin emojis.
- Color «amarillo» de los presets: `#FFE14D`.
- Frases: 6 a 25 palabras; fidelidad ≥ 90 % por palabras en ±60 s de su minuto; repetidas si comparten > 60 % de palabras; como mucho 7, ordenadas por minuto; imágenes 1080×1350.
- Animaciones de la galería respetan `prefers-reduced-motion`. Íconos Lucide; foco visible.
- Procesos hijos con `spawn`/`execFile(cmd, args[])` sin `shell: true`. Versiones npm exactas; no se agregan dependencias.
- Trabajar en una rama `plan-8` (o worktree); no reconstruir `out/` con la app abierta.

## Review Focus

1. Clip guardado antes del plan 8 (sin `estiloGancho`) con marca sin `estilo.gancho` → la composición es idéntica a la de hoy. Prueba en Task 2.
2. Gancho de 60 caracteres (el máximo del campo) con estilo `gigante` en 1:1 → cabe en el ancho y su caja no se cruza con la franja de subtítulos. Prueba en Task 2.
3. Claude devuelve frases con `en` mal escrito, fuera del rango de la prédica, vacías, inventadas o repetidas → se descartan sin romper; si no queda ninguna, error legible. Prueba en Task 5 y Task 6.
4. Video original no encontrado y una frase con fondo «momento» → la imagen sale con fondo «marca» y un aviso, nunca falla el lote. Prueba en Task 6.
5. Frase con comillas, `<`, `&` y 25 palabras → HTML escapado y tamaño de letra mínimo (56 px), cabe en la tarjeta. Prueba en Task 5.

---

## Estructura de archivos

```
src/shared/reel/pasos.ts            # PasoAnim + aJs (serializador idéntico al formato actual)
src/shared/reel/estilos-sub.ts      # (mod) pasosBloque; despacha legado vs motor; NOMBRE_ESTILO con los 8 nuevos
src/shared/reel/presets-sub.ts      # PresetSub + PRESETS_SUB (8)
src/shared/reel/motor-sub.ts        # html/pasos/css de un preset
src/shared/reel/subtitulos.ts       # (mod) límites por preset
src/shared/reel/gancho.ts           # EstiloGancho: html, pasos, css, medio alto, palabra en color
src/shared/reel/encuadre.ts         # (mod) posicionGancho acepta el medio alto
src/shared/reel/composicion.ts      # (mod) tamaños nuevos y gancho por estilo
src/shared/tipos.ts                 # (mod) EstiloSub, EstiloGancho, ClipSpec.estiloGancho, EstiloIglesia.gancho
src/shared/clip.ts                  # (mod) plantilla con gancho
src/main/claude/cambios.ts          # (mod) estilo_gancho
src/renderer/componentes/Galeria.tsx  # grilla de muestras animadas (subtítulos y gancho)
src/renderer/componentes/Inspector.tsx # (mod) usa Galeria
src/shared/frases.ts                # Frase, fidelidad, elegir, tamaño, html de la tarjeta
src/main/entregas/frases.ts         # prompt, sacarFrases, leer/guardar, cuadro del momento, PNG
src/main/ipc.ts, src/preload/index.ts, src/shared/api.ts  # (mod) canales entregas:frases*
src/renderer/componentes/FrasesPublicar.tsx  # tarjeta en Entregas
src/renderer/componentes/Entregas.tsx  # (mod) incluye FrasesPublicar
tests/fixtures/claude/respuesta-frases.json, falso-claude.mjs (mod)
```

---

### Task 1: Animaciones como datos y motor de 8 estilos de subtítulo

**Files:**
- Create: `src/shared/reel/pasos.ts`, `src/shared/reel/presets-sub.ts`, `src/shared/reel/motor-sub.ts`
- Modify: `src/shared/tipos.ts:82`, `src/shared/reel/estilos-sub.ts`, `src/shared/reel/subtitulos.ts:8-11`, `src/shared/reel/composicion.ts:40-43`
- Test: `tests/shared/reel/estilos-sub.test.ts` (nuevo), `tests/shared/reel/motor-sub.test.ts` (nuevo)

**Interfaces:**
- Produces:
  - `type EstiloSub = "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon" | "viral" | "una" | "cajamarca" | "subrayado" | "dostonos" | "rebote" | "brillo" | "elegante"`
  - `interface PasoAnim { metodo: "set" | "to" | "from" | "fromTo"; sel: string; de?: Record<string, number | string | boolean>; a: Record<string, number | string | boolean>; t: number }` (`sel` sin comillas, p. ej. `#b0w1` o `#b0w1 .fondo`)
  - `aJs(p: PasoAnim): string` → `tl.<metodo>("<sel>", { k: v, … }[, { … }], <t>);` con claves sin comillas, cadenas con comillas dobles, números tal cual — el mismo formato que las cadenas actuales.
  - `pasosBloque(estilo: EstiloSub, b: Bloque, i: number, color: string): PasoAnim[]`; `animarBloque` queda como `pasosBloque(...).map(aJs)`.
  - `htmlBloque` y `cssEstilosSub(t)` mantienen su firma y suman los presets.
  - `type EstiloNuevo = Exclude<EstiloSub, "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon">` (en `presets-sub.ts`).
  - `interface PresetSub { mayusculas: boolean; contorno: "borde" | "sombra"; activa: "color" | "escala" | "caja" | "subrayado" | "rebote" | "brillo" | "ninguna"; colorActiva: "marca" | "amarillo"; palabras: 1 | 2 | 3; letras: number; peso: 800 | 900; escala: number }` y `PRESETS_SUB: Record<EstiloNuevo, PresetSub>`; `esPreset(e: EstiloSub): e is EstiloNuevo`.
  - `TAMANOS` de `composicion.ts` exportado (lo usa la galería).

- [ ] **Step 1: Prueba de guarda del legado (antes de tocar nada)**

En `tests/shared/reel/estilos-sub.test.ts`, con un `Bloque` fijo de 3 palabras (una `clave`, la primera con `desde` anterior al bloque) y color `#f5c542` y `#202020`:
```ts
test.each(["pop","caja","limpio","resaltado","karaoke","impacto","neon"] as const)("legado %s no cambia", (e) => {
  expect({ html: htmlBloque(e, bloque, 3), js: animarBloque(e, bloque, 3, color), css: cssEstilosSub(70) }).toMatchSnapshot();
});
```

- [ ] **Step 2: Correr y guardar el snapshot con el código actual**

Run: `npx vitest run --project unit tests/shared/reel/estilos-sub.test.ts`
Expected: PASS, crea `__snapshots__/estilos-sub.test.ts.snap`. Commit del snapshot solo:
```bash
git add tests/shared/reel/estilos-sub.test.ts tests/shared/reel/__snapshots__/estilos-sub.test.ts.snap
git commit -m "test: guardar la salida actual de los estilos de subtítulo"
```

- [ ] **Step 3: Pruebas del motor (fallan)**

En `tests/shared/reel/motor-sub.test.ts`:
- `aJs({ metodo: "fromTo", sel: "#b0", de: { opacity: 0, scale: 0.65 }, a: { opacity: 1, ease: "power3.out", immediateRender: false }, t: 1.5 })` es `tl.fromTo("#b0", { opacity: 0, scale: 0.65 }, { opacity: 1, ease: "power3.out", immediateRender: false }, 1.5);`
- Para cada id de `PRESETS_SUB`: `htmlBloque` da un `<span id="b3wN" class="w…">` por palabra; `pasosBloque` no está vacío y todo `sel` empieza con `#b3`; `cssEstilosSub(70)` contiene `.sub.<id>`.
- `una`: `bloquesSubtitulos` con ese estilo nunca arma bloques de más de 1 palabra; `viral`: ≤ 3 palabras y ≤ 18 letras.
- `viral` usa `#FFE14D` en los pasos; `cajamarca` usa el color de la marca y texto `#111111` si la marca es clara (`esClaro`).
- `elegante`: el texto no va en mayúsculas.
- `dostonos` y `brillo`: solo las palabras `clave` tienen pasos propios.
- Regla del versículo: con una ventana de versículo encima, ningún bloque del estilo `rebote` empieza dentro de ella.

- [ ] **Step 4: Correr — debe fallar**

Run: `npx vitest run --project unit tests/shared/reel/motor-sub.test.ts`
Expected: FAIL (`aJs` / `PRESETS_SUB` no existen).

- [ ] **Step 5: Implementar**

- `pasos.ts`: `PasoAnim` y `aJs`.
- `estilos-sub.ts`: reescribir la animación de los 7 estilos como `pasosBloque` (mismos valores, mismo orden); `animarBloque = (…) => pasosBloque(…).map(aJs)`; los ids nuevos se despachan al motor. `NOMBRE_ESTILO` suma: viral «Viral», una «Una palabra», cajamarca «Caja de marca», subrayado «Subrayado», dostonos «Dos tonos», rebote «Rebote», brillo «Brillo», elegante «Elegante».
- `presets-sub.ts` con estos valores:

| id | may. | contorno | activa | color | pal. | letras | peso | escala |
|---|---|---|---|---|---|---|---|---|
| viral | sí | borde | escala | amarillo | 3 | 18 | 900 | 1 |
| una | sí | borde | rebote | marca | 1 | 14 | 900 | 1.6 |
| cajamarca | sí | borde | caja | marca | 3 | 16 | 900 | 1 |
| subrayado | sí | sombra | subrayado | marca | 3 | 18 | 800 | 1 |
| dostonos | sí | borde | ninguna | marca | 3 | 18 | 900 | 1 |
| rebote | sí | borde | rebote | marca | 2 | 14 | 900 | 1.1 |
| brillo | sí | sombra | brillo | marca | 3 | 18 | 800 | 1 |
| elegante | no | sombra | color | marca | 3 | 24 | 800 | 0.9 |

- `motor-sub.ts`: `htmlPreset`, `pasosPreset`, `cssPreset(id, t)`. Entrada del bloque: `from { opacity: 0, y: 16, duration: 0.12 }`. Por `activa`, en `w.desde` y hasta `w.hasta + 0.05`:
  - `color`: `set` del color y vuelta a blanco (la `clave` queda en el color de la marca).
  - `escala`: `fromTo` scale 1.15 + color, `duration 0.18`, `power2.out`.
  - `caja`: como `caja` del legado.
  - `subrayado`: un `<i class="barra">` por palabra; `scaleX 0→1` en 0.15 s y `opacity 0` al terminar.
  - `rebote`: `fromTo { y: 40, scale: 0.6, opacity: 0 } → { y: 0, scale: 1, opacity: 1, duration: 0.22, ease: "back.out(2.2)" }`.
  - `brillo`: solo `clave`, `textShadow` con el color de la marca.
  - `ninguna`: sin pasos por palabra.
  La `clave` va 1.25 em en `dostonos` y `brillo`. Borde: `-webkit-text-stroke` 0.17 × tamaño `#0b0b0b` con `paint-order: stroke fill`; sombra: `0 4px 18px rgba(0,0,0,.7)`. La fuente no se fija en el preset (usa la de `.sub`).
- `subtitulos.ts`: `LIMITES` de los presets salen de `PRESETS_SUB`.
- `composicion.ts`: `TAMANOS` exportado; presets = `POP` × `escala`.

- [ ] **Step 6: Correr todo**

Run: `npx vitest run --project unit tests/shared/reel`
Expected: PASS, incluido el snapshot del Step 2 sin cambios y `composicion.test.ts`, `versiculo-reel.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/reel/pasos.ts src/shared/reel/presets-sub.ts src/shared/reel/motor-sub.ts src/shared/reel/estilos-sub.ts src/shared/reel/subtitulos.ts src/shared/reel/composicion.ts src/shared/tipos.ts tests/shared/reel/motor-sub.test.ts
git commit -m "feat: 8 estilos de subtítulo virales con un motor de presets"
```

---

### Task 2: Gancho con 5 estilos

**Files:**
- Create: `src/shared/reel/gancho.ts`
- Modify: `src/shared/tipos.ts` (ClipSpec), `src/shared/reel/encuadre.ts:55-80`, `src/shared/reel/composicion.ts:49,125-136,193`, `src/shared/reel/estilos.css.ts:19-22`
- Test: `tests/shared/reel/gancho.test.ts` (nuevo), `tests/shared/reel/composicion.test.ts`

**Interfaces:**
- Consumes: `PasoAnim`, `aJs` (Task 1).
- Produces:
  - `type EstiloGancho = "tarjeta" | "gigante" | "marca" | "subrayado" | "golpe"`; `ESTILOS_GANCHO: EstiloGancho[]`; `NOMBRE_GANCHO: Record<EstiloGancho, string>` («Tarjeta», «Gigante», «Franja de marca», «Subrayado», «Golpe»).
  - `ClipSpec.estiloGancho?: EstiloGancho`.
  - `palabraEnColor(gancho: string, claves: string[]): number` → índice de la primera palabra del gancho que esté en `claves` (normalizada sin tildes); si ninguna, la más larga (empate: la primera).
  - `htmlGancho(estilo: EstiloGancho, texto: string, iColor: number): string` (interior del `#gancho`; palabras con id `g<j>`).
  - `pasosGancho(estilo: EstiloGancho, palabras: number, dur: number): PasoAnim[]` (con `tarjeta` devuelve exactamente los 2 pasos de hoy).
  - `cssGancho(formato: Formato, ancho: number): string`.
  - `MEDIO_GANCHO_ESTILO: Record<EstiloGancho, Record<Formato, number>>` (tarjeta = la tabla de hoy 0.055/0.075/0.095; gigante y golpe 0.09/0.11/0.13; marca 0.07/0.09/0.11; subrayado 0.075/0.095/0.115).
  - `ALTO_GANCHO_PX: Record<EstiloGancho, number>` (tarjeta 200, gigante 400, marca 260, subrayado 300, golpe 400).
  - `posicionGancho(cara, formato, medio = MEDIO_GANCHO[formato])`.

- [ ] **Step 1: Pruebas (fallan)**

En `gancho.test.ts`:
- `palabraEnColor("Tu prueba no es el final", ["prueba"])` → 1; `palabraEnColor("Dios no ha terminado contigo", [])` → 3; con tildes: `("Él está aquí", ["esta"])` → 1.
- Para cada estilo: `htmlGancho` escapa `<b>&"` y da tantos `g<j>` como palabras; la palabra `iColor` lleva la clase `color`.
- `pasosGancho("tarjeta", 5, 4.5).map(aJs)` es igual a las 2 líneas de `composicion.ts:134-135` con `dur = 4.5`.
- Gigante: el CSS fija 120 px en 9:16, 104 px en 4:5 y 92 px en 1:1.

En `composicion.test.ts`:
- Un clip sin `estiloGancho` produce el mismo `html` que `estiloGancho: "tarjeta"`, y su `#gancho` tiene la clase `gancho` y el `<i>` de hoy (guarda de la Review Focus 1: snapshot del `html` 9:16 tomado antes de cambiar `composicion.ts`).
- Review Focus 2: gancho de 60 caracteres `gigante` en 1:1 → el `top` del `#gancho` + `ALTO_GANCHO_PX.gigante / 2` es menor que el `top` del primer `.sub`, y el CSS lleva `max-width` ≤ ancho − 120.
- `golpe` agrega el efecto «pop» igual que hoy.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/shared/reel/gancho.test.ts tests/shared/reel/composicion.test.ts`
Expected: FAIL (módulo `gancho` no existe).

- [ ] **Step 3: Implementar**

- `gancho.ts` con lo de arriba. CSS por estilo:
  - `tarjeta`: el de hoy, movido desde `estilos.css.ts`.
  - `gigante`: mayúsculas 900, borde negro, `.color` en `var(--marca)`.
  - `marca`: franja `var(--marca)` a lo ancho con texto blanco (oscuro si `esClaro`).
  - `subrayado`: `<i class="barra">` bajo la palabra en color que crece en 0.3 s.
  - `golpe`: cada `g<j>` entra con `fromTo { scale: 1.6, opacity: 0 } → { scale: 1, opacity: 1, duration: 0.18, ease: "back.out(2)" }` cada 0.12 s y un `x` de ±6 px en 0.08 s.
  Todos salen con `opacity 0` en 0.3 s al final de `dur`.
- `composicion.ts`: usa `c.estiloGancho ?? "tarjeta"`, el medio alto y `ALTO_GANCHO_PX` del estilo. Las palabras clave para el color salen de `c.palabrasClave`.

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/shared/reel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/reel/gancho.ts src/shared/reel/encuadre.ts src/shared/reel/composicion.ts src/shared/reel/estilos.css.ts src/shared/tipos.ts tests/shared/reel/gancho.test.ts tests/shared/reel/composicion.test.ts tests/shared/reel/__snapshots__
git commit -m "feat: gancho grande con 5 estilos"
```

---

### Task 3: Plantilla de la iglesia y pedidos a Claude con los estilos nuevos

**Files:**
- Modify: `src/shared/tipos.ts:99-114`, `src/shared/clip.ts:55-128`, `src/main/claude/cambios.ts:34,92-93,128,142-148`
- Test: `tests/shared/clip.test.ts`, `tests/main/claude/cambios.test.ts`

**Interfaces:**
- Consumes: `EstiloGancho`, `ESTILOS_GANCHO` (Task 2).
- Produces: `EstiloIglesia.gancho?: EstiloGancho`; `estiloDesdeClip` copia `c.estiloGancho` si existe; `aplicarEstiloAClip` pone `estiloGancho: e.gancho` si existe; `delEstiloParaClipNuevo` incluye `estiloGancho`. `cambios.ts` acepta `estilo_gancho` (uno de `ESTILOS_GANCHO`, sin tildes ni mayúsculas).

- [ ] **Step 1: Pruebas (fallan)**

- `clip.test.ts`: guardar el estilo de un clip con `estiloGancho: "gigante"` y `subtitulos.estilo: "viral"` y aplicarlo a otro → ambos llegan. Aplicar a un `estado: "exportado"` mediante `aplicarEstilo` no lo toca (ya existe; extender con el campo). Un `EstiloIglesia` sin `gancho` no agrega `estiloGancho` al clip.
- `cambios.test.ts`: respuesta con `"estilo_gancho":"Gigante"` → `estiloGancho: "gigante"`; con `"estilo_gancho":"inventado"` → el clip no cambia ese campo y aparece el aviso «Ese estilo de gancho no existe». `"estilo_subtitulos":"viral"` se acepta.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/shared/clip.test.ts tests/main/claude/cambios.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** según las Interfaces; en el prompt de cambios, sumar `"estilo_gancho"` al ejemplo y la línea `"estilo_gancho": uno de ${ESTILOS_GANCHO.join(", ")}.`; mandar `estilo_gancho: c.estiloGancho ?? "tarjeta"` en el estado del clip.

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/shared tests/main/claude`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/tipos.ts src/shared/clip.ts src/main/claude/cambios.ts tests/shared/clip.test.ts tests/main/claude/cambios.test.ts
git commit -m "feat: la plantilla de la iglesia y Claude conocen los estilos nuevos"
```

---

### Task 4: Galería de estilos en el Inspector

**Files:**
- Create: `src/renderer/componentes/Galeria.tsx`
- Modify: `src/renderer/componentes/Inspector.tsx:5-7,82-94,148-153`, `src/renderer/estilos/pantallas.css`
- Test: `tests/renderer/Galeria.test.tsx` (nuevo), `tests/renderer/Inspector.test.tsx`

**Interfaces:**
- Consumes: `htmlBloque`, `pasosBloque`, `cssEstilosSub`, `TAMANOS` (Task 1); `htmlGancho`, `pasosGancho`, `cssGancho`, `NOMBRE_GANCHO` (Task 2).
- Produces: `Galeria<T extends string>({ etiqueta, opciones: [T, string][], valor: T, alCambiar(v: T): void, muestra(id: T): { html: string; css: string; pasos: PasoAnim[]; dur: number } })` — un `role="radiogroup"` con un `role="radio"` por opción (`aria-checked`, flechas para moverse).
  - `muestraSub(estilo: EstiloSub, color: string): …`: bloque fijo «TU PRUEBA NO ES EL FINAL» con «PRUEBA» como clave, 0.3 s por palabra.
  - `muestraGancho(estilo: EstiloGancho, color: string): …`: «Tu prueba no es el final», `dur 2.4`.

- [ ] **Step 1: Pruebas (fallan)**

En `Galeria.test.tsx`:
- Con las 15 opciones de subtítulo hay 15 radios y el del valor tiene `aria-checked="true"`.
- Clic en «Viral» llama `alCambiar("viral")`.
- Flecha derecha mueve el foco y elige el siguiente.
- Con `matchMedia("(prefers-reduced-motion: reduce)")` en `true` no se crea ninguna línea de tiempo (espía de `gsap.timeline`), y cada muestra muestra la palabra clave con su clase `clave`.
- Sin reducción: una línea de tiempo por muestra con `repeat: -1`, y se mata (`kill`) al desmontar.

En `Inspector.test.tsx`:
- La pestaña Estilo muestra la galería de subtítulos.
- La pestaña Clip muestra «Estilo del gancho» con 5 opciones, y elegir «Gigante» llama `alCambiar` con `estiloGancho: "gigante"`.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/renderer/Galeria.test.tsx tests/renderer/Inspector.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Cada muestra es un escenario de 240×140 escalado (el bloque de 1080 px de ancho con `transform: scale`), con el CSS de la muestra dentro de un `<style>` del escenario y los selectores `#…` resueltos con `raiz.querySelector`. Se usa `gsap` importado (nada de `eval`). El color es el de la marca, que el `Editor` ya pasa al Inspector (sumar la prop `colorMarca: string`).

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/renderer`
Expected: PASS.

- [ ] **Step 5: Verificar en la app**

Run: `npm run dev`. En un clip, abrir Estilo y luego Clip. Las muestras se animan, elegir una cambia la vista previa y con el teclado se recorre la grilla. Captura de pantalla para el informe.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/componentes/Galeria.tsx src/renderer/componentes/Inspector.tsx src/renderer/pantallas/Editor.tsx src/renderer/estilos/pantallas.css tests/renderer/Galeria.test.tsx tests/renderer/Inspector.test.tsx
git commit -m "feat: galería animada para elegir subtítulos y gancho"
```

---

### Task 5: Frases — fidelidad, selección y tarjeta (funciones puras)

**Files:**
- Create: `src/shared/frases.ts`
- Test: `tests/shared/frases.test.ts`

**Interfaces:**
- Consumes: `Palabra` (`src/shared/reel/tiempo.ts`: `{ t, s, e }`), `Marca`.
- Produces:
  - `type FondoFrase = "marca" | "momento" | "pintura"`.
  - `interface Frase { texto: string; en: number; original: string; fondo: FondoFrase; pintura?: string; versiculo?: { ref: string; texto: string; confirmado: boolean } }`.
  - `interface Candidata { texto: string; en: string; versiculo?: { ref: string; texto: string } }`.
  - `normalizarPalabras(s: string): string[]` (sin tildes, minúsculas, sin puntuación, conserva ñ).
  - `coincidencia(frase: string, palabras: Palabra[], en: number): number` (0–1): mejor proporción de palabras de la frase que aparecen **en orden** (LCS) en alguna ventana de la transcripción de largo n a n+3 palabras, con inicio entre `en − 60` y `en + 60` s.
  - `elegirFrases(candidatas: Candidata[], palabras: Palabra[], rango: { inicio: number; fin: number }): Frase[]`: descarta `en` que no se pueda leer (formato H:MM:SS o M:SS) o fuera de `rango`, textos con menos de 6 o más de 25 palabras y coincidencia < 0.9. Toma en el orden de Claude, salta las repetidas (palabras en común / palabras de la más corta > 0.6), corta en 7 y ordena por `en`. `original = texto`, `fondo = "marca"`, versículo con `confirmado: false`.
  - `fiel(f: Frase): boolean` → `coincidencia de f.texto con f.original ≥ 0.9` (sobre las palabras de `original`).
  - `tamanoFrase(texto: string): number` → `round(96 − (palabras − 8) × 40/17)` acotado a [56, 96].
  - `htmlTarjetaFrase(d: { frase: Frase; marca: Marca; predicador?: string; claves: string[]; fondo: { tipo: FondoFrase; src?: string; pintura?: string }; fuentes: string }): string`: documento completo de 1080×1350, sin scripts.

- [ ] **Step 1: Pruebas (fallan)**

Con `tests/fixtures/transcripcion-muestra.json` (`palabrasDe`):
- Una frase copiada de la muestra con `en` exacto → `coincidencia` 1.
- La misma sin tildes y en mayúsculas → 1.
- Con una palabra cambiada en 12 → < 0.95 y ≥ 0.9.
- Inventada → < 0.5.
- La correcta con `en` corrido 120 s → < 0.9.
- `elegirFrases`:
  - con 10 candidatas (2 inventadas, 1 repetida, 1 con `en: "abc"`, 1 de 3 palabras, 1 fuera de rango) → 4 frases, ordenadas por `en`.
  - con 12 válidas → 7.
  - con todas inválidas → `[]`.
- `tamanoFrase` con 6 palabras → 96, 25 → 56, 16 → 77.
- Review Focus 5: `htmlTarjetaFrase` con `Dijo "ven" <ahora> & ya` (repetido hasta 25 palabras) → contiene `&quot;ven&quot; &lt;ahora&gt; &amp;`, `font-size: 56px` y ningún `<script`.
- Versículo sin confirmar → no aparece en el HTML; confirmado → aparece con «RVR1960».
- `fiel` es falso tras cambiar 3 de 10 palabras.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/shared/frases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar** según las Interfaces. La tarjeta lleva:
- Comillas grandes en `var(--marca)`.
- La palabra clave (primera de `claves` presente) en color.
- Predicador si existe.
- Abajo logo y/o nombre según `marca.marcaReel`.
- Fondos: «marca» = degradado de `marca.color` a `#0b0d14`; «momento» = `src` con `filter: blur(6px) brightness(.45)`; «pintura» = la imagen del banco con velo `rgba(0,0,0,.5)`.

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/shared/frases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/frases.ts tests/shared/frases.test.ts
git commit -m "feat: elegir frases fieles de la prédica y su tarjeta"
```

---

### Task 6: Frases — consulta a Claude, archivos e imágenes (proceso principal)

**Files:**
- Create: `src/main/entregas/frases.ts`, `tests/fixtures/claude/respuesta-frases.json`
- Modify: `tests/fixtures/claude/falso-claude.mjs`, `src/main/ipc.ts:145-150`, `src/preload/index.ts`, `src/shared/api.ts:62-66`
- Test: `tests/main/entregas/frases.test.ts`

**Interfaces:**
- Consumes: `elegirFrases`, `htmlTarjetaFrase`, `Frase` (Task 5); `preguntar`, `extraerJson`, `partirComando`, `ERROR_SESION`, `ERROR_SIN_CLAUDE` (`src/main/claude/analizar.ts`); `leerJson`/`guardarJson`, `leerProyecto`, `leerMarca`, `leerTranscripcion` (`almacen.ts`); `baseEntregas`, `carpetaEntregas`, `validarIdProyecto` (`entregas.ts`); `PINTURAS`, `esPintura` (`pinturas.ts`).
- Produces:
  - `promptFrases(lineas: string): string`, que empieza con `FRASES DE LA PRÉDICA.` (marcador del Claude falso).
  - `sacarFrases(proyectoId: string, o?: { comando?: string; senal?: AbortSignal }): Promise<{ frases: Frase[]; aviso?: string }>`: guarda `frases.json` y devuelve `aviso: "Claude encontró N frases textuales."` si N < 7.
  - `cancelarFrases(proyectoId: string): boolean`.
  - `leerFrases(proyectoId: string): Promise<Frase[]>` (`[]` si no hay archivo).
  - `guardarFrases(proyectoId: string, frases: Frase[]): Promise<void>`.
  - `guardarImagenesFrases(proyectoId: string, pintar?: (html: string) => Promise<Buffer>): Promise<{ archivos: string[]; avisos: string[] }>`: escribe `exportados/frases/<base>-frase-<n>.png` y `exportados/<base>-frases.txt`.
  - `pintarPng(html: string): Promise<Buffer>`: `BrowserWindow({ show: false, width: 1080, height: 1350, useContentSize: true, webPreferences: { javascript: false, sandbox: true, offscreen: true } })` → `loadFile` de un HTML temporal → `capturePage()` → `toPNG()`.
  - `cuadroDelMomento(video: string, t: number, destino: string): Promise<boolean>`: `ffmpeg -v error -y -ss <t> -i <video> -frames:v 1 -vf scale=1080:-2 -q:v 3 <destino>`, con `execFile` sin shell.
  - IPC: `entregas:frases` (sacar), `entregas:cancelarFrases`, `entregas:leerFrases`, `entregas:guardarFrases`, `entregas:imagenesFrases`; todos validan el id. `ApiReels` suma `sacarFrases`, `cancelarFrases`, `leerFrases`, `guardarFrases`, `guardarImagenesFrases` con esas firmas (sin `proyectoId` interno).

- [ ] **Step 1: Respuesta falsa y pruebas (fallan)**

`respuesta-frases.json`: 10 candidatas sobre `transcripcion-muestra.json`:
- 6 textuales,
- 1 textual con versículo,
- 2 inventadas,
- 1 con `en: "sin hora"`.

`falso-claude.mjs`: si la entrada incluye `FRASES DE LA PRÉDICA`, responde ese archivo; con `FALSO_CLAUDE_MODO=frases-invalido-luego-ok`, la primera respuesta es texto sin JSON.

`tests/main/entregas/frases.test.ts` (patrón de `traducir.test.ts`):
- `sacarFrases` → 7 válidas = 6 + la del versículo; `aviso` ausente; `frases.json` escrito; el versículo `confirmado: false`.
- Modo `frases-invalido-luego-ok` → 2 llamadas (contador) y resultado bueno.
- Sin transcripción → «Primero hay que transcribir la prédica».
- Respuesta con todas inválidas → «Claude no encontró frases textuales. Prueba de nuevo.»
- Dos `sacarFrases` a la vez → la segunda falla con «Ya se están sacando las frases de esta prédica.».
- `cancelarFrases` → «Se canceló.».
- `guardarImagenesFrases` con un `pintar` falso que devuelve un `Buffer` de 1 byte:
  - escribe 7 PNG y el `.txt`, con líneas `«…» — 12:34` y el predicador;
  - el versículo sin confirmar no está en el `.txt`;
  - Review Focus 4: con el video del proyecto inexistente y una frase con `fondo: "momento"` → esa imagen se pinta con fondo «marca» y `avisos` incluye «La foto del momento no está disponible: el video original no se encuentra.».
- `validarIdProyecto` rechaza `../x`.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/main/entregas/frases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

El prompt manda la transcripción corregida en líneas `[H:MM:SS] texto` (la misma forma que usa el análisis; reutilizar su función de líneas si existe en `prompt.ts`, si no, una local). Pide 10 candidatas con la forma de la spec, palabra por palabra, sin saludos, avisos, ofrendas ni oraciones largas, e indica «nunca agregues versículos que el predicador no citó». El reintento sigue el patrón de `traducir.ts` (`consultar` + aviso antes de la transcripción). El cancelado sigue `enCurso`/`AbortController`. Las imágenes se pintan una por una; el cuadro del momento va a `tmp/` del proyecto y se borra al terminar.

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/main`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/entregas/frases.ts src/main/ipc.ts src/preload/index.ts src/shared/api.ts tests/main/entregas/frases.test.ts tests/fixtures/claude/respuesta-frases.json tests/fixtures/claude/falso-claude.mjs
git commit -m "feat: sacar 7 frases de la prédica con Claude y pintarlas en PNG"
```

---

### Task 7: «Frases para publicar» en la pestaña Entregas

**Files:**
- Create: `src/renderer/componentes/FrasesPublicar.tsx`
- Modify: `src/renderer/componentes/Entregas.tsx`, `src/renderer/estilos/pantallas.css`, y el que abre la transcripción en un minuto (pasar `alIrA?(t: number)` desde `Editor.tsx`)
- Test: `tests/renderer/FrasesPublicar.test.tsx`

**Interfaces:**
- Consumes: `ApiReels` de Task 6; `fiel`, `Frase` (Task 5); `useAccion`, `Resultado`, `limpiarError`, `Segmentos` (existentes); `PINTURAS`.
- Produces: `FrasesPublicar({ proyectoId, alIrA }: { proyectoId: string; alIrA?(t: number): void })`.

- [ ] **Step 1: Pruebas (fallan)**

Con `window.reels` simulado:
- Al montar llama `leerFrases` y muestra las guardadas.
- «Sacar 7 frases» muestra «Buscando frases…», deshabilita el botón y luego lista las frases con su minuto (`formatoTiempo`).
- Si el aviso existe, se muestra.
- «Copiar» llama `navigator.clipboard.writeText` con el texto.
- «Ir al momento» llama `alIrA(en)`.
- «Quitar» y cambiar el fondo llaman `guardarFrases` con la lista nueva.
- «Foto del momento» deshabilitada si el proyecto marca video no encontrado.
- Editar el texto a algo no fiel muestra «Ya no es lo que dijo el predicador».
- «Guardar imágenes» muestra «Listo: 7 imágenes en exportados/frases» y los avisos.
- Un error de `sacarFrases` se muestra con `role="alert"` y botón «Reintentar»; «Cancelar» llama `cancelarFrases`.

- [ ] **Step 2: Correr — debe fallar**

Run: `npx vitest run --project unit tests/renderer/FrasesPublicar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar** la tarjeta con el estilo de las otras de `Entregas.tsx` (ícono `Quote` de Lucide). La edición se guarda con `guardarFrases` al salir del campo.

- [ ] **Step 4: Correr**

Run: `npx vitest run --project unit tests/renderer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/componentes/FrasesPublicar.tsx src/renderer/componentes/Entregas.tsx src/renderer/pantallas/Editor.tsx src/renderer/estilos/pantallas.css tests/renderer/FrasesPublicar.test.tsx
git commit -m "feat: frases para publicar en la pestaña Entregas"
```

---

### Task 8: Pruebas de render y de punta a punta

**Files:**
- Create: `tests/integracion/plan8.test.ts`, `tests/e2e/plan8.spec.ts`

**Interfaces:**
- Consumes: todo lo anterior; el patrón de `tests/integracion/plan7.test.ts` (render real con HyperFrames) y de `tests/e2e/plan6.spec.ts` (app empaquetada con Claude falso).

- [ ] **Step 1: Escribir las pruebas**

- `plan8.test.ts`: renderiza 2 s de un clip de la muestra por cada estilo nuevo de subtítulo (8) y de gancho (4 nuevos) en 9:16, y el gancho `gigante` en 1:1.
  - Cada MP4 existe y dura 2 s ± 0.1.
  - Del cuadro del segundo 1, el área del gancho no es negro puro: el gancho se pintó.
- `plan8.spec.ts`: abre la prédica de prueba, va a Entregas, saca frases (Claude falso), guarda imágenes y verifica:
  - hay 7 archivos en `exportados/frases`;
  - cada PNG mide 1080×1350 (leer el encabezado IHDR) y pesa más de 10 KB;
  - en el Inspector, elegir «Viral» cambia la vista previa.

- [ ] **Step 2: Correr**

Run: `npm run test:integracion -- tests/integracion/plan8.test.ts` y `npm run e2e -- tests/e2e/plan8.spec.ts` (con la app cerrada).
Expected: PASS.

- [ ] **Step 3: Revisión completa**

Run: `npm run typecheck`, `npm test`.
Expected: sin errores y todas las pruebas en verde.

- [ ] **Step 4: Commit**

```bash
git add tests/integracion/plan8.test.ts tests/e2e/plan8.spec.ts
git commit -m "test: render de los estilos nuevos y frases de punta a punta"
```
