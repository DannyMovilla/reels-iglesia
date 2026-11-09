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

test("el estilo de la iglesia se toma de un clip", async () => {
  const { estiloDesdeClip } = await import("../../src/shared/clip");
  const c = completarClip({ ...viejo, subtitulos: { activos: true, estilo: "neon", tamano: "l", altura: 0.7 }, cierre: false, formatos: ["1:1"] }, ESTILO_POR_DEFECTO);
  expect(estiloDesdeClip(c)).toEqual({
    subtitulos: { estilo: "neon", tamano: "l" }, musica: { modo: "auto", volumen: 0.12 },
    cortes: { pausas: true, muletillas: true }, efectos: { transicion: "destello", grano: false, rotulo: true },
    cierre: false, formatos: ["1:1"],
  });
});

test("plan 5: aplicar el estilo de la iglesia copia intensidad y lista pero conserva los tramos quitados del clip", async () => {
  const { aplicarEstiloAClip, estiloDesdeClip } = await import("../../src/shared/clip");
  const c = completarClip({ ...viejo, cortes: { pausas: true, muletillas: true, quitados: [{ inicio: 40, fin: 41 }] } }, ESTILO_POR_DEFECTO);
  const e = { ...ESTILO_POR_DEFECTO, cortes: { pausas: true, muletillas: false, intensidad: "fuerte" as const, lista: ["este"] } };
  const r = aplicarEstiloAClip(c, e);
  expect(r.cortes).toEqual({ pausas: true, muletillas: false, intensidad: "fuerte", lista: ["este"], quitados: [{ inicio: 40, fin: 41 }] });
  expect(estiloDesdeClip(r).cortes).toEqual({ pausas: true, muletillas: false, intensidad: "fuerte", lista: ["este"] });
});

test("revisión I5: el nivel de voz del estilo de la iglesia llega a los clips nuevos (y no pisa el de un clip)", async () => {
  const { clipManual } = await import("../../src/shared/clip");
  const estilo = { ...ESTILO_POR_DEFECTO, voz: "podcast" as const };
  expect(completarClip(viejo, estilo).voz).toBe("podcast");
  expect(completarClip({ ...viejo, voz: "ligera" }, estilo).voz).toBe("ligera");
  expect(completarClip(viejo, ESTILO_POR_DEFECTO).voz).toBeUndefined();
  const ps = [{ s: 0, e: 3, t: "Dios" }, { s: 3, e: 7, t: "es" }];
  expect(clipManual(0, 7, ps, estilo).voz).toBe("podcast");
});
