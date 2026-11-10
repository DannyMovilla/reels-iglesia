# Reels Iglesia — Plan 9: el rediseño en toda la app y los detalles pendientes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el diseño del editor de prédicas (riel de categorías, secciones plegables, acciones arriba) a Con IA y pulir Prédicas, Marca, Música y Exportados; arreglar los 9 detalles del plan 8 y los 4 del plan 7; armar un instalador nuevo.

**Architecture:** El riel y las secciones salen del Inspector a un componente común (`PanelCategorias.tsx`) que usan el editor de prédicas y el de Con IA. Las tareas que deben sobrevivir a que un componente se desmonte (buscar frases, traducir) viven en un almacén de módulo del renderer (`enCurso.ts`), no en el estado de React. Los detalles de composición (CSS de presets, gancho desconocido, logo y subtítulos) se arreglan en `src/shared/reel/` con pruebas puras.

**Tech Stack:** el del plan 8 (Electron 35, React 18, TypeScript, HyperFrames 0.9.17, GSAP 3.12.5, Vitest, Playwright, electron-builder).

**Spec:** `docs/superpowers/specs/2026-11-05-reels-iglesia-design.md`, sección 20 (diseño del editor en el commit 1555876).

## Global Constraints

- Toda la interfaz y los errores en español sencillo. Íconos Lucide; foco visible; las animaciones respetan `prefers-reduced-motion`.
- Nada nuevo para Claude ni para el análisis: los prompts no cambian.
- RVR1960: un versículo sin confirmar no se exporta (Con IA incluido).
- Clips, creaciones y marcas guardados antes abren y exportan igual.
- Los 7 estilos de subtítulo de siempre generan el mismo HTML y JS; su CSS vuelve a ser el de antes del plan 8 (Task 6).
- Solo variables de `tokens.css` en el CSS nuevo, para que funcione en tema oscuro y claro.
- No se agregan dependencias. Procesos hijos sin `shell: true`.
- Se trabaja en main (decisión de la persona). No se reconstruye `out/` ni `dist/` con la app abierta.
- Prueba rápida al terminar cada tarea; las completas al final (Task 11).

## Review Focus

1. Con IA: una creación sin referencia ni texto (Claude no escribió el versículo) → abre en «Versículo» con «Pedir a Claude otra vez» y «Exportar» apagado. Prueba en Task 3.
2. Volver a Entregas mientras se traduce y cancelar desde ahí → cancela la traducción en curso (no queda colgada una segunda). Prueba en Task 7.
3. Frase con 41 palabras o más → el aviso aparece y la imagen no se desborda: la letra no baja de 44 px y el texto se corta con «…» al pasar 40 palabras. Prueba en Task 4.
4. Marca con `marcaReel.tamano` 1.5 y logo en 1:1 con subtítulos grandes → el logo queda arriba del borde inferior y debajo de los subtítulos, nunca menos de 40 px. Prueba en Task 8.
5. Prédica cuyo video ya no está → la tarjeta de Prédicas muestra el fondo liso, sin un `<video>` roto. Prueba en Task 9.

---

## Estructura de archivos

```
src/renderer/enCurso.ts                     # almacén de tareas largas que sobreviven al desmontar
src/renderer/componentes/PanelCategorias.tsx # RielCategorias + Seccion + PanelCategorias (salen del Inspector)
src/renderer/componentes/Inspector.tsx      # (mod) usa PanelCategorias
src/renderer/componentes/EditorVersiculo.tsx # (mod) 5 categorías, Exportar arriba
src/renderer/componentes/FrasesPublicar.tsx # (mod) detalles B1–B5
src/shared/frases.ts                        # (mod) tamanoFrase hasta 40 palabras, MAX_PALABRAS
src/main/entregas/frases.ts                 # (mod) aviso en singular
src/renderer/componentes/Galeria.tsx        # (mod) cssFuente, palabra marcada quieta
src/shared/reel/estilos-sub.ts, estilos.css.ts, composicion.ts  # (mod) CSS solo del preset usado; gancho desconocido
src/renderer/componentes/Entregas.tsx       # (mod) traducción con enCurso
src/main/entregas/traducir.ts               # (mod) mensaje de cancelar con idiomas guardados
src/renderer/pantallas/Marca.tsx            # (mod) logo que falta; tarjetas; vista fija
src/shared/reel/composicion.ts              # (mod) htmlMarcaReel con alto máximo
src/renderer/pantallas/Predicas.tsx, Musica.tsx, Exportados.tsx  # (mod) pulido
src/renderer/estilos/pulido.css             # (mod) estilos de todo lo anterior
```

---

### Task 1: Almacén `enCurso` para tareas largas

**Files:**
- Create: `src/renderer/enCurso.ts`
- Test: `tests/renderer/enCurso.test.tsx`

**Interfaces:**
- Produces:
  - `lanzar<T>(clave: string, f: (alProgreso: (texto: string | null) => void) => Promise<T>): Promise<T>`: corre `f` una sola vez por clave (si ya hay una con esa clave, devuelve la misma promesa) y borra la entrada al terminar, bien o mal.
  - `enCurso<T>(clave: string): { promesa: Promise<T>; progreso: string | null } | undefined`
  - `alCambiar(clave: string, cb: (progreso: string | null) => void): () => void`: avisa cada cambio de progreso y una vez más (con `null`) al terminar.

- [ ] **Step 1: Escribir las pruebas**
  - `"lanzar dos veces con la misma clave corre f una sola vez"`: `f` cuenta llamadas; dos `lanzar("a", f)` → 1 llamada y la misma promesa.
  - `"enCurso guarda el último progreso y se borra al terminar"`: dentro de `f`, `alProgreso("parte 1")`; `enCurso("a")?.progreso === "parte 1"`; tras resolver, `enCurso("a") === undefined`.
  - `"alCambiar avisa el progreso y el final; también si f falla"`: un `f` que rechaza → el oyente recibe `null` y `enCurso` queda vacío.
- [ ] **Step 2:** `npx vitest run --project unit tests/renderer/enCurso.test.tsx` → FAIL (no existe el módulo).
- [ ] **Step 3:** Implementar con un `Map` de módulo `{ promesa, progreso, oyentes: Set }`.
- [ ] **Step 4:** La misma prueba → PASS.
- [ ] **Step 5:** `git commit -m "feat: almacén de tareas largas que sobreviven a cambiar de pestaña"`

### Task 2: El riel sale a `PanelCategorias.tsx`

**Files:**
- Create: `src/renderer/componentes/PanelCategorias.tsx`
- Modify: `src/renderer/componentes/Inspector.tsx` (quita `Seccion`, el riel y `mover`; los importa)
- Test: `tests/renderer/PanelCategorias.test.tsx` (las pruebas del Inspector ya cubren el comportamiento; se agrega una del componente solo)

**Interfaces:**
- Produces:
  - `interface CategoriaRiel<C extends string> { id: C; nombre: string; titulo: string; ayuda: string; Icono: LucideIcon; separado?: boolean; aviso?: string }` (`aviso`: texto de la descripción accesible y punto dorado).
  - `PanelCategorias<C extends string>(p: { etiqueta: string; categorias: CategoriaRiel<C>[]; actual: C; alElegir(c: C): void; cabeza?: ReactNode; children: ReactNode }): JSX.Element`: renderiza `.inspector` con el `tabpanel` (cabecera con `h2` = `titulo`, `cabeza` a la derecha, `ayuda` debajo; cuerpo `.inspector-cuerpo` con `children`) y el `tablist` vertical de nombre `etiqueta`, con las flechas arriba/abajo.
  - `Seccion` (misma firma de hoy) se exporta desde aquí; `Inspector.tsx` la reexporta para no romper imports.
- Las clases CSS no cambian (`.riel-categorias`, `.seccion`, …). Los `id` del panel y las pestañas llevan un prefijo único por instancia (`useId`) para que dos paneles no choquen.

- [ ] **Step 1:** Prueba `"PanelCategorias: el aviso se lee como descripción y pinta el punto"`: categorías `[{id:"a",…},{id:"b",…,aviso:"Falta confirmar"}]` → la pestaña «b» tiene descripción accesible «Falta confirmar» y un `.riel-punto`.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Mover el código del Inspector al componente; el Inspector pasa `aviso: faltaConfirmar ? "Falta confirmar el texto" : undefined` en «versiculo».
- [ ] **Step 4:** `npx vitest run --project unit tests/renderer/PanelCategorias.test.tsx tests/renderer/Inspector.test.tsx tests/renderer/Editor.test.tsx` → todo PASS.
- [ ] **Step 5:** commit `"refactor: el riel de categorías es un componente común"`.

### Task 3: Con IA con el riel y Exportar arriba

**Files:**
- Modify: `src/renderer/componentes/EditorVersiculo.tsx`, `src/renderer/estilos/pulido.css`
- Test: `tests/renderer/ConIA.test.tsx`, `tests/e2e/con-ia.spec.ts`

**Interfaces:**
- Consumes: `PanelCategorias`, `Seccion` (Task 2); el hueco `#barra-acciones` de `BarraTitulo` (ya existe; el editor de prédicas lo usa con `createPortal`).
- Categorías (`type CatIA = "texto" | "versiculo" | "fondo" | "audio" | "publicar"`), en este orden y con estos nombres: Texto (gancho, reflexión) · Versículo (aviso de Claude sin texto + «Pedir a Claude otra vez», referencia, texto RVR1960, confirmar) · Fondo (el selector `Fondo` y lo que depende de él) · Audio (`Música`, ánimo, efectos de sonido) · Publicar (separado; «Formatos a exportar» y `Publicar`).
- Al abrir: «versiculo» si `!c.versiculo.confirmado`, si no «texto». Aviso del riel en Versículo: `"Falta confirmar el texto"` mientras no esté confirmado.
- «Exportar» (mismo nombre accesible) y el aviso «Confirma el texto RVR1960 para poder exportar.» van al hueco de la barra; si no existe el hueco (pruebas sin `App`), quedan en `.ia-pie` como hoy. La cola de exportación sigue en `.ia-pie`.

- [ ] **Step 1:** Ajustar `ConIA.test.tsx`: el test del editor abre «Fondo» en vez de «Estilo» (`getByRole("tab", { name: "Fondo" })`); agregar `"Con IA abre en Versículo si falta confirmar y en Texto si ya está confirmado"` y `"el riel de Con IA tiene Texto, Versículo, Fondo, Audio y Publicar"`.
- [ ] **Step 2:** Correr `tests/renderer/ConIA.test.tsx` → FAIL.
- [ ] **Step 3:** Implementar. El panel `.ia-panel` pasa a ser el `PanelCategorias`; el CSS da a `.ia-panel .inspector` el alto completo.
- [ ] **Step 4:** PASS. En `con-ia.spec.ts`: `tab "Estilo"` → `tab "Publicar"` antes del checkbox «4:5».
- [ ] **Step 5:** commit `"feat: Con IA con el riel de categorías y Exportar en la barra de arriba"`.

### Task 4: Detalles de las frases (plan 8: B1–B5)

**Files:**
- Modify: `src/main/entregas/frases.ts:111`, `src/shared/frases.ts:116-120`, `src/renderer/componentes/FrasesPublicar.tsx`
- Test: `tests/shared/frases.test.ts`, `tests/renderer/FrasesPublicar.test.tsx`, `tests/main/entregas/frases.test.ts` (o donde esté la prueba de `sacarFrases`)

**Interfaces:**
- Consumes: `lanzar`, `enCurso`, `alCambiar` (Task 1) con la clave `` `frases:${proyectoId}` ``.
- Produces: `export const MAX_PALABRAS_FRASE = 25` y `export const TOPE_PALABRAS_IMAGEN = 40` en `src/shared/frases.ts`.

- [ ] **Step 1: Pruebas**
  - `frases.test.ts`: `tamanoFrase` igual que hoy hasta 25 palabras (96 → 56); con 40 palabras = 44; con 60 palabras = 44. `htmlTarjetaFrase` con 45 palabras muestra 40 palabras y «…».
  - Prueba de main: con 1 frase elegida, el aviso es exactamente `"Claude encontró 1 frase textual."`; con 3, `"Claude encontró 3 frases textuales."`.
  - `FrasesPublicar.test.tsx`:
    - `"Copiar avisa que se copió"`: tras el clic se ve `"Copiada"` (rol `status`).
    - `"una frase de más de 25 palabras avisa"`: escribir 26 palabras → `"Muy larga para la imagen (máximo 25 palabras)"`.
    - `"Guardar imágenes espera a que se guarde lo editado"`: `guardarFrases` resuelve tarde (promesa manual); editar, salir del campo, «Guardar imágenes» → `guardarImagenesFrases` se llama recién después de que `guardarFrases` resuelve.
    - `"al volver a Entregas mientras Claude busca, se sigue esperando y llegan las frases"`: `sacarFrases` con promesa manual; desmontar y volver a montar; se ve «Buscando frases…»; al resolver aparecen las frases.
- [ ] **Step 2:** Correr las tres → FAIL.
- [ ] **Step 3:** Implementar:
  - `tamanoFrase`: misma recta hasta 25 palabras, después baja lineal hasta 44 px en 40 palabras; tope 44.
  - La tarjeta corta en `TOPE_PALABRAS_IMAGEN` con «…».
  - `sacar` usa `lanzar`; al montar, si `enCurso` tiene la clave, `buscando = true` y espera esa promesa.
  - `guardar` guarda su promesa en un `useRef`; `pintar` la espera antes de llamar a `guardarImagenesFrases`.
  - «Copiar» muestra «Copiada» 1,8 s.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `"fix: detalles de las frases para publicar"`.

### Task 5: Galería con la fuente del clip y la palabra marcada al quedar quieta (plan 8: B6, B7)

**Files:**
- Modify: `src/renderer/componentes/Galeria.tsx`, `src/renderer/componentes/Inspector.tsx`, `src/renderer/pantallas/Editor.tsx`
- Test: `tests/renderer/Galeria.test.tsx`

**Interfaces:**
- Produces:
  - Prop nueva de `Galeria`: `cssFuente?: string` (CSS extra que se aísla igual que el de la muestra).
  - Prop nueva del `Inspector`: `urlFuenteIglesia?: string` (la del editor: `` `marca/${archivo}` `` como en `VistaPrevia`).
- El Inspector pasa `cssFuente={cssFuentesElegidas(c.fuentes, urlFuenteIglesia)}` a las dos galerías.

- [ ] **Step 1: Pruebas**
  - `"la galería usa la fuente elegida del clip"`: con `cssFuente` que pone Figtree en `.sub` → el `<style>` de cada muestra contiene `.muestra-lienzo .sub` y `Figtree`.
  - `"con movimiento reducido la muestra quieta marca la palabra dicha"`: con reducido, la línea de tiempo de GSAP se crea, se lleva al momento de la palabra clave (`desde` + 60 % del tramo de su bloque) y queda en pausa. Se comprueba con el espía de `gsap.timeline`: `seek` y `pause` llamados, y ningún `play`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. Con reducido se arma la misma línea de tiempo sin `repeat`, se hace `seek(t)` y se deja en pausa (ya no se usa `fija`).
- [ ] **Step 4:** PASS (también las pruebas de la galería que ya estaban).
- [ ] **Step 5:** commit `"fix: la galería usa la fuente del clip y marca la palabra al quedar quieta"`.

### Task 6: Composición: CSS solo del estilo usado y gancho desconocido (plan 8: B8, B9)

**Files:**
- Modify: `src/shared/reel/estilos-sub.ts:103`, `src/shared/reel/estilos.css.ts`, `src/shared/reel/composicion.ts:136`
- Test: `tests/shared/reel/composicion.test.ts`, snapshots en `tests/shared/reel/__snapshots__/`

**Interfaces:**
- Produces: `cssEstilosSub(t: number, estilo?: EstiloSub): string`. Sin `estilo` devuelve todo (la galería y las pruebas la usan así). Con un estilo de siempre, devuelve solo las reglas de siempre. Con un preset, devuelve las de siempre más las de ese preset.
- `cssComposicion` ya recibe `estiloSub`: se lo pasa.

- [ ] **Step 1: Pruebas**
  - `"un clip con Pop no lleva el CSS de los estilos nuevos"`: la composición de un clip `pop` no contiene `.sub.viral` ni `.sub.cajamarca`.
  - `"un clip con Viral lleva solo el CSS de Viral"`: contiene `.sub.viral` y no `.sub.rebote`.
  - `"un estiloGancho desconocido se trata como tarjeta"`: `estiloGancho: "raro" as EstiloGancho` → la composición no lanza y su HTML es igual al del mismo clip con `tarjeta`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. En composición: `ESTILOS_GANCHO.includes(c.estiloGancho) ? c.estiloGancho : "tarjeta"`.
- [ ] **Step 4:** PASS. Los snapshots de los estilos de siempre cambian solo en el CSS de los presets que se va: revisar el diff (solo líneas `.sub.<preset>` quitadas) y actualizar con `-u`. Ledger: `Ruling: snapshots actualizados — quitan solo el CSS de los presets`.
- [ ] **Step 5:** commit `"fix: la composición lleva solo el CSS del estilo usado y tolera un gancho desconocido"`.

### Task 7: Traducción que sobrevive a cambiar de pestaña y cancelar que dice qué quedó (plan 7: C1, C2)

**Files:**
- Modify: `src/renderer/componentes/Entregas.tsx`, `src/main/entregas/traducir.ts`
- Test: `tests/renderer/Entregas.test.tsx`, `tests/main/entregas/traducir.test.ts` (o donde esté)

**Interfaces:**
- Consumes: `lanzar`, `enCurso`, `alCambiar` (Task 1) con la clave `` `traducir:${proyectoId}` ``.
- Produces: el error al cancelar dice exactamente `"Se canceló la traducción."`, más `" Ya se guardó: inglés."` si quedó un idioma, o `" Ya se guardaron: inglés y portugués."` si fueron varios (nombres de `IDIOMAS`, unidos con comas e «y»).

- [ ] **Step 1: Pruebas**
  - Main: con `FALSO_CLAUDE_MODO=traduccion-lenta` y dos idiomas, después de que el primero se termina (se simula con `alProgreso` en la parte 1 del segundo), cancelar → el error es `"Se canceló la traducción. Ya se guardó: inglés."`. Si hace falta, usar un comando falso que responda al primer idioma y cuelgue al segundo.
  - Renderer: `"al volver a Entregas se ve el progreso y se puede cancelar"`: `traducirSrt` con promesa manual y `alProgresoEntregas` que emite «Traduciendo al inglés (parte 1 de 1)…»; desmontar y volver a montar → se ve el texto de progreso y «Cancelar»; el clic llama `cancelarTraduccion(proyectoId)`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar. En main, `traducir` recibe un arreglo `hechos: string[]` que va llenando, y `traducirSrt` lo usa en el mensaje al cancelar. En el renderer, `traducir` usa `lanzar`; el progreso se lee de `alCambiar` y `enCurso` al montar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `"fix: la traducción se ve al volver a Entregas y al cancelar dice qué quedó"`.

### Task 8: Logo que falta y logo que choca con los subtítulos (plan 7: C3, C4)

**Files:**
- Modify: `src/renderer/pantallas/Marca.tsx` (muestra de «Durante el reel» y la elección de logo), `src/shared/reel/composicion.ts:192, 232-242`, `src/shared/reel/versiculo-reel.ts:149`
- Test: `tests/renderer/Marca.test.tsx`, `tests/shared/reel/composicion.test.ts`

**Interfaces:**
- Produces: `htmlMarcaReel(marca: Marca, logoSrc: string | undefined, inicio: number, dur: number, altoMax?: number): string`. La altura del logo es `max(40, min(90 × escala, altoMax))` cuando hay `altoMax`. El texto se achica en la misma proporción.
- En `componerReel`, `altoMax = H − 70 − (topSub + altoSub / 2) − 16` si hay subtítulos activos y el formato no es 9:16. Si no, `undefined` (9:16 queda igual). En Con IA no se pasa.

- [ ] **Step 1: Pruebas**
  - `"en 1:1 con marca al 150 % el logo no baja de 40 px ni toca los subtítulos"`: la altura del `<img>` en el HTML de la marca es ≤ al espacio libre y ≥ 40.
  - `"en 9:16 la marca no cambia"`: el HTML es igual al de hoy.
  - Marca: `"si el archivo del logo no está, lo dice y la muestra usa el nombre"`: disparar `error` en el `<img>` de la muestra → se ve «No encuentro el archivo del logo: elige otro» y el nombre de la iglesia en la muestra.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar (`onError` → estado `logoRoto`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** commit `"fix: la marca avisa si falta el logo y no tapa los subtítulos en 4:5 y 1:1"`.

### Task 9: Prédicas con tarjetas de portada

**Files:**
- Modify: `src/renderer/pantallas/Predicas.tsx`, `src/renderer/estilos/pulido.css`
- Test: `tests/renderer/Predicas.test.tsx` (crear si no existe)

**Interfaces:**
- Cada tarjeta lleva:
  - Portada: `<video src={`${urlVideo(p.id)}#t=${inicio + 20}`} preload="metadata" muted>` con `inicio = p.rango.inicio`, en 16:9. Si el video da error, la portada queda con un fondo liso de `--bg-3` y un ícono.
  - Nombre, fecha, «Prédica de N min» (`Math.round((p.rango.fin − p.rango.inicio) / 60)`) y el estado de hoy.
  - Grilla `repeat(auto-fill, minmax(260px, 1fr))`.

- [ ] **Step 1:** Pruebas:
  - `"cada prédica muestra su duración"`: rango 600–3000 → «Prédica de 40 min».
  - `"sin video la portada queda lisa"`: disparar `error` en el `<video>` → el `<video>` desaparece y queda `.portada-vacia`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** commit `"feat: las prédicas se ven como tarjetas con portada y duración"`.

### Task 10: Marca, Música y Exportados pulidos

**Files:**
- Modify: `src/renderer/pantallas/Marca.tsx`, `src/renderer/pantallas/Musica.tsx`, `src/renderer/pantallas/Exportados.tsx`, `src/renderer/estilos/pulido.css`
- Test: `tests/renderer/Marca.test.tsx`, `tests/renderer/Musica.test.tsx`, `tests/renderer/Exportados.test.tsx` (crear si no existe)

**Interfaces:**
- Marca: tres `<section className="tarjeta-ajuste">` con `h2` «Tu iglesia» (nombre, invitación, color), «Logo y fuente» (logo, tamaño del logo, fuente) y «Durante el reel» (modo, tamaño, muestra). La vista previa del cierre usa `position: sticky; top: 24px`. Los campos, sus etiquetas y su orden dentro de cada tarjeta no cambian.
- Música:
  - Con pistas: un `<section>` por ánimo que tenga pistas, en el orden de `ANIMOS`, con `h2` `NOMBRE_ANIMO[a]` y «N pista(s)» (singular con 1).
  - Sin pistas: un estado vacío con el ícono `Music`, el texto de hoy y el botón «Agregar mis pistas».
- Exportados:
  - La cabecera de cada grupo dice «N reel(es)» (singular con 1).
  - Cada archivo muestra una etiqueta con el formato que sale de `/(9x16|4x5|1x1)/` en el nombre (`9x16` → «9:16»), y ninguna si el nombre no lo tiene.
  - `formatoDeArchivo(nombre: string): "9:16" | "4:5" | "1:1" | null` se exporta desde `Exportados.tsx`.

- [ ] **Step 1:** Pruebas:
  - Marca: `"los ajustes van en tres tarjetas"` (headings «Tu iglesia», «Logo y fuente», «Durante el reel»).
  - Música: `"las pistas se agrupan por ánimo con su cuenta"`. Dos pistas «paz» y una «victoria» dan los headings «Paz» y «Victoria», con «2 pistas» y «1 pista».
  - Exportados:
    - `formatoDeArchivo("juan-8-12-9x16.mp4") === "9:16"` y `formatoDeArchivo("notas.txt") === null`.
    - `"cada grupo dice cuántos reels tiene"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS (también las pruebas de Marca y Música que ya estaban).
- [ ] **Step 5:** commit `"feat: Marca, Música y Exportados con el diseño nuevo"`.

### Task 11: Instalador nuevo, pruebas completas y capturas

**Files:** ninguno nuevo. Solo si hace falta, `tests/e2e/instalado.spec.ts` (las categorías ya están).

- [ ] **Step 1:** Con la app cerrada: `npm run typecheck`. Debe salir sin errores.
- [ ] **Step 2:** Correr `npx vitest run --project unit` y `npx vitest run --project integracion`. Deben pasar todas.
- [ ] **Step 3:** Correr `npx electron-vite build`, después `npm run dist:carpeta` y luego `npx playwright test`. Deben pasar las 9, incluida «la app instalada…».
- [ ] **Step 4:** `npm run dist`: el instalador queda en `dist/` (anotar el nombre del `.exe` para la persona).
- [ ] **Step 5:** Capturas con el script de capturas, en tema oscuro y claro: Prédicas, Con IA (cada categoría), Marca, Música y Exportados. Revisarlas y arreglar lo que se vea mal antes de cerrar.
- [ ] **Step 6:** Revisión final de toda la rama con un revisor nuevo (modelo más capaz). Después, una sola pasada de arreglos.
- [ ] **Step 7:** commit de los arreglos; el push lo decide la persona.
