import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { analizarProyecto } from "./claude/analizar";
import { abrirInicioSesionClaude, verificarSistema } from "./sistema/verificar";
import { Cola } from "./cola/cola";
import { registrarEsquemaVideo, registrarIpc } from "./ipc";
import { crearEjecutores, marcarInterrumpidos } from "./pipeline/tareas";
import { resolverComandoClaude } from "./sistema/claude-cmd";
import { protegerNavegacion } from "./ventana";
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
  protegerNavegacion(v.webContents);
  v.once("ready-to-show", () => v.show());
  if (process.env.ELECTRON_RENDERER_URL) v.loadURL(process.env.ELECTRON_RENDERER_URL);
  else v.loadFile(join(__dirname, "../renderer/index.html"));
  return v;
}

const comandoClaude = (): string => process.env.REELS_CLAUDE_COMANDO ?? "claude";

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
  await marcarInterrumpidos(cola.lista());

  ventana = crearVentana();
  registrarIpc({
    cola,
    ventana: () => ventana,
    verificarSistema: () => {
      const [claude, claudeArgs] = resolverComandoClaude();
      return verificarSistema({ python: rutaPython(), claude, claudeArgs });
    },
    accionSistema: async (accion) => {
      if (accion === "iniciar-sesion-claude") abrirInicioSesionClaude(comandoClaude());
    },
  });
  ipcMain.on("ventana:minimizar", () => ventana?.minimize());
  ipcMain.on("ventana:maximizar", () => (ventana?.isMaximized() ? ventana.unmaximize() : ventana?.maximize()));
  ipcMain.on("ventana:cerrar", () => ventana?.close());
});

app.on("window-all-closed", () => app.quit());
