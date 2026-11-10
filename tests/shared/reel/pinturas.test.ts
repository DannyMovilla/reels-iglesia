// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { PINTURAS } from "../../../src/shared/reel/pinturas";
import { construirReelVersiculo } from "../../../src/shared/reel/versiculo-reel";
import type { Creacion } from "../../../src/shared/tipos";
import { MARCA_PLAN3 } from "../../ayuda/plan3";

const RAIZ = resolve(__dirname, "../../..");

test("cada pintura tiene su archivo, obra, autor, año, tema y página de origen, y está en NOTICE", () => {
  const notice = readFileSync(join(RAIZ, "NOTICE.md"), "utf8");
  expect(Object.keys(PINTURAS).length).toBeGreaterThanOrEqual(10);
  for (const [id, p] of Object.entries(PINTURAS)) {
    expect(existsSync(join(RAIZ, "resources", "pinturas", `${id}.jpg`)), id).toBe(true);
    expect(p.obra && p.autor && p.anio && p.tema).toBeTruthy();
    expect(p.fuente).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    expect(notice).toContain(p.obra);
  }
});

const creacion = (fondo: Creacion["fondo"]): Creacion => ({
  id: "c", creado: "", entrada: { tipo: "versiculo", texto: "Lucas 15:20" },
  versiculo: { ref: "Lucas 15:20", texto: "Y levantándose, vino a su padre.", confirmado: true },
  gancho: "Siempre puedes volver", reflexion: "El Padre te espera.", palabrasClave: [],
  musica: { modo: "ninguna", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 }, subtitulos: { estilo: "pop" }, fondo,
  redes: { instagram: { texto: "", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
  formatos: ["9:16"], estado: "borrador",
});
const marca = { nombre: "I", color: "#f2b544", invitacion: "", ...MARCA_PLAN3 };
const recursos = { gsap: "g.js", fuentes: "f", escenas: "recursos/escenas/shaders.iife.js", pinturas: "recursos/pinturas" };

test("reel con pintura: la imagen llena el cuadro, se acerca despacio, lleva velo y no anima left/top", () => {
  const r = construirReelVersiculo({ creacion: creacion({ tipo: "pintura", pintura: "prodigo" }), marca, formato: "9:16", recursos, modo: "render" });
  const d = new DOMParser().parseFromString(r.html, "text/html");
  expect(d.querySelector("img.pintura")!.getAttribute("src")).toBe("recursos/pinturas/prodigo.jpg");
  expect(d.querySelector(".velo-fondo")).not.toBeNull();
  expect(r.html).toMatch(/img\.pintura[^{]*\{[^}]*object-fit:\s*cover/);
  expect(r.html).toContain('tl.fromTo("#pintura"');
  expect(r.html).not.toMatch(/tl\.(to|from|fromTo)\([^)]*\b(left|top)\s*:/);
  expect(d.querySelector("canvas[data-shader]")).toBeNull();
});

test("una pintura que no existe cae en la escena «luz»", () => {
  const r = construirReelVersiculo({ creacion: creacion({ tipo: "pintura", pintura: "no-existe" }), marca, formato: "9:16", recursos, modo: "render" });
  expect(new DOMParser().parseFromString(r.html, "text/html").querySelector("canvas[data-shader]")).not.toBeNull();
});
