import type { EventEmitter } from "node:events";
import { registrar } from "./registro";

import type { EstadoActualizacion } from "@shared/actualizacion";

export type { EstadoActualizacion };

/** Lo que se usa de `autoUpdater` (electron-updater); en las pruebas, un falso. */
export interface UpdaterMinimo extends Pick<EventEmitter, "on"> {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

const PRIMERA = 10_000;
const CADA = 6 * 60 * 60 * 1000;
export const ERROR_ACTUALIZAR = "No pude revisar las actualizaciones. Revisa tu internet.";
export const SOLO_INSTALADA = "Las actualizaciones funcionan solo en la app instalada.";

/**
 * Actualizaciones automáticas desde los releases de GitHub: revisa 10 s después de abrir y cada 6 horas, descarga
 * sola y se instala al cerrar. Nunca reinicia con una exportación o una tarea larga en curso. En desarrollo no revisa.
 */
export class Actualizador {
  private actual: EstadoActualizacion = { fase: "inactivo" };
  private ultimoTrabajando: boolean | null = null;

  constructor(private d: { updater: UpdaterMinimo; empaquetada: boolean; hayTrabajo: () => boolean; alCambiar: (e: EstadoActualizacion) => void }) {
    const u = d.updater;
    u.autoDownload = true;
    u.autoInstallOnAppQuit = true;
    u.on("checking-for-update", () => this.poner({ fase: "buscando" }));
    u.on("update-not-available", () => this.poner({ fase: "al-dia" }));
    u.on("update-available", (i: { version?: string }) => this.poner({ fase: "descargando", pct: 0, ...(i?.version ? { version: i.version } : {}) }));
    u.on("download-progress", (p: { percent?: number }) => this.poner({ fase: "descargando", pct: Math.round(p?.percent ?? 0) }));
    u.on("update-downloaded", (i: { version?: string }) => {
      registrar("info", "actualizar", `versión ${i?.version ?? "?"} lista para instalar`);
      this.poner({ fase: "lista", version: i?.version });
    });
    u.on("error", (e: unknown) => this.fallo(e));
  }

  /** El estado; con la versión lista, también si hay trabajo en curso (entonces no se ofrece reiniciar). */
  estado(): EstadoActualizacion {
    return this.actual.fase === "lista" ? { ...this.actual, trabajando: this.d.hayTrabajo() } : this.actual;
  }

  /** Vuelve a avisar a la ventana si cambió «hay trabajo» con la versión lista (se llama cuando cambian las tareas). */
  avisarTrabajo(): void {
    if (this.actual.fase !== "lista") return;
    const t = this.d.hayTrabajo();
    if (t === this.ultimoTrabajando) return;
    this.d.alCambiar(this.estado());
    this.ultimoTrabajando = t;
  }

  iniciar(): void {
    if (!this.d.empaquetada) return;
    setTimeout(() => void this.buscar(), PRIMERA);
    setInterval(() => void this.buscar(), CADA);
  }

  /** Busca una versión nueva; nunca lanza (el error queda en el estado). */
  async buscar(): Promise<void> {
    if (!this.d.empaquetada) return this.poner({ fase: "error", error: SOLO_INSTALADA });
    if (["buscando", "descargando", "lista"].includes(this.actual.fase)) return;
    try {
      await this.d.updater.checkForUpdates();
    } catch (e) {
      this.fallo(e);
    }
  }

  /** Reinicia para instalar; false (sin reiniciar) si hay trabajo en curso. */
  reiniciar(): boolean {
    if (this.d.hayTrabajo()) return false;
    this.d.updater.quitAndInstall(false, true);
    return true;
  }

  private fallo(e: unknown): void {
    registrar("aviso", "actualizar", `no pude revisar: ${e instanceof Error ? e.message : String(e)}`);
    this.poner({ fase: "error", error: ERROR_ACTUALIZAR });
  }

  private poner(e: EstadoActualizacion): void {
    this.actual = e;
    const estado = this.estado();
    if (e.fase === "lista") this.ultimoTrabajando = estado.trabajando ?? null;
    this.d.alCambiar(estado);
  }
}
