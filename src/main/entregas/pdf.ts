import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { htmlTranscripcion } from "@shared/pdf-transcripcion";
import { leerCapitulos } from "../claude/capitulos";
import { leerMarca, leerProyecto, leerTranscripcion } from "../proyectos/almacen";
import { baseEntregas, carpetaEntregas } from "./entregas";

/** HTML → PDF (A4) con la impresión de Electron, en una ventana oculta. */
export async function imprimirPdf(html: string): Promise<Buffer> {
  const { BrowserWindow } = await import("electron");
  const archivo = join(tmpdir(), `reels-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  await writeFile(archivo, html, "utf8");
  const v = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true } });
  try {
    await v.loadFile(archivo);
    return await v.webContents.printToPDF({ pageSize: "A4", printBackground: true });
  } finally {
    v.destroy();
    await rm(archivo, { force: true });
  }
}

/** La transcripción de la prédica en PDF (exportados/<slug>-transcripcion.pdf); devuelve el nombre. */
export async function guardarPdf(proyectoId: string, imprimir: (html: string) => Promise<Buffer> = imprimirPdf): Promise<string> {
  const transcripcion = await leerTranscripcion(proyectoId);
  if (!transcripcion?.segmentos.length) throw new Error("No hay transcripción para crear el PDF.");
  const [proyecto, marca, capitulos] = await Promise.all([leerProyecto(proyectoId), leerMarca(), leerCapitulos(proyectoId)]);
  const pdf = await imprimir(htmlTranscripcion({ proyecto, marca, transcripcion, capitulos }));
  const nombre = `${await baseEntregas(proyectoId)}-transcripcion.pdf`;
  await writeFile(join(await carpetaEntregas(proyectoId), nombre), pdf);
  return nombre;
}
