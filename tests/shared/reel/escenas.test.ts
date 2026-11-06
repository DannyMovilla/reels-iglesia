// @vitest-environment jsdom
import { expect, test } from "vitest";
import { ESCENAS, htmlEscena } from "../../../src/shared/reel/escenas";
import type { Escena } from "../../../src/shared/tipos";

const dom = (html: string) => new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");

test("seis escenas con nombre en español", () => {
  expect(Object.keys(ESCENAS)).toEqual(["luz", "amanecer", "aurora", "nubes", "atardecer", "destello"]);
  expect(Object.values(ESCENAS).map((e) => e.nombre)).toEqual(["Luz", "Amanecer", "Aurora", "Nubes", "Atardecer", "Destello"]);
});

test.each(Object.keys(ESCENAS) as Escena[])("%s: un solo canvas con su shader, el color de la marca y el tamaño del formato", (escena) => {
  const d = dom(htmlEscena(escena, "#f2b544", 1080, 1350));
  const canvas = d.querySelectorAll("canvas[data-shader]");
  expect(canvas).toHaveLength(1);
  expect(canvas[0].getAttribute("data-shader")).toBe(ESCENAS[escena].shader);
  expect([canvas[0].getAttribute("width"), canvas[0].getAttribute("height")]).toEqual(["1080", "1350"]);
  const props = JSON.parse(canvas[0].getAttribute("data-shader-props")!);
  expect(typeof props).toBe("object");
  if (escena === "nubes") expect(props.colorB).toBe("#f9deab"); // el color de la marca aclarado
  else if (escena !== "destello") expect(JSON.stringify(props).toLowerCase()).toContain("#f2b544");
  expect(d.querySelector(".velo")).not.toBeNull(); // oscurece para que el texto se lea
  expect(d.body.innerHTML).not.toMatch(/https?:\/\//);
});
