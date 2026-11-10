import { expect, test } from "vitest";
import { animarBloque, cssEstilosSub, htmlBloque } from "../../../src/shared/reel/estilos-sub";
import type { Bloque } from "../../../src/shared/reel/subtitulos";

// La primera palabra empieza antes del bloque (no lleva animación propia); la segunda es clave.
const bloque: Bloque = {
  desde: 2.1, hasta: 3.4,
  palabras: [
    { texto: "tu", desde: 2.0, hasta: 2.3, clave: false },
    { texto: "prueba", desde: 2.35, hasta: 2.8, clave: true },
    { texto: "<final>", desde: 2.85, hasta: 3.3, clave: false },
  ],
};

const LEGADO = ["pop", "caja", "limpio", "resaltado", "karaoke", "impacto", "neon"] as const;

test.each(LEGADO)("el estilo de antes %s genera lo mismo que antes del plan 8", (e) => {
  for (const color of ["#f5c542", "#202020"]) {
    expect({ html: htmlBloque(e, bloque, 3), js: animarBloque(e, bloque, 3, color) }).toMatchSnapshot(color);
  }
});

test("el CSS de los estilos de antes no cambia", () => {
  const css = cssEstilosSub(70);
  for (const e of ["resaltado", "karaoke", "impacto", "neon"]) {
    const reglas = css.split("\n").filter((l) => l.startsWith(`.sub.${e}`)).join("\n");
    expect(reglas).toMatchSnapshot(e);
  }
});
