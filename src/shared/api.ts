/** API que el preload expone al renderer como `window.reels`. Crece en las tareas siguientes. */
export interface ApiReels {
  ventana: { minimizar(): void; maximizar(): void; cerrar(): void };
}
