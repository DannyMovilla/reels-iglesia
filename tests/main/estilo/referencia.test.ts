import { expect, test } from "vitest";
import { leerEstilo, promptEstilo } from "../../../src/main/estilo/referencia";
import type { ClipSpec } from "../../../src/shared/tipos";
import { PLAN3 } from "../../ayuda/plan3";

const clip: ClipSpec = {
  id: "c", titulo: "T", gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50, apertura: null, palabrasClave: [],
  versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "neon", tamano: "s", altura: 0.7 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
};

test("valores raros se reemplazan por los del clip; los buenos se usan", () => {
  const e = leerEstilo({ subtitulos: "KARAOKE", tamano: "xl", altura: 2, fuente_titulos: "montserrat", fuente_subtitulos: "comic-sans", animo: "fiesta", intensidad: "fuerte", look: "cine", explicacion: " Rápido. " }, clip);
  expect(e).toEqual({
    subtitulos: "karaoke", tamano: "s", altura: 0.7, fuenteTitulos: "montserrat", fuenteSubtitulos: "montserrat",
    animo: clip.musica.animo, intensidad: "fuerte", look: "cine", explicacion: "Rápido.",
  });
  expect(leerEstilo(null, clip).subtitulos).toBe("neon");
});

test("el prompt lleva la marca, los cuadros y lo que no se pudo medir", () => {
  const p = promptEstilo({ duracion: 2, cortesPorMinuto: null, lufs: null, cuadros: ["C:/t/cuadro-1.jpg", "C:/t/cuadro-2.jpg"], avisos: [] });
  expect(p).toContain("ESTILO DE UN REEL");
  expect(p).toContain("- C:/t/cuadro-1.jpg");
  expect(p).toContain("no se midió el ritmo de cortes");
  expect(p).toContain("sin audio medido");
});
