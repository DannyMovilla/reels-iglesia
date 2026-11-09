import type { Correccion } from "./correcciones";
import type { Pista } from "./reel/pistas";
import type { Animo, Caras, ClipSpec, Creacion, Formato, Marca, Proyecto, Tarea, TipoTarea, Transcripcion, VideoOrigen } from "./tipos";

export interface Chequeo {
  ok: boolean;
  detalle: string;
  accion?: "instalar-ffmpeg" | "instalar-python" | "crear-venv" | "iniciar-sesion-claude" | "comprobar-claude";
}

export interface EstadoSistema {
  ffmpeg: Chequeo;
  python: Chequeo;
  gpu: Chequeo;
  claude: Chequeo;
}

export interface DatosNuevoProyecto {
  nombre: string;
  video: VideoOrigen;
  rango: { inicio: number; fin: number };
  predicador?: string;
}

/** API que el preload expone al renderer como `window.reels`. */
export interface ApiReels {
  elegirVideo(): Promise<VideoOrigen | null>;
  /** Descarga el video del culto desde un enlace (yt-dlp) a la carpeta de datos. */
  descargarVideo(url: string): Promise<VideoOrigen>;
  cancelarDescarga(): Promise<void>;
  alProgresoDescarga(cb: (pct: number) => void): () => void;
  crearProyecto(d: DatosNuevoProyecto): Promise<Proyecto>;
  listarProyectos(): Promise<Proyecto[]>;
  leerProyecto(id: string): Promise<Proyecto>;
  leerClips(id: string): Promise<ClipSpec[]>;
  /** La transcripción con las correcciones de la persona aplicadas. */
  leerTranscripcion(id: string): Promise<Transcripcion | null>;
  leerCorrecciones(id: string): Promise<Correccion[]>;
  /** Guarda una corrección de palabra y devuelve la transcripción corregida. */
  corregir(id: string, c: Correccion): Promise<Transcripcion>;
  quitarCorreccion(id: string, indice: number): Promise<Transcripcion>;
  leerCaras(id: string): Promise<Caras | null>;
  /** Guarda un clip editado (reemplaza el de mismo id en clips.json). */
  guardarClip(proyectoId: string, clip: ClipSpec): Promise<void>;
  leerMarca(): Promise<Marca>;
  /** «Con IA»: reels de un versículo. */
  listarCreaciones(): Promise<Creacion[]>;
  crearCreacion(entrada: Creacion["entrada"]): Promise<Creacion>;
  /** Claude escribe el versículo RVR1960, el gancho, la reflexión, la escena y los textos (una consulta). */
  escribirCreacion(id: string): Promise<Creacion>;
  leerCreacion(id: string): Promise<Creacion>;
  guardarCreacion(c: Creacion): Promise<void>;
  borrarCreacion(id: string): Promise<void>;
  /** Abre el diálogo para elegir una foto o un video de fondo; devuelve la ruta copiada o null. */
  elegirFondo(id: string): Promise<string | null>;
  /** Encola la exportación del reel de versículo en cada formato. */
  exportarCreacion(id: string, formatos: Formato[]): Promise<void>;
  /** URL de la foto o el video de fondo de una creación (vista previa). */
  urlFondo(id: string, archivo: string): string;
  /** Música que sonará en el reel de versículo (vista previa), o null. */
  urlMusicaCreacion(id: string, duracion: number): Promise<string | null>;
  listarPistas(): Promise<Pista[]>;
  /** Abre el diálogo para agregar pistas propias; devuelve las agregadas. */
  agregarPistas(): Promise<Pista[]>;
  cambiarAnimo(id: string, animo: Animo): Promise<void>;
  /** URL para escuchar una pista de la carpeta de música. */
  urlPista(id: string): string;
  /** Música que sonará en el reel, para la vista previa (URL), o null si no lleva música. */
  urlMusicaVista(proyectoId: string, clip: ClipSpec, duracion: number): Promise<string | null>;
  /** Voz limpia del proyecto (voz.m4a). */
  urlVoz(proyectoId: string): string;
  guardarMarca(m: Marca): Promise<void>;
  /** Abre el diálogo para elegir el logo, lo copia a la carpeta de la marca y devuelve su ruta (null si se cancela). */
  elegirLogo(): Promise<string | null>;
  /** Aplica el estilo de la iglesia a los clips sin exportar del proyecto. */
  aplicarEstilo(proyectoId: string): Promise<void>;
  /** Ancho y alto del video original (para encuadrar). */
  infoVideo(id: string): Promise<{ ancho: number; alto: number }>;
  /** Elegir de nuevo el video original si se movió (mismo archivo). null si se cancela. */
  ubicarVideo(id: string): Promise<Proyecto | null>;
  /** Encola el procesamiento desde un paso (por defecto, desde la transcripción). */
  procesar(id: string, desde?: TipoTarea): Promise<void>;
  /** Encola una exportación por clip y formato (por defecto, los formatos marcados en cada clip). */
  exportar(proyectoId: string, clipIds: string[], formatos?: Formato[]): Promise<void>;
  abrirCarpetaExportados(proyectoId: string): Promise<void>;
  listarExportados(): Promise<{ proyectoId: string; nombre: string; archivos: { nombre: string; tamano: number; portada?: string }[] }[]>;
  /** URL de un archivo de la carpeta exportados/ de un proyecto (portadas). */
  urlExportado(proyectoId: string, archivo: string): string;
  tareas(): Promise<Tarea[]>;
  alCambiarTareas(cb: (t: Tarea[]) => void): () => void;
  reintentar(idTarea: string): Promise<void>;
  cancelar(idTarea: string): Promise<void>;
  urlVideo(id: string): string;
  /** URL para reproducir un video elegido con elegirVideo() (antes de crear el proyecto). */
  urlArchivo(ruta: string): string;
  /** Registra una composición de vista previa y devuelve su URL reels-comp://<id>/index.html. */
  registrarVista(id: string, html: string): Promise<string>;
  /** Revisa lo que necesita la app. Con `claude: true` también consulta a Claude (gasta una consulta). */
  verificarSistema(opciones?: { claude?: boolean }): Promise<EstadoSistema>;
  /** Progreso de una acción del asistente (preparar el entorno, instalar FFmpeg…). */
  alProgresoSistema(cb: (p: { pct: number; texto?: string }) => void): () => void;
  accionSistema(accion: NonNullable<Chequeo["accion"]>): Promise<void>;
  ventana: { minimizar(): void; maximizar(): void; cerrar(): void };
}
