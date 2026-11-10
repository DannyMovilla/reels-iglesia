import { expect, test } from "vitest";
import { aplicarReferencia, type EstiloReferencia } from "../../src/shared/estilo-referencia";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const clip: ClipSpec = {
  id: "c", titulo: "Título", gancho: "Gancho", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50,
  apertura: null, palabrasClave: ["fe"], versiculos: [{ ref: "Juan 3:16", texto: "Porque de tal manera…", en: 3, activo: true, confirmado: true }],
  puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3,
  cortes: { pausas: false, muletillas: true, quitados: [{ inicio: 20, fin: 21 }] }, cierre: true, formatos: ["9:16"], estado: "editado",
  color: { look: "natural", intensidad: 0.7, balance: [0.9, 1, 1.1] },
};
const ref: EstiloReferencia = {
  subtitulos: "karaoke", tamano: "l", altura: 0.68, fuenteTitulos: "montserrat", fuenteSubtitulos: "figtree",
  animo: "victoria", intensidad: "fuerte", look: "cine", explicacion: "Subtítulos grandes en píxel, ritmo rápido.",
};

test("aplica el estilo sin tocar el contenido del clip", () => {
  const r = aplicarReferencia(clip, ref);
  expect(r.subtitulos).toEqual({ activos: true, estilo: "karaoke", tamano: "l", altura: 0.68 });
  expect(r.fuentes).toEqual({ titulos: "montserrat", subtitulos: "figtree" });
  expect(r.musica.animo).toBe("victoria");
  expect(r.cortes).toEqual({ pausas: true, muletillas: true, intensidad: "fuerte", quitados: [{ inicio: 20, fin: 21 }] });
  expect(r.color).toEqual({ look: "cine", intensidad: 0.7, balance: [0.9, 1, 1.1] });
  for (const k of ["inicio", "fin", "titulo", "gancho", "versiculos", "palabrasClave", "redes", "id"] as const) expect(r[k]).toEqual(clip[k]);
});
