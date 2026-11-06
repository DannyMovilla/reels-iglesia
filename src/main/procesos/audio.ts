/**
 * Voz limpia de la prédica (una vez por proyecto): sin graves de ruido (<80 Hz), con menos siseo
 * y eco (afftdn), sin agudos de ruido (>12 kHz) y con el volumen emparejado (dynaudnorm).
 * El segundo 0 de voz.m4a es el inicio del rango de la prédica.
 */
export function argsVozLimpia(video: string, inicio: number, fin: number, salida: string): string[] {
  return [
    "-v", "error", "-y", "-progress", "pipe:1", "-nostats",
    "-ss", inicio.toFixed(3), "-t", (fin - inicio).toFixed(3), "-i", video,
    "-vn", "-af", "highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15",
    "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", salida,
  ];
}

/** "out_time_ms=1435750000" (microsegundos, aunque diga ms) → segundos, o null. */
export function segundosDeProgreso(linea: string): number | null {
  const m = /^out_time_(?:ms|us)=(\d+)/.exec(linea.trim());
  return m ? Number(m[1]) / 1e6 : null;
}
