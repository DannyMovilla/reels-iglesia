import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { protocol } from "electron";

/**
 * reels-comp://<id>/<archivo> sirve las composiciones de vista previa:
 * - index.html: la composición registrada con registrarComposicion(id, html)
 * - recursos/*: GSAP, el runtime de HyperFrames y las fuentes, desde node_modules (sin internet)
 * Cada respuesta lleva su propia CSP: el iframe del reproductor no hereda la de la app (prueba técnica D1).
 */
const composiciones = new Map<string, string>();

/** Cuántas composiciones de vista previa se guardan (cada cambio registra una nueva). */
const MAXIMO = 8;

export function registrarComposicion(id: string, html: string): string {
  composiciones.delete(id);
  composiciones.set(id, html);
  while (composiciones.size > MAXIMO) composiciones.delete(composiciones.keys().next().value!);
  return `reels-comp://${id}/index.html`;
}

export const composicionRegistrada = (id: string): string | undefined => composiciones.get(id);

/** Ruta del archivo local para un recurso pedido, o null si no está permitido. */
export function rutaRecurso(ruta: string, raiz: string, datos?: string): string | null {
  if (ruta.startsWith("marca/")) return datos && /^marca\/logo\.(png|jpe?g|svg|webp)$/.test(ruta) ? join(datos, "marca", ruta.slice(6)) : null;
  const nm = join(raiz, "node_modules");
  const fijos: Record<string, string> = {
    "recursos/gsap.min.js": join(nm, "gsap", "dist", "gsap.min.js"),
    "recursos/hyperframe.runtime.iife.js": join(nm, "@hyperframes", "core", "dist", "hyperframe.runtime.iife.js"),
  };
  if (fijos[ruta]) return fijos[ruta];
  const prefijo = "recursos/fuentes/";
  if (!ruta.startsWith(prefijo)) return null;
  const base = join(nm, "@fontsource");
  const archivo = normalize(join(base, ruta.slice(prefijo.length)));
  return archivo.startsWith(base + sep) && archivo.endsWith(".woff2") ? archivo : null;
}

const TIPOS: Record<string, string> = {
  ".js": "text/javascript", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp",
};
const CSP = "default-src 'self' reels-comp: http://127.0.0.1:*; script-src 'self' 'unsafe-inline' reels-comp:; style-src 'self' 'unsafe-inline' reels-comp:; font-src reels-comp: data:; media-src http://127.0.0.1:* reels-comp: blob:; img-src reels-comp: data: blob:";

/** Debe registrarse antes de app.ready. */
export const esquemaVista = { scheme: "reels-comp", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } };

export function servirVista(raiz: string, datos: () => string): void {
  protocol.handle("reels-comp", async (req) => {
    const url = new URL(req.url);
    const ruta = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const encabezados = (tipo: string) => ({ "Content-Type": tipo, "Content-Security-Policy": CSP, "Cache-Control": "no-store" });
    if (ruta === "index.html") {
      const html = composiciones.get(url.hostname);
      return html ? new Response(html, { headers: encabezados("text/html; charset=utf-8") }) : new Response("No existe", { status: 404 });
    }
    const archivo = rutaRecurso(ruta, raiz, datos());
    if (!archivo) return new Response("No permitido", { status: 404 });
    try {
      return new Response(await readFile(archivo), { headers: encabezados(TIPOS[extname(archivo)] ?? "application/octet-stream") });
    } catch {
      return new Response("No existe", { status: 404 });
    }
  });
}
