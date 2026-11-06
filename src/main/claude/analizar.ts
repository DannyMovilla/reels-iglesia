import type { Transcripcion } from "@shared/tipos";
import type { ContextoTarea } from "../cola/cola";
import { ejecutarConProgreso } from "../procesos/lineas";
import { guardarJson, leerJson } from "../proyectos/almacen";
import { RespuestaClaude } from "./esquema";
import { normalizarClips } from "./normalizar";
import { construirPrompt } from "./prompt";

const ERROR_JSON = "Claude no devolvió una lista de clips válida";
export const ERROR_SESION = "Claude no tiene sesión iniciada. Abre Ajustes → Iniciar sesión en Claude.";

/** JSON completo; si no, el cuerpo de un bloque ```json; si no, del primer [ al último ]. */
export function extraerJson(texto: string): unknown {
  const intentos = [texto.trim()];
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  if (bloque) intentos.push(bloque[1].trim());
  const a = texto.indexOf("["), b = texto.lastIndexOf("]");
  if (a >= 0 && b > a) intentos.push(texto.slice(a, b + 1));
  for (const i of intentos) {
    try {
      return JSON.parse(i);
    } catch {
      /* siguiente intento */
    }
  }
  throw new Error(ERROR_JSON);
}

/** Separa "node C:/x/falso.mjs" en ejecutable + argumentos (respeta comillas). */
function partirComando(c: string): [string, string[]] {
  const partes = c.match(/"[^"]*"|\S+/g)?.map((p) => p.replace(/^"|"$/g, "")) ?? ["claude"];
  return [partes[0], partes.slice(1)];
}

async function preguntar(comando: string, prompt: string, senal: AbortSignal): Promise<string> {
  const [exe, args] = partirComando(comando);
  const r = await ejecutarConProgreso(exe, [...args, "-p", "--output-format", "json"], { entrada: prompt, senal });
  let salida: { is_error?: boolean; result?: string };
  try {
    salida = JSON.parse(r.stdout.trim().split(/\r?\n/).pop() ?? "");
  } catch {
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
  opciones: { comando?: string; n?: number } = {},
): Promise<void> {
  const t = await leerJson<Transcripcion>(id, "transcripcion.json");
  if (!t?.segmentos?.length) throw new Error("No hay transcripción para analizar. Vuelve a procesar la prédica.");
  const comando = opciones.comando ?? process.env.REELS_CLAUDE_COMANDO ?? "claude";
  const prompt = construirPrompt(t, opciones.n ?? 6);
  ctx.alProgreso(10, "Claude está leyendo la prédica…");
  let texto = await preguntar(comando, prompt, ctx.senal);
  let clips;
  try {
    clips = RespuestaClaude.parse(extraerJson(texto));
  } catch (e) {
    ctx.alProgreso(55, "Pidiendo a Claude que corrija el formato…");
    const motivo = e instanceof Error ? e.message.slice(0, 400) : String(e);
    texto = await preguntar(comando, `${prompt}\n\nTu respuesta anterior no era válida: ${motivo}. Responde solo con el arreglo JSON.`, ctx.senal);
    clips = RespuestaClaude.parse(extraerJson(texto));
  }
  await guardarJson(id, "clips.json", normalizarClips(clips, t));
  ctx.alProgreso(100);
}
