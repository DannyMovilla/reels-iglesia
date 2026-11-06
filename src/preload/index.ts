import { contextBridge, ipcRenderer } from "electron";
import type { ApiReels } from "@shared/api";
import type { Tarea } from "@shared/tipos";

const api: ApiReels = {
  elegirVideo: () => ipcRenderer.invoke("video:elegir"),
  descargarVideo: (url) => ipcRenderer.invoke("video:descargar", url),
  cancelarDescarga: () => ipcRenderer.invoke("video:cancelarDescarga"),
  alProgresoDescarga: (cb) => {
    const oyente = (_e: unknown, p: number) => cb(p);
    ipcRenderer.on("video:progresoDescarga", oyente);
    return () => ipcRenderer.removeListener("video:progresoDescarga", oyente);
  },
  crearProyecto: (d) => ipcRenderer.invoke("proyectos:crear", d),
  listarProyectos: () => ipcRenderer.invoke("proyectos:listar"),
  leerProyecto: (id) => ipcRenderer.invoke("proyectos:leer", id),
  leerClips: (id) => ipcRenderer.invoke("proyectos:clips", id),
  leerTranscripcion: (id) => ipcRenderer.invoke("proyectos:transcripcion", id),
  leerCaras: (id) => ipcRenderer.invoke("proyectos:caras", id),
  guardarClip: (id, clip) => ipcRenderer.invoke("proyectos:guardarClip", id, clip),
  leerMarca: () => ipcRenderer.invoke("marca:leer"),
  listarPistas: () => ipcRenderer.invoke("musica:listar"),
  agregarPistas: () => ipcRenderer.invoke("musica:agregar"),
  cambiarAnimo: (id, animo) => ipcRenderer.invoke("musica:animo", id, animo),
  urlPista: (id) => `reels-video://musica/${encodeURIComponent(id)}`,
  urlExportado: (id, archivo) => `reels-video://exportado/${encodeURIComponent(id)}/${encodeURIComponent(archivo)}`,
  guardarMarca: (m) => ipcRenderer.invoke("marca:guardar", m),
  elegirLogo: () => ipcRenderer.invoke("marca:elegirLogo"),
  aplicarEstilo: (id) => ipcRenderer.invoke("proyectos:aplicarEstilo", id),
  infoVideo: (id) => ipcRenderer.invoke("proyectos:infoVideo", id),
  procesar: (id, desde) => ipcRenderer.invoke("proyectos:procesar", id, desde),
  exportar: (id, clipIds, formatos) => ipcRenderer.invoke("exportar:encolar", id, clipIds, formatos),
  abrirCarpetaExportados: (id) => ipcRenderer.invoke("exportar:abrir", id),
  listarExportados: () => ipcRenderer.invoke("exportar:listar"),
  tareas: () => ipcRenderer.invoke("tareas:lista"),
  alCambiarTareas: (cb) => {
    const oyente = (_e: unknown, t: Tarea[]) => cb(t);
    ipcRenderer.on("tareas:cambio", oyente);
    return () => ipcRenderer.removeListener("tareas:cambio", oyente);
  },
  reintentar: (id) => ipcRenderer.invoke("tareas:reintentar", id),
  cancelar: (id) => ipcRenderer.invoke("tareas:cancelar", id),
  urlVideo: (id) => `reels-video://proyecto/${encodeURIComponent(id)}`,
  urlArchivo: (ruta) => `reels-video://archivo/${encodeURIComponent(ruta)}`,
  registrarVista: (id, html) => ipcRenderer.invoke("vista:registrar", id, html),
  verificarSistema: () => ipcRenderer.invoke("sistema:verificar"),
  accionSistema: (a) => ipcRenderer.invoke("sistema:accion", a),
  ventana: {
    minimizar: () => ipcRenderer.send("ventana:minimizar"),
    maximizar: () => ipcRenderer.send("ventana:maximizar"),
    cerrar: () => ipcRenderer.send("ventana:cerrar"),
  },
};

contextBridge.exposeInMainWorld("reels", api);
