import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import type { EstadoSistema } from "@shared/api";
import { analizarProyecto } from "./claude/analizar";
import { Cola } from "./cola/cola";
import { registrarEsquemaVideo, registrarIpc } from "./ipc";
import { crearEjecutores } from "./pipeline/tareas";
import { carpetaDatos, rutaPython, rutaTranscriptor } from "./rutas";

registrarEsquemaVideo();

let ventana: BrowserWindow | null = null;

function crearVentana(): BrowserWindow {
  const v = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    backgroundColor: "#0a0c16",
    title: "Reels Iglesia",
    show: false,
    webPreferences: { preload: join(__dirname, "../preload/index.js"), contextIsolation: true, sandbox: false },
  });
  v.once("ready-to-show", () => v.show());
  if (process.env.ELECTRON_RENDERER_URL) v.loadURL(process.env.ELECTRON_RENDERER_URL);
  else v.loadFile(join(__dirname, "../renderer/index.html"));
  return v;
}

const PENDIENTE = { ok: false, detalle: "Verificación pendiente" };

app.whenReady().then(async () => {
  let cola: Cola;
  const ejecutores = crearEjecutores({
    python: rutaPython(),
    script: rutaTranscriptor(),
    encolar: (id, tipo) => cola.agregar(id, tipo),
    analizar: (id, ctx) => analizarProyecto(id, ctx),
  });
  cola = new Cola(join(carpetaDatos(), "cola.json"), ejecutores);
  await cola.cargar();

  ventana = crearVentana();
  registrarIpc({
    cola,
    ventana: () => ventana,
    verificarSistema: async (): Promise<EstadoSistema> => ({ ffmpeg: PENDIENTE, python: PENDIENTE, gpu: PENDIENTE, claude: PENDIENTE }),
    accionSistema: async () => {},
  });
  ipcMain.on("ventana:minimizar", () => ventana?.minimize());
  ipcMain.on("ventana:maximizar", () => (ventana?.isMaximized() ? ventana.unmaximize() : ventana?.maximize()));
  ipcMain.on("ventana:cerrar", () => ventana?.close());
});

app.on("window-all-closed", () => app.quit());
