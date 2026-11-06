// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { construirReelVersiculo, tarjetasVersiculo, tiemposReelVersiculo } from "../../../src/shared/reel/versiculo-reel";
import type { Creacion } from "../../../src/shared/tipos";
import { MARCA_PLAN3 } from "../../ayuda/plan3";

const JUAN = "Otra vez Jesús les habló, diciendo: Yo soy la luz del mundo; el que me sigue, no andará en tinieblas, sino que tendrá la luz de la vida.";
const SALMO23 = "Jehová es mi pastor; nada me faltará. En lugares de delicados pastos me hará descansar; junto a aguas de reposo me pastoreará. Confortará mi alma; me guiará por sendas de justicia por amor de su nombre. Aunque ande en valle de sombra de muerte, no temeré mal alguno, porque tú estarás conmigo; tu vara y tu cayado me infundirán aliento. Aderezas mesa delante de mí en presencia de mis angustiadores; unges mi cabeza con aceite; mi copa está rebosando. Ciertamente el bien y la misericordia me seguirán todos los días de mi vida, y en la casa de Jehová moraré por largos días.";

const creacion = (extra: Partial<Creacion> = {}): Creacion => ({
  id: "c", creado: "", entrada: { tipo: "versiculo", texto: "Juan 8:12" },
  versiculo: { ref: "Juan 8:12", texto: JUAN, confirmado: true },
  gancho: "No tienes que caminar a oscuras", reflexion: "Cuando todo parece oscuro, Jesús sigue siendo tu luz.",
  palabrasClave: ["luz", "vida"], musica: { modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 },
  subtitulos: { estilo: "pop" }, fondo: { tipo: "escena", escena: "luz" },
  redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
  formatos: ["9:16"], estado: "borrador", ...extra,
});
const marca = { nombre: "Iglesia Familia", color: "#f2b544", invitacion: "Síguenos", ...MARCA_PLAN3, redes: { instagram: "iglesiafamilia" } };
const recursos = { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", escenas: "recursos/escenas/shaders.iife.js" };
const construir = (c = creacion(), extra: Record<string, unknown> = {}) =>
  construirReelVersiculo({ creacion: c, marca, formato: "9:16", recursos, modo: "render", ...extra });
const dom = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("tarjetas y tiempos", () => {
  test("un versículo corto va en una sola tarjeta", () => {
    expect(tarjetasVersiculo(JUAN)).toEqual([JUAN]);
  });

  test("el Salmo 23 se reparte en tarjetas de 28 palabras o menos, cortando en la puntuación", () => {
    const t = tarjetasVersiculo(SALMO23);
    expect(t.length).toBeGreaterThan(1);
    for (const x of t) expect(x.split(/\s+/).length).toBeLessThanOrEqual(28);
    expect(t.join(" ")).toBe(SALMO23);
    for (const x of t.slice(0, -1)) expect(x).toMatch(/[.;:,]$/);
  });

  test("gancho 2,5 s, versículo al ritmo de lectura (4–12 s por tarjeta), reflexión (3–7 s) y cierre", () => {
    const t = tiemposReelVersiculo(creacion());
    expect(t.gancho).toEqual({ desde: 0, hasta: 2.5 });
    const palabras = JUAN.split(/\s+/).length;
    expect(t.tarjetas[0].desde).toBe(2.5);
    expect(t.tarjetas[0].hasta - t.tarjetas[0].desde).toBeCloseTo(Math.min(12, Math.max(4, 0.5 + 0.3 * palabras)), 1);
    const nRef = creacion().reflexion.split(/\s+/).length;
    expect(t.reflexion.hasta - t.reflexion.desde).toBeCloseTo(Math.min(7, Math.max(3, 0.5 + 0.28 * nRef)), 1);
    expect(t.cierre.hasta).toBe(t.duracion);
    expect(t.cierre.hasta - t.cierre.desde).toBeCloseTo(2.6, 2);
  });

  test("sin reflexión, el cierre va justo después del versículo", () => {
    const t = tiemposReelVersiculo(creacion({ reflexion: "" }));
    expect(t.reflexion.hasta - t.reflexion.desde).toBe(0);
    expect(t.cierre.desde).toBe(t.tarjetas.at(-1)!.hasta);
  });
});

describe("composición", () => {
  test("escena animada: un canvas de shader y la librería local", () => {
    const d = dom(construir().html);
    expect(d.querySelectorAll("canvas[data-shader]")).toHaveLength(1);
    expect([...d.querySelectorAll("script")].some((s) => s.getAttribute("src") === "recursos/escenas/shaders.iife.js")).toBe(true);
  });

  test("degradado de la marca sin archivo ni shader", () => {
    const d = dom(construir(creacion({ fondo: { tipo: "degradado" } })).html);
    expect(d.querySelector("canvas[data-shader]")).toBeNull();
    expect(d.querySelector(".degradado")).not.toBeNull();
  });

  test("foto: llena el cuadro sin deformarse, oscurecida, con un acercamiento lento", () => {
    const r = construir(creacion({ fondo: { tipo: "imagen", archivo: "C:/x/fondo.jpg" } }), { fondoSrc: "fondo.jpg" });
    const img = dom(r.html).querySelector("img.fondo")!;
    expect(img.getAttribute("src")).toBe("fondo.jpg");
    expect(r.html).toMatch(/img\.fondo[^{]*\{[^}]*object-fit:\s*cover/);
    expect(r.html).toContain('tl.fromTo("#fondo", { scale: 1 }');
  });

  test("video más corto que el reel: se repite, mudo, hasta cubrirlo", () => {
    const r = construir(creacion({ fondo: { tipo: "video", archivo: "C:/x/fondo.mp4" } }), { fondoSrc: "fondo.mp4", fondoDuracion: 6 });
    const videos = [...dom(r.html).querySelectorAll("video")];
    expect(videos.length).toBe(Math.ceil(r.duracion / 6));
    for (const v of videos) {
      expect(v.hasAttribute("muted")).toBe(true);
      expect(v.getAttribute("data-media-start")).toBe("0");
    }
  });

  test("texto: gancho, cada palabra del versículo animada, palabras clave en el color de la marca, RVR1960, reflexión y cierre con @", () => {
    const d = dom(construir().html);
    expect(d.querySelector("#gancho")!.textContent).toBe("No tienes que caminar a oscuras");
    const palabras = [...d.querySelectorAll(".tarjeta .p")];
    expect(palabras.length).toBe(JUAN.split(/\s+/).length);
    expect(palabras.filter((p) => p.classList.contains("clave")).map((p) => p.textContent)).toEqual(["luz", "luz", "vida."]);
    expect(d.querySelector(".referencia")!.textContent).toContain("Juan 8:12");
    expect(d.querySelector(".referencia")!.textContent).toContain("RVR1960");
    expect(d.querySelector("#reflexion")!.textContent).toContain("Jesús sigue siendo tu luz");
    expect(d.querySelector("#cierre .seguir")!.textContent).toContain("@iglesiafamilia");
  });

  test("música con carril de volumen; sin left/top animados ni internet; tamaño por formato", () => {
    const r = construir(creacion(), { musica: { src: "musica.wav" } });
    expect(dom(r.html).querySelector("audio#musica")!.getAttribute("data-automation")).toContain('"target":"volume"');
    expect(r.html).not.toMatch(/tl\.(to|from|fromTo)\([^)]*\b(left|top)\s*:/);
    expect(r.html).not.toMatch(/https?:\/\//);
    const cuadrado = construirReelVersiculo({ creacion: creacion(), marca, formato: "1:1", recursos, modo: "render" });
    expect(cuadrado.alto).toBe(1080);
    expect(dom(cuadrado.html).querySelector("canvas")!.getAttribute("height")).toBe("1080");
  });
});

test("la librería de escenas se carga al final, cuando el canvas ya existe", () => {
  const html = construir().html;
  expect(html.indexOf('<script src="recursos/escenas/shaders.iife.js">')).toBeGreaterThan(html.indexOf("<canvas"));
});

test("las palabras, el gancho y la reflexión empiezan ocultos: nunca se ve el texto completo antes de su animación", () => {
  const html = construir().html;
  expect(html).toMatch(/\.tarjeta \.p \{[^}]*opacity: 0/);
  expect(html).toMatch(/\.gancho-ia \{[^}]*opacity: 0/);
  expect(html).toMatch(/\.reflexion \{[^}]*opacity: 0/);
  // Cada palabra entra con tl.to (desde el estado oculto del CSS), no con fromTo sin estado inicial.
  expect(html).toMatch(/tl\.to\("#t0p0", \{ opacity: 1/);
  expect(html).not.toMatch(/tl\.fromTo\("#t0p0"/);
});
