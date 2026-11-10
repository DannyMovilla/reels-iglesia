import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { dialog, ipcMain, protocol, shell, type BrowserWindow } from "electron";
import type { DatosNuevoProyecto, EstadoSistema } from "@shared/api";
import { descargarVideo } from "./descargas/ytdlp";
import { agregarPista, cambiarAnimo, carpetaMusica, listarPistas, musicaParaVista, musicaVistaEn } from "./musica/banco";
import { escribirCreacion } from "./ia/claude";
import { carpetaCreacion, listarExportadosIa, borrarCreacion, copiarFondo, crearCreacion, guardarCreacion, leerCreacion, listarCreaciones } from "./ia/almacen";
import type { NivelVoz } from "@shared/tipos";
import type { Analisis, Animo, Caras, ClipSpec, Creacion, Formato, Marca, TipoTarea, Transcripcion } from "@shared/tipos";
import type { Correccion } from "@shared/correcciones";
import { clipManual } from "@shared/clip";
import { pedirCambios, type EntradaHistorial } from "./claude/cambios";
import { crearCapitulos, leerCapitulos } from "./claude/capitulos";
import { guardarSrt } from "./entregas/entregas";
import { guardarPdf } from "./entregas/pdf";
import { guardarMp3 } from "./entregas/mp3";
import { traducirSrt } from "./entregas/traducir";
import { medirBalance } from "./procesos/color";
import { archivoVoz } from "./procesos/audio";
import { asegurarVoz } from "./exportar/tarea";
import { palabrasDe } from "@shared/reel/tiempo";
import type { Cola } from "./cola/cola";
import { dimensionesVideo, duracionVideo } from "./procesos/video";
import { carpetaDatos, carpetaProyecto, raizApp, rutaEfectos, rutaEscenas, rutaPinturas } from "./rutas";
import { esquemaVista, registrarComposicion, servirVista } from "./vista";
import { cacheSinErrores } from "./util/cache";
import { aplicarEstilo, copiarLogo, reubicarVideo, crearProyecto, guardarClip, guardarMarca, leerClips, leerJson, leerMarca, leerProyecto, listarExportados, listarProyectos, leerTranscripcion, leerCorrecciones, corregir, quitarCorreccion, agregarClip, guardarProyecto, validarTramoClip, copiarFuente } from "./proyectos/almacen";

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
    if (id.startsWith("ia:")) return simple(id.slice(3)) ? join(carpetaCreacion(id.slice(3)), "exportados", archivo) : null;
    return join(carpetaProyecto(id), "exportados", archivo);
  }
  if (tipo === "fondo-ia") {
    const [id, archivo] = valor.split("/");
    return simple(id) && simple(archivo) && /^fondo\.\w+$/.test(archivo) ? join(carpetaCreacion(id), archivo) : null;
  }
  if (tipo === "voz") {
    // "id" (voz Limpia) o "id/nivel".
    const [id, nivel] = valor.split("/");
    if (!simple(id)) return null;
    if (nivel === undefined || nivel === "limpia") return join(carpetaProyecto(id), "voz.m4a");
    return nivel === "ligera" || nivel === "podcast" ? join(carpetaProyecto(id), archivoVoz(nivel)) : null;
  }
  if (tipo === "cache") return simple(valor) ? join(carpetaDatos(), "cache", valor) : null;
  if (tipo === "proyecto") return simple(valor) ? (await leerProyecto(valor).catch(() => null))?.video.ruta ?? null : null;
  return null;
}

export function registrarIpc(deps: DepsIpc): void {
  servirVista(raizApp(), carpetaDatos, rutaEscenas(), rutaEfectos(), rutaPinturas());
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
  ipcMain.handle("proyectos:transcripcion", (_e, id: string) => leerTranscripcion(id));
  ipcMain.handle("proyectos:correcciones", (_e, id: string) => leerCorrecciones(id));
  ipcMain.handle("proyectos:corregir", (_e, id: string, c: Correccion) => corregir(id, c));
  ipcMain.handle("proyectos:quitarCorreccion", (_e, id: string, i: number) => quitarCorreccion(id, i));
  ipcMain.handle("proyectos:caras", (_e, id: string) => leerJson<Caras>(id, "caras.json"));
  ipcMain.handle("proyectos:guardarClip", (_e, id: string, clip: ClipSpec) => guardarClip(id, clip));
  ipcMain.handle("proyectos:prepararVoz", async (_e, id: string, nivel: NivelVoz) => {
    if (!["ligera", "limpia", "podcast"].includes(nivel)) throw new Error("Ese nivel de voz no existe.");
    await asegurarVoz(await leerProyecto(id), nivel);
  });
  ipcMain.handle("proyectos:medirColor", async (_e, id: string, inicio: number, fin: number) => {
    const p = await leerProyecto(id);
    if (!p.videoDisponible) throw new Error("No encuentro el video original. Vuelve a ponerlo en su lugar y reintenta.");
    return medirBalance(p.video.ruta, Number(inicio) || 0, Number(fin) || 0);
  });
  ipcMain.handle("entregas:pdf", (_e, id: string) => guardarPdf(id));
  ipcMain.handle("entregas:traducir", (e, id: string, idiomas: string[]) =>
    traducirSrt(id, Array.isArray(idiomas) ? idiomas : [], { comando: process.env.REELS_CLAUDE_COMANDO, alProgreso: (t) => e.sender.send("entregas:progreso", t) }));
  ipcMain.handle("entregas:mp3", (_e, id: string, nivel: NivelVoz) => guardarMp3(id, ["ligera", "limpia", "podcast"].includes(nivel) ? nivel : "limpia"));
  ipcMain.handle("entregas:srt", (_e, id: string, o: { completo: boolean }) => guardarSrt(id, { completo: o?.completo !== false }));
  ipcMain.handle("proyectos:capitulos", (_e, id: string) => leerCapitulos(id));
  ipcMain.handle("claude:capitulos", (_e, id: string) => crearCapitulos(id, { comando: process.env.REELS_CLAUDE_COMANDO }));
  ipcMain.handle("claude:cambios", (_e, id: string, clip: ClipSpec, pedido: string, historial: EntradaHistorial[]) =>
    pedirCambios(id, clip, pedido, historial, { comando: process.env.REELS_CLAUDE_COMANDO }));
  ipcMain.handle("proyectos:crearClip", async (_e, id: string, inicio: number, fin: number) => {
    if (!/^[\w-]+$/.test(String(id))) throw new Error("No pude crear el clip con ese tramo.");
    validarTramoClip(id, inicio, fin, await leerProyecto(id));
    const t = await leerTranscripcion(id);
    if (!t) throw new Error("No hay transcripción para crear el clip.");
    const clip = clipManual(inicio, fin, palabrasDe(t), (await leerMarca()).estilo);
    await agregarClip(id, clip);
    return clip;
  });
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
  ipcMain.handle("marca:elegirFuente", async () => {
    const r = await dialog.showOpenDialog({ title: "Elegir la fuente de la iglesia", properties: ["openFile"], filters: [{ name: "Fuentes", extensions: ["ttf", "otf", "woff", "woff2"] }] });
    return r.canceled || !r.filePaths[0] ? null : copiarFuente(r.filePaths[0]);
  });
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
  ipcMain.handle("proyectos:reanalizar", async (_e, id: string, analisis: Analisis) => {
    const p = await leerProyecto(id);
    await guardarProyecto({ ...p, analisis });
    void cola.agregar(id, "analizar");
  });
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
  ipcMain.handle("ia:musicaVista", async (_e, id: string, duracion: number) =>
    musicaVistaEn((await leerCreacion(id)).musica, carpetaCreacion(id), duracion).catch(() => null));
  ipcMain.handle("ia:exportar", async (_e, id: string, formatos: Formato[]) => {
    const instantaneaIa = await leerCreacion(id);
    for (const formato of formatos) cola.agregar(`ia:${id}`, "exportar-ia", { creacionId: id, formato, instantaneaIa });
  });
  ipcMain.handle("tareas:lista", () => cola.lista());
  ipcMain.handle("tareas:reintentar", (_e, id: string) => cola.reintentar(id));
  ipcMain.handle("tareas:cancelar", (_e, id: string) => cola.cancelar(id));
  ipcMain.handle("sistema:verificar", (_e, o?: { claude?: boolean }) => deps.verificarSistema(o));
  ipcMain.handle("sistema:accion", (e, a: string) => deps.accionSistema(a, (p) => e.sender.send("sistema:progreso", p)));
}
