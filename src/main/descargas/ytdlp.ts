import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ejecutarConProgreso } from "../procesos/lineas";
import { rutaPython } from "../rutas";

/** ¿Parece un enlace (con o sin https://)? */
export const esEnlace = (texto: string): boolean => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(texto.trim());

/** yt-dlp: la mejor calidad hasta 1080p, unida en MP4, sin listas de reproducción; imprime la ruta final. */
export function argsYtdlp(url: string, carpeta: string): string[] {
  return [
    "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--merge-output-format", "mp4", "--no-playlist", "--newline",
    "-o", `${carpeta.replace(/\\/g, "/")}/%(title).70s [%(id)s].%(ext)s`, "--print", "after_move:filepath", url,
  ];
}

/** Errores de yt-dlp → mensajes para la persona. */
export function traducirError(stderr: string): string {
  if (/private|login|log in|registered users|cookies|members only|not available/i.test(stderr)) {
    return "Ese video es privado o pide iniciar sesión. Descárgalo desde Facebook o YouTube y elige el archivo.";
  }
  if (/unsupported url|not a valid url|no video formats|is not a video/i.test(stderr)) {
    return "Ese enlace no parece un video. Copia el enlace del video del culto (no el de la página o la transmisión en curso).";
  }
  if (/unable to download webpage|getaddrinfo|network|timed out|connection/i.test(stderr)) {
    return "No hay conexión a internet o la página no respondió. Revisa tu internet e inténtalo de nuevo.";
  }
  return `No se pudo descargar el video. ${stderr.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? ""}`.trim();
}

export interface OpcionesDescarga {
  senal: AbortSignal;
  alProgreso(pct: number): void;
  /** Comando de yt-dlp (para pruebas); por defecto el Python de la app con -m yt_dlp. */
  comando?: [string, string[]];
}

/** Descarga el video del culto a la carpeta y devuelve su ruta. Si se cancela, borra lo que quedó a medias. */
export async function descargarVideo(url: string, carpeta: string, op: OpcionesDescarga): Promise<string> {
  await mkdir(carpeta, { recursive: true });
  const antes = new Set(await readdir(carpeta));
  const [cmd, base] = op.comando ?? (process.env.REELS_YTDLP_COMANDO ? partir(process.env.REELS_YTDLP_COMANDO) : [rutaPython(), ["-m", "yt_dlp"]]);
  let final = "";
  let r;
  try {
    r = await ejecutarConProgreso(cmd, [...base, ...argsYtdlp(url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`, carpeta)], {
      senal: op.senal,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
      alLinea: (l) => {
        const m = /^\[download\]\s+([\d.]+)%/.exec(l.trim());
        if (m) op.alProgreso(Number(m[1]));
        else if (l.trim() && !l.startsWith("[") && /\.\w{2,4}$/.test(l.trim())) final = l.trim();
      },
    });
  } catch (e) {
    if (op.senal.aborted) await limpiar(carpeta, antes);
    if (op.senal.aborted) throw new Error("Descarga cancelada.");
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new Error("Falta preparar el entorno de Python de la app. Abre Ajustes.");
    throw e;
  }
  if (op.senal.aborted) {
    await limpiar(carpeta, antes);
    throw new Error("Descarga cancelada.");
  }
  if (r.codigo !== 0) {
    await limpiar(carpeta, antes);
    if (/no module named yt_dlp/i.test(r.stderr)) throw new Error("Falta instalar el descargador (yt-dlp). Abre Ajustes y prepara el entorno.");
    throw new Error(traducirError(r.stderr));
  }
  if (!final || !existsSync(final)) throw new Error("La descarga terminó pero no encuentro el video.");
  return final;
}

/** Borra los archivos que aparecieron durante la descarga (partes a medias). */
async function limpiar(carpeta: string, antes: Set<string>): Promise<void> {
  for (const a of await readdir(carpeta).catch(() => [] as string[])) {
    if (!antes.has(a)) await rm(join(carpeta, a), { force: true, recursive: true }).catch(() => undefined);
  }
}

function partir(c: string): [string, string[]] {
  const partes = c.match(/"[^"]*"|\S+/g)?.map((x) => x.replace(/^"|"$/g, "")) ?? [];
  return [partes[0], partes.slice(1)];
}
