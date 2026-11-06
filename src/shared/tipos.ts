export type EstadoProyecto = "nuevo" | "transcribiendo" | "caras" | "analizando" | "listo" | "error";
export type NombrePaso = "transcripcion" | "caras" | "analisis";

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
  versiculos: { ref: string; texto: string; en: number; activo: boolean }[];
  puntaje: number;
  razon: string;
  descripcion: string;
  hashtags: string[];
  encuadre: { modo: "auto" | "fijo"; x: number; zoom: number };
  subtitulos: { activos: boolean; estilo: "pop" | "caja" | "limpio"; tamano: "s" | "m" | "l"; altura: number };
  musica: { pista: string | null; volumen: number };
  cierre: boolean;
  formatos: Formato[];
  estado: "sugerido" | "editado" | "exportado";
}
