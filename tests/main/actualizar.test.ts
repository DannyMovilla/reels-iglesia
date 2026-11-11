import { EventEmitter } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";
import { Actualizador, type EstadoActualizacion } from "../../src/main/actualizar";
import { configurarRegistro } from "../../src/main/registro";

class UpdaterFalso extends EventEmitter {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  checkForUpdates = vi.fn(async () => null);
  quitAndInstall = vi.fn();
}

let updater: UpdaterFalso;
let estados: EstadoActualizacion[];
let trabajo = false;
beforeEach(() => {
  configurarRegistro({ carpeta: mkdtempSync(join(tmpdir(), "reels-act-")) });
  updater = new UpdaterFalso();
  estados = [];
  trabajo = false;
  vi.useFakeTimers();
});

const crear = (empaquetada = true) =>
  new Actualizador({ updater, empaquetada, hayTrabajo: () => trabajo, alCambiar: (e) => estados.push(e) });

test("en desarrollo no revisa", () => {
  crear(false).iniciar();
  vi.advanceTimersByTime(30 * 60 * 60 * 1000);
  expect(updater.checkForUpdates).not.toHaveBeenCalled();
});

test("instalada revisa a los 10 s y luego cada 6 horas, y descarga sola", () => {
  crear().iniciar();
  expect(updater.autoDownload).toBe(true);
  expect(updater.autoInstallOnAppQuit).toBe(true);
  vi.advanceTimersByTime(9_999);
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(0);
  vi.advanceTimersByTime(1);
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  updater.emit("update-not-available");
  vi.advanceTimersByTime(21_600_000);
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
});

test("los eventos se vuelven estados en español", () => {
  const a = crear();
  a.iniciar();
  updater.emit("checking-for-update");
  expect(a.estado()).toEqual({ fase: "buscando" });
  updater.emit("update-not-available");
  expect(a.estado()).toEqual({ fase: "al-dia" });
  updater.emit("download-progress", { percent: 41.7 });
  expect(a.estado()).toEqual({ fase: "descargando", pct: 42 });
  updater.emit("update-downloaded", { version: "0.3.0" });
  expect(a.estado()).toEqual({ fase: "lista", version: "0.3.0", trabajando: false });
  expect(estados.at(-1)).toEqual({ fase: "lista", version: "0.3.0", trabajando: false });
});

test("sin internet: estado de error en español y sin buscar dos veces a la vez (Review Focus 3)", async () => {
  const a = crear();
  a.iniciar();
  updater.emit("checking-for-update");
  await a.buscar();
  expect(updater.checkForUpdates).toHaveBeenCalledTimes(0);
  updater.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED"));
  expect(a.estado()).toEqual({ fase: "error", error: "No pude revisar las actualizaciones. Revisa tu internet." });
  updater.checkForUpdates.mockRejectedValueOnce(new Error("net::ERR_INTERNET_DISCONNECTED"));
  await expect(a.buscar()).resolves.toBeUndefined();
  expect(a.estado().fase).toBe("error");
});

test("no reinicia mientras hay trabajo; sin trabajo instala", () => {
  const a = crear();
  updater.emit("update-downloaded", { version: "0.3.0" });
  trabajo = true;
  expect(a.reiniciar()).toBe(false);
  expect(updater.quitAndInstall).not.toHaveBeenCalled();
  trabajo = false;
  expect(a.reiniciar()).toBe(true);
  expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
});

test("en desarrollo, «Buscar actualizaciones» dice que solo funciona instalada", async () => {
  const a = crear(false);
  await a.buscar();
  expect(updater.checkForUpdates).not.toHaveBeenCalled();
  expect(a.estado()).toEqual({ fase: "error", error: "Las actualizaciones funcionan solo en la app instalada." });
});

test("revisión: con la versión lista, el estado dice si hay trabajo y se vuelve a avisar cuando cambia", () => {
  const a = crear();
  updater.emit("update-downloaded", { version: "0.3.0" });
  expect(a.estado()).toEqual({ fase: "lista", version: "0.3.0", trabajando: false });
  const antes = estados.length;
  trabajo = true;
  a.avisarTrabajo();
  expect(estados.at(-1)).toEqual({ fase: "lista", version: "0.3.0", trabajando: true });
  a.avisarTrabajo();
  expect(estados.length).toBe(antes + 1);
  trabajo = false;
  a.avisarTrabajo();
  expect(estados.at(-1)).toEqual({ fase: "lista", version: "0.3.0", trabajando: false });
});
