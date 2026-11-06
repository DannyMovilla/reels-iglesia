import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";

function crearVentana(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    frame: false,
    backgroundColor: "#0a0c16",
    title: "Reels Iglesia",
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: false,
    },
  });
  ventana.once("ready-to-show", () => ventana.show());
  if (process.env.ELECTRON_RENDERER_URL) ventana.loadURL(process.env.ELECTRON_RENDERER_URL);
  else ventana.loadFile(join(__dirname, "../renderer/index.html"));
  return ventana;
}

app.whenReady().then(() => {
  const ventana = crearVentana();
  ipcMain.on("ventana:minimizar", () => ventana.minimize());
  ipcMain.on("ventana:maximizar", () => (ventana.isMaximized() ? ventana.unmaximize() : ventana.maximize()));
  ipcMain.on("ventana:cerrar", () => ventana.close());
});

app.on("window-all-closed", () => app.quit());
