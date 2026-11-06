import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { dialog, ipcMain, protocol, type BrowserWindow } from "electron";
import type { DatosNuevoProyecto, EstadoSistema } from "@shared/api";
import type { ClipSpec, Transcripcion } from "@shared/tipos";
import type { Cola } from "./cola/cola";
import { ejecutarConProgreso } from "./procesos/lineas";
import { crearProyecto, leerJson, leerProyecto, listarProyectos } from "./proyectos/almacen";

export interface DepsIpc {
  cola: Cola;
  ventana: () => BrowserWindow | null;
  verificarSistema(): Promise<EstadoSistema>;
  accionSistema(accion: string): Promise<void>;
}

const MIME: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska" };

/** Debe llamarse antes de app.ready. */
export function registrarEsquemaVideo(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: "reels-video", privileges: { stream: true, supportFetchAPI: true, bypassCSP: false } }]);
}

/** reels-video://proyecto/<id> sirve el video original, con soporte de rangos para poder adelantar. */
function servirVideo(): void {
  protocol.handle("reels-video", async (req) => {
    const id = decodeURIComponent(new URL(req.url).pathname.replace(/^\//, ""));
    const p = await leerProyecto(id);
    const { size } = await stat(p.video.ruta);
    const tipo = MIME[extname(p.video.ruta).toLowerCase()] ?? "video/mp4";
    const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
    if (!rango) {
      return new Response(Readable.toWeb(createReadStream(p.video.ruta)) as ReadableStream, {
        status: 200, headers: { "Content-Type": tipo, "Content-Length": String(size), "Accept-Ranges": "bytes" },
      });
    }
    const ini = rango[1] ? Number(rango[1]) : 0;
    const fin = rango[2] ? Math.min(Number(rango[2]), size - 1) : size - 1;
    return new Response(Readable.toWeb(createReadStream(p.video.ruta, { start: ini, end: fin })) as ReadableStream, {
      status: 206,
      headers: { "Content-Type": tipo, "Content-Length": String(fin - ini + 1), "Content-Range": `bytes ${ini}-${fin}/${size}`, "Accept-Ranges": "bytes" },
    });
  });
}

async function duracion(ruta: string): Promise<number> {
  const r = await ejecutarConProgreso("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta]);
  const d = Number(r.stdout.trim());
  if (r.codigo !== 0 || !Number.isFinite(d)) throw new Error("No pude leer la duración del video. ¿Está instalado FFmpeg?");
  return d;
}

export function registrarIpc(deps: DepsIpc): void {
  servirVideo();
  const { cola } = deps;
  cola.on("cambio", (t) => deps.ventana()?.webContents.send("tareas:cambio", t));

  ipcMain.handle("video:elegir", async () => {
    const r = await dialog.showOpenDialog({
      title: "Elige el video del culto",
      properties: ["openFile"],
      filters: [{ name: "Videos", extensions: ["mp4", "mov", "m4v", "mkv", "webm"] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const ruta = r.filePaths[0];
    const st = await stat(ruta);
    return { ruta, tamano: st.size, modificado: st.mtimeMs, duracion: await duracion(ruta) };
  });
  ipcMain.handle("proyectos:crear", (_e, d: DatosNuevoProyecto) => crearProyecto(d));
  ipcMain.handle("proyectos:listar", () => listarProyectos());
  ipcMain.handle("proyectos:leer", (_e, id: string) => leerProyecto(id));
  ipcMain.handle("proyectos:clips", async (_e, id: string) => (await leerJson<ClipSpec[]>(id, "clips.json")) ?? []);
  ipcMain.handle("proyectos:transcripcion", (_e, id: string) => leerJson<Transcripcion>(id, "transcripcion.json"));
  ipcMain.handle("proyectos:procesar", (_e, id: string) => void cola.agregar(id, "transcribir"));
  ipcMain.handle("tareas:lista", () => cola.lista());
  ipcMain.handle("tareas:reintentar", (_e, id: string) => cola.reintentar(id));
  ipcMain.handle("tareas:cancelar", (_e, id: string) => cola.cancelar(id));
  ipcMain.handle("sistema:verificar", () => deps.verificarSistema());
  ipcMain.handle("sistema:accion", (_e, a: string) => deps.accionSistema(a));
}
