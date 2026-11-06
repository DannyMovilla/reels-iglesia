import { r2, type Palabra, type Parte } from "./tiempo";

export interface Tramo { desde: number; hasta: number }
export interface Punto { t: number; v: number }

/** Volumen de la música en la entrada (primeros 1,8 s). */
export const VOLUMEN_ENTRADA = 0.5;
const FIN_ENTRADA = 1.8;
const BAJADA = 0.4;
/** Una pausa de la voz más larga que esto deja subir la música. */
const PAUSA_LARGA = 1.2;
const DESVANECER = 1.0;

/** Momentos del reel en que se oye la voz (palabras de cada parte con video, en tiempo de reel; unidas si están a < 0,5 s). */
export function tramosDeVoz(partes: Parte[], palabras: Palabra[]): Tramo[] {
  const crudos: Tramo[] = [];
  for (const p of partes) {
    if (p.tipo === "cierre") continue;
    for (const w of palabras) {
      if (w.e <= p.inicioVideo || w.s >= p.finVideo) continue;
      const desde = p.inicioReel + Math.max(0, w.s - p.inicioVideo);
      const hasta = p.inicioReel + Math.min(p.duracion, w.e - p.inicioVideo);
      crudos.push({ desde: r2(desde), hasta: r2(hasta) });
    }
  }
  crudos.sort((a, b) => a.desde - b.desde);
  const unidos: Tramo[] = [];
  for (const t of crudos) {
    const ultimo = unidos.at(-1);
    if (ultimo && t.desde - ultimo.hasta < 0.5) ultimo.hasta = Math.max(ultimo.hasta, t.hasta);
    else unidos.push({ ...t });
  }
  return unidos;
}

/**
 * Carril de volumen de la música: entra a 0,5 los primeros 1,8 s, baja al volumen del clip bajo la voz,
 * sube a 2× ese volumen (máx. 0,3) en pausas de más de 1,2 s y se desvanece en el último segundo.
 */
export function curvaMusica(voz: Tramo[], duracion: number, volumen: number): Punto[] {
  const alto = Math.min(0.3, volumen * 2);
  const puntos: Punto[] = [{ t: 0, v: VOLUMEN_ENTRADA }, { t: FIN_ENTRADA, v: VOLUMEN_ENTRADA }, { t: FIN_ENTRADA + BAJADA, v: volumen }];
  const agregar = (t: number, v: number) => puntos.push({ t: r2(Math.max(t, puntos.at(-1)!.t)), v });
  const subir = (desde: number, hasta: number) => {
    agregar(desde + 0.3, volumen);
    agregar(desde + 0.6, alto);
    agregar(hasta, alto);
  };
  for (let i = 1; i < voz.length; i++) {
    const a = voz[i - 1].hasta, b = voz[i].desde;
    if (b - a > PAUSA_LARGA && a + 0.3 >= FIN_ENTRADA + BAJADA) {
      subir(a, b - 0.3);
      agregar(b, volumen);
    }
  }
  const finVoz = voz.at(-1)?.hasta ?? 0;
  if (duracion - finVoz > PAUSA_LARGA && finVoz + 0.3 >= FIN_ENTRADA + BAJADA) subir(finVoz, duracion - DESVANECER);
  else agregar(duracion - DESVANECER, volumen);
  agregar(duracion, 0);
  return puntos;
}

/** Volumen del carril en el segundo t (interpolación lineal, como la hace HyperFrames). */
export function valorEn(puntos: Punto[], t: number): number {
  if (t <= puntos[0].t) return puntos[0].v;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1], b = puntos[i];
    if (t <= b.t) return b.t === a.t ? b.v : a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
  }
  return puntos.at(-1)!.v;
}
