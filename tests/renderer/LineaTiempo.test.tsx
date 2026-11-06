import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LineaTiempo } from "../../src/renderer/componentes/LineaTiempo";
import { ajustarCorte } from "../../src/shared/reel/cortes";
import { palabrasDe } from "../../src/shared/reel/tiempo";
import type { ClipSpec, Transcripcion } from "../../src/shared/tipos";
import { PLAN3, SIN_MUSICA } from "../ayuda/plan3";

const muestra: Transcripcion = JSON.parse(readFileSync(join(resolve(__dirname, "../fixtures"), "transcripcion-muestra.json"), "utf8"));
const palabras = palabrasDe(muestra);
const clip = (extra: Partial<ClipSpec> = {}): ClipSpec => ({
  id: "c", titulo: "T", gancho: "G", ganchosAlternativos: [], categoria: "Exhortación", inicio: 30.93, fin: 63.46, apertura: null,
  palabrasClave: ["quebrantamiento"], versiculos: [], puntaje: 90, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "auto", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, musica: SIN_MUSICA, cierre: true, formatos: ["9:16"], estado: "sugerido", ...extra,
});

test("la tecla O marca el fin en el cabezal, ajustado al final de una palabra", () => {
  const alCambiarCorte = vi.fn();
  // tiempo de reel 19,37 = segundo 50,3 del video (el clip empieza en 30,93 y no hay apertura)
  render(<LineaTiempo clip={clip()} palabras={palabras} tiempoActual={19.37} alBuscar={() => {}} alCambiarCorte={alCambiarCorte} />);
  fireEvent.keyDown(screen.getByRole("region", { name: "Línea de tiempo" }), { key: "o" });
  expect(alCambiarCorte).toHaveBeenCalledWith(30.93, ajustarCorte({ inicio: 30.93, fin: 50.3 }, palabras).fin);
});

test("muestra el hueco de subtítulos mientras aparece la cita", () => {
  const c = clip({ versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado", en: 10, activo: true, confirmado: true }] });
  render(<LineaTiempo clip={c} palabras={palabras} tiempoActual={0} alBuscar={() => {}} alCambiarCorte={() => {}} />);
  expect(screen.getByText("ocultos por la cita")).toBeInTheDocument();
  expect(screen.getByText("Salmos 51:17")).toBeInTheDocument();
});

test("un corte de menos de 5 s no se aplica y lo explica", () => {
  const alCambiarCorte = vi.fn();
  render(<LineaTiempo clip={clip()} palabras={palabras} tiempoActual={2} alBuscar={() => {}} alCambiarCorte={alCambiarCorte} />);
  fireEvent.keyDown(screen.getByRole("region", { name: "Línea de tiempo" }), { key: "o" });
  expect(alCambiarCorte).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Un reel necesita al menos 5 segundos.");
});

test("las flechas mueven el cabezal 0,1 s (Shift: 1 s)", () => {
  const alBuscar = vi.fn();
  render(<LineaTiempo clip={clip()} palabras={palabras} tiempoActual={10} alBuscar={alBuscar} alCambiarCorte={() => {}} />);
  const r = screen.getByRole("region", { name: "Línea de tiempo" });
  fireEvent.keyDown(r, { key: "ArrowRight" });
  fireEvent.keyDown(r, { key: "ArrowLeft", shiftKey: true });
  expect(alBuscar.mock.calls.map((c) => Math.round(c[0] * 100) / 100)).toEqual([10.1, 9]);
});
