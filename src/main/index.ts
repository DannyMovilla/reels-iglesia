import { join } from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { analizarProyecto } from "./claude/analizar";
import { abrirInicioSesionClaude, verificarSistema } from "./sistema/verificar";
import { Cola } from "./cola/cola";
import { registrarEsquemaVideo, registrarIpc, resolverMedio } from "./ipc";
import { iniciarServidorMedios } from "./servidor-medios";
import { avisarExportaciones } from "./exportar/avisos";
import { crearEjecutorExportar } from "./exportar/tarea";
import { crearEjecutorExportarIa } from "./ia/exportar";
import { crearEjecutores, marcarInterrumpidos } from "./pipeline/tareas";
import { resolverComandoClaude } from "./sistema/claude-cmd";
import { protegerNavegacion } from "./ventana";
import { carpetaDatos, raizApp, raizRecursos, rutaEntorno, rutaPython, rutaTranscriptor } from "./rutas";
import { argsWinget, prepararEntorno } from "./sistema/preparar";
import { ejecutarConProgreso } from "./procesos/lineas";

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
    // Instalada, la ventana toma el ícono del .exe; en desarrollo, el de build/.
    ...(app.isPackaged ? {} : { icon: join(raizApp(), "build", "icon.png") }),
    show: false,
    webPreferences: { preload: join(__dirname, "../preload/index.js"), contextIsolation: true, sandbox: true },
  });
  protegerNavegacion(v.webContents);
  v.once("ready-to-show", () => v.show());
  if (process.env.ELECTRON_RENDERER_URL) v.loadURL(process.env.ELECTRON_RENDERER_URL);
  else v.loadFile(join(__dirname, "../renderer/index.html"));
  return v;
}

let preparando: AbortController | null = null;
const comandoClaude = (): string => process.env.REELS_CLAUDE_COMANDO ?? "claude";

app.whenReady().then(async () => {
  let cola: Cola;
  const ejecutores = crearEjecutores({
    python: rutaPython(),
    script: rutaTranscriptor(),
    encolar: (id, tipo) => cola.agregar(id, tipo),
    analizar: (id, ctx) => analizarProyecto(id, ctx),
  });
  cola = new Cola(join(carpetaDatos(), "cola.json"), { ...ejecutores, exportar: crearEjecutorExportar(), "exportar-ia": crearEjecutorExportarIa() });
  avisarExportaciones(cola);
  await cola.cargar();
  await marcarInterrumpidos(cola.lista());

  // Antes de la ventana: el preload pide la dirección del servidor de medios al cargar.
  const medios = await iniciarServidorMedios(resolverMedio);
  ipcMain.on("medios:base", (e) => { e.returnValue = medios.base; });
  ventana = crearVentana();
  registrarIpc({
    cola,
    ventana: () => ventana,
    verificarSistema: (o) => {
      const [claude, claudeArgs] = resolverComandoClaude();
      return verificarSistema({ python: rutaPython(), claude, claudeArgs, revisarClaude: o?.claude ?? false });
    },
    accionSistema: async (accion, alProgreso) => {
      if (accion === "iniciar-sesion-claude") return abrirInicioSesionClaude(comandoClaude());
      if (accion === "cancelar") return void preparando?.abort();
      if (accion === "crear-venv") {
        preparando = new AbortController();
        const hayNvidia = await ejecutarConProgreso("nvidia-smi", ["-L"]).then((r) => r.codigo === 0).catch(() => false);
        const cli = join(raizApp(), "node_modules", "hyperframes", "bin", "hyperframes.mjs");
        return prepararEntorno({
          destino: rutaEntorno(), requisitos: join(raizRecursos(), "python", "requirements.txt"),
          requisitosGpu: join(raizRecursos(), "python", "requirements-gpu.txt"), gpu: hayNvidia,
          navegador: [process.execPath, [cli, "browser", "ensure"]], senal: preparando.signal,
          alProgreso: (pct, texto) => alProgreso({ pct, texto }),
        });
      }
      const ids: Record<string, string> = { "instalar-ffmpeg": "Gyan.FFmpeg", "instalar-python": "Python.Python.3.12" };
      if (ids[accion]) {
        alProgreso({ pct: 10, texto: "Instalando con winget… (puede pedir permiso de Windows)" });
        const r = await ejecutarConProgreso("winget", argsWinget(ids[accion]));
        if (r.codigo !== 0) throw new Error("No se pudo instalar con winget. Instálalo a mano desde la página oficial y vuelve a revisar.");
        alProgreso({ pct: 100, texto: "Instalado. Cierra y vuelve a abrir Reels Iglesia si no aparece." });
      }
    },
  });
  ipcMain.on("ventana:minimizar", () => ventana?.minimize());
  ipcMain.on("ventana:maximizar", () => (ventana?.isMaximized() ? ventana.unmaximize() : ventana?.maximize()));
  ipcMain.on("ventana:cerrar", () => ventana?.close());
});

app.on("window-all-closed", () => app.quit());
