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

1. **Nuevo proyecto:** elegir el video (arrastrar o buscar). Se muestra un reproductor con la forma
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
   - texto bíblico: **Reina-Valera 1909** (dominio público), tomado de un archivo incluido en la app
     por referencia — Claude solo identifica la referencia y el momento, no escribe el texto.
5. **Encuadre:** sigue la cara del predicador (zona muerta, cortes secos en cambios de cámara),
   zoom 1,0–2,0 (por defecto 1,25), recalculado para cada formato.
6. **Cierre (opcional, activo por defecto):** 2,5 s con logo, nombre e invitación de la marca.
7. **Música:** generada según la categoría (o pista propia), entra fuerte en los primeros ~1,8 s,
   baja bajo la voz, sube un poco en pausas largas y se desvanece al final. Limitador para que nada
   pase de −1 dB.
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
| Versículo no encontrado en RV1909 | La tarjeta muestra solo la referencia y avisa en el inspector. |
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
6. Marca, música generada y mezcla.
7. Primer uso, empaquetado del instalador y pruebas E2E.

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| HyperFrames es 0.x y cambia rápido | Versión fijada; pruebas de integración que renderizan un fixture. |
| Vista previa en vivo de la composición (video sincronizado con GSAP dentro del `<iframe>`) no probada | Primer paso de la etapa 4: usar el runtime/reproductor de vista previa de HyperFrames si lo expone; alternativa: el motor canvas del artefacto (ya probado) para la vista previa y HyperFrames solo para exportar. |
| Mezcla de música con bajada bajo la voz en HyperFrames no probada | Probar su carril de volumen al inicio de la etapa 6; alternativa: mezclar con FFmpeg (`sidechaincompress`) después del render. |
| Empaquetar Python + CUDA (~2 GB) | Fase 1: el asistente de primer uso crea el `.venv` e instala dependencias; el instalador no las incluye. |
| Límite de uso de la suscripción | Una llamada por proyecto; mostrar el error de límite con claridad. |
| Texto bíblico | Solo Reina-Valera 1909 (dominio público) incluida localmente; se cita la versión en la tarjeta si el usuario lo activa. |
