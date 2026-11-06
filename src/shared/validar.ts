/** "1:40" o "1:02:05" */
export function formatoTiempo(seg: number): string {
  const t = Math.max(0, Math.floor(seg));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Devuelve el mensaje de error en español o null si el rango de la prédica es válido. */
export function validarRango(inicio: number, fin: number, duracion: number): string | null {
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) return "Escribe el inicio y el fin de la prédica.";
  if (inicio < 0) return "El inicio de la prédica no puede ser negativo.";
  if (fin <= inicio) return "El fin de la prédica debe ser después del inicio.";
  if (fin > duracion + 0.5) return `El fin de la prédica pasa la duración del video (${formatoTiempo(duracion)}).`;
  return null;
}
