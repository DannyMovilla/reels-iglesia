import { esPintura, PINTURAS } from "@shared/reel/pinturas";
import { z } from "zod";
import { recortarRedes } from "@shared/redes";
import { ANIMOS, type Animo, type Creacion, type Escena } from "@shared/tipos";
import { formatearReferencia } from "../biblia/biblia";
import { partirComando, preguntar } from "../claude/analizar";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { guardarCreacion, leerCreacion } from "./almacen";

const ESCENAS: Record<Escena, string> = {
  luz: "rayos de luz (luz, gloria, presencia de Dios)",
  amanecer: "amanecer (esperanza, misericordias nuevas, un nuevo comienzo)",
  aurora: "aurora suave (paz, adoración, quietud)",
  nubes: "nubes y cielo (refugio, la venida, el cuidado de Dios)",
  atardecer: "atardecer cálido (descanso, gratitud, consuelo)",
  destello: "destello de luz (revelación, la Palabra, llamado)",
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const conHashtags = z.object({ texto: z.string().default(""), hashtags: z.array(z.string()).default([]) });

const RespuestaVersiculo = z.object({
  ref: z.string().catch(""),
  texto: z.string().catch(""),
  gancho: z.string().catch(""),
  reflexion: z.string().catch(""),
  palabras_clave: z.array(z.string()).catch([]),
  animo: z.preprocess((v) => (typeof v === "string" ? ANIMOS.find((a) => sinTildes(a) === sinTildes(v)) : undefined), z.enum(ANIMOS as unknown as [Animo, ...Animo[]]).optional()).catch(undefined),
  escena: z.preprocess((v) => (typeof v === "string" ? (Object.keys(ESCENAS) as Escena[]).find((e) => sinTildes(e) === sinTildes(v)) : undefined),
    z.enum(Object.keys(ESCENAS) as [Escena, ...Escena[]]).optional()).catch(undefined),
  pintura: z.preprocess((v) => (typeof v === "string" && esPintura(v.trim()) ? v.trim() : undefined), z.string().optional()).catch(undefined),
  redes: z.object({
    instagram: conHashtags, tiktok: conHashtags,
    facebook: z.object({ texto: z.string().default("") }),
    youtube: z.object({ titulo: z.string().default(""), texto: z.string().default("") }),
  }).optional().catch(undefined),
});

/** La respuesta de Claude ya validada: nunca lanza un error técnico por un campo raro. */
export const leerRespuestaVersiculo = (v: unknown) => RespuestaVersiculo.parse(v && typeof v === "object" ? v : {});

/** Prompt para el reel de un versículo (una sola consulta). */
export function promptVersiculo(entrada: Creacion["entrada"]): string {
  const pedido = entrada.tipo === "versiculo" ? `el versículo ${entrada.texto}` : `un versículo bíblico sobre este tema: ${entrada.texto}`;
  return `REEL DE VERSÍCULO. Eres el editor de redes sociales de una iglesia cristiana hispana. Prepara un reel vertical corto con ${pedido}.

Responde solo con un objeto JSON con esta forma:
{"ref":"Juan 8:12","texto":"…","gancho":"…","reflexion":"…","palabras_clave":["…"],"animo":"esperanza","escena":"luz","pintura":"prodigo","redes":{"instagram":{"texto":"…","hashtags":["#fe"]},"tiktok":{"texto":"…","hashtags":["#fe"]},"facebook":{"texto":"…"},"youtube":{"titulo":"…","texto":"…"}}}

- "ref": la referencia (libro capítulo:versículo o rango corto). Si es un tema, elige el pasaje más claro y conocido; máximo 3 versículos seguidos.
- "texto": el pasaje completo en la Reina-Valera 1960, palabra por palabra, sin agregar ni quitar nada (la persona lo revisará antes de publicar). Si no estás seguro de que el versículo exista, deja "ref" y "texto" vacíos.
- "gancho": máximo 8 palabras, aparece primero en pantalla para que la gente se detenga.
- "reflexion": una o dos frases cortas (máximo 30 palabras) que apliquen el versículo a la vida diaria, fieles a lo que dice el texto.
- "palabras_clave": de 2 a 4 palabras del versículo para resaltarlas.
- "animo": la música de fondo: uno de ${ANIMOS.join(", ")}.
- "escena": el fondo animado que mejor va con el versículo: ${(Object.entries(ESCENAS) as [Escena, string][]).map(([k, v]) => `${k} = ${v}`).join("; ")}.
- "pintura": una pintura clásica para el fondo, la que mejor vaya con el versículo: ${Object.entries(PINTURAS).map(([k, p]) => `${k} = ${p.obra} (${p.autor}: ${p.tema})`).join("; ")}.
- "redes": texto para Instagram (hasta 2200 caracteres, 3 a 8 hashtags), TikTok (corto, 3 a 5 hashtags), Facebook (hasta 5000, sin hashtags) y YouTube Shorts ("titulo" de hasta 100 caracteres y "texto").
Escribe como habla la iglesia, cercano y en español sencillo. Que no suene a inteligencia artificial: nada de "no es X, es Y", ni listas de tres por costumbre, ni "sumérgete", "descubre", "transforma tu vida", ni un emoji en cada línea. Termina los textos de redes con una pregunta que invite a comentar.`;
}

/** El objeto JSON de la respuesta (texto completo, bloque ```json o del primer { al último }). */
export function extraerObjeto(texto: string, mensaje = "Claude no devolvió el reel en el formato esperado. Toca «Pedir a Claude otra vez»."): unknown {
  const intentos = [texto.trim()];
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(texto);
  if (bloque) intentos.push(bloque[1].trim());
  const a = texto.indexOf("{"), b = texto.lastIndexOf("}");
  if (a >= 0 && b > a) intentos.push(texto.slice(a, b + 1));
  for (const i of intentos) {
    try {
      const v = JSON.parse(i);
      if (v && typeof v === "object" && !Array.isArray(v)) return v;
    } catch {
      /* siguiente intento */
    }
  }
  throw new Error(mensaje);
}

const DIEZ_MINUTOS = 10 * 60 * 1000;

/** Pregunta a Claude (una consulta, un reintento si el formato falla) y llena la creación. */
export async function escribirCreacion(id: string, opciones: { comando?: string; senal?: AbortSignal } = {}): Promise<Creacion> {
  const c = await leerCreacion(id);
  const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
  const senal = opciones.senal ?? new AbortController().signal;
  const tiempo = AbortSignal.timeout(DIEZ_MINUTOS);
  const prompt = promptVersiculo(c.entrada);
  let r;
  try {
    r = leerRespuestaVersiculo(extraerObjeto(await preguntar(comando, prompt, senal, tiempo)));
  } catch {
    r = leerRespuestaVersiculo(extraerObjeto(await preguntar(comando, `${prompt}\n\nTu respuesta anterior no tenía el formato pedido. Responde solo con el objeto JSON.`, senal, tiempo)));
  }
  if (!r.ref.trim() || !r.texto.trim()) throw new Error("Claude no encontró ese versículo. Escríbelo a mano o prueba con otra referencia.");
  const nueva: Creacion = {
    ...c,
    versiculo: { ref: formatearReferencia(r.ref), texto: r.texto.trim(), confirmado: false },
    gancho: r.gancho.trim(),
    reflexion: r.reflexion.trim(),
    palabrasClave: r.palabras_clave.slice(0, 4),
    musica: { ...c.musica, animo: r.animo ?? c.musica.animo },
    fondo: c.fondo.tipo === "escena" ? { tipo: "escena", escena: r.escena ?? "luz" }
      : c.fondo.tipo === "pintura" ? { tipo: "pintura", pintura: r.pintura ?? c.fondo.pintura ?? "prodigo" } : c.fondo,
    redes: r.redes ? recortarRedes(r.redes) : c.redes,
  };
  await guardarCreacion(nueva);
  return nueva;
}
