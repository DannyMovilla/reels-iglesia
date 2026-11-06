import type { ClipSpec, Proyecto, Tarea, Transcripcion, VideoOrigen } from "./tipos";

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
}

/** API que el preload expone al renderer como `window.reels`. */
export interface ApiReels {
  elegirVideo(): Promise<VideoOrigen | null>;
  crearProyecto(d: DatosNuevoProyecto): Promise<Proyecto>;
  listarProyectos(): Promise<Proyecto[]>;
  leerProyecto(id: string): Promise<Proyecto>;
  leerClips(id: string): Promise<ClipSpec[]>;
  leerTranscripcion(id: string): Promise<Transcripcion | null>;
  procesar(id: string): Promise<void>;
  tareas(): Promise<Tarea[]>;
  alCambiarTareas(cb: (t: Tarea[]) => void): () => void;
  reintentar(idTarea: string): Promise<void>;
  cancelar(idTarea: string): Promise<void>;
  urlVideo(id: string): string;
  verificarSistema(): Promise<EstadoSistema>;
  accionSistema(accion: NonNullable<Chequeo["accion"]>): Promise<void>;
  ventana: { minimizar(): void; maximizar(): void; cerrar(): void };
}
