import { execFile } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import type { EstiloReferencia } from "@shared/estilo-referencia";
import { MATRIZ_LOOK, type Look } from "@shared/reel/color";
import { ESTILOS_SUB } from "@shared/reel/estilos-sub";
import { FUENTES, FUENTES_POR_DEFECTO, type IdFuente } from "@shared/reel/fuentes";
import { ANIMOS, type ClipSpec } from "@shared/tipos";
import { partirComando, preguntar } from "../claude/analizar";
import { extraerObjeto } from "../ia/claude";
import { resolverComandoClaude } from "../sistema/claude-cmd";

export interface MedidasReferencia { duracion: number; cortesPorMinuto: number | null; lufs: number | null; cuadros: string[]; avisos: string[] }

const correr = (exe: string, args: string[]): Promise<{ codigo: number; stdout: string; stderr: string }> =>
  new Promise((r) => execFile(exe, args, { maxBuffer: 1 << 26, windowsHide: true }, (err, stdout, stderr) =>
    r({ codigo: err ? (typeof (err as NodeJS.ErrnoException).code === "number" ? Number((err as NodeJS.ErrnoException).code) : 1) : 0, stdout: String(stdout), stderr: String(stderr) })));

/**
 * Mide un reel de referencia: duración, 6 cuadros repartidos (para que Claude los mire), cortes por minuto
 * (detección de cambio de escena) y volumen si tiene audio. Nunca falla por un video raro: avisa lo que no pudo medir.
 */
export async function medirReferencia(video: string, carpeta?: string): Promise<MedidasReferencia> {
  const avisos: string[] = [];
  const info = await correr("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", video]);
  let duracion = 0, conAudio = false, conVideo = false;
  try {
    const j = JSON.parse(info.stdout) as { format?: { duration?: string }; streams?: { codec_type: string }[] };
    duracion = Number(j.format?.duration) || 0;
    conAudio = (j.streams ?? []).some((s) => s.codec_type === "audio");
    conVideo = (j.streams ?? []).some((s) => s.codec_type === "video");
  } catch {
    /* sin datos */
  }
  if (info.codigo !== 0 || duracion <= 0) throw new Error("No pude leer ese video. Prueba con un MP4 o MOV.");
  if (!conVideo) avisos.push("El archivo no tiene video: no pude mirar cuadros ni medir el ritmo.");
  else if (duracion < 3) avisos.push("El video dura menos de 3 segundos: no pude medir el ritmo de los cortes.");
  const dir = carpeta ?? join(tmpdir(), `reels-referencia-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  const fps = Math.max(0.05, Math.round((6 / Math.max(duracion, 0.5)) * 1000) / 1000);
  await correr("ffmpeg", ["-v", "error", "-y", "-i", video, "-vf", `fps=${fps},scale=-2:720`, "-frames:v", "6", "-q:v", "3", join(dir, "cuadro-%d.jpg")]);
  const cuadros = (await readdir(dir)).filter((f) => /^cuadro-\d+\.jpg$/.test(f)).sort().map((f) => join(dir, f));
  if (!cuadros.length && conVideo) avisos.push("No pude sacar cuadros del video.");
  let cortesPorMinuto: number | null = null;
  if (conVideo && duracion >= 3) {
    const sc = await correr("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-an", "-vf", "scdet=threshold=12,metadata=print", "-f", "null", "-"]);
    const cortes = (sc.stderr.match(/lavfi\.scd\.time=/g) ?? []).length;
    cortesPorMinuto = Math.round((cortes / duracion) * 60 * 10) / 10;
  }
  let lufs: number | null = null;
  if (conAudio) {
    const r = await correr("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vn", "-af", "ebur128", "-f", "null", "-"]);
    const m = /I:\s+(-?[0-9.]+) LUFS/.exec(r.stderr.slice(r.stderr.lastIndexOf("Summary:")));
    lufs = m ? Number(m[1]) : null;
    if (lufs === null) avisos.push("No pude medir el volumen del video.");
  } else avisos.push("El video no tiene audio: no pude medir el volumen.");
  return { duracion: Math.round(duracion * 10) / 10, cortesPorMinuto, lufs, cuadros, avisos };
}

/** Prompt para que Claude mire los cuadros (herramienta Read) y proponga el estilo. */
export function promptEstilo(m: MedidasReferencia): string {
  return `ESTILO DE UN REEL. Eres el editor de redes de una iglesia cristiana. Mira estos cuadros de un reel que a la iglesia le gusta (léelos con la herramienta Read):
${m.cuadros.map((c) => `- ${c}`).join("\n")}

Medidas del video: dura ${m.duracion} s; ${m.cortesPorMinuto === null ? "no se midió el ritmo de cortes" : `${m.cortesPorMinuto} cortes por minuto`}; ${m.lufs === null ? "sin audio medido" : `volumen ${m.lufs} LUFS`}.

Propón el estilo más parecido con las opciones de la app y responde solo con un objeto JSON:
{"cuadros_vistos":6,"subtitulos":"pop","tamano":"m","altura":0.74,"fuente_titulos":"figtree","fuente_subtitulos":"montserrat","animo":"esperanza","intensidad":"normal","look":"natural","explicacion":"…"}

- "cuadros_vistos": cuántos de los cuadros pudiste abrir y mirar (0 si no pudiste abrir ninguno).

- "subtitulos": uno de ${ESTILOS_SUB.join(", ")}. "tamano": s, m o l. "altura": dónde van los subtítulos, de 0.55 a 0.85 del alto.
- "fuente_titulos" y "fuente_subtitulos": montserrat (gruesa, moderna) o figtree (redondeada, amable).
- "animo" de la música: uno de ${ANIMOS.join(", ")}. "intensidad" de los cortes de pausas: suave, normal o fuerte (fuerte si el ritmo es rápido).
- "look" de color: uno de ${Object.keys(MATRIZ_LOOK).join(", ")}.
- "explicacion": una o dos oraciones en español sencillo de por qué.`;
}

const Respuesta = z.object({
  cuadros_vistos: z.coerce.number().catch(0),
  subtitulos: z.string().optional().catch(undefined),
  tamano: z.string().optional().catch(undefined),
  altura: z.coerce.number().optional().catch(undefined),
  fuente_titulos: z.string().optional().catch(undefined),
  fuente_subtitulos: z.string().optional().catch(undefined),
  animo: z.string().optional().catch(undefined),
  intensidad: z.string().optional().catch(undefined),
  look: z.string().optional().catch(undefined),
  explicacion: z.string().catch(""),
});

/** La propuesta de Claude: cualquier valor fuera de lista se reemplaza por el del clip. */
export function leerEstilo(v: unknown, clip: ClipSpec): EstiloReferencia {
  const r = Respuesta.parse(v && typeof v === "object" ? v : {});
  const de = <T extends string>(x: string | undefined, lista: readonly T[], defecto: T): T => (x && (lista as readonly string[]).includes(x.trim().toLowerCase()) ? (x.trim().toLowerCase() as T) : defecto);
  const fuentes = clip.fuentes ?? FUENTES_POR_DEFECTO;
  const ids = Object.keys(FUENTES).filter((f) => f !== "iglesia") as IdFuente[];
  return {
    subtitulos: de(r.subtitulos, ESTILOS_SUB, clip.subtitulos.estilo),
    tamano: de(r.tamano, ["s", "m", "l"] as const, clip.subtitulos.tamano),
    altura: r.altura !== undefined && r.altura >= 0.55 && r.altura <= 0.85 ? Math.round(r.altura * 100) / 100 : clip.subtitulos.altura,
    fuenteTitulos: de(r.fuente_titulos, ids, fuentes.titulos),
    fuenteSubtitulos: de(r.fuente_subtitulos, ids, fuentes.subtitulos),
    animo: de(r.animo, ANIMOS, clip.musica.animo),
    intensidad: de(r.intensidad, ["suave", "normal", "fuerte"] as const, clip.cortes.intensidad ?? "normal"),
    look: de(r.look, Object.keys(MATRIZ_LOOK) as Look[], clip.color?.look ?? "natural"),
    explicacion: r.explicacion.trim(),
  };
}

/** Mide el reel de referencia y le pide a Claude el estilo (una consulta, con permiso solo para leer los cuadros). */
export async function analizarReferencia(video: string, clip: ClipSpec, opciones: { comando?: string } = {}): Promise<{ estilo: EstiloReferencia; avisos: string[] }> {
  const dir = join(tmpdir(), `reels-referencia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    const m = await medirReferencia(video, dir);
    const comando = opciones.comando ? partirComando(opciones.comando) : resolverComandoClaude();
    const tiempo = AbortSignal.timeout(5 * 60 * 1000);
    // Los cuadros están fuera de la carpeta de trabajo de Claude: se le da permiso para leer esa carpeta.
    const texto = await preguntar(comando, promptEstilo(m), new AbortController().signal, tiempo, ["--allowedTools", "Read", "--add-dir", dir]);
    const crudo = extraerObjeto(texto, "Claude no devolvió el estilo en el formato esperado. Prueba de nuevo.");
    const vistos = Number((crudo as { cuadros_vistos?: unknown }).cuadros_vistos) || 0;
    const avisos = [...m.avisos];
    if (m.cuadros.length && vistos <= 0) avisos.push("Claude no pudo mirar los cuadros: la propuesta se basa solo en el ritmo y el volumen.");
    return { estilo: leerEstilo(crudo, clip), avisos };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
