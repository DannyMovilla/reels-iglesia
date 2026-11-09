import type { Transcripcion } from "@shared/tipos";
import type { ContextoTarea } from "../cola/cola";
import { ejecutarConProgreso } from "../procesos/lineas";
import { conservarAlReanalizar } from "@shared/clip";
import type { ClipSpec } from "@shared/tipos";
import { guardarJson, leerJson, leerMarca, leerTranscripcion } from "../proyectos/almacen";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { RespuestaClaude } from "./esquema";
import { normalizarClips } from "./normalizar";
import { construirPrompt } from "./prompt";

const ERROR_JSON = "Claude no devolvió una lista de clips válida";
export const ERROR_SESION = "Claude no tiene sesión iniciada. Abre Ajustes → Iniciar sesión en Claude.";
const ERROR_FORMATO = "Claude no devolvió una lista de clips válida. Toca Reintentar.";
const ERROR_TIEMPO = "Claude tardó demasiado en responder. Revisa tu conexión y toca Reintentar.";
const ERROR_SIN_CLAUDE = "No encuentro Claude Code en esta PC. Revisa Ajustes.";
const ERROR_SIN_CLIPS = "Claude no encontró momentos de al menos 5 segundos. Revisa el rango de la prédica y toca Reintentar.";
const DIEZ_MINUTOS = 10 * 60 * 1000;

/** Una lista JSON: el texto completo; si no, el cuerpo de un bloque ```json; si no, del primer [ al último ]. */
export function extraerJson(texto: string): unknown {
  const intentos = [texto.trim()];
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  if (bloque) intentos.push(bloque[1].trim());
  const a = texto.indexOf("["), b = texto.lastIndexOf("]");
  if (a >= 0 && b > a) intentos.push(texto.slice(a, b + 1));
  for (const i of intentos) {
    try {
      const v = JSON.parse(i);
      if (Array.isArray(v)) return v;
    } catch {
      /* siguiente intento */
    }
  }
  throw new Error(ERROR_JSON);
}

export function partirComando(c: string): [string, string[]] {
  const partes = c.match(/"[^"]*"|\S+/g)?.map((p) => p.replace(/^"|"$/g, "")) ?? ["claude"];
  return [partes[0], partes.slice(1)];
}

export async function preguntar(comando: [string, string[]], prompt: string, senal: AbortSignal, tiempo: AbortSignal): Promise<string> {
  const [exe, args] = comando;
  let r;
  try {
    r = await ejecutarConProgreso(exe, [...args, "-p", "--output-format", "json"], { entrada: prompt, senal: AbortSignal.any([senal, tiempo]) });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error(ERROR_SIN_CLAUDE);
    throw e;
  }
  if (tiempo.aborted) throw new Error(ERROR_TIEMPO);
  const todo = `${r.stdout}\n${r.stderr}`;
  let salida: { is_error?: boolean; result?: string };
  try {
    salida = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() ?? "");
  } catch {
    if (/not logged in|\/login/i.test(todo)) throw new Error(ERROR_SESION);
    throw new Error(`Claude no respondió (${r.stderr.trim().split(/\r?\n/).pop() || `código ${r.codigo}`}).`);
  }
  if (salida.is_error) {
    if (/not logged in|\/login/i.test(salida.result ?? "")) throw new Error(ERROR_SESION);
    throw new Error(`Claude respondió con un error: ${salida.result ?? "desconocido"}`);
  }
  return salida.result ?? "";
}

export async function analizarProyecto(
  id: string,
  ctx: ContextoTarea,
  opciones: { comando?: string; n?: number; tiempoMaximoMs?: number } = {},
): Promise<void> {
  const t = await leerTranscripcion(id);
  if (!t?.segmentos?.length) throw new Error("No hay transcripción para analizar. Vuelve a procesar la prédica.");
  const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
  const tiempo = AbortSignal.timeout(opciones.tiempoMaximoMs ?? DIEZ_MINUTOS);
  const prompt = construirPrompt(t, opciones.n ?? 6);
  ctx.alProgreso(10, "Claude está leyendo la prédica…");
  let texto = await preguntar(comando, prompt, ctx.senal, tiempo);
  let clips;
  try {
    clips = RespuestaClaude.parse(extraerJson(texto));
  } catch (e) {
    ctx.alProgreso(55, "Pidiendo a Claude que corrija el formato…");
    const motivo = e instanceof Error ? e.message.slice(0, 400) : String(e);
    texto = await preguntar(comando, `${prompt}\n\nTu respuesta anterior no era válida: ${motivo}. Responde solo con el arreglo JSON.`, ctx.senal, tiempo);
    try {
      clips = RespuestaClaude.parse(extraerJson(texto));
    } catch {
      throw new Error(ERROR_FORMATO);
    }
  }
  const normalizados = normalizarClips(clips, t, (await leerMarca()).estilo);
  if (normalizados.length === 0) throw new Error(ERROR_SIN_CLIPS);
  const viejos = (await leerJson<ClipSpec[]>(id, "clips.json")) ?? [];
  await guardarJson(id, "clips.json", conservarAlReanalizar(viejos, normalizados));
  ctx.alProgreso(100);
}
