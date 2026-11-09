import type { NivelVoz } from "@shared/tipos";

const LIMPIA = "highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15";
/** Filtro de FFmpeg de cada nivel de voz. */
export const FILTRO_VOZ: Record<NivelVoz, string> = {
  ligera: "highpass=f=80,dynaudnorm=f=200:g=15",
  limpia: LIMPIA,
  // Presencia a 3,5 kHz, menos siseo de las "s" y compresión suave.
  podcast: `${LIMPIA},equalizer=f=3500:t=q:w=1.2:g=3,deesser=i=0.4,acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2`,
};

/** Archivo de cada nivel en la carpeta del proyecto (la Limpia es la voz.m4a de siempre). */
export const archivoVoz = (nivel: NivelVoz = "limpia"): string => (nivel === "limpia" ? "voz.m4a" : `voz-${nivel}.m4a`);

/**
 * Voz limpia de la prédica (una vez por proyecto): sin graves de ruido (<80 Hz), con menos siseo
 * y eco (afftdn), sin agudos de ruido (>12 kHz) y con el volumen emparejado (dynaudnorm).
 * El segundo 0 de voz.m4a es el inicio del rango de la prédica.
 */
export function argsVozLimpia(video: string, inicio: number, fin: number, salida: string, nivel: NivelVoz = "limpia"): string[] {
  return [
    "-v", "error", "-y", "-progress", "pipe:1", "-nostats",
    "-ss", inicio.toFixed(3), "-t", (fin - inicio).toFixed(3), "-i", video,
    "-vn", "-af", FILTRO_VOZ[nivel],
    "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", salida,
  ];
}

/** "out_time_ms=1435750000" (microsegundos, aunque diga ms) → segundos, o null. */
export function segundosDeProgreso(linea: string): number | null {
  const m = /^out_time_(?:ms|us)=(\d+)/.exec(linea.trim());
  return m ? Number(m[1]) / 1e6 : null;
}
