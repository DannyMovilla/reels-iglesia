import { randomUUID } from "node:crypto";
import { completarClip, ESTILO_POR_DEFECTO } from "@shared/clip";
import type { ClipSpec, EstiloIglesia, Transcripcion } from "@shared/tipos";
import { formatearReferencia } from "../biblia/biblia";
import type { ClipClaude } from "./esquema";

interface Palabra { s: number; e: number; t: string }

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ]+/g, "");

/** "1:44:44" / "44:44" / "31" → segundos */
export function aSegundos(texto: string): number {
  const partes = texto.trim().replace(",", ".").split(":").map(Number);
  if (partes.some((p) => !Number.isFinite(p))) return NaN;
  return partes.reduce((a, p) => a * 60 + p, 0);
}

const palabras = (t: Transcripcion): Palabra[] => t.segmentos.flatMap((s) => s.w.map(([ws, we, wt]) => ({ s: ws, e: we, t: wt })));

function cercano(t: Transcripcion, valor: number, clave: "s" | "e"): number {
  let mejor = t.segmentos[0]?.[clave] ?? valor;
  for (const s of t.segmentos) if (Math.abs(s[clave] - valor) < Math.abs(mejor - valor)) mejor = s[clave];
  return mejor;
}

/** Ubica una frase palabra por palabra dentro de [a, b]; exige ≥ 50 % de coincidencia. */
export function ubicarFrase(ws: Palabra[], frase: string, a: number, b: number): { s: number; e: number; frase: string } | null {
  const objetivo = frase.split(/\s+/).map(norm).filter(Boolean);
  if (objetivo.length < 2) return null;
  const cand = ws.filter((w) => w.s >= a - 0.5 && w.e <= b + 0.5);
  let mejor = -1, puntos = 0;
  for (let i = 0; i < cand.length; i++) {
    let p = 0;
    for (let j = 0; j < objetivo.length && i + j < cand.length; j++) if (norm(cand[i + j].t) === objetivo[j]) p++;
    if (p > puntos) { puntos = p; mejor = i; }
  }
  if (mejor < 0 || puntos < Math.ceil(objetivo.length * 0.5)) return null;
  const ult = Math.min(cand.length - 1, mejor + objetivo.length - 1);
  return { s: cand[mejor].s, e: cand[ult].e, frase: cand.slice(mejor, ult + 1).map((w) => w.t).join(" ") };
}

export function normalizarClips(r: ClipClaude[], t: Transcripcion, estilo: EstiloIglesia = ESTILO_POR_DEFECTO): ClipSpec[] {
  const ws = palabras(t);
  const clips: ClipSpec[] = [];
  for (const c of r) {
    const a0 = aSegundos(c.inicio), b0 = aSegundos(c.fin);
    if (!Number.isFinite(a0) || !Number.isFinite(b0)) continue;
    const inicio = cercano(t, a0, "s"), fin = cercano(t, b0, "e");
    if (fin - inicio < 5) continue;
    const intro = c.intro_frase ? ubicarFrase(ws, c.intro_frase, inicio, fin) : null;
    const apertura = intro && intro.e - intro.s >= 1.5
      ? { activa: true, inicio: Math.max(0, intro.s - 0.15), fin: Math.min(intro.s + 8, intro.e + 0.25), frase: intro.frase }
      : null;
    const versiculos = c.versiculos.map((v) => {
      const cita = ubicarFrase(ws, v.cita.split(/\s+/).slice(0, 8).join(" "), inicio, fin);
      return { ref: formatearReferencia(v.ref), texto: v.texto.trim(), en: cita ? Math.round((cita.s - inicio) * 100) / 100 : 3, activo: true, confirmado: false };
    });
    clips.push(completarClip({
      id: randomUUID(),
      titulo: c.titulo,
      gancho: c.gancho,
      ganchosAlternativos: c.ganchos_alternativos,
      categoria: c.categoria,
      inicio,
      fin,
      apertura,
      palabrasClave: c.palabras_clave,
      versiculos,
      puntaje: Math.round(c.puntaje),
      razon: c.razon,
      descripcion: c.descripcion,
      hashtags: c.hashtags,
      encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
      subtitulos: { activos: true, estilo: estilo.subtitulos.estilo, tamano: estilo.subtitulos.tamano, altura: 0.74 },
      musica: { modo: estilo.musica.modo, pista: null, volumen: estilo.musica.volumen },
      cierre: estilo.cierre,
      formatos: [...estilo.formatos],
      estado: "sugerido",
    }, estilo));
  }
  return clips.sort((x, y) => y.puntaje - x.puntaje);
}
