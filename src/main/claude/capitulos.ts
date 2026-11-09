import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { limpiarCapitulos, textoYoutube, type Capitulos } from "@shared/capitulos";
import type { Transcripcion } from "@shared/tipos";
import { extraerObjeto } from "../ia/claude";
import { guardarJson, leerJson, leerProyecto, leerTranscripcion } from "../proyectos/almacen";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { partirComando, preguntar } from "./analizar";
import { aSegundos } from "./normalizar";

const Respuesta = z.object({
  resumen: z.string().catch(""),
  capitulos: z.array(z.object({ t: z.union([z.string(), z.number()]), titulo: z.string() }).catch({ t: "x", titulo: "" })).catch([]),
});

/** 125 → "2:05" (desde el inicio de la prédica). */
const mmss = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Prompt de capítulos y resumen. Los tiempos van desde el inicio de la prédica (0:00). */
export function promptCapitulos(t: Transcripcion): string {
  const lineas = t.segmentos.map((s) => `[${mmss(s.s - t.inicio)}] ${s.t.trim()}`).join("\n");
  return `CAPÍTULOS DE UNA PRÉDICA. Eres el editor de una iglesia cristiana hispana. Abajo está la transcripción de una prédica, con el tiempo en que empieza cada línea (desde el inicio de la prédica).

Escribe:
- "resumen": de 2 a 4 oraciones con el mensaje central, fiel a lo que dijo el predicador, en español sencillo y cercano (para la descripción de YouTube).
- "capitulos": las partes de la prédica en orden, para los capítulos de YouTube: el primero en "0:00", al menos 3, cada uno de 10 segundos o más, con un título corto (máximo 6 palabras) que diga de qué trata esa parte. Si el predicador lee un pasaje, ponlo en el título (por ejemplo "Lectura: Filipenses 4").

Que no suene a inteligencia artificial: nada de "no es X, es Y", ni "sumérgete", "descubre", "transforma tu vida".

Responde solo con un objeto JSON con esta forma:
{"resumen":"…","capitulos":[{"t":"0:00","titulo":"…"},{"t":"4:12","titulo":"…"}]}

Transcripción:
${lineas}`;
}

const DIEZ_MINUTOS = 10 * 60 * 1000;
const ERROR_FORMATO = "Claude no devolvió los capítulos en el formato esperado. Toca «Crear capítulos» otra vez.";

/** Una consulta a Claude (un reintento si el formato falla); guarda capitulos.json. */
export async function crearCapitulos(proyectoId: string, opciones: { comando?: string; senal?: AbortSignal } = {}): Promise<Capitulos> {
  const t = await leerTranscripcion(proyectoId);
  if (!t?.segmentos.length) throw new Error("No hay transcripción para crear los capítulos.");
  const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
  const senal = opciones.senal ?? new AbortController().signal;
  const tiempo = AbortSignal.timeout(DIEZ_MINUTOS);
  const prompt = promptCapitulos(t);
  const leer = (r: string) => Respuesta.parse(extraerObjeto(r, ERROR_FORMATO));
  let r: z.infer<typeof Respuesta>;
  try {
    r = leer(await preguntar(comando, prompt, senal, tiempo));
  } catch (e) {
    if (e instanceof Error && e.message !== ERROR_FORMATO) throw e;
    r = leer(await preguntar(comando, `${prompt}\n\nTu respuesta anterior no tenía el formato pedido. Responde solo con el objeto JSON.`, senal, tiempo));
  }
  const capitulos = limpiarCapitulos(
    r.capitulos.map((c) => ({ t: typeof c.t === "number" ? c.t : aSegundos(c.t), titulo: c.titulo })),
    t.fin - t.inicio,
  );
  const c: Capitulos = { resumen: r.resumen.trim(), capitulos };
  await guardarJson(proyectoId, "capitulos.json", c);
  return c;
}

export async function leerCapitulos(proyectoId: string): Promise<Capitulos | null> {
  const c = await leerJson<Capitulos>(proyectoId, "capitulos.json");
  return c && Array.isArray(c.capitulos) ? c : null;
}

/** Al exportar: capitulos.txt (tiempos del video completo) en la carpeta de exportados, si hay capítulos. */
export async function escribirCapitulosTxt(proyectoId: string, carpeta: string): Promise<void> {
  const c = await leerCapitulos(proyectoId);
  if (!c || !existsSync(carpeta)) return;
  const p = await leerProyecto(proyectoId);
  await writeFile(join(carpeta, "capitulos.txt"), `${textoYoutube(c, { completo: true, inicioRango: p.rango.inicio })}\n`, "utf8");
}
