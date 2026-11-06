export type EstadoProyecto = "nuevo" | "transcribiendo" | "limpiando" | "caras" | "analizando" | "listo" | "error";
export type NombrePaso = "transcripcion" | "audio" | "caras" | "analisis";

export interface VideoOrigen {
  ruta: string;
  tamano: number;
  modificado: number;
  duracion: number;
}

export interface Paso {
  estado: "pendiente" | "ok" | "error";
  segundos?: number;
  detalle?: string;
}

export interface Proyecto {
  id: string;
  nombre: string;
  creado: string;
  video: VideoOrigen;
  rango: { inicio: number; fin: number };
  predicador?: string;
  estado: EstadoProyecto;
  pasos: Record<NombrePaso, Paso>;
  videoDisponible?: boolean;
}

export interface Segmento {
  s: number;
  e: number;
  t: string;
  w: [number, number, string][];
}

export interface Transcripcion {
  formato: "pulpito-transcripcion/1";
  inicio: number;
  fin: number;
  modelo: string;
  dispositivo: string;
  segmentos: Segmento[];
}

/** [t, [[x, y, w, score], ...]] con coordenadas normalizadas 0–1. */
export type Caras = [number, [number, number, number, number][]][];

export type TipoTarea = "transcribir" | "audio" | "caras" | "analizar" | "exportar";
export type EstadoTarea = "pendiente" | "corriendo" | "ok" | "error" | "cancelada" | "interrumpida";

export interface Tarea {
  id: string;
  proyectoId: string;
  tipo: TipoTarea;
  estado: EstadoTarea;
  pct: number;
  texto?: string;
  error?: string;
  creada: string;
  iniciada?: string;
  terminada?: string;
  /** Solo "exportar": qué clip, en qué formato, y la copia del clip al momento de encolar. */
  clipId?: string;
  formato?: Formato;
  instantanea?: ClipSpec;
}

export type Animo = "reflexivo" | "esperanza" | "victoria" | "adoracion" | "tension";
export const ANIMOS: readonly Animo[] = ["reflexivo", "esperanza", "victoria", "adoracion", "tension"];
export type EstiloSub = "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon";
export type ModoMusica = "auto" | "pista" | "pad" | "ninguna";

export interface Redes {
  instagram: { texto: string; hashtags: string[] };
  tiktok: { texto: string; hashtags: string[] };
  facebook: { texto: string };
  youtube: { titulo: string; texto: string };
}

/** Lo que la iglesia guarda una vez y se aplica a cada clip nuevo. */
export interface EstiloIglesia {
  subtitulos: { estilo: EstiloSub; tamano: "s" | "m" | "l" };
  musica: { modo: ModoMusica; volumen: number };
  cortes: { pausas: boolean; muletillas: boolean };
  efectos: { transicion: "destello" | "luz" | "ninguna"; grano: boolean; rotulo: boolean };
  cierre: boolean;
  formatos: Formato[];
}

export interface Marca {
  nombre: string;
  color: string;
  invitacion: string;
  logo?: string;
  /** 0,5–1,5 (1 = tamaño normal). */
  logoEscala: number;
  redes: { instagram?: string; tiktok?: string; facebook?: string; youtube?: string };
  predicador?: string;
  estilo: EstiloIglesia;
}

export const CATEGORIAS = ["Enseñanza", "Reflexión", "Exhortación", "Esperanza", "Testimonio", "Llamado"] as const;
export type Categoria = (typeof CATEGORIAS)[number];
export type Formato = "9:16" | "4:5" | "1:1";

export interface ClipSpec {
  id: string;
  titulo: string;
  gancho: string;
  ganchosAlternativos: string[];
  categoria: Categoria;
  inicio: number;
  fin: number;
  apertura: { activa: boolean; inicio: number; fin: number; frase: string } | null;
  palabrasClave: string[];
  /** Texto en Reina-Valera 1960, escrito por Claude; no se exporta hasta que la persona lo confirma. */
  versiculos: { ref: string; texto: string; en: number; activo: boolean; confirmado: boolean }[];
  puntaje: number;
  razon: string;
  descripcion: string;
  hashtags: string[];
  encuadre: { modo: "auto" | "fijo"; x: number; zoom: number };
  subtitulos: { activos: boolean; estilo: EstiloSub; tamano: "s" | "m" | "l"; altura: number };
  musica: { modo: ModoMusica; pista: string | null; animo: Animo; tonalidad: string; volumen: number };
  cortes: EstiloIglesia["cortes"];
  efectos: EstiloIglesia["efectos"];
  redes: Redes;
  cierre: boolean;
  formatos: Formato[];
  estado: "sugerido" | "editado" | "exportado";
}
