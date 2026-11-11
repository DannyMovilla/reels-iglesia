/** Estado de las actualizaciones automáticas (proceso principal → ventana). */
export type EstadoActualizacion = {
  fase: "inactivo" | "buscando" | "al-dia" | "descargando" | "lista" | "error";
  version?: string;
  pct?: number;
  error?: string;
};

/** El estado en palabras, para Ajustes. */
export function textoActualizacion(e: EstadoActualizacion): string {
  switch (e.fase) {
    case "buscando": return "Buscando…";
    case "al-dia": return "Estás al día";
    case "descargando": return `Descargando ${e.pct ?? 0} %`;
    case "lista": return `Versión ${e.version ?? "nueva"} lista: se instala al cerrar`;
    case "error": return e.error ?? "No pude revisar las actualizaciones.";
    default: return "";
  }
}
