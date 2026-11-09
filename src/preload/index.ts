import { contextBridge, ipcRenderer } from "electron";
import type { ApiReels } from "@shared/api";
import type { Tarea } from "@shared/tipos";

/** http://127.0.0.1:<puerto>/<clave> del servidor de medios del proceso principal. */
const medios = ipcRenderer.sendSync("medios:base") as string;

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
  leerCorrecciones: (id) => ipcRenderer.invoke("proyectos:correcciones", id),
  corregir: (id, c) => ipcRenderer.invoke("proyectos:corregir", id, c),
  quitarCorreccion: (id, i) => ipcRenderer.invoke("proyectos:quitarCorreccion", id, i),
  leerCaras: (id) => ipcRenderer.invoke("proyectos:caras", id),
  guardarClip: (id, clip) => ipcRenderer.invoke("proyectos:guardarClip", id, clip),
  crearClip: (id, inicio, fin) => ipcRenderer.invoke("proyectos:crearClip", id, inicio, fin),
  leerCapitulos: (id) => ipcRenderer.invoke("proyectos:capitulos", id),
  crearCapitulos: (id) => ipcRenderer.invoke("claude:capitulos", id),
  pedirCambios: (id, clip, pedido, historial) => ipcRenderer.invoke("claude:cambios", id, clip, pedido, historial),
  leerMarca: () => ipcRenderer.invoke("marca:leer"),
  listarCreaciones: () => ipcRenderer.invoke("ia:listar"),
  crearCreacion: (entrada) => ipcRenderer.invoke("ia:crear", entrada),
  escribirCreacion: (id) => ipcRenderer.invoke("ia:escribir", id),
  leerCreacion: (id) => ipcRenderer.invoke("ia:leer", id),
  guardarCreacion: (c) => ipcRenderer.invoke("ia:guardar", c),
  borrarCreacion: (id) => ipcRenderer.invoke("ia:borrar", id),
  elegirFondo: (id) => ipcRenderer.invoke("ia:elegirFondo", id),
  exportarCreacion: (id, formatos) => ipcRenderer.invoke("ia:exportar", id, formatos),
  urlMusicaCreacion: async (id, duracion) => {
    const r = (await ipcRenderer.invoke("ia:musicaVista", id, duracion)) as { tipo: string; nombre: string } | null;
    return r ? `${medios}/${r.tipo}/${encodeURIComponent(r.nombre)}` : null;
  },
  urlFondo: (id, archivo) => `${medios}/fondo-ia/${encodeURIComponent(id)}/${encodeURIComponent(archivo)}`,
  listarPistas: () => ipcRenderer.invoke("musica:listar"),
  agregarPistas: () => ipcRenderer.invoke("musica:agregar"),
  cambiarAnimo: (id, animo) => ipcRenderer.invoke("musica:animo", id, animo),
  urlPista: (id) => `${medios}/musica/${encodeURIComponent(id)}`,
  urlMusicaVista: async (proyectoId, clip, duracion) => {
    const r = (await ipcRenderer.invoke("musica:vista", proyectoId, clip, duracion)) as { tipo: string; nombre: string } | null;
    return r ? `${medios}/${r.tipo}/${encodeURIComponent(r.nombre)}` : null;
  },
  urlVoz: (id) => `${medios}/voz/${encodeURIComponent(id)}`,
  urlExportado: (id, archivo) => `${medios}/exportado/${encodeURIComponent(id)}/${encodeURIComponent(archivo)}`,
  guardarMarca: (m) => ipcRenderer.invoke("marca:guardar", m),
  elegirLogo: () => ipcRenderer.invoke("marca:elegirLogo"),
  aplicarEstilo: (id) => ipcRenderer.invoke("proyectos:aplicarEstilo", id),
  infoVideo: (id) => ipcRenderer.invoke("proyectos:infoVideo", id),
  ubicarVideo: (id) => ipcRenderer.invoke("proyectos:ubicarVideo", id),
  procesar: (id, desde) => ipcRenderer.invoke("proyectos:procesar", id, desde),
  reanalizar: (id, analisis) => ipcRenderer.invoke("proyectos:reanalizar", id, analisis),
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
  urlVideo: (id) => `${medios}/proyecto/${encodeURIComponent(id)}`,
  urlArchivo: (ruta) => `${medios}/archivo/${encodeURIComponent(ruta)}`,
  registrarVista: (id, html) => ipcRenderer.invoke("vista:registrar", id, html),
  verificarSistema: (o) => ipcRenderer.invoke("sistema:verificar", o),
  alProgresoSistema: (cb) => {
    const oyente = (_e: unknown, p: { pct: number; texto?: string }) => cb(p);
    ipcRenderer.on("sistema:progreso", oyente);
    return () => ipcRenderer.removeListener("sistema:progreso", oyente);
  },
  accionSistema: (a) => ipcRenderer.invoke("sistema:accion", a),
  ventana: {
    minimizar: () => ipcRenderer.send("ventana:minimizar"),
    maximizar: () => ipcRenderer.send("ventana:maximizar"),
    cerrar: () => ipcRenderer.send("ventana:cerrar"),
  },
};

contextBridge.exposeInMainWorld("reels", api);
