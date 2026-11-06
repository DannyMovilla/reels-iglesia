import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { dialog, ipcMain, protocol, shell, type BrowserWindow } from "electron";
import type { DatosNuevoProyecto, EstadoSistema } from "@shared/api";
import type { Caras, ClipSpec, Formato, TipoTarea, Transcripcion } from "@shared/tipos";
import type { Cola } from "./cola/cola";
import { dimensionesVideo, duracionVideo } from "./procesos/video";
import { carpetaProyecto, raizApp } from "./rutas";
import { esquemaVista, registrarComposicion, servirVista } from "./vista";
import { crearProyecto, guardarClip, leerClips, leerJson, leerMarca, leerProyecto, listarExportados, listarProyectos } from "./proyectos/almacen";

export interface DepsIpc {
  cola: Cola;
  ventana: () => BrowserWindow | null;
  verificarSistema(): Promise<EstadoSistema>;
  accionSistema(accion: string): Promise<void>;
}

const MIME: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska" };

/** Debe llamarse antes de app.ready. */
export function registrarEsquemaVideo(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: "reels-video", privileges: { stream: true, supportFetchAPI: true, bypassCSP: false } },
    esquemaVista,
  ]);
}

/** Videos que la persona eligió con el diálogo: solo esos se pueden servir por ruta. */
const elegidos = new Set<string>();

/**
 * reels-video://proyecto/<id> sirve el video original de un proyecto;
 * reels-video://archivo/<ruta> sirve un video elegido con el diálogo. Con soporte de rangos para adelantar.
 */
function servirVideo(): void {
  protocol.handle("reels-video", async (req) => {
    const url = new URL(req.url);
    const valor = decodeURIComponent(url.pathname.replace(/^\//, ""));
    let ruta: string;
    if (url.hostname === "archivo") {
      if (!elegidos.has(valor)) return new Response("No permitido", { status: 403 });
      ruta = valor;
    } else {
      ruta = (await leerProyecto(valor)).video.ruta;
    }
    const { size } = await stat(ruta);
    const tipo = MIME[extname(ruta).toLowerCase()] ?? "video/mp4";
    const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
    if (!rango) {
      return new Response(Readable.toWeb(createReadStream(ruta)) as ReadableStream, {
        status: 200, headers: { "Content-Type": tipo, "Content-Length": String(size), "Accept-Ranges": "bytes" },
      });
    }
    const ini = rango[1] ? Number(rango[1]) : 0;
    const fin = rango[2] ? Math.min(Number(rango[2]), size - 1) : size - 1;
    return new Response(Readable.toWeb(createReadStream(ruta, { start: ini, end: fin })) as ReadableStream, {
      status: 206,
      headers: { "Content-Type": tipo, "Content-Length": String(fin - ini + 1), "Content-Range": `bytes ${ini}-${fin}/${size}`, "Accept-Ranges": "bytes" },
    });
  });
}

export function registrarIpc(deps: DepsIpc): void {
  servirVideo();
  servirVista(raizApp());
  ipcMain.handle("vista:registrar", (_e, id: string, html: string) => registrarComposicion(id, html));
  const { cola } = deps;
  cola.on("cambio", (t) => {
    const v = deps.ventana();
    if (v && !v.isDestroyed()) v.webContents.send("tareas:cambio", t);
  });

  ipcMain.handle("video:elegir", async () => {
    let ruta = process.env.REELS_VIDEO_PRUEBA; // solo pruebas E2E: el diálogo nativo no se puede automatizar
    if (!ruta) {
      const r = await dialog.showOpenDialog({
        title: "Elige el video del culto",
        properties: ["openFile"],
        filters: [{ name: "Videos", extensions: ["mp4", "mov", "m4v", "mkv", "webm"] }],
      });
      if (r.canceled || !r.filePaths[0]) return null;
      ruta = r.filePaths[0];
    }
    elegidos.add(ruta);
    const st = await stat(ruta);
    return { ruta, tamano: st.size, modificado: st.mtimeMs, duracion: await duracionVideo(ruta) };
  });
  ipcMain.handle("proyectos:crear", (_e, d: DatosNuevoProyecto) => crearProyecto(d));
  ipcMain.handle("proyectos:listar", () => listarProyectos());
  ipcMain.handle("proyectos:leer", (_e, id: string) => leerProyecto(id));
  ipcMain.handle("proyectos:clips", (_e, id: string) => leerClips(id));
  ipcMain.handle("proyectos:transcripcion", (_e, id: string) => leerJson<Transcripcion>(id, "transcripcion.json"));
  ipcMain.handle("proyectos:caras", (_e, id: string) => leerJson<Caras>(id, "caras.json"));
  ipcMain.handle("proyectos:guardarClip", (_e, id: string, clip: ClipSpec) => guardarClip(id, clip));
  ipcMain.handle("marca:leer", () => leerMarca());
  const dims = new Map<string, Promise<{ ancho: number; alto: number }>>();
  ipcMain.handle("proyectos:infoVideo", async (_e, id: string) => {
    if (!dims.has(id)) dims.set(id, leerProyecto(id).then((p) => dimensionesVideo(p.video.ruta)));
    return dims.get(id);
  });
  ipcMain.handle("proyectos:procesar", (_e, id: string, desde?: TipoTarea) => void cola.agregar(id, desde ?? "transcribir"));
  ipcMain.handle("exportar:encolar", async (_e, id: string, clipIds: string[], formatos?: Formato[]) => {
    const clips = await leerClips(id);
    for (const c of clips.filter((x) => clipIds.includes(x.id))) {
      for (const formato of formatos ?? c.formatos) cola.agregar(id, "exportar", { clipId: c.id, formato, instantanea: c });
    }
  });
  ipcMain.handle("exportar:abrir", async (_e, id: string) => {
    const dir = join(carpetaProyecto(id), "exportados");
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
  ipcMain.handle("exportar:listar", () => listarExportados());
  ipcMain.handle("tareas:lista", () => cola.lista());
  ipcMain.handle("tareas:reintentar", (_e, id: string) => cola.reintentar(id));
  ipcMain.handle("tareas:cancelar", (_e, id: string) => cola.cancelar(id));
  ipcMain.handle("sistema:verificar", () => deps.verificarSistema());
  ipcMain.handle("sistema:accion", (_e, a: string) => deps.accionSistema(a));
}
