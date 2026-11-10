import { randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname } from "node:path";

/**
 * Servidor de video, audio e imágenes solo para este PC (127.0.0.1) y con una clave al azar por sesión.
 * Reemplaza al protocolo reels-video: en Electron 35 el reproductor no podía adelantar un video servido
 * por un protocolo propio ("PIPELINE_ERROR_READ"); por HTTP con rangos funciona como en cualquier página.
 *
 * URL: <base>/<tipo>/<valor> — tipo: proyecto | archivo | musica | exportado.
 */
export interface ServidorMedios { base: string; cerrar(): void }

/** Ruta del archivo para un pedido, o null si no existe o no está permitido. */
export type Resolver = (tipo: string, valor: string) => Promise<string | null>;

const MIME: Record<string, string> = {
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".flac": "audio/flac", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".ttf": "font/ttf", ".otf": "font/otf", ".woff": "font/woff", ".woff2": "font/woff2",
};

export function iniciarServidorMedios(resolver: Resolver): Promise<ServidorMedios> {
  const clave = randomBytes(16).toString("hex");
  const servidor = createServer(async (req, res) => {
    try {
      const [, c, tipo, ...resto] = (req.url ?? "").split("?")[0].split("/");
      if (c !== clave) return void res.writeHead(403).end();
      const ruta = tipo ? await resolver(tipo, resto.map(decodeURIComponent).join("/")) : null;
      if (!ruta) return void res.writeHead(404).end();
      const { size } = await stat(ruta).catch(() => ({ size: -1 }));
      if (size < 0) return void res.writeHead(404).end();
      const cabeceras = { "Content-Type": MIME[extname(ruta).toLowerCase()] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
      if (!m || (!m[1] && !m[2])) {
        res.writeHead(200, { ...cabeceras, "Content-Length": size });
        return void (req.method === "HEAD" ? res.end() : createReadStream(ruta).pipe(res));
      }
      const ini = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const fin = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (ini >= size || ini > fin) return void res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
      res.writeHead(206, { ...cabeceras, "Content-Length": fin - ini + 1, "Content-Range": `bytes ${ini}-${fin}/${size}` });
      if (req.method === "HEAD") return void res.end();
      const flujo = createReadStream(ruta, { start: ini, end: fin });
      res.on("close", () => flujo.destroy()); // el reproductor corta pedidos al adelantar
      flujo.pipe(res);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return new Promise((resolve) => {
    servidor.listen(0, "127.0.0.1", () => {
      const { port } = servidor.address() as AddressInfo;
      resolve({ base: `http://127.0.0.1:${port}/${clave}`, cerrar: () => servidor.close() });
    });
  });
}
