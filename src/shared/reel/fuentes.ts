/** Fuentes que se pueden elegir para los títulos y los subtítulos de un reel. */
export type IdFuente = "montserrat" | "figtree" | "iglesia";

export const FUENTES: Record<IdFuente, { nombre: string; familia: string }> = {
  montserrat: { nombre: "Montserrat", familia: "Montserrat, sans-serif" },
  figtree: { nombre: "Figtree", familia: "Figtree, sans-serif" },
  iglesia: { nombre: "La de la iglesia", familia: '"Fuente iglesia", Montserrat, sans-serif' },
};

/** Las de siempre: Figtree en títulos (gancho, versículo, rótulo, cierre) y Montserrat en subtítulos. */
export const FUENTES_POR_DEFECTO: { titulos: IdFuente; subtitulos: IdFuente } = { titulos: "figtree", subtitulos: "montserrat" };

const TITULOS = ".gancho, .vers b, .vers b small, .rotulo b, .cierre, .cierre *";
const SUBTITULOS = ".sub, .sub *";

/**
 * CSS que cambia las fuentes del reel según la elección (vacío si es la de siempre). `propia`: URL del archivo de
 * la fuente de la iglesia; si falta, "iglesia" vuelve a la de siempre.
 */
export function cssFuentesElegidas(f?: { titulos: IdFuente; subtitulos: IdFuente }, propia?: string): string {
  if (!f) return "";
  const usar = (id: IdFuente, defecto: IdFuente): IdFuente => (id === "iglesia" && !propia ? defecto : FUENTES[id] ? id : defecto);
  const titulos = usar(f.titulos, FUENTES_POR_DEFECTO.titulos), subtitulos = usar(f.subtitulos, FUENTES_POR_DEFECTO.subtitulos);
  const reglas: string[] = [];
  if (propia && (titulos === "iglesia" || subtitulos === "iglesia")) reglas.push(`@font-face { font-family: "Fuente iglesia"; src: url("${propia}"); }`);
  if (titulos !== FUENTES_POR_DEFECTO.titulos) reglas.push(`${TITULOS} { font-family: ${FUENTES[titulos].familia} !important; }`);
  if (subtitulos !== FUENTES_POR_DEFECTO.subtitulos) reglas.push(`${SUBTITULOS} { font-family: ${FUENTES[subtitulos].familia} !important; }`);
  return reglas.length ? `\n${reglas.join("\n")}\n` : "";
}
