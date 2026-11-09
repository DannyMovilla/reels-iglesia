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

/** Pedido de la persona para el análisis de Claude: instrucción opcional (≤ 300 caracteres) y duración de los clips. */
export interface Analisis {
  instruccion?: string;
  /** corta: 15–30 s; normal: 30–60 s; larga: 60–90 s. */
  duracion: "corta" | "normal" | "larga";
}

export interface Proyecto {
  id: string;
  nombre: string;
  creado: string;
  video: VideoOrigen;
  rango: { inicio: number; fin: number };
  predicador?: string;
  /** Sin el campo (proyectos de antes del plan 5): clips de 30 a 90 s, sin instrucción. */
  analisis?: Analisis;
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

export type TipoTarea = "transcribir" | "audio" | "caras" | "analizar" | "exportar" | "exportar-ia";
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
  /** Solo "exportar-ia": qué reel de «Con IA» (proyectoId es "ia:<id>") y su copia al momento de encolar. */
  creacionId?: string;
  instantaneaIa?: Creacion;
}

export type Animo = "reflexivo" | "esperanza" | "victoria" | "adoracion" | "tension";
export const ANIMOS: readonly Animo[] = ["reflexivo", "esperanza", "victoria", "adoracion", "tension"];
export type EstiloSub = "pop" | "caja" | "limpio" | "resaltado" | "karaoke" | "impacto" | "neon";
export type Intensidad = "suave" | "normal" | "fuerte";
/** Color del video: look, intensidad 0–1 y balance de blancos (ganancias R, G, B) medido del video. */
export interface ColorClip { look: import("./reel/color").Look; intensidad: number; balance?: [number, number, number] }
/** Ligera: solo graves y volumen parejo. Limpia: también menos ruido (la de siempre). Podcast: Limpia + presencia y compresión. */
export type NivelVoz = "ligera" | "limpia" | "podcast";
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
  /** intensidad: sin ella, "normal". lista: muletillas que se quitan (sin ella, las de por defecto). */
  cortes: { pausas: boolean; muletillas: boolean; intensidad?: Intensidad; lista?: string[] };
  /** sonidos: efectos de sonido (whoosh en transiciones, pop con el gancho); sin el campo, encendidos. */
  efectos: { transicion: "destello" | "luz" | "ninguna"; grano: boolean; rotulo: boolean; sonidos?: boolean };
  cierre: boolean;
  formatos: Formato[];
  /** Sin el campo: "limpia". */
  voz?: NivelVoz;
  /** Look de color de la iglesia (sin balance: el balance es de cada video). */
  color?: ColorClip;
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
  versiculos: { ref: string; texto: string; en: number; activo: boolean; confirmado: boolean; fuera?: boolean }[];
  puntaje: number;
  razon: string;
  descripcion: string;
  hashtags: string[];
  encuadre: { modo: "auto" | "fijo"; x: number; zoom: number };
  subtitulos: { activos: boolean; estilo: EstiloSub; tamano: "s" | "m" | "l"; altura: number };
  musica: { modo: ModoMusica; pista: string | null; animo: Animo; tonalidad: string; volumen: number };
  /** quitados: tramos del video original que la persona quitó (frases repetidas, a mano). */
  cortes: EstiloIglesia["cortes"] & { quitados?: { inicio: number; fin: number }[] };
  efectos: EstiloIglesia["efectos"];
  redes: Redes;
  cierre: boolean;
  formatos: Formato[];
  estado: "sugerido" | "editado" | "exportado";
  /** Nivel de voz; sin el campo, "limpia". */
  voz?: NivelVoz;
  /** Corrección de color; sin el campo, el video queda como está. */
  color?: ColorClip;
  favorito?: boolean;
  /** Oculto de la lista (se ve con "Ver ocultos"). */
  oculto?: boolean;
  /** "manual": la persona lo creó desde la transcripción. Sin el campo: lo sugirió Claude. */
  origen?: "claude" | "manual";
}

/** Escenas animadas para los reels de «Con IA» (fondos del catálogo de HyperFrames). */
export type Escena = "luz" | "amanecer" | "aurora" | "nubes" | "atardecer" | "destello";

/** Un reel de «Con IA»: un versículo RVR1960 (escrito por Claude, confirmado por la persona) con su reflexión. */
export interface Creacion {
  id: string;
  creado: string;
  entrada: { tipo: "versiculo" | "tema"; texto: string };
  versiculo: { ref: string; texto: string; confirmado: boolean };
  gancho: string;
  reflexion: string;
  palabrasClave: string[];
  musica: ClipSpec["musica"];
  subtitulos: { estilo: EstiloSub };
  fondo: { tipo: "escena" | "degradado" | "imagen" | "video"; escena?: Escena; archivo?: string };
  redes: Redes;
  formatos: Formato[];
  estado: "borrador" | "exportado";
  /** Whoosh suave entre tarjetas; sin el campo, encendido. */
  sonidos?: boolean;
}
