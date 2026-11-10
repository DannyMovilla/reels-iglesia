import type { ClipSpec, EstiloSub } from "../tipos";
import { siguienteConservado, videoAReel, type Palabra, type Parte } from "./tiempo";
import { type Ventana, ventanaVersiculo } from "./versiculo";
import { PRESETS_SUB, type EstiloNuevo } from "./presets-sub";

export interface PalabraBloque { texto: string; desde: number; hasta: number; clave: boolean }
export interface Bloque { desde: number; hasta: number; palabras: PalabraBloque[] }

const CORTO = { palabras: 3, letras: 16 };
const LIMITES: Record<EstiloSub, { palabras: number; letras: number }> = {
  pop: CORTO, caja: CORTO, limpio: { palabras: 6, letras: 30 }, resaltado: CORTO, karaoke: CORTO, impacto: CORTO, neon: CORTO,
  ...(Object.fromEntries(Object.entries(PRESETS_SUB).map(([id, p]) => [id, { palabras: p.palabras, letras: p.letras }])) as Record<EstiloNuevo, { palabras: number; letras: number }>),
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, "");

/** Mientras se ve la tarjeta del versículo no hay subtítulos: el que entra se corta y si queda < 0,3 s se omite. */
export function aplicarReglaVersiculo(bloques: Bloque[], ventanas: Ventana[]): Bloque[] {
  const salida: Bloque[] = [];
  for (const b0 of bloques) {
    let b: Bloque | null = { ...b0 };
    for (const v of ventanas) {
      if (!b) break;
      if (b.desde >= v.desde && b.desde < v.hasta) b = null;
      else if (b.desde < v.desde && b.hasta > v.desde) {
        b = { ...b, hasta: v.desde, palabras: b.palabras.filter((p) => p.desde < v.desde) };
        if (b.hasta - b.desde < 0.3) b = null;
      }
    }
    if (b) salida.push(b);
  }
  return salida;
}

/** Bloques de subtítulos del reel (apertura y clip), en tiempo de reel, con la regla del versículo aplicada. */
export function bloquesSubtitulos(c: ClipSpec, palabras: Palabra[], partes: Parte[]): Bloque[] {
  const lim = LIMITES[c.subtitulos.estilo];
  const claves = new Set(c.palabrasClave.map(norm).filter(Boolean));
  const bloques: Bloque[] = [];
  for (const parte of partes) {
    if (parte.tipo === "cierre") continue;
    // Un momento que se cortó va al siguiente que se conserva (nunca a una cuenta lineal que ignore los cortes).
    const aReel = (t: number) => videoAReel(parte, t) ?? videoAReel(parte, siguienteConservado(parte, t)) ?? Math.min(parte.inicioReel + parte.duracion, parte.inicioReel + Math.max(0, t - parte.inicioVideo));
    const finReel = parte.inicioReel + parte.duracion;
    let actual: Bloque | null = null;
    let previa: Palabra | null = null;
    const propios: Bloque[] = [];
    for (const w of palabras) {
      if (w.e <= parte.inicioVideo || w.s >= parte.finVideo) continue;
      if (parte.tramos && videoAReel(parte, (w.s + w.e) / 2) === null) continue; // palabra cortada (muletilla)
      const texto = w.t.replace(/\s+/g, " ").trim();
      if (!texto) continue;
      const letras = actual ? actual.palabras.reduce((a, p) => a + p.texto.length + 1, 0) : 0;
      if (!actual || actual.palabras.length >= lim.palabras || letras + texto.length > lim.letras
        || (previa && aReel(w.s) - aReel(previa.e) > 0.6) || (previa && /[.?!¿¡:;]$/.test(previa.t))) {
        actual = { desde: Math.max(parte.inicioReel, aReel(w.s)), hasta: 0, palabras: [] };
        propios.push(actual);
      }
      const n = norm(texto);
      actual.palabras.push({ texto, desde: aReel(w.s), hasta: aReel(w.e), clave: n.length > 2 && claves.has(n) });
      actual.hasta = Math.min(finReel, aReel(w.e));
      previa = w;
    }
    for (let i = 0; i < propios.length - 1; i++) if (propios[i + 1].desde - propios[i].hasta < 0.5) propios[i].hasta = propios[i + 1].desde;
    bloques.push(...propios);
  }
  const clip = partes.find((p) => p.tipo === "clip");
  const ventanas = clip ? c.versiculos.map((v) => ventanaVersiculo(v, clip)).filter((v): v is Ventana => v !== null) : [];
  return aplicarReglaVersiculo(bloques, ventanas);
}
