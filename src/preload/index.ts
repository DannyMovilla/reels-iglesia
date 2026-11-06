import { contextBridge, ipcRenderer } from "electron";
import type { ApiReels } from "@shared/api";

const api: ApiReels = {
  ventana: {
    minimizar: () => ipcRenderer.send("ventana:minimizar"),
    maximizar: () => ipcRenderer.send("ventana:maximizar"),
    cerrar: () => ipcRenderer.send("ventana:cerrar"),
  },
};

contextBridge.exposeInMainWorld("reels", api);
