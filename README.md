# Reels Iglesia

App de escritorio para Windows que convierte la prédica del culto en reels listos para publicar en
Instagram, TikTok, Facebook y YouTube Shorts. También crea reels de un versículo («Con IA») y las
entregas de la semana: subtítulos, transcripción en PDF, la prédica en MP3, traducciones y frases para
publicar.

La transcripción y el armado de los videos se hacen en tu PC. Claude (con tu suscripción) elige los
mejores momentos y escribe los textos.

---

## Requisitos

**Obligatorio**

- Windows 10 u 11 de 64 bits.
- Internet: para instalar y para todo lo que hace Claude.
- Una cuenta de Claude con suscripción (Pro o Max) y **Claude Code** instalado con la sesión iniciada.
  La app no usa claves de API pagadas.
- **Python 3.11 o más nuevo** y **FFmpeg**. Si faltan, la app ofrece instalarlos con winget.
- Espacio en disco: unos 130 MB de la app, unos 3 GB del entorno de Python (se descarga una sola vez)
  y lugar para los videos de los cultos y los reels. Recomendado: al menos 10 GB libres.

**Recomendado**

- Una tarjeta **NVIDIA**: la transcripción es mucho más rápida (se probó con una GTX 1650 Ti de 4 GB).
  Sin NVIDIA también funciona, con el procesador y un modelo más chico (tarda más).
- 16 GB de RAM para ir cómodo (8 GB como mínimo; estimado, no medido).

---

## Instalar

1. Descarga `Reels-Iglesia-Setup-X.Y.Z.exe` desde
   [Releases](https://github.com/DannyMovilla/reels-iglesia/releases/latest).
2. Ábrelo. Windows puede mostrar «Windows protegió su PC» porque la app todavía no tiene firma:
   toca **Más información → Ejecutar de todas formas**.
3. Instala con las opciones de siempre y abre **Reels Iglesia** desde el escritorio.

La app se actualiza sola: cuando sale una versión nueva, la descarga y la instala al cerrar.

## Primer uso

La primera vez se abre un asistente con lo que falta, marcado en rojo. Toca cada botón en orden:

1. **Instalar FFmpeg** y **Instalar Python** (puede pedir permiso de Windows).
2. **Preparar el entorno** de Python: descarga unos 3 GB una sola vez (transcripción, detección del
   predicador y descarga de videos). Si tienes NVIDIA, también instala lo que la tarjeta necesita.
3. **Iniciar sesión en Claude**: se abre la ventana de Claude; inicia sesión con tu cuenta.

Cuando todo queda en verde, la app está lista. Esa misma lista se ve después en **Ajustes → Lo que
necesita la app**.

---

## Cómo se usa

### 1. Configura tu marca (una sola vez)

En **Marca**:

- **Tu iglesia:** nombre, invitación («Síguenos · Domingos 10:00 AM»), color principal, predicador por
  defecto y las redes (@ de Instagram, TikTok, Facebook y YouTube).
- **Logo y fuente:** el logo (PNG con fondo transparente se ve mejor), su tamaño y, si quieres, la fuente
  propia de la iglesia (TTF, OTF, WOFF o WOFF2).
- **Durante el reel:** qué se ve abajo durante todo el reel: el nombre, el logo o los dos, y su tamaño.
- **Muletillas que se quitan** («eh», «em»…): las que se recortan de los clips.

A la derecha se ve la tarjeta de cierre del reel. Todo se guarda solo.

### 2. Nueva prédica

En **Prédicas → Nueva prédica**:

1. Elige el video del culto (MP4 o MOV). El video no se copia ni se sube: se usa desde donde está.
   También puedes pegar el **enlace** del culto y tocar **Descargar**.
2. Marca **dónde empieza y dónde termina la prédica** (con «Marcar inicio aquí» y «Marcar fin aquí»).
3. Escribe el predicador (opcional) y toca **Procesar prédica**.

La app transcribe, limpia el audio, busca al predicador en la imagen y Claude elige los mejores momentos.
Arriba se ve el avance; cuando termina dice **«Prédica lista · 4 de 4 pasos»**.

### 3. El editor

- **Izquierda, los clips:** los momentos que sugirió Claude, con su puntaje. Se pueden buscar, filtrar
  (favoritos, con versículo…), marcar como favoritos u ocultar.
- **Centro, la vista previa:** el reel tal como va a quedar, en 9:16, 4:5 o 1:1, con la zona que tapa
  cada red. Las pestañas del centro cambian a **Transcripción**, **Capítulos** y **Entregas**.
- **Abajo, la línea de tiempo** con 5 pistas (Video, Gancho, Subtítulos, Versículo, Música). Arrastra los
  bordes dorados para cambiar el corte, o usa **I** / **O** para marcar inicio y fin y **← / →** para
  mover el cabezal. Tocar una pista abre sus ajustes a la derecha.
- **Derecha, los ajustes del clip**, por categorías en el riel del borde:
  - **Gancho:** título del clip, la frase grande del comienzo (con otras ideas de Claude) y su estilo.
  - **Subtítulos:** estilo (15, filtrados por familia), tamaño, altura y fuentes.
  - **Versículo:** el texto RVR1960 de la cita. **Hay que confirmarlo** antes de exportar (lo escribe
    Claude y puede tener diferencias). Un punto dorado avisa cuando falta.
  - **Imagen:** color (looks y «Corregir tono amarillo»), encuadre, efectos, apertura en blanco y negro
    y cierre con invitación.
  - **Audio:** voz del predicador (Ligera, Limpia, Podcast), música de fondo y efectos de sonido.
  - **Ritmo:** acortar pausas, quitar muletillas y frases repetidas.
  - **Publicar:** formatos a exportar y el texto de cada red (con su límite y botón para copiar).
  - **Mi estilo:** guardar cómo se ve este clip como estilo de la iglesia, aplicarlo a todos los clips,
    o copiar el estilo de un reel que te guste.
  - **Claude:** pedir cambios con tus palabras («empieza 2 segundos antes», «subtítulos más grandes»).

En la **Transcripción** puedes corregir palabras, seleccionar un tramo para **crear un clip a mano** o
**quitarlo del clip**.

### 4. Exportar

Toca **Exportar este clip** (arriba a la derecha). Se crea un MP4 por cada formato elegido en la
carpeta de la prédica. Con varios clips, **Exportar N clips** los hace todos en cola. Los reels
aparecen en **Exportados**, con su formato y el botón **Abrir carpeta**.

### 5. Entregas de la semana

En la pestaña **Entregas** del centro:

- **Subtítulos (SRT)** para el video completo en YouTube o Facebook.
- **Transcripción en PDF** para estudios de célula (con resumen y capítulos si los creaste).
- **Prédica en MP3** para podcast o WhatsApp, con título, predicador y logo.
- **Subtítulos traducidos** (inglés, portugués, francés, italiano, alemán, coreano, chino). Se puede
  salir de Entregas mientras traduce: al volver sigue el avance y se puede cancelar.
- **Frases para publicar:** Claude elige hasta 7 frases que dijo el predicador, palabra por palabra, y se
  guardan como imágenes de 1080×1350.

**Capítulos** (pestaña del centro) crea los capítulos de la prédica para la descripción de YouTube.

### Con IA: reels de un versículo

En **Con IA → Nuevo reel de versículo**, escribe un versículo («Juan 8:12») o un tema y toca **Crear con
Claude**. Claude escribe el gancho, el texto RVR1960 y una reflexión. En el riel de la derecha:

- **Texto:** gancho y reflexión.
- **Versículo:** referencia y texto, que **hay que confirmar** para poder exportar.
- **Fondo:** escena animada, pintura clásica (dominio público), degradado o tu foto o video.
- **Audio:** música y efectos de sonido.
- **Publicar:** formatos y textos por red.

### Música

En **Música → Agregar mis pistas** suma MP3 o WAV que tengas permiso de usar (por ejemplo de Pixabay)
y asígnales un ánimo. Claude elige para cada reel una pista del ánimo del mensaje. Si no hay ninguna,
la app crea un fondo suave (pad) en el momento.

### Ajustes

- **Apariencia:** oscuro, claro o «Como Windows».
- **Lo que necesita la app:** el estado de FFmpeg, Python, la tarjeta de video y Claude.
- **Espacio:** cuánto ocupa cada prédica y **Liberar espacio** (borra lo que se puede volver a crear).
- **Diagnóstico:** **Copiar diagnóstico** para mandar si algo falla.
- **Versión:** la versión instalada y si hay una actualización.

Las prédicas y los reels se pueden borrar: van a la Papelera de Windows.

---

## Si algo falla

- **«Falta iniciar sesión en Claude»:** abre Claude Code e inicia sesión, o usa el botón del asistente.
- **«Claude no respondió»:** revisa la conexión a internet y vuelve a intentar.
- **«No encuentro el video original»:** el video se movió o se borró. Toca **Ubicar el video**; la
  transcripción y los clips se conservan.
- **Un paso del proceso falló:** toca **Reintentar** en ese paso.
- Para pedir ayuda, usa **Ajustes → Copiar diagnóstico** y pega el texto en el mensaje. Los registros
  de la app están en `%APPDATA%\Reels Iglesia\registros`.

---

## Para desarrolladores

Requisitos: Node.js, Python 3.11+ y FFmpeg. Stack: Electron 35, electron-vite, React 18, TypeScript,
HyperFrames (render de los reels), GSAP, faster-whisper, FFmpeg y `claude -p`.

```bash
npm install
npm run dev            # la app en modo desarrollo
npm test               # pruebas de la interfaz y de la lógica (Vitest)
npm run test:integracion
npm run e2e            # arma la app y corre las pruebas de punta a punta (Playwright)
npm run typecheck
npm run dist           # arma el instalador en dist/
```

**Publicar una versión:** sube la versión en `package.json` y corre `npm run publicar` con un token de
GitHub en la variable `GH_TOKEN` (permiso `public_repo`). Crea el release en GitHub y las apps
instaladas se actualizan solas. El token va solo en la variable de la terminal: nunca en un archivo
del proyecto ni en un mensaje.

El diseño y las decisiones están en `docs/superpowers/specs/` y los planes de trabajo en
`docs/superpowers/plans/`.

## Licencias

Las fuentes, pinturas, efectos de sonido y otros recursos de terceros, con sus licencias, están en
[NOTICE.md](NOTICE.md).
