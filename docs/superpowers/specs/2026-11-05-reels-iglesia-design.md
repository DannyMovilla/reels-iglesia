# Reels Iglesia — Diseño (fase 1: prédicas)

Fecha: 2026-11-05 · Estado: borrador para revisión del usuario

## 1. Objetivo

Reels Iglesia es una app de escritorio para Windows que convierte la prédica de un culto grabado en
reels listos para publicar (Instagram, TikTok, Facebook, YouTube Shorts). La meta es llevar la palabra
de Dios a más personas con clips que se entiendan solos, sean fieles al mensaje y se vean
profesionales.

**Fase 1 (este documento):** clips de prédicas.
**Más adelante (fuera de alcance aquí):** canciones / alabanza y reels creados con IA. La navegación
ya reserva un lugar para ellos ("Pronto").

### Criterios de éxito

1. Con un culto de 1–3 h y la prédica marcada, la app entrega entre 4 y 10 clips sugeridos sin que el
   usuario escriba código ni comandos.
2. Cada clip exportado se reproduce sin cuadros trabados ni saltos de audio, con subtítulos en
   sincronía palabra por palabra.
3. El análisis usa la suscripción de Claude del usuario (sin API key de pago).
4. Exportar los clips de un culto puede quedar corriendo solo (cola), sin que la ventana tenga que
   estar visible.
5. El usuario puede corregir cualquier decisión de la IA (corte, gancho, encuadre, versículo) antes
   de exportar.

## 2. Lo que ya está probado

| Pieza | Evidencia |
|---|---|
| Transcripción local | `transcribir.py` con faster-whisper `large-v3-turbo` en la GTX 1650 Ti (CUDA 12, cuBLAS/cuDNN por pip): 54 s de audio en 6 s; respaldo automático a CPU (`small`). |
| Detección de caras | YuNet (OpenCV, `modelos/face_detection_yunet_2023mar.onnx`) a 2 cuadros/s: cara encontrada en 80/80 cuadros de una muestra del culto real; ~2 min por 48 min de video. |
| Elección de clips | Prompt probado en el artefacto `Púlpito Clips` (Claude vía capacidad `sample`). |
| Render | Prueba en `spike/`: HyperFrames 0.9.17 renderizó un reel de 40,6 s (1080×1920) en 72 s con `--gpu --workers 4`, sin cuadros duplicados fuera de la tarjeta final fija; audio con pico −3,8 dB. Formatos 4:5 y 1:1 verificados con capturas. |
| Diseño | Maqueta aprobada: `design/maqueta-editor.html` (+ `design/maqueta-editor.png`). |

## 3. Decisiones de arquitectura

| Decisión | Elegido | Por qué / alternativa descartada |
|---|---|---|
| Tipo de app | **Electron** (Windows) | Necesita FFmpeg, GPU, Python y archivos locales; el artefacto de navegador no puede y su render en tiempo real se trababa. |
| Interfaz | **React + TypeScript + Vite** (electron-vite), CSS con los tokens de la maqueta | Un solo lenguaje para la interfaz; la maqueta ya está en HTML/CSS. |
| Render de reels | **HyperFrames** (Apache 2.0), versión fijada | Render cuadro a cuadro determinista (no se traba), HTML + GSAP como la maqueta. Remotion descartado: licencia con verificación de organización sin fines de lucro y React como formato de video. |
| IA | **Claude Code en modo headless** (`claude -p --output-format json`) | Usa la suscripción del usuario. Requiere iniciar sesión una vez en el CLI (hoy el CLI de esta PC responde "Not logged in"). |
| Transcripción y caras | **Python** existente (`transcribir.py`) en un `.venv` propio de la app | Ya funciona con GPU; se reutiliza como proceso hijo. |
| Datos | Archivos JSON por proyecto en una carpeta del usuario | Simple, portable, fácil de respaldar; sin base de datos. |

### 3.1 Procesos

```
┌──────────────── Electron main (Node) ────────────────┐
│ Proyectos (lee/escribe JSON) · Cola de tareas        │
│  ├─ Python  ─ transcribir.py / caras  (proceso hijo) │
│  ├─ claude -p  ─ análisis de clips    (proceso hijo) │
│  └─ hyperframes render ─ exportar     (proceso hijo) │
└───────────────▲──────────────────────────────────────┘
                │ IPC tipado (contextBridge)
┌───────────────┴──── Renderer (React) ────────────────┐
│ Pantallas · vista previa en vivo (canvas/DOM + GSAP) │
│ Música generada (OfflineAudioContext → WAV)          │
└──────────────────────────────────────────────────────┘
```

- **Una sola cola** en el proceso principal ejecuta tareas largas (transcribir, caras, analizar,
  renderizar) de a una por tipo de recurso (GPU), con progreso por IPC. Las tareas sobreviven a cerrar
  el editor pero no a cerrar la app (se marcan "interrumpidas" y se pueden reintentar).
- Los procesos hijos reportan progreso con líneas JSON por stdout (`{"etapa":…, "pct":…}`); el
  script de Python se adapta a ese formato.
- El renderer nunca ejecuta procesos ni lee archivos directamente: todo pasa por un preload con una
  API mínima y tipada.

### 3.2 Composición del reel

El renderer y el exportador usan **la misma descripción del clip** (JSON) y el mismo constructor de
composición, para que la vista previa y el MP4 coincidan:

1. `ClipSpec` (datos) → `construirComposicion(ClipSpec, Marca, formato)` → HTML de HyperFrames.
2. Vista previa: el mismo HTML se carga en un `<iframe>` y la línea de tiempo GSAP se mueve con el
   cabezal (sin render).
3. Exportar: el HTML se escribe en una carpeta temporal y se llama a `hyperframes render`.

El constructor se escribe en TypeScript a partir de `spike/generar.py` (que queda como referencia).

## 4. Datos

### 4.1 Carpeta de proyectos

`Documentos/Reels Iglesia/` (configurable):

```
Reels Iglesia/
  marca.json                 # kit de marca global
  musica/                    # pistas propias del usuario
  proyectos/
    2026-11-02-culto-dominical/
      proyecto.json          # metadatos, ruta al video original, rango de la prédica, estado
      transcripcion.json     # formato pulpito-transcripcion/1 (segmentos + palabras)
      caras.json             # [[t, [[x, y, w, score], …]], …]
      clips.json             # ClipSpec[]
      exportados/            # MP4 finales: <slug>-9x16.mp4, -4x5, -1x1
      tmp/                   # composiciones y audio generados (se puede borrar)
```

El video original **no se copia**: se guarda su ruta, tamaño y fecha. Si se mueve, la app pide
ubicarlo de nuevo.

### 4.2 ClipSpec (campos principales)

```ts
interface ClipSpec {
  id: string; titulo: string; gancho: string; ganchosAlternativos: string[];
  categoria: "Enseñanza" | "Reflexión" | "Exhortación" | "Esperanza" | "Testimonio" | "Llamado";
  inicio: number; fin: number;                  // segundos del video original
  apertura: { activa: boolean; inicio: number; fin: number; frase: string } | null;
  palabrasClave: string[];
  versiculos: { ref: string; texto: string; en: number; activo: boolean }[]; // en = segundos dentro del clip
  puntaje: number; razon: string;
  descripcion: string; hashtags: string[];
  encuadre: { modo: "auto" | "fijo"; x: number; zoom: number };
  subtitulos: { activos: boolean; estilo: "pop" | "caja" | "limpio"; tamano: "s" | "m" | "l"; altura: number };
  musica: { pista: "auto" | "esperanza" | "reflexion" | "exhortacion" | string /* archivo */ | null; volumen: number };
  cierre: boolean;
  formatos: ("9:16" | "4:5" | "1:1")[];         // por defecto ["9:16", "4:5"]
  estado: "sugerido" | "editado" | "exportado";
}
```

### 4.3 Marca (`marca.json`)

Nombre de la iglesia, logo (PNG con y sin fondo, tamaño), color principal, texto de invitación
(p. ej. "Síguenos · Domingos 10:00 AM"), redes sociales, fuente de subtítulos.

## 5. Flujo del usuario

1. **Nuevo proyecto:** elegir el video (arrastrar o buscar) **o pegar el enlace** del culto
   (Facebook, YouTube…; plan 3): la app lo descarga con yt-dlp a la carpeta de datos, con progreso en
   pantalla y errores en español (enlace privado, sin internet). Solo videos que la iglesia puede usar.
   Se muestra un reproductor con la forma
   de onda; el usuario marca inicio y fin de la prédica (botones "Marcar aquí" + campos de tiempo).
2. **Procesar** (automático, en cola): transcribir → detectar caras → analizar con Claude. Cada paso
   muestra estado, tiempo y errores comprensibles (panel "Proceso" de la maqueta).
3. **Revisar** en el editor: lista de clips por puntaje, vista previa, inspector, línea de tiempo.
4. **Exportar:** por clip o "Exportar todos", en los formatos marcados. La cola sigue aunque se
   minimice la ventana. Al terminar: notificación de Windows y botón "Abrir carpeta".
5. **Publicar** (manual en fase 1): pestaña con texto, hashtags y versículos para copiar.

## 6. Pantallas

| Pantalla | Contenido |
|---|---|
| Prédicas (inicio) | Proyectos recientes con miniatura, estado y cantidad de clips; botón "Nueva prédica". |
| Nueva prédica | Selección de video, marcado del rango, resumen de lo que va a pasar y tiempo estimado. |
| Editor | Según la maqueta: proceso + clips (izq.), vista previa con 9:16/4:5/1:1 y zona segura (centro), inspector Clip/Estilo/Publicar (der.), línea de tiempo con video, efectos, subtítulos y música (abajo), cola de exportación. |
| Exportados | Todos los MP4 por proyecto, con reproducir y abrir carpeta. |
| Marca | Kit de marca con vista previa en vivo sobre un cuadro de ejemplo. |
| Ajustes | Carpeta de proyectos, estado de Claude (sesión iniciada / iniciar sesión), estado de GPU/CUDA, modelo de Whisper, calidad de exportación. |
| Primer uso | Asistente: verifica FFmpeg, Python/.venv, GPU, sesión de Claude; ofrece instalar lo que falte con un clic y explica cada paso. |

Diseño visual: tokens de la maqueta (azul noche, ámbar "luz" para acciones, turquesa para línea de
tiempo/IA, Geist + Geist Mono, Fraunces solo en la marca). Íconos Lucide. Contraste AA, foco visible,
navegación con teclado (espacio = reproducir, J/K/L, I/O = marcar inicio/fin, flechas = cuadro a
cuadro), respeta "reducir movimiento".

## 7. Reglas del reel

1. **Apertura en blanco y negro (opcional, activa por defecto si hay frase):** la frase más fuerte
   del clip (3–8 s, elegida por Claude y ubicada palabra por palabra) en B/N con viñeta, el gancho
   encima y un destello blanco de 0,3 s al pasar al clip a color.
2. **Gancho/título:** se ubica según la cara: si la cara está en la mitad superior, el gancho va a
   media pantalla; si no, arriba. Nunca sobre la cara ni en la zona segura de la plataforma.
3. **Subtítulos:** palabra por palabra, máx. 3 palabras / 16 caracteres por bloque (estilo Pop/Caja),
   palabras clave en el color de marca, la palabra dicha con un "pop" de escala. Altura ajustable,
   siempre fuera de la zona segura inferior.
4. **Regla del versículo:** cuando el clip tiene un versículo activo:
   - se muestra una tarjeta con la referencia y el texto, **debajo de la cara**, en el espacio de los
     subtítulos;
   - **mientras la tarjeta está visible no se muestran subtítulos**; un bloque de subtítulo que
     empiece antes se corta en el momento en que entra la tarjeta (si quedaría < 0,3 s, se omite);
   - duración de la tarjeta = tiempo de lectura (0,5 s + 0,3 s por palabra), entre 4 y 8 s;
   - texto bíblico: **Reina-Valera 1960** (la versión que usa la iglesia). Como tiene derechos de
     autor, la app no incluye la Biblia: Claude escribe el texto RVR1960 del versículo citado en el
     mismo análisis y la tarjeta queda **sin confirmar** hasta que la persona lo revisa o corrige en el
     editor. Un reel con un versículo activo sin confirmar no se exporta. La tarjeta muestra "RVR1960".
     (Decisión del 2026-11-06; el archivo es_rv1960.bib de la persona está cifrado y no se usa.)
5. **Encuadre:** sigue la cara del predicador (zona muerta, cortes secos en cambios de cámara),
   zoom 1,0–2,0 (por defecto 1,25), recalculado para cada formato.
6. **Cierre (opcional, activo por defecto):** 2,5 s con logo, nombre e invitación de la marca.
7. **Música:** generada según la categoría (o pista propia), entra fuerte en los primeros ~1,8 s,
   baja bajo la voz, sube un poco en pausas largas y se desvanece al final. Limitador para que nada
   pase de −1 dB.
   **Fuentes de música (decidido 2026-11-06, plan 3):**
   - *Banco de pistas libres:* la app trae decenas de pistas de dominio público (CC0) clasificadas por
     ánimo (reflexivo, esperanza, victoria, adoración, tensión…). Claude elige la pista según el mensaje
     del clip y evita repetir la misma en reels seguidos. La persona puede agregar pistas propias
     (Pixabay, biblioteca de YouTube…) a `musica/`; la app las etiqueta. Solo se incluyen en la app
     pistas CC0 (las de Pixabay no se pueden redistribuir dentro de una app).
   - *Pads de adoración generados en el PC:* fondos suaves (sintetizador/piano) en la tonalidad elegida,
     sin derechos ni repetición; respaldo cuando ninguna pista encaja.
   - Generación con IA (MusicGen u otros) queda fuera por ahora: licencia no comercial y calidad
     irregular en 4 GB de VRAM. Posible experimento opcional más adelante.
8. **Formatos:** 9:16 (1080×1920), 4:5 (1080×1350), 1:1 (1080×1080); H.264 con NVENC, ~10 Mb/s.

## 8. Claude (análisis)

- Se llama a `claude -p` con el prompt de selección de clips (el del artefacto, ampliado con
  `ganchosAlternativos` y `versiculos: [{ref, cita_textual_del_predicador}]`) y la transcripción con
  marcas de tiempo; salida JSON validada con un esquema (zod). Si no valida: un reintento con el error
  como contexto; si vuelve a fallar, se muestra el error y el botón "Reintentar".
- El prompt y el esquema viven en archivos versionados (`src/main/claude/`), con pruebas que validan
  respuestas de ejemplo guardadas.
- Antes del primer análisis, Ajustes/Primer uso verifican la sesión (`claude -p "ok"`); si responde
  "Not logged in", la app explica cómo iniciar sesión (abre una terminal con `claude` → `/login`).
- Se respeta el límite de uso: un análisis por proyecto (más reintentos manuales); los textos
  alternativos se piden en la misma llamada.

## 9. Errores y casos límite

| Caso | Comportamiento |
|---|---|
| Sin GPU/CUDA | Transcribe en CPU con `small` y avisa el tiempo estimado. |
| Video sin caras detectadas | Encuadre fijo al centro; el usuario ajusta con el control. |
| Claude sin sesión / límite alcanzado | Mensaje claro con la acción a tomar; el proyecto queda en "Listo para analizar". |
| Respuesta de Claude inválida | Reintento automático una vez; luego error con "Reintentar". |
| Versículo sin texto o sin confirmar | El inspector pide escribir o confirmar el texto RVR1960; exportar queda bloqueado con ese mensaje. |
| Video original movido o borrado | Se pide ubicarlo; la transcripción y los clips se conservan. |
| Render falla | La tarea queda en rojo con el detalle y "Reintentar"; el resto de la cola sigue. |
| Disco lleno | Se detiene la cola y se avisa antes de empezar si no hay espacio estimado suficiente. |

## 10. Pruebas

- **Unitarias (Vitest):** bloques de subtítulos, regla del versículo, ubicación del gancho, pista de
  cara/encuadre, curva de música, constructor de composición (snapshot del HTML), validación del
  JSON de Claude, búsqueda de versículos.
- **Python (pytest):** formato de salida y progreso de `transcribir.py`, conversión de tiempos.
- **Integración:** render de un fixture de 10 s con HyperFrames y verificación con FFmpeg (duración,
  resolución, cero cuadros duplicados fuera de partes fijas, nivel de audio).
- **E2E (Playwright para Electron):** nuevo proyecto con fixture → procesar (con Claude simulado) →
  editar → exportar.

## 11. Fuera de alcance (fase 1)

Canciones/alabanza, reels generados con IA, publicación directa en redes, varios usuarios o nube,
macOS/Linux, edición multicámara, traducción de subtítulos.

## 12. Etapas propuestas

1. Esqueleto Electron + diseño base + pantalla de proyectos.
2. Nuevo proyecto y cola de tareas con Python (transcripción y caras).
3. Análisis con Claude (`claude -p`) y lista de clips.
4. Editor: vista previa en vivo, inspector, línea de tiempo.
5. Exportación con HyperFrames (formatos, cola, notificaciones) + regla del versículo + cierre.
6. Plan 3 (todo junto, decidido 2026-11-06 por la persona): ver sección 14.

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| HyperFrames es 0.x y cambia rápido | Versión fijada; pruebas de integración que renderizan un fixture. |
| Vista previa en vivo de la composición (video sincronizado con GSAP dentro del `<iframe>`) no probada | Primer paso de la etapa 4: usar el runtime/reproductor de vista previa de HyperFrames si lo expone; alternativa: el motor canvas del artefacto (ya probado) para la vista previa y HyperFrames solo para exportar. |
| Mezcla de música con bajada bajo la voz en HyperFrames no probada | Probar su carril de volumen al inicio de la etapa 6; alternativa: mezclar con FFmpeg (`sidechaincompress`) después del render. |
| Empaquetar Python + CUDA (~2 GB) | Fase 1: el asistente de primer uso crea el `.venv` e instala dependencias; el instalador no las incluye. |
| Límite de uso de la suscripción | Una llamada por proyecto; mostrar el error de límite con claridad. |
| Texto bíblico (RVR1960 con derechos de autor) | No se incluye la Biblia; Claude propone cada versículo citado y la persona lo confirma; la tarjeta indica "RVR1960". |

## 14. Plan 3 — alcance (decidido 2026-11-06)

La persona pidió todo en un solo plan:

1. **Marca:** pantalla para nombre, logo (tamaño ajustable, sin recortar), color, invitación, redes
   (@ de Instagram/TikTok/Facebook/YouTube) y nombre del predicador por defecto, con vista previa en vivo.
2. **Estilo de la iglesia:** la combinación de subtítulos, música, efectos, cortes, cierre y formatos se
   guarda en la marca y se aplica a los clips nuevos; botones "Guardar como estilo de la iglesia" y
   "Aplicar a todos los clips".
3. **Música:** banco CC0 elegido por ánimo + pads generados (sección 7.7). Claude devuelve el ánimo de
   cada clip en el mismo análisis.
4. **Mezcla:** la música entra fuerte (~1,8 s), baja bajo la voz, sube un poco en pausas largas y se
   desvanece al final.
5. **Audio limpio:** la voz de la prédica se limpia una vez por proyecto (ruido y eco, filtro de graves)
   y el reel final se normaliza a −14 LUFS con pico máximo −1 dBTP (nivel de Instagram/TikTok).
6. **Cortes de pausas y muletillas** (opcional por clip, activo según el estilo): pausas de más de 0,7 s
   se acortan a 0,25 s y se quitan muletillas sueltas ("eh", "em", "mmm"); subtítulos, versículo y
   apertura siguen sincronizados.
7. **Estilos de subtítulos del catálogo de HyperFrames** (Apache 2.0, con crédito en NOTICE): además de
   Pop/Caja/Limpio, estilos tipo resaltado, karaoke en píldora, impacto y neón.
8. **Efectos:** transición con destello/luz al pasar del B/N al color, textura de grano opcional,
   rótulo con el nombre del predicador al inicio, cierre animado con las redes de la iglesia.
9. **Textos por red:** Claude escribe, en el mismo análisis, texto y hashtags para Instagram, TikTok,
   Facebook y YouTube Shorts (título), dentro de los límites de cada red y sin sonar a IA. Pestaña
   Publicar con contador y botón Copiar; al exportar se guarda `<slug>-textos.txt`.
10. **Portada:** al exportar, una imagen JPG del reel con el gancho visible (`<slug>-<formato>-portada.jpg`).
11. **Nueva prédica desde enlace** (yt-dlp) o archivo (sección 5.1).
12. **Primer uso:** asistente que revisa y arregla con un clic Python + entorno, FFmpeg y la sesión de Claude.
13. **Instalador** de Windows (NSIS) que funciona sin el repositorio.
14. **Pendientes menores** de los planes 1 y 2 que afectan a la persona (ubicar video movido, errores en
    inglés, guion doble en nombres, versículo fuera del corte, etc.).

Fuera del plan 3: publicar directo en las redes, generación de música con IA.

## 15. Con IA — reel de un versículo (decidido 2026-11-06)

- **Entrada:** un versículo ("Juan 3:16") o un tema ("esperanza en la prueba").
- **Claude (una consulta, suscripción):** referencia y texto **RVR1960** (queda sin confirmar hasta que la
  persona lo revisa; sin confirmar no se exporta), gancho (≤ 8 palabras), **una o dos frases de
  reflexión**, palabras clave, ánimo de la música y textos por red (mismos límites que la sección 14).
- **Reel (15–25 s):** gancho (~2,5 s) → versículo palabra por palabra al ritmo de lectura → referencia
  con "RVR1960" → reflexión → cierre de la marca. Música (pad o pista propia según el ánimo) con la misma
  curva y normalización (−14 LUFS). Formatos 9:16, 4:5, 1:1; portada y textos al exportar.
- **Fondo:** degradado animado con el color de la marca (luz y grano), o una **foto o video propio**
  oscurecido y algo desenfocado para que el texto se lea. Sin generación de imágenes (la persona descartó
  Gemini de pago y Stable Diffusion local).
- **Dónde vive:** sección "Con IA" del riel (deja de ser "Pronto"); cada reel en `<datos>/ia/<id>/`
  (`creacion.json`, fondo copiado, `exportados/`); los MP4 aparecen también en "Exportados".

## 16. Plan 5 — el editor como FilmScribe (decidido 2026-11-09)

Ideas tomadas de FilmScribe (filmscribe.ai, app web de pago con página para prédicas) y del repositorio
GlennSomers/threads (solo ideas: no tiene licencia, no se copia código). Todo sigue en la PC de la
iglesia y con la suscripción de Claude (`claude -p`), sin claves de pago.

1. **Pedir cambios a Claude en palabras** (pestaña "Claude" del inspector): "córtalo en menos de 60
   segundos", "otro gancho más fuerte", "textos más cortos". Una consulta por pedido, con la
   transcripción del clip (±60 s) y el clip actual. Claude puede cambiar: inicio y fin, gancho, título,
   frase de apertura, palabras clave, textos por red, ánimo de la música, estilo de subtítulos y tramos a
   quitar. Nunca agrega versículos. La app ajusta los tiempos a límites de palabra, mueve los versículos
   como al cortar a mano, muestra en una línea qué cambió y ofrece **Deshacer**.
2. **Cortes más finos:**
   - tres intensidades para las pausas: **Suave** (pausas de más de 1,0 s, deja 0,36 s), **Normal**
     (0,7 s → 0,25 s, la de hoy) y **Fuerte** (0,45 s → 0,16 s);
   - la lista de muletillas se edita en Marca (por defecto "eh", "ehh", "em", "emm", "mm", "mmm"); solo
     se quitan cuando van sueltas, como hoy;
   - **frases repetidas** (el predicador se traba y repite): la app las sugiere; cuando las mismas 3
     palabras se repiten dentro de 8 s, se sugiere quitar la primera toma (máx. 12 palabras) y dejar la
     última. Nada se quita hasta que la persona toca "Quitar";
   - **tramos quitados a mano** desde la transcripción (seleccionar palabras → "Quitar del clip");
   - **fundidos de 10 ms** en cada corte de la voz para que no suene un "clic".
3. **Lista de clips con buscador, filtros y orden** (como FilmScribe): buscar por texto (título, gancho,
   transcripción), filtrar por categoría, duración, puntaje mínimo, con versículo, favoritos; ordenar por
   mayor impacto, orden en el video, más cortos, más largos; marcar **favorito** y **ocultar**.
   **Clip a mano:** seleccionar palabras en la transcripción → "Crear clip con esto".
   Volver a analizar conserva favoritos, clips a mano, editados y exportados; solo reemplaza las
   sugerencias que nadie tocó.
4. **Instrucción al analizar** (opcional, hasta 300 caracteres: "prioriza lo que habla de la
   ansiedad") y **duración de los clips**: Cortos (15–30 s), Normales (30–60 s, por defecto) o Largos
   (60–90 s). Se piden al crear la prédica y al "Analizar de nuevo".
5. **Transcripción completa** (vista del centro del editor, junto a la vista previa): buscador, clic en
   una palabra para ir a ese momento, y **corregir una palabra** en esa aparición o en todas. Las
   correcciones se guardan aparte (`correcciones.json`) y se aplican siempre al leer la transcripción:
   subtítulos, clips, análisis y capítulos usan el texto corregido, y no se pierden si se vuelve a
   transcribir.
6. **Capítulos y resumen** (una consulta a Claude por prédica, botón "Crear capítulos"): un resumen de
   2 a 4 oraciones y capítulos con título para pegar en la descripción de YouTube (formato de YouTube:
   el primero en 0:00, al menos 3, cada uno de 10 s o más). Con tiempos del video completo (por defecto,
   sumando el inicio de la prédica, con "0:00 Inicio del culto" si la prédica no empieza en 0) o solo
   de la prédica. Botón Copiar; al exportar se guarda `capitulos.txt` en exportados.
7. **Niveles de voz:** **Ligera** (solo graves y volumen parejo, para buenos micrófonos), **Limpia**
   (la de hoy, por defecto) y **Podcast** (Limpia + presencia a 3,5 kHz, menos siseo de las "s" y
   compresión suave). Cada nivel se prepara una vez por prédica cuando se usa por primera vez.
8. **Efectos de sonido** (opcionales, encendidos por defecto en el estilo de la iglesia): un "whoosh"
   en el paso de la apertura al clip y del clip al cierre, y un "pop" suave cuando aparece el gancho. En
   «Con IA», un "whoosh" suave entre tarjetas del versículo. Los sonidos se generan con un script propio
   (`python/efectos.py`), así que no hay licencias de terceros, y van incluidos en la app.

Fuera del plan 5 (van al plan 6): más fuentes, zonas seguras exactas por red, corrección de color,
escenas con pinturas de dominio público, copiar el estilo de un reel, SRT, PDF, MP3 y traducción.

## 17. Plan 6 — entregas de la semana, imagen y detalles (decidido 2026-11-09)

Orden acordado: primero lo que se usa desde el primer domingo (entregas y detalles), después lo visual.

**A. Detalles del plan 5** (los 9 menores de la revisión final): validar id, inicio y fin al crear un
clip a mano; Claude no puede alargar un clip a más de 90 s (se recorta con aviso); mensaje en español
si falla crear un clip, corregir una palabra o volver a analizar; el aviso de voz se borra al cambiar de
clip; «Exportar N clips» y el contador no cuentan los ocultos; clic en una palabra fuera del clip ofrece
«Crear clip desde aquí» y lo dice; una corrección puede cambiar también la puntuación (si la persona la
escribe); «Volver a poner» por tramo; comentarios del código en su lugar.

**B. Entregas de la semana** (pestaña «Entregas» del editor, todo se guarda en `exportados/`):
1. **Subtítulos SRT** de la prédica: máximo 2 líneas de 42 caracteres, 1 a 7 s por bloque y como mucho
   17 caracteres por segundo, cortando en la puntuación; con tiempos del video completo (por defecto) o
   solo de la prédica. Usan la transcripción corregida.
2. **Transcripción en PDF** (para estudios de célula): nombre de la iglesia, título, fecha y predicador,
   resumen y capítulos si existen, y el texto en párrafos con su minuto. Se arma con la impresión a PDF
   de Electron (sin librerías nuevas).
3. **MP3 de la prédica** (podcast o WhatsApp): la voz del nivel elegido, a −16 LUFS (nivel de podcast),
   128 kbps, con título, predicador e iglesia en las etiquetas y el logo como carátula.
4. **Subtítulos traducidos** (inglés, portugués, francés, italiano, alemán, coreano, chino; elegir
   varios): Claude traduce los bloques del SRT por partes, sin cambiar sus tiempos y con las reglas de
   lectura; los versículos citados van en una versión reconocida de ese idioma, y si Claude no está seguro
   lo dice. Un `.srt` por idioma.

**C. Imagen de los reels:**
5. **Zonas seguras exactas** por red (TikTok, Instagram Reels, YouTube Shorts y Facebook): la vista
   previa dibuja la de la red elegida, y el gancho, los subtítulos, el versículo y el rótulo se acomodan
   dentro de la zona segura común a todas (nunca tapados por botones ni textos de la red).
6. **Corrección de color:** looks propios (Natural, Cálido, Frío, Cine, Suave, Blanco y negro suave)
   con intensidad 0–100 %, y **«Corregir tono amarillo»** automático: la app mide el color promedio del
   video y equilibra los blancos. Se aplica como filtro de color en la composición (se ve igual en la
   vista previa y en el MP4).
7. **Más fuentes:** un grupo de fuentes libres (OFL) elegidas para reels, descargadas una vez e incluidas
   en la app, más **la fuente propia de la iglesia** (archivo .ttf, .otf o .woff2 en Marca). Se elige la
   fuente de los subtítulos y la de los títulos.
8. **Escenas con pinturas clásicas** de dominio público para «Con IA» (por ejemplo Rembrandt, Caravaggio,
   Murillo, El Greco): un grupo pequeño descargado una vez de Wikimedia Commons e incluido en la app, con
   su autor y obra en NOTICE; acercamiento lento y velo para que el texto se lea. Claude puede proponer
   la pintura según el versículo.
9. **Copiar el estilo de un reel:** la persona elige un video de referencia; la app saca algunos cuadros
   y mide el ritmo de cortes y el volumen; Claude (leyendo los cuadros) propone el estilo de subtítulos,
   la fuente, el color, la posición, el ánimo de la música y la intensidad de los cortes. La persona ve la
   propuesta y la aplica a un clip o la guarda como estilo de la iglesia.

Fuera del plan 6: publicar directo en las redes, generar imágenes o música con IA, cuentas de usuario.

## 18. Plan 7 — marca en el reel, detalles, fuentes y tema claro (decidido 2026-11-09)

1. **Marca durante el reel:** en Marca se elige qué se ve abajo durante todo el reel: **Texto** (el nombre,
   como hoy), **Logo** o **Logo y texto**, y su tamaño. Sin logo cargado, «Logo» se comporta como «Texto».
   Aplica a los reels de prédica y de «Con IA», en la vista previa y al exportar.
2. **Los 9 detalles del plan 6:** cancelar una traducción (y no lanzar dos a la vez); cada intento de traducción
   con su propio tiempo y reintento también si falla la consulta; carátula del MP3 con el logo sobre fondo blanco,
   cuadrada y aceptando WEBP; `Object.hasOwn` para las pinturas; «Corregir tono amarillo» sin pisar lo cambiado
   mientras mide; la tarjeta de «Copiar el estilo» dice si activa «acortar pausas» y conserva la fuente de la
   iglesia; el selector de fuentes muestra la real si falta la fuente de la iglesia y la fuente se puede quitar en
   Marca; los IPC nuevos validan el id; avisos de referencia sin video o sin volumen medible; sin código muerto en
   el SRT.
3. **Fuentes incluidas:** Geist, Geist Mono y Fraunces van dentro de la app (paquetes @fontsource, licencia OFL,
   con permiso de la persona); la app se ve igual sin internet.
4. **Tema claro:** Ajustes → Apariencia: Oscuro (por defecto), Claro o «Como Windows». Se guarda en la PC y se
   aplica al abrir, sin parpadeo.

## 19. Plan 8 — subtítulos virales, gancho grande y frases para publicar (decidido 2026-11-09)

Ideas tomadas de OpusClip (gancho), Submagic (subtítulos) y Castmagic / Gloo (contenido escrito de la
prédica). Regla del plan: **nada se suma al análisis de la prédica**; todo es composición del reel o una
entrega que corre solo cuando se pide. Fuera del plan: PySceneDetect (recorre el video completo y el
encuadre ya detecta cambios de cámara por el salto de la cara) y ClipsAI (duplica el pipeline y exige
WhisperX, pyannote y un token de Hugging Face).

**A. Subtítulos virales** (motor combinable)
1. Los 7 estilos actuales (Pop, Caja, Limpio, Resaltado, Karaoke, Impacto, Neón) no cambian: mismo código,
   mismo resultado.
2. Los estilos nuevos son **presets** de un motor (`src/shared/reel/presets-sub.ts` y `motor-sub.ts`). Un
   preset define: mayúsculas o no; borde negro o sombra; cómo se marca la palabra que se está diciendo
   (`color`, `escala`, `caja`, `subrayado`, `rebote`, `brillo`); el color de esa marca (`marca` = color de la
   iglesia, o `amarillo` #FFE14D); y palabras por bloque (1 a 3, con su límite de letras). El motor genera el
   HTML, el CSS y la animación GSAP con las mismas firmas que hoy (`htmlBloque`, `animarBloque`, `cssEstilosSub`
   y los límites de `subtitulos.ts`).
3. Los presets **no eligen fuente**: usan la de subtítulos del clip o de la iglesia (plan 6/7).
4. Ocho presets nuevos, en la línea de Pop:
   - **Viral**: borde negro; la palabra dicha en amarillo y 15 % más grande; 2–3 palabras.
   - **Una palabra**: una palabra gigante a la vez, con rebote.
   - **Caja de marca**: caja del color de la iglesia detrás de la palabra dicha.
   - **Subrayado**: barra del color de la iglesia que crece bajo la palabra dicha.
   - **Dos tonos**: blanco; la palabra clave más grande y en color.
   - **Rebote**: cada palabra entra con golpe (`back.out`).
   - **Brillo**: la palabra clave con resplandor del color de la iglesia.
   - **Elegante**: minúsculas, sin borde, sombra suave.
5. Se mantienen las reglas de siempre: no hay subtítulos mientras se ve la tarjeta del versículo, se respetan
   la altura elegida y la zona segura común, y las palabras clave van en color.
6. **Galería:** en el Inspector, el selector de estilo pasa a ser una grilla de tarjetas. Cada tarjeta anima
   en bucle una frase de muestra («TU PRUEBA NO ES EL FINAL») con el mismo motor, en el color y la fuente de
   la iglesia. Con `prefers-reduced-motion` las tarjetas quedan quietas, mostrando la palabra marcada.
7. Sin emojis en esta versión.

**B. Gancho grande**
1. Campo nuevo opcional `ClipSpec.estiloGancho`: `tarjeta` (el de hoy), `gigante`, `marca`, `subrayado`,
   `golpe`. Sin el campo se usa `tarjeta`, así un clip anterior sale idéntico.
   - **Gigante**: 2–3 líneas en mayúsculas, ~120 px en 9:16, blanco con borde negro, una palabra en color.
   - **Marca**: texto blanco sobre una franja del color de la iglesia.
   - **Subrayado**: texto grande con una barra de color que se dibuja bajo la palabra en color.
   - **Golpe**: cada palabra entra con escala y un sacudón corto (con el «pop» de sonido de hoy).
2. La palabra en color es la primera del gancho que esté en las palabras clave del clip; si no hay ninguna,
   la más larga.
3. El tiempo en pantalla no cambia (durante la apertura o los primeros 4,5 s). La posición sigue usando
   `posicionGancho`, con un medio alto propio de cada estilo para que no tape la cabeza ni baje a los
   subtítulos. En 4:5 y 1:1 el tamaño se reduce para que siempre quepa.
4. El prompt de Claude no cambia (sigue escribiendo `gancho` y 2 alternativos).
5. El Inspector muestra el estilo del gancho con tarjetas iguales a las de los subtítulos.

**C. Plantilla de la iglesia**
1. `EstiloIglesia` suma `gancho?: EstiloGancho`. `estiloDesdeClip`, `aplicarEstiloAClip` y los clips nuevos
   lo llevan, así «Guardar como estilo de la iglesia» y «Aplicar a todos los clips» cubren el subtítulo y el
   gancho nuevos. Sin el campo se usa `tarjeta`.
2. Los pedidos de cambios a Claude (`estilo_subtitulos`, y ahora `estilo_gancho`) y «Copiar el estilo de un
   reel» aceptan los ids nuevos. Un id desconocido se ignora con aviso y nunca rompe el clip.

**D. Frases para publicar** (pestaña Entregas)
1. Botón «Sacar 7 frases». Hace una consulta a `claude -p` con la transcripción corregida (mismo `preguntar` /
   `extraerJson` y un reintento si el JSON no valida). Pide 10 candidatas
   `{ "texto", "en": "H:MM:SS", "versiculo"?: { "ref", "texto" } }`: frases **dichas palabra por palabra**,
   de 6 a 25 palabras, con una idea completa y sin saludos, avisos ni ofrendas.
2. **Fidelidad** (`src/shared/frases.ts`, función pura): cada frase se busca en la transcripción normalizada
   (sin tildes, mayúsculas ni puntuación) cerca de su minuto (±60 s). Si no aparece con al menos 90 % de
   coincidencia por palabras, se descarta. Quedan como mucho 7, sin repetir idea (no más de 60 % de palabras
   en común), ordenadas por minuto.
3. Si una frase trae versículo, va en RVR1960 y queda **sin confirmar**. Sin confirmar no aparece en la
   imagen ni en el texto exportado. Claude nunca agrega versículos que el predicador no citó.
4. Se guarda en `frases.json` del proyecto: `{ texto, en, original, fondo, versiculo? }[]`.
5. En pantalla, cada frase muestra su minuto y los botones «Copiar», «Ir al momento» (abre la transcripción
   ahí), «Quitar» y el fondo. El texto se puede corregir; si la corrección baja la coincidencia con
   `original` del 90 %, aparece el aviso «Ya no es lo que dijo el predicador».
6. **Imágenes** de 1080×1350 con tres fondos a elegir por frase:
   - **Marca**: degradado del color de la iglesia (por defecto).
   - **Foto del momento**: un cuadro del video en `en`, sacado con FFmpeg, oscurecido y desenfocado.
     Con el video no encontrado, esta opción no está disponible.
   - **Pintura**: una del banco del plan 6.
   La composición lleva comillas grandes, la frase con tamaño automático según su largo (de 4 a 9 líneas
   como mucho), la palabra clave en el color de la iglesia, el nombre del predicador si existe, y abajo el
   logo y/o el nombre según `marcaReel`. Fuentes de títulos de la iglesia, incrustadas.
7. Se pintan con una ventana oculta de Electron de 1080×1350 (`capturePage` → PNG), igual que el PDF y sin
   librerías nuevas. Se guardan en `exportados/frases/<prédica>-frase-<n>.png`, más un `<prédica>-frases.txt`
   con cada frase, su minuto y el predicador.
8. **Errores:** sin transcripción → «Primero hay que transcribir la prédica»; Claude falla dos veces →
   mensaje y «Reintentar»; menos de 7 frases fieles → se muestran las que hay con «Claude encontró N frases
   textuales»; no se lanzan dos pedidos a la vez y se puede cancelar.

**Pruebas**
- Motor de subtítulos: cada preset genera bloques válidos, respeta el límite de palabras y letras y la
  regla del versículo; los 7 estilos de antes generan exactamente el mismo HTML/JS que hoy.
- Gancho: un clip sin `estiloGancho` produce la misma composición que hoy; cada estilo cabe en 9:16, 4:5
  y 1:1 sin tocar la zona de subtítulos.
- Plantilla: guardar y aplicar el estilo lleva subtítulo y gancho; un clip exportado no se toca.
- Frases: fidelidad (exacta, tildes distintas, inventada, recortada, fuera de minuto), sin repetidas,
  tamaño automático; `frases.ts` con el Claude falso de `tests/fixtures`; una prueba de punta a punta que
  genera las PNG y verifica 1080×1350.
- Un render de prueba con HyperFrames por cada estilo nuevo de subtítulo y de gancho.

Fuera del plan 8: emojis en subtítulos, B-roll, frases como mini reels, publicar directo en redes,
PySceneDetect y ClipsAI.

## 20. Plan 9 — el rediseño en toda la app y los detalles pendientes (decidido 2026-11-10)

Sigue al rediseño del editor (riel de categorías al borde, secciones plegables con su valor en la cabecera,
acciones en la barra de arriba). Nada nuevo para Claude ni para el análisis.

**A. El rediseño en el resto de la app**
1. **Con IA:** el editor del reel de versículo usa el mismo riel que el editor de prédicas, con 5 categorías:
   **Texto** (gancho y reflexión), **Versículo** (referencia, texto RVR1960 y confirmar), **Fondo** (escena,
   pintura, degradado o foto/video), **Audio** (música y efectos de sonido) y **Publicar** (formatos y texto de
   cada red). «Exportar» va en la barra de arriba; si el versículo no está confirmado, el botón está apagado y el
   riel marca «Versículo» con el punto dorado. Empieza en «Versículo» si falta confirmar, si no en «Texto».
2. **Prédicas:** cada prédica es una tarjeta con un cuadro del video (de la prédica, no del inicio del culto), su
   nombre, la fecha, la duración de la prédica y el estado. Sin video, la tarjeta muestra un fondo liso.
3. **Marca:** los ajustes se agrupan en tarjetas («Tu iglesia», «Logo y fuente», «Durante el reel») y la vista
   previa del cierre queda fija a la derecha mientras se recorre la página.
4. **Música:** las pistas se agrupan por ánimo, cada grupo con cuántas pistas tiene; sin pistas, un estado vacío
   que explica los pads y ofrece «Agregar mis pistas».
5. **Exportados:** cada grupo dice cuántos archivos tiene; cada reel muestra una etiqueta con su formato (9:16,
   4:5 o 1:1) cuando el nombre del archivo lo indica.
6. **Instalador nuevo:** se arma la carpeta empaquetada y el instalador con el rediseño; la prueba de la app
   instalada pasa.

**B. Los 9 detalles del plan 8**
1. «1 frase» en singular (y «N frases» en plural) en el aviso de Claude.
2. «Guardar imágenes» espera a que se guarde la última edición de una frase.
3. Si se cambia de pestaña mientras Claude busca frases, al volver se sigue viendo «Buscando frases…» y aparecen
   las frases cuando llegan.
4. «Copiar» de una frase avisa «Copiada» un momento.
5. Una frase editada a más de 25 palabras avisa «Muy larga para la imagen (máximo 25 palabras)» y la imagen baja
   la letra hasta 44 px para que entre (hasta 40 palabras).
6. La galería de estilos usa la fuente elegida para el clip (incluida la de la iglesia).
7. Con movimiento reducido, las muestras quietas muestran la palabra dicha marcada.
8. Un clip que no usa un estilo nuevo no lleva el CSS de los 8 estilos nuevos en su composición.
9. Un `estiloGancho` desconocido (clip editado a mano) se trata como «tarjeta», sin romper la composición.

**C. Los detalles del plan 7**
1. La traducción sigue mostrando su progreso y su botón «Cancelar» si se sale de Entregas y se vuelve.
2. Al cancelar una traducción de varios idiomas, el mensaje dice cuáles quedaron guardados.
3. Si el archivo del logo ya no existe, Marca lo dice («No encuentro el archivo del logo: elige otro») y la
   muestra usa el nombre.
4. En 4:5 y 1:1, el logo de la marca durante el reel se achica para no tocar los subtítulos (mínimo 40 px de alto).

## 21. Plan 10 — listos para producción (decidido 2026-11-10)

Objetivo: que la app se instale, se actualice y se pueda diagnosticar en una PC que no sea la del desarrollo,
y que la persona pueda borrar lo que ya no usa. Nada de esto cambia cómo se hacen los reels.

**A. Registro de errores y diagnóstico**
1. `src/main/registro.ts` escribe en `%APPDATA%\Reels Iglesia\registros\reels-AAAA-MM-DD.log` (una línea por
   evento: hora ISO, nivel `info`/`aviso`/`error`, origen, mensaje). Se guardan los últimos 7 días; un archivo
   que pasa de 5 MB deja de crecer ese día (se anota una sola línea «registro lleno»).
2. Se anotan: arranque (versión de la app, Electron y Windows); errores no capturados del proceso principal
   (`uncaughtException`, `unhandledRejection`); errores de la ventana (`window.onerror` y
   `unhandledrejection`, enviados por el preload); `render-process-gone`; cada `ipcMain.handle` que lanza
   (nombre del canal y mensaje); inicio, fin y duración de cada tarea larga (transcribir, caras, analizar,
   voz, exportar, traducir, frases, MP3, PDF); y las últimas 20 líneas de stderr cuando un proceso hijo
   (Python, FFmpeg, Claude, render) termina con error.
3. Nunca se anota el texto de la prédica, las respuestas de Claude, el contenido de los prompts ni variables de
   entorno. Las rutas de archivos sí.
4. Ajustes → «Diagnóstico»: botón **«Copiar diagnóstico»**, que copia al portapapeles la versión de la app,
   Electron y Windows, la CPU, la RAM, la GPU, el resultado de los chequeos del sistema (sin consultar a
   Claude) y las últimas 200 líneas del registro; y botón **«Abrir carpeta de registros»**. El diagnóstico
   nunca se envía a ningún lado.

**B. Actualizaciones automáticas**
1. `electron-updater` con el proveedor GitHub (`DannyMovilla/reels-iglesia`, releases públicos). El repositorio
   debe ser público; el token para publicar (`GH_TOKEN`) vive solo en la PC de quien publica.
2. La app revisa 10 s después de abrir y luego cada 6 horas; si hay versión nueva la descarga en segundo plano.
   En desarrollo (`!app.isPackaged`) no revisa.
3. Con la descarga lista, un aviso en la barra de arriba: «La versión X está lista: se instala al cerrar» y el
   botón «Reiniciar ahora». «Reiniciar ahora» no se ofrece mientras haya una exportación o una tarea larga en
   curso (se muestra «Se instalará al terminar»).
4. Ajustes → «Versión»: la versión actual, «Buscar actualizaciones» y el estado (buscando, al día, descargando
   N %, lista, o el error en español: «No pude revisar las actualizaciones. Revisa tu internet.»).
5. `npm run publicar` = build + `electron-builder --publish always`. La versión pasa a **0.2.0**.
6. Sin firma de código: la actualización se verifica con el sha512 de `latest.yml`.

**C. Borrar prédicas y exportados**
1. Prédicas → menú de la tarjeta → «Borrar prédica». El aviso dice qué se va (transcripción, N clips, M reels
   exportados, frases y el espacio en MB) y «El video original del culto no se borra». Se manda la carpeta de
   la prédica a la Papelera de Windows (`shell.trashItem`). Si la Papelera no está disponible, error en español
   y no se borra nada.
2. No se puede borrar una prédica con una tarea en curso (procesar, exportar, traducir, frases): «Espera a que
   termine lo que está haciendo esta prédica».
3. Exportados: «Borrar» en cada reel (el MP4, su portada y su archivo de textos) y «Borrar todos» por prédica,
   con aviso y el espacio que se libera. Todo va a la Papelera. Los clips cuyo reel se borró vuelven a estado
   «editado». Lo mismo para los reels de «Con IA».
4. Los IPC de borrar validan el id y que la ruta quede dentro de la carpeta de datos.

**D. Datos y disco**
1. Cada tarjeta de Prédicas muestra cuánto ocupa la prédica (sin contar el video original). Ajustes → «Espacio»
   muestra el total de la carpeta de datos.
2. «Liberar espacio» (por prédica y en Ajustes para todas) borra lo que la app sabe rehacer: la carpeta `tmp/`
   y las voces limpias `voz-*.m4a`, estas últimas solo si el video original sigue disponible. Dice cuánto liberó.
3. Al abrir la app se borran los archivos de `tmp/` de más de 7 días de todas las prédicas.
4. La tarjeta de una prédica cuyo video no está dice «Video no encontrado» (el editor ya ofrece ubicarlo).

**E. Instalador 0.2.0 y prueba en una PC limpia**
1. `npm run dist` con la versión 0.2.0 y `tests/e2e/instalado.spec.ts` actualizado (incluye que el registro se
   cree en la carpeta de datos de prueba).
2. `docs/superpowers/notas/prueba-pc-limpia.md`: lista de verificación paso a paso del primer uso en un Windows
   sin Python, FFmpeg, Node ni Claude (instalar, aviso de Windows, asistente, crear entorno, iniciar sesión en
   Claude, primera prédica, exportar, «Copiar diagnóstico»), con dónde anotar cada falla. La prueba la hace la
   persona en otra PC (Windows 11 Home no trae Windows Sandbox).

**F. Prueba con un culto real**
1. Una sesión con la persona: un culto de 1 a 2 horas, Claude real; transcribir, analizar, exportar 3 reels en
   9:16 y 4:5, frases y entregas. Los tiempos de cada paso se toman del registro y se anotan en
   `docs/superpowers/notas/prueba-culto-real.md`, junto con lo que se vio mal.
2. Solo se ajustan valores (no lógica) y cada ajuste lleva su prueba.

**Pruebas**
- Registro: formato de línea, rotación de 7 días, tope de 5 MB, que no anote textos de la prédica, errores de
  IPC y de procesos hijos con el final del stderr.
- Diagnóstico: el texto copiado tiene versión, sistema, chequeos y las últimas 200 líneas.
- Actualizaciones: con un `autoUpdater` simulado, los estados y avisos; no reinicia con una tarea en curso; no
  revisa en desarrollo.
- Borrar: va a la Papelera (simulada), avisa lo correcto, se niega con tarea en curso, rechaza ids y rutas
  fuera de la carpeta de datos, los clips vuelven a «editado».
- Espacio: tamaños, liberar respeta las voces sin video, limpieza de `tmp/` viejo al abrir.
- E2E: instalado.spec con la versión 0.2.0.

Fuera del plan 10: firma de código, integración continua, licencia y nota de privacidad, publicar en redes.
