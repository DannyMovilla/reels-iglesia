import { expect, test } from "vitest";
import { elegirPista, type Pista } from "../../../src/shared/reel/pistas";

const p = (id: string, animo: Pista["animo"], duracion = 60): Pista => ({ id, archivo: `C:/m/${id}.mp3`, titulo: id, autor: "", licencia: "", animo, duracion, propia: true });

test("elige una pista del mismo ánimo que no se usó en los últimos reels", () => {
  const pistas = [p("a", "esperanza"), p("b", "esperanza"), p("c", "esperanza"), p("d", "victoria")];
  expect(elegirPista("esperanza", pistas, ["a", "b"], 30)?.id).toBe("c");
  expect(elegirPista("victoria", pistas, [], 30)?.id).toBe("d");
});

test("sin pistas de ese ánimo devuelve null (se usará un pad)", () => {
  expect(elegirPista("tension", [p("a", "esperanza")], [], 30)).toBeNull();
  expect(elegirPista("esperanza", [], [], 30)).toBeNull();
});

test("prefiere una pista que dure todo el reel; si ninguna alcanza, la más larga", () => {
  expect(elegirPista("esperanza", [p("corta", "esperanza", 20), p("larga", "esperanza", 90)], [], 40)?.id).toBe("larga");
  expect(elegirPista("esperanza", [p("x", "esperanza", 20), p("y", "esperanza", 25)], [], 40)?.id).toBe("y");
});

test("si todas se usaron hace poco, repite la que se usó hace más tiempo", () => {
  const pistas = [p("a", "esperanza"), p("b", "esperanza")];
  expect(elegirPista("esperanza", pistas, ["b", "a"], 30)?.id).toBe("a"); // recientes: el primero es el más reciente
});
