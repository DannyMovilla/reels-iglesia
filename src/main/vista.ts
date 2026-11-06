import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { protocol } from "electron";

/**
 * reels-comp://<id>/<archivo> sirve composiciones de vista previa:
 * - index.html: la composición registrada con registrarComposicion(id, html)
 * - recursos/*: GSAP, el runtime de HyperFrames y las fuentes, desde node_modules (sin internet)
 * Cada respuesta lleva su propia CSP: el iframe del reproductor no hereda la de la app.
 */
const composiciones = new Map<string, string>();

export function registrarComposicion(id: string, html: string): string {
  composiciones.set(id, html);
  return `reels-comp://${id}/index.html`;
}

const TIPOS: Record<string, string> = {
  ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".html": "text/html; charset=utf-8",
};

export function recursosVista(raizApp: string): Record<string, string> {
  const nm = join(raizApp, "node_modules");
  return {
    "gsap.min.js": join(nm, "gsap", "dist", "gsap.min.js"),
    "hyperframe.runtime.iife.js": join(nm, "@hyperframes", "core", "dist", "hyperframe.runtime.iife.js"),
  };
}

const CSP = "default-src 'self' reels-comp: reels-video:; script-src 'self' 'unsafe-inline' reels-comp:; style-src 'self' 'unsafe-inline' reels-comp:; font-src reels-comp: data:; media-src reels-video: reels-comp: blob:; img-src reels-comp: data: blob:";

/** Debe llamarse antes de app.ready, junto con registrarEsquemaVideo. */
export const esquemaVista = { scheme: "reels-comp", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } };

export function servirVista(raizApp: string): void {
  const recursos = recursosVista(raizApp);
  const fuentes = resolve(raizApp, "node_modules", "@fontsource");
  protocol.handle("reels-comp", async (req) => {
    const url = new URL(req.url);
    const ruta = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const encabezados = (tipo: string) => ({ "Content-Type": tipo, "Content-Security-Policy": CSP, "Cache-Control": "no-store" });
    if (ruta === "index.html") {
      const html = composiciones.get(url.hostname);
      return html ? new Response(html, { headers: encabezados(TIPOS[".html"]) }) : new Response("No existe", { status: 404 });
    }
    let archivo: string | undefined;
    if (ruta.startsWith("recursos/fuentes/")) {
      const dentro = normalize(join(fuentes, ruta.slice("recursos/fuentes/".length)));
      if (dentro.startsWith(fuentes)) archivo = dentro;
    } else if (ruta.startsWith("recursos/")) {
      archivo = recursos[ruta.slice("recursos/".length)];
    }
    if (!archivo) return new Response("No existe", { status: 404 });
    try {
      return new Response(await readFile(archivo), { headers: encabezados(TIPOS[extname(archivo)] ?? "application/octet-stream") });
    } catch {
      return new Response("No existe", { status: 404 });
    }
  });
}
