import type { WebContents } from "electron";

/**
 * La ventana nunca sale de la app: soltar un video encima o seguir un enlace no la reemplaza
 * (sin marco, la persona quedaría sin botones para cerrar o volver).
 */
export function protegerNavegacion(wc: WebContents): void {
  wc.on("will-navigate", (e) => e.preventDefault());
  wc.setWindowOpenHandler(() => ({ action: "deny" }));
}
