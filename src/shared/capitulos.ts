/** Capítulos de la prédica para la descripción de YouTube. `t`: segundos desde el inicio de la prédica. */
export interface Capitulo { t: number; titulo: string }
export interface Capitulos { resumen: string; capitulos: Capitulo[] }

/** YouTube pide: el primero en 0:00, al menos 3 y cada uno de 10 s o más. */
export const SEPARACION_MINIMA = 10;
export const ERROR_POCOS = "Claude no encontró al menos 3 partes en la prédica.";

export function limpiarCapitulos(cs: Capitulo[], duracion: number): Capitulo[] {
  const orden = cs
    .filter((c) => Number.isFinite(c.t) && c.t >= 0 && c.t < duracion && c.titulo.trim())
    .map((c) => ({ t: Math.round(c.t), titulo: c.titulo.trim() }))
    .sort((a, b) => a.t - b.t);
  const r: Capitulo[] = [];
  for (const c of orden) {
    if (r.length === 0) r.push({ ...c, t: 0 });
    else if (c.t - r[r.length - 1].t >= SEPARACION_MINIMA) r.push(c);
  }
  if (r.length < 3) throw new Error(ERROR_POCOS);
  return r;
}

const conHoras = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const sinHoras = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Texto para pegar en YouTube: el resumen, una línea en blanco y los capítulos. `completo`: tiempos del video
 * del culto entero (con "Inicio del culto" en 0:00 si la prédica no empieza al principio); si no, de la prédica.
 */
export function textoYoutube(c: Capitulos, opciones: { completo: boolean; inicioRango: number }): string {
  const desplazar = opciones.completo ? Math.round(opciones.inicioRango) : 0;
  const lineas = c.capitulos.map((x) => ({ t: x.t + desplazar, titulo: x.titulo }));
  if (desplazar >= SEPARACION_MINIMA) lineas.unshift({ t: 0, titulo: "Inicio del culto" });
  else if (lineas.length) lineas[0] = { ...lineas[0], t: 0 };
  const fmt = (lineas.at(-1)?.t ?? 0) >= 3600 ? conHoras : sinHoras;
  const lista = lineas.map((x) => `${fmt(x.t)} ${x.titulo}`).join("\n");
  return c.resumen.trim() ? `${c.resumen.trim()}\n\n${lista}` : lista;
}
