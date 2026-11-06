import type { Pista } from "./reel/pistas";
import type { Animo, Caras, ClipSpec, Formato, Marca, Proyecto, Tarea, TipoTarea, Transcripcion, VideoOrigen } from "./tipos";

export interface Chequeo {
  ok: boolean;
  detalle: string;
  accion?: "instalar-ffmpeg" | "crear-venv" | "iniciar-sesion-claude";
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
  leerTranscripcion(id: string): Promise<Transcripcion | null>;
  leerCaras(id: string): Promise<Caras | null>;
  /** Guarda un clip editado (reemplaza el de mismo id en clips.json). */
  guardarClip(proyectoId: string, clip: ClipSpec): Promise<void>;
  leerMarca(): Promise<Marca>;
  listarPistas(): Promise<Pista[]>;
  /** Abre el diálogo para agregar pistas propias; devuelve las agregadas. */
  agregarPistas(): Promise<Pista[]>;
  cambiarAnimo(id: string, animo: Animo): Promise<void>;
  /** URL para escuchar una pista de la carpeta de música. */
  urlPista(id: string): string;
  guardarMarca(m: Marca): Promise<void>;
  /** Abre el diálogo para elegir el logo, lo copia a la carpeta de la marca y devuelve su ruta (null si se cancela). */
  elegirLogo(): Promise<string | null>;
  /** Aplica el estilo de la iglesia a los clips sin exportar del proyecto. */
  aplicarEstilo(proyectoId: string): Promise<void>;
  /** Ancho y alto del video original (para encuadrar). */
  infoVideo(id: string): Promise<{ ancho: number; alto: number }>;
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
  verificarSistema(): Promise<EstadoSistema>;
  accionSistema(accion: NonNullable<Chequeo["accion"]>): Promise<void>;
  ventana: { minimizar(): void; maximizar(): void; cerrar(): void };
}
