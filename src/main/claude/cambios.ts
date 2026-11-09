import { z } from "zod";
import { moverVersiculos } from "@shared/clip";
import { recortarRedes } from "@shared/redes";
import { ajustarCorte, DURACION_MINIMA } from "@shared/reel/cortes";
import { ajustarQuitado, duracionConservada } from "@shared/reel/cortes-voz";
import { ESTILOS_SUB } from "@shared/reel/estilos-sub";
import { palabrasDe, type Palabra } from "@shared/reel/tiempo";
import { ANIMOS, type Animo, type ClipSpec, type EstiloSub, type Transcripcion } from "@shared/tipos";
import { extraerObjeto } from "../ia/claude";
import { leerTranscripcion } from "../proyectos/almacen";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { partirComando, preguntar } from "./analizar";
import { aSegundos, ubicarFrase } from "./normalizar";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const texto = z.string().optional().catch(undefined);
const conHashtags = z.object({ texto: z.string().default(""), hashtags: z.array(z.string()).default([]) });

/** Lo que Claude puede cambiar de un clip. Cada campo inválido se ignora (nunca un error técnico). */
const CambiosClaude = z.object({
  resumen: z.string().catch("Listo."),
  titulo: texto,
  gancho: texto,
  inicio: texto,
  fin: texto,
  apertura_frase: texto,
  palabras_clave: z.array(z.string()).optional().catch(undefined),
  redes: z.object({
    instagram: conHashtags, tiktok: conHashtags,
    facebook: z.object({ texto: z.string().default("") }),
    youtube: z.object({ titulo: z.string().default(""), texto: z.string().default("") }),
  }).optional().catch(undefined),
  animo: texto,
  estilo_subtitulos: texto,
  quitar: z.array(z.object({ desde: z.string(), hasta: z.string() })).optional().catch(undefined),
});
export type CambiosClaude = z.infer<typeof CambiosClaude>;

export interface EntradaHistorial { pedido: string; resumen: string }

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Un reel no pasa de 90 s. */
export const DURACION_MAXIMA = 90;
/** 30.93 → "0:00:30.9" */
export function tiempoDecimas(seg: number): string {
  const d = Math.round(seg * 10) / 10;
  const h = Math.floor(d / 3600), m = Math.floor((d % 3600) / 60), s = d - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Aplica los cambios de Claude al clip. Los tiempos se ajustan a límites de palabra (mínimo 5 s) dentro de la
 * prédica; si no sirven, se ignoran con un aviso. Los versículos solo se mueven con el corte: Claude nunca los cambia.
 */
export function aplicarCambios(clip: ClipSpec, cambios: CambiosClaude, palabras: Palabra[], rango: { inicio: number; fin: number }): { clip: ClipSpec; avisos: string[] } {
  const avisos: string[] = [];
  let c: ClipSpec = { ...clip, estado: clip.estado === "sugerido" ? "editado" : clip.estado };
  const limpio = (t?: string) => t?.trim() || undefined;
  if (limpio(cambios.titulo)) c.titulo = limpio(cambios.titulo)!;
  if (limpio(cambios.gancho)) c.gancho = limpio(cambios.gancho)!;

  if (cambios.inicio !== undefined || cambios.fin !== undefined) {
    const ini = cambios.inicio !== undefined ? aSegundos(cambios.inicio) : clip.inicio;
    const fin = cambios.fin !== undefined ? aSegundos(cambios.fin) : clip.fin;
    const problema = !Number.isFinite(ini) || !Number.isFinite(fin) ? "Claude dio un tiempo que no entiendo."
      : ini < rango.inicio - 0.5 || fin > rango.fin + 0.5 ? "el tiempo queda fuera de la prédica."
      : fin <= ini ? "el final queda antes del inicio." : null;
    if (problema) avisos.push(`No pude usar el nuevo corte: ${problema}`);
    else {
      const enRango = palabras.filter((w) => w.s >= rango.inicio && w.e <= rango.fin);
      let corte = ajustarCorte({ inicio: ini, fin }, enRango);
      if (corte.fin - corte.inicio > DURACION_MAXIMA) {
        // Un reel no pasa de 90 s: se corta en la última palabra que cabe.
        const ultima = enRango.filter((w) => w.s >= corte.inicio && w.e <= corte.inicio + DURACION_MAXIMA).at(-1);
        corte = { inicio: corte.inicio, fin: ultima ? ultima.e : corte.inicio + DURACION_MAXIMA };
        avisos.push("Lo dejé en 90 segundos, el máximo para un reel.");
      }
      c = { ...c, inicio: corte.inicio, fin: corte.fin, versiculos: moverVersiculos(clip.versiculos, clip.inicio, clip.fin, corte.inicio, corte.fin) };
    }
  }

  if (limpio(cambios.apertura_frase)) {
    const intro = ubicarFrase(palabras, cambios.apertura_frase!, c.inicio, c.fin);
    if (intro && intro.e - intro.s >= 1.5) {
      c.apertura = { activa: true, inicio: Math.max(0, r2(intro.s - 0.15)), fin: r2(Math.min(intro.s + 8, intro.e + 0.25)), frase: intro.frase };
    } else avisos.push("No encontré la frase de apertura dentro del clip; dejé la de antes.");
  }
  if (cambios.palabras_clave?.length) c.palabrasClave = cambios.palabras_clave.map((p) => p.trim()).filter(Boolean).slice(0, 6);
  if (cambios.redes) c.redes = recortarRedes(cambios.redes);
  const animo = cambios.animo ? ANIMOS.find((a) => sinTildes(a) === sinTildes(cambios.animo!)) : undefined;
  if (animo) c.musica = { ...c.musica, animo: animo as Animo };
  const estilo = cambios.estilo_subtitulos ? ESTILOS_SUB.find((e) => sinTildes(e) === sinTildes(cambios.estilo_subtitulos!)) : undefined;
  if (estilo) c.subtitulos = { ...c.subtitulos, estilo: estilo as EstiloSub };

  if (cambios.quitar?.length) {
    const nuevos = cambios.quitar
      .map((q) => ({ inicio: aSegundos(q.desde), fin: aSegundos(q.hasta) }))
      .filter((q) => Number.isFinite(q.inicio) && Number.isFinite(q.fin))
      .map((q) => ajustarQuitado(q, palabras, c))
      .filter((q): q is { inicio: number; fin: number } => q !== null);
    if (nuevos.length < cambios.quitar.length) avisos.push("Algunos tramos que Claude quería quitar quedaban fuera del clip; no los quité.");
    if (nuevos.length) {
      const conQuitados: ClipSpec = { ...c, cortes: { ...c.cortes, quitados: [...(c.cortes.quitados ?? []), ...nuevos] } };
      if (duracionConservada(conQuitados, palabras) >= DURACION_MINIMA) c = conQuitados;
      else avisos.push("No quité esos tramos: el clip quedaría con menos de 5 segundos.");
    }
  }
  return { clip: c, avisos };
}

/** Transcripción alrededor del clip (±60 s) en líneas de ~8 palabras con su tiempo en décimas. */
function transcripcionCercana(t: Transcripcion, c: ClipSpec): string {
  const ws = palabrasDe(t).filter((w) => w.s >= c.inicio - 60 && w.e <= c.fin + 60 && w.t.trim());
  const lineas: string[] = [];
  for (let i = 0; i < ws.length; i += 8) {
    const grupo = ws.slice(i, i + 8);
    const marca = grupo[0].s >= c.inicio && grupo[0].s <= c.fin ? "" : " (fuera del clip)";
    lineas.push(`[${tiempoDecimas(grupo[0].s)}]${marca} ${grupo.map((w) => w.t.trim()).join(" ")}`);
  }
  return lineas.join("\n");
}

/** Prompt para pedir cambios a un clip en palabras de la persona. */
export function promptCambios(c: ClipSpec, t: Transcripcion, pedido: string, historial: EntradaHistorial[]): string {
  const actual = {
    titulo: c.titulo, gancho: c.gancho, inicio: tiempoDecimas(c.inicio), fin: tiempoDecimas(c.fin), duracion_segundos: Math.round(c.fin - c.inicio),
    apertura_frase: c.apertura?.activa ? c.apertura.frase : null, palabras_clave: c.palabrasClave, animo: c.musica.animo,
    estilo_subtitulos: c.subtitulos.estilo, versiculos: c.versiculos.map((v) => v.ref), redes: c.redes,
  };
  const antes = historial.slice(-3).map((h) => `- La persona pidió: «${h.pedido}». Tú respondiste: «${h.resumen}»`).join("\n");
  return `CAMBIOS DE UN CLIP. Eres el editor de redes sociales de una iglesia cristiana hispana. La persona está editando un reel de una prédica y te pide un cambio.

Pedido de la persona: «${pedido.trim()}»
${antes ? `\nLo que ya pidió antes sobre este clip:\n${antes}\n` : ""}
El clip ahora (JSON):
${JSON.stringify(actual)}

Transcripción alrededor del clip, con el segundo en que empieza cada línea (H:MM:SS.d):
${transcripcionCercana(t, c)}

Responde solo con un objeto JSON con lo que cambia (deja fuera lo que no cambia) y un "resumen" de una oración, en español sencillo, de lo que hiciste:
{"resumen":"…","titulo":"…","gancho":"…","inicio":"0:12:30.4","fin":"0:13:10.2","apertura_frase":"…","palabras_clave":["…"],"animo":"esperanza","estilo_subtitulos":"pop","quitar":[{"desde":"0:12:40.1","hasta":"0:12:42.0"}],"redes":{"instagram":{"texto":"…","hashtags":["#fe"]},"tiktok":{"texto":"…","hashtags":["#fe"]},"facebook":{"texto":"…"},"youtube":{"titulo":"…","texto":"…"}}}

Reglas:
- "inicio" y "fin" usan los tiempos de la transcripción; el clip debe durar entre 5 y 90 segundos, empezar con una frase fuerte y terminar con la idea cerrada.
- "quitar": tramos dentro del clip que conviene sacar (una frase que se repite, algo que no se entiende solo).
- "apertura_frase": una frase que se dice dentro del clip, copiada palabra por palabra.
- "gancho": máximo 8 palabras. "animo": uno de ${ANIMOS.join(", ")}. "estilo_subtitulos": uno de ${ESTILOS_SUB.join(", ")}.
- Nunca agregues ni cambies versículos, y no cambies el sentido de lo que dijo el predicador.
- Escribe como habla la iglesia, sin sonar a inteligencia artificial.`;
}

const TRES_MINUTOS = 3 * 60 * 1000;
const ERROR_CAMBIOS = "Claude no devolvió cambios válidos. Prueba con otras palabras.";

/** Una consulta a Claude (un reintento si el formato falla) y los cambios ya aplicados al clip. */
export async function pedirCambios(
  proyectoId: string, clip: ClipSpec, pedido: string, historial: EntradaHistorial[],
  opciones: { comando?: string; senal?: AbortSignal; tiempoMaximoMs?: number } = {},
): Promise<{ clip: ClipSpec; resumen: string; avisos: string[] }> {
  if (!pedido.trim()) throw new Error("Escribe qué quieres cambiar.");
  const t = await leerTranscripcion(proyectoId);
  if (!t) throw new Error("No hay transcripción para este proyecto. Vuelve a procesar la prédica.");
  const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
  const senal = opciones.senal ?? new AbortController().signal;
  const tiempo = AbortSignal.timeout(opciones.tiempoMaximoMs ?? TRES_MINUTOS);
  const prompt = promptCambios(clip, t, pedido, historial);
  const leer = (r: string) => CambiosClaude.parse(extraerObjeto(r, ERROR_CAMBIOS));
  let cambios: CambiosClaude;
  try {
    cambios = leer(await preguntar(comando, prompt, senal, tiempo));
  } catch (e) {
    if (e instanceof Error && e.message !== ERROR_CAMBIOS) throw e;
    cambios = leer(await preguntar(comando, `${prompt}\n\nTu respuesta anterior no tenía el formato pedido. Responde solo con el objeto JSON.`, senal, tiempo));
  }
  const r = aplicarCambios(clip, cambios, palabrasDe(t), { inicio: t.inicio, fin: t.fin });
  return { ...r, resumen: cambios.resumen.trim() || "Listo." };
}
