import { mkdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { dialog, ipcMain, protocol, shell, type BrowserWindow } from "electron";
import type { DatosNuevoProyecto, EstadoSistema } from "@shared/api";
import { descargarVideo } from "./descargas/ytdlp";
import { agregarPista, cambiarAnimo, carpetaMusica, listarPistas, musicaParaVista } from "./musica/banco";
import { escribirCreacion } from "./ia/claude";
import { carpetaCreacion, listarExportadosIa, borrarCreacion, copiarFondo, crearCreacion, guardarCreacion, leerCreacion, listarCreaciones } from "./ia/almacen";
import type { Animo, Caras, ClipSpec, Creacion, Formato, Marca, TipoTarea, Transcripcion } from "@shared/tipos";
import type { Cola } from "./cola/cola";
import { dimensionesVideo, duracionVideo } from "./procesos/video";
import { carpetaDatos, carpetaProyecto, raizApp, rutaEscenas } from "./rutas";
import { esquemaVista, registrarComposicion, servirVista } from "./vista";
import { cacheSinErrores } from "./util/cache";
import { aplicarEstilo, copiarLogo, reubicarVideo, crearProyecto, guardarClip, guardarMarca, leerClips, leerJson, leerMarca, leerProyecto, listarExportados, listarProyectos } from "./proyectos/almacen";

export interface DepsIpc {
  cola: Cola;
  ventana: () => BrowserWindow | null;
  verificarSistema(o?: { claude?: boolean }): Promise<EstadoSistema>;
  accionSistema(accion: string, alProgreso: (p: { pct: number; texto?: string }) => void): Promise<void>;
}


/** Debe llamarse antes de app.ready. */
export function registrarEsquemaVideo(): void {
  protocol.registerSchemesAsPrivileged([
    esquemaVista,
  ]);
}

/** Videos que la persona eligió con el diálogo: solo esos se pueden servir por ruta. */
const elegidos = new Set<string>();

/**
 * Qué archivo entrega el servidor de medios (ver servidor-medios.ts):
 * proyecto/<id> el video original; archivo/<ruta> un video elegido con el diálogo o descargado;
 * musica/<archivo> una pista; exportado/<proyecto>/<archivo> una portada o un MP4 exportado.
 */
export async function resolverMedio(tipo: string, valor: string): Promise<string | null> {
  const simple = (x?: string) => !!x && x === basename(x) && !x.startsWith(".");
  if (tipo === "archivo") return elegidos.has(valor) ? valor : null;
  if (tipo === "musica") return simple(valor) ? join(carpetaMusica(), valor) : null;
  if (tipo === "exportado") {
    const [id, archivo] = valor.split("/");
    if (!simple(id) || !simple(archivo)) return null;
    return id.startsWith("ia:") ? join(carpetaCreacion(id.slice(3)), "exportados", archivo) : join(carpetaProyecto(id), "exportados", archivo);
  }
  if (tipo === "fondo-ia") {
    const [id, archivo] = valor.split("/");
    return simple(id) && simple(archivo) && /^fondo\.\w+$/.test(archivo) ? join(carpetaCreacion(id), archivo) : null;
  }
  if (tipo === "voz") return simple(valor) ? join(carpetaProyecto(valor), "voz.m4a") : null;
  if (tipo === "cache") return simple(valor) ? join(carpetaDatos(), "cache", valor) : null;
  if (tipo === "proyecto") return simple(valor) ? (await leerProyecto(valor).catch(() => null))?.video.ruta ?? null : null;
  return null;
}

export function registrarIpc(deps: DepsIpc): void {
  servirVista(raizApp(), carpetaDatos, rutaEscenas());
  ipcMain.handle("vista:registrar", (_e, id: string, html: string) => registrarComposicion(id, html));
  const { cola } = deps;
  cola.on("cambio", (t) => {
    const v = deps.ventana();
    if (v && !v.isDestroyed()) v.webContents.send("tareas:cambio", t);
  });

  let descarga: AbortController | null = null;
  ipcMain.handle("video:descargar", async (e, url: string) => {
    descarga?.abort();
    descarga = new AbortController();
    const ruta = await descargarVideo(url, join(carpetaDatos(), "videos"), {
      senal: descarga.signal,
      alProgreso: (p) => e.sender.send("video:progresoDescarga", p),
    });
    descarga = null;
    elegidos.add(ruta);
    const st = await stat(ruta);
    return { ruta, tamano: st.size, modificado: st.mtimeMs, duracion: await duracionVideo(ruta) };
  });
  ipcMain.handle("video:cancelarDescarga", () => descarga?.abort());
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
  ipcMain.handle("ia:listar", () => listarCreaciones());
  ipcMain.handle("ia:crear", (_e, entrada: Creacion["entrada"]) => crearCreacion(entrada));
  ipcMain.handle("ia:escribir", (_e, id: string) => escribirCreacion(id, { comando: process.env.REELS_CLAUDE_COMANDO }));
  ipcMain.handle("ia:leer", (_e, id: string) => leerCreacion(id));
  ipcMain.handle("ia:guardar", (_e, c: Creacion) => guardarCreacion(c));
  ipcMain.handle("ia:borrar", (_e, id: string) => borrarCreacion(id));
  ipcMain.handle("ia:elegirFondo", async (_e, id: string) => {
    const r = await dialog.showOpenDialog({ title: "Elige una foto o un video de fondo", properties: ["openFile"],
      filters: [{ name: "Fotos y videos", extensions: ["jpg", "jpeg", "png", "webp", "mp4", "mov", "m4v", "webm"] }] });
    return r.canceled || !r.filePaths[0] ? null : copiarFondo(id, r.filePaths[0]);
  });
  ipcMain.handle("musica:listar", () => listarPistas());
  ipcMain.handle("musica:vista", async (_e, proyectoId: string, clip: ClipSpec, duracion: number) =>
    musicaParaVista(clip, await leerProyecto(proyectoId), duracion).catch(() => null));
  ipcMain.handle("musica:agregar", async () => {
    const r = await dialog.showOpenDialog({ title: "Agrega música de fondo", properties: ["openFile", "multiSelections"], filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "ogg", "flac"] }] });
    const agregadas = [];
    for (const f of r.canceled ? [] : r.filePaths) agregadas.push(await agregarPista(f));
    return agregadas;
  });
  ipcMain.handle("musica:animo", (_e, id: string, animo: Animo) => cambiarAnimo(id, animo));
  ipcMain.handle("marca:guardar", (_e, m: Marca) => guardarMarca(m));
  ipcMain.handle("marca:elegirLogo", async () => {
    const r = await dialog.showOpenDialog({ title: "Elige el logo de la iglesia", properties: ["openFile"], filters: [{ name: "Imágenes", extensions: ["png", "jpg", "jpeg", "svg", "webp"] }] });
    return r.canceled || !r.filePaths[0] ? null : copiarLogo(r.filePaths[0]);
  });
  ipcMain.handle("proyectos:aplicarEstilo", (_e, id: string) => aplicarEstilo(id));
  const dims = cacheSinErrores((id) => leerProyecto(id).then((p) => dimensionesVideo(p.video.ruta)));
  ipcMain.handle("proyectos:infoVideo", (_e, id: string) => dims(id));
  ipcMain.handle("proyectos:ubicarVideo", async (_e, id: string) => {
    const r = await dialog.showOpenDialog({ title: "Ubica el video del culto", properties: ["openFile"], filters: [{ name: "Videos", extensions: ["mp4", "mov", "m4v", "mkv", "webm"] }] });
    return r.canceled || !r.filePaths[0] ? null : reubicarVideo(id, r.filePaths[0]);
  });
  ipcMain.handle("proyectos:procesar", (_e, id: string, desde?: TipoTarea) => void cola.agregar(id, desde ?? "transcribir"));
  ipcMain.handle("exportar:encolar", async (_e, id: string, clipIds: string[], formatos?: Formato[]) => {
    const clips = await leerClips(id);
    for (const c of clips.filter((x) => clipIds.includes(x.id))) {
      for (const formato of formatos ?? c.formatos) cola.agregar(id, "exportar", { clipId: c.id, formato, instantanea: c });
    }
  });
  ipcMain.handle("exportar:abrir", async (_e, id: string) => {
    const dir = id.startsWith("ia:") ? join(carpetaCreacion(id.slice(3)), "exportados") : join(carpetaProyecto(id), "exportados");
    await mkdir(dir, { recursive: true });
    await shell.openPath(dir);
  });
  ipcMain.handle("exportar:listar", async () => [...(await listarExportados()), ...(await listarExportadosIa())]);
  ipcMain.handle("ia:exportar", (_e, id: string, formatos: Formato[]) => {
    for (const formato of formatos) cola.agregar(`ia:${id}`, "exportar-ia", { creacionId: id, formato });
  });
  ipcMain.handle("tareas:lista", () => cola.lista());
  ipcMain.handle("tareas:reintentar", (_e, id: string) => cola.reintentar(id));
  ipcMain.handle("tareas:cancelar", (_e, id: string) => cola.cancelar(id));
  ipcMain.handle("sistema:verificar", (_e, o?: { claude?: boolean }) => deps.verificarSistema(o));
  ipcMain.handle("sistema:accion", (e, a: string) => deps.accionSistema(a, (p) => e.sender.send("sistema:progreso", p)));
}
