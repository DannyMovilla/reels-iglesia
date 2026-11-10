import type { EstiloSub } from "@shared/tipos";

/** Familias para filtrar la galería de subtítulos: [id, nombre, estilos]. Entre todas están los 15 estilos. */
export const FAMILIAS_SUB: [string, string, EstiloSub[]][] = [
  ["sencillos", "Sencillos", ["limpio", "elegante", "subrayado", "caja"]],
  ["animados", "Animados", ["pop", "karaoke", "rebote", "brillo", "resaltado"]],
  ["virales", "Virales", ["impacto", "neon", "viral", "una"]],
  ["marca", "Con tu color", ["cajamarca", "dostonos"]],
];
