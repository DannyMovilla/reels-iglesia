import { expect, test } from "vitest";
import { completarClip, ESTILO_POR_DEFECTO } from "../../src/shared/clip";
import type { ClipSpec } from "../../src/shared/tipos";

/** Un clip tal como lo guardaba el plan 2. */
const viejo = {
  id: "c", titulo: "El quebrantamiento activa la gloria de Dios en tu vida diaria y en tu familia cuando aprendes a rendirte por completo ante Él",
  gancho: "Tu quebranto abre el cielo", ganchosAlternativos: [], categoria: "Esperanza", inicio: 30, fin: 60,
  apertura: null, palabrasClave: [], versiculos: [], puntaje: 90, razon: "", descripcion: "¿Cuándo oraste así?", hashtags: ["#fe", "#iglesia"],
  encuadre: { modo: "auto", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  musica: { pista: "auto", volumen: 0.12 }, cierre: true, formatos: ["9:16"], estado: "sugerido",
};

test("el estilo de la iglesia por defecto", () => {
  expect(ESTILO_POR_DEFECTO).toEqual({
    subtitulos: { estilo: "pop", tamano: "m" }, musica: { modo: "auto", volumen: 0.12 },
    cortes: { pausas: true, muletillas: true }, efectos: { transicion: "destello", grano: false, rotulo: true },
    cierre: true, formatos: ["9:16", "4:5"],
  });
});

test("un clip del plan 2 se completa con valores por defecto sin perder lo que tenía", () => {
  const c = completarClip(viejo, ESTILO_POR_DEFECTO);
  expect(c.musica).toEqual({ modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.12 });
  expect(c.cortes).toEqual({ pausas: true, muletillas: true });
  expect(c.efectos).toEqual({ transicion: "destello", grano: false, rotulo: true });
  expect(c.redes.instagram).toEqual({ texto: "¿Cuándo oraste así?", hashtags: ["#fe", "#iglesia"] });
  expect(c.redes.tiktok).toEqual({ texto: "¿Cuándo oraste así?", hashtags: ["#fe", "#iglesia"] });
  expect(c.redes.facebook.texto).toBe("¿Cuándo oraste así?");
  expect(c.redes.youtube.titulo.length).toBeLessThanOrEqual(100);
  expect(c.redes.youtube.titulo.endsWith(" ")).toBe(false);
  expect(c.gancho).toBe("Tu quebranto abre el cielo");
  expect(c.subtitulos).toEqual(viejo.subtitulos);
});

test("ánimo según la categoría", () => {
  const animo = (categoria: string) => completarClip({ ...viejo, categoria }, ESTILO_POR_DEFECTO).musica.animo;
  expect(animo("Exhortación")).toBe("victoria");
  expect(animo("Llamado")).toBe("victoria");
  expect(animo("Reflexión")).toBe("reflexivo");
  expect(animo("Enseñanza")).toBe("reflexivo");
  expect(animo("Testimonio")).toBe("adoracion");
});

test("un clip ya completo no cambia", () => {
  const completo: ClipSpec = completarClip(viejo, ESTILO_POR_DEFECTO);
  expect(completarClip(structuredClone(completo), ESTILO_POR_DEFECTO)).toEqual(completo);
});
