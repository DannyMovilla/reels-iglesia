// @vitest-environment jsdom
import { expect, test } from "vitest";
import { htmlTranscripcion } from "../../src/shared/pdf-transcripcion";
import type { Transcripcion } from "../../src/shared/tipos";

const t: Transcripcion = {
  formato: "pulpito-transcripcion/1", inicio: 6284, fin: 6600, modelo: "m", dispositivo: "cpu",
  segmentos: Array.from({ length: 30 }, (_, i) => ({ s: 6284 + i * 10, e: 6292 + i * 10, t: i === 3 ? "Dios <es> fiel & bueno." : `Oración número ${i}.`, w: [] })),
};
const base = {
  proyecto: { nombre: "Culto dominical", creado: "2026-11-09T15:00:00Z", predicador: "Pastor Juan" },
  marca: { nombre: "Iglesia Familia", predicador: undefined },
  transcripcion: t,
};
const dom = (html: string) => new DOMParser().parseFromString(html, "text/html");

test("cabecera con iglesia, título, fecha y predicador; texto escapado en párrafos con su minuto", () => {
  const d = dom(htmlTranscripcion({ ...base, capitulos: null }));
  expect(d.querySelector(".iglesia")!.textContent).toBe("Iglesia Familia");
  expect(d.querySelector("h1")!.textContent).toBe("Culto dominical");
  expect(d.querySelector(".meta")!.textContent).toContain("Pastor Juan");
  expect(d.querySelector(".meta")!.textContent).toContain("9 de noviembre de 2026");
  const ps = [...d.querySelectorAll("p.parrafo")];
  expect(ps.length).toBeGreaterThan(2);
  expect(ps[0].querySelector(".minuto")!.textContent).toBe("0:00");
  expect(d.body.textContent).toContain("Dios <es> fiel & bueno.");
  expect(d.querySelector("script")).toBeNull();
  expect(d.querySelector(".resumen")).toBeNull();
});

test("con capítulos: resumen y lista de capítulos", () => {
  const caps = { resumen: "Habló de la fe.", capitulos: [{ t: 0, titulo: "Lectura" }, { t: 125, titulo: "La fe" }, { t: 300, titulo: "Llamado" }] };
  const d = dom(htmlTranscripcion({ ...base, capitulos: caps }));
  expect(d.querySelector(".resumen")!.textContent).toContain("Habló de la fe.");
  expect([...d.querySelectorAll(".capitulos li")].map((li) => li.textContent)).toEqual(["0:00 Lectura", "2:05 La fe", "5:00 Llamado"]);
  expect(d.querySelector("style")!.textContent).toContain("@page");
});
