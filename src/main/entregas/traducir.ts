import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { palabrasDe } from "@shared/reel/tiempo";
import { bloquesSrt, partirLineas, REGLAS_SRT, textoSrt, type BloqueSrt } from "@shared/srt";
import { extraerJson, partirComando, preguntar } from "../claude/analizar";
import { leerTranscripcion } from "../proyectos/almacen";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { baseEntregas, carpetaEntregas } from "./entregas";

/** Idiomas a los que se pueden traducir los subtítulos. */
export const IDIOMAS: Record<string, string> = { en: "inglés", pt: "portugués", fr: "francés", it: "italiano", de: "alemán", ko: "coreano", zh: "chino" };

/** Bloques que se mandan a Claude en cada consulta. */
const POR_PARTE = 120;
const DIEZ_MINUTOS = 10 * 60 * 1000;

/** Prompt para traducir una parte de los subtítulos. `indice0`: cuántos bloques van antes de esta parte. */
export function promptTraduccion(bloques: BloqueSrt[], idioma: string, indice0: number): string {
  const lista = bloques.map((b, i) => ({ n: indice0 + i + 1, texto: b.texto.replace(/\n/g, " ") }));
  return `TRADUCCIÓN DE SUBTÍTULOS. Traduce estos subtítulos de una prédica cristiana del español al ${IDIOMAS[idioma]} (idioma: ${idioma} (${IDIOMAS[idioma]})).

Reglas:
- Devuelve exactamente un elemento por bloque, con el mismo "n", en el mismo orden, y ningún "texto" vacío.
- Cada texto debe poder leerse en 2 líneas de 42 caracteres como mucho: si hace falta, resume un poco sin cambiar el sentido.
- Mantén el tono de una iglesia, cercano y sencillo. No agregues explicaciones.
- Si se cita un versículo bíblico, usa una versión reconocida de la Biblia en ese idioma (por ejemplo la KJV o la NIV en inglés, la Almeida en portugués). Nunca inventes un versículo; si no estás seguro de la cita, tradúcela literalmente.

Responde solo con un arreglo JSON de la forma [{"n":1,"texto":"…"}].

Bloques (JSON):
${JSON.stringify(lista)}`;
}

/** Valida la respuesta de una parte: mismos números, en orden, sin textos vacíos. */
function leerParte(respuesta: string, esperados: number[]): string[] | null {
  let v: unknown;
  try {
    v = extraerJson(respuesta);
  } catch {
    return null;
  }
  if (!Array.isArray(v) || v.length !== esperados.length) return null;
  const textos: string[] = [];
  for (let i = 0; i < v.length; i++) {
    const x = v[i] as { n?: unknown; texto?: unknown };
    if (Number(x?.n) !== esperados[i] || typeof x.texto !== "string" || !x.texto.trim()) return null;
    textos.push(x.texto.trim());
  }
  return textos;
}

/** Texto traducido en 2 líneas de 42 cuando se puede (si no cabe, se deja como vino). */
const acomodar = (t: string): string => {
  const plano = t.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
  return (partirLineas(plano, REGLAS_SRT.maxLinea, REGLAS_SRT.maxLineas) ?? [plano]).join("\n");
};

/**
 * Traduce los subtítulos de la prédica a cada idioma (una consulta por cada 120 bloques, un reintento por parte)
 * y escribe exportados/<slug>.<idioma>.srt con los tiempos del video completo o, con `completo: false`, de la prédica.
 * Si una parte sigue mal tras el reintento, ese idioma no se guarda y se avisa.
 */
export async function traducirSrt(
  proyectoId: string, idiomas: string[],
  opciones: { comando?: string; senal?: AbortSignal; alProgreso?: (texto: string) => void; completo?: boolean } = {},
): Promise<string[]> {
  if (!idiomas.length || idiomas.some((i) => !IDIOMAS[i])) throw new Error("Ese idioma no está disponible.");
  const t = await leerTranscripcion(proyectoId);
  if (!t?.segmentos.length) throw new Error("No hay transcripción para traducir.");
  const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
  const senal = opciones.senal ?? new AbortController().signal;
  const bloques = bloquesSrt(palabrasDe(t));
  const partes: BloqueSrt[][] = [];
  for (let i = 0; i < bloques.length; i += POR_PARTE) partes.push(bloques.slice(i, i + POR_PARTE));
  const base = await baseEntregas(proyectoId);
  const carpeta = await carpetaEntregas(proyectoId);
  const nombres: string[] = [];
  for (const idioma of idiomas) {
    const traducidos: string[] = [];
    for (let p = 0; p < partes.length; p++) {
      opciones.alProgreso?.(`Traduciendo al ${IDIOMAS[idioma]} (parte ${p + 1} de ${partes.length})…`);
      const indice0 = p * POR_PARTE;
      const esperados = partes[p].map((_, i) => indice0 + i + 1);
      const prompt = promptTraduccion(partes[p], idioma, indice0);
      const tiempo = AbortSignal.timeout(DIEZ_MINUTOS);
      let textos = leerParte(await preguntar(comando, prompt, senal, tiempo), esperados);
      if (!textos) {
        // El aviso va antes de los bloques: el JSON sigue al final del prompt.
        const otraVez = prompt.replace("Bloques (JSON):", `Tu respuesta anterior no tenía exactamente ${esperados.length} bloques válidos. Responde solo con el arreglo JSON completo.\n\nBloques (JSON):`);
        textos = leerParte(await preguntar(comando, otraVez, senal, tiempo), esperados);
      }
      if (!textos) throw new Error(`No pude traducir al ${IDIOMAS[idioma]}. Prueba de nuevo.`);
      traducidos.push(...textos);
    }
    const nombre = `${base}.${idioma}.srt`;
    // Los mismos tiempos que el SRT en español: del video completo o solo de la prédica.
    const desplazar = opciones.completo === false ? -t.inicio : 0;
    await writeFile(join(carpeta, nombre), textoSrt(bloques.map((b, i) => ({ ...b, texto: acomodar(traducidos[i]) })), desplazar), "utf8");
    nombres.push(nombre);
  }
  return nombres;
}
