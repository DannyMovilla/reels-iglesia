/** Tema de la app: oscuro (por defecto), claro o como Windows. Se guarda en esta PC. */
export type PreferenciaTema = "oscuro" | "claro" | "sistema";

const CLAVE = "reels-tema";
let quitarEscucha: (() => void) | null = null;

export function leerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === "claro" || v === "sistema" ? v : "oscuro";
  } catch {
    return "oscuro";
  }
}

const sistemaClaro = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches;

/** Aplica y guarda el tema. Con "sistema", cambia solo cuando Windows cambia. */
export function aplicarTema(pref: PreferenciaTema): void {
  try {
    localStorage.setItem(CLAVE, pref);
  } catch {
    /* sin almacenamiento */
  }
  quitarEscucha?.();
  quitarEscucha = null;
  const poner = () => { document.documentElement.dataset.tema = pref === "claro" || (pref === "sistema" && sistemaClaro()) ? "claro" : "oscuro"; };
  poner();
  if (pref === "sistema" && typeof window.matchMedia === "function") {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener?.("change", poner);
    quitarEscucha = () => mq.removeEventListener?.("change", poner);
  }
}
