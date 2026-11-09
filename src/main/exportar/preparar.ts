import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { raizApp, rutaEfectos } from "../rutas";

/** Archivos locales que necesita una composición (sin internet). Ruta relativa dentro de la carpeta → origen. */
export function archivosRecursos(raiz = raizApp(), efectos = rutaEfectos()): Record<string, string> {
  const nm = join(raiz, "node_modules");
  const fuente = (pkg: string, archivo: string) => [`recursos/fuentes/${pkg}/files/${archivo}`, join(nm, "@fontsource", pkg, "files", archivo)] as const;
  return Object.fromEntries([
    ["recursos/gsap.min.js", join(nm, "gsap", "dist", "gsap.min.js")],
    fuente("montserrat", "montserrat-latin-900-normal.woff2"),
    fuente("montserrat", "montserrat-latin-800-normal.woff2"),
    fuente("figtree", "figtree-latin-600-normal.woff2"),
    fuente("figtree", "figtree-latin-800-normal.woff2"),
    ...["whoosh", "whoosh-suave", "pop"].map((x) => [`recursos/efectos/${x}.wav`, join(efectos, `${x}.wav`)] as const),
  ]);
}

/** Carpeta de render de HyperFrames: index.html + recursos locales + archivos de proyecto. */
/** `extra`: más archivos a copiar (destino relativo → origen), p. ej. la librería de escenas. */
export async function prepararCarpeta(dir: string, html: string, extra: Record<string, string> = {}): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [destino, origen] of Object.entries({ ...archivosRecursos(), ...extra })) {
    await mkdir(dirname(join(dir, destino)), { recursive: true });
    await copyFile(origen, join(dir, destino));
  }
  await writeFile(join(dir, "index.html"), html, "utf8");
  await writeFile(join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "recursos" }, media: { autoProxy: true } }, null, 2), "utf8");
  await writeFile(join(dir, "meta.json"), JSON.stringify({ id: "reel", name: "reel", createdAt: new Date().toISOString() }, null, 2), "utf8");
}
