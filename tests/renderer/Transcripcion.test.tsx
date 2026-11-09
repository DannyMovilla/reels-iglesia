import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Transcripcion } from "../../src/renderer/componentes/Transcripcion";
import type { Transcripcion as T } from "../../src/shared/tipos";

const t: T = {
  formato: "pulpito-transcripcion/1", inicio: 0, fin: 20, modelo: "m", dispositivo: "cpu",
  segmentos: [
    { s: 0, e: 3, t: "Dios es fiel.", w: [[0, 1, "Dios"], [1.1, 2, "es"], [2.1, 3, "fiel."]] },
    { s: 10, e: 13, t: "Confía en Dios siempre.", w: [[10, 11, "Confía"], [11.1, 11.5, "en"], [11.6, 12.2, "Dios"], [12.3, 13, "siempre."]] },
  ],
};
const props = (extra = {}) => ({ transcripcion: t, clip: { inicio: 10, fin: 13 }, alBuscar: vi.fn(), alCorregir: vi.fn(), alSeleccionar: vi.fn(), ...extra });

test("buscar cuenta las coincidencias sin tildes ni mayúsculas y las flechas recorren", async () => {
  render(<Transcripcion {...props()} />);
  await userEvent.type(screen.getByLabelText("Buscar en la transcripción"), "dios");
  expect(screen.getByText("1 de 2")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente coincidencia" }));
  expect(screen.getByText("2 de 2")).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText("Buscar en la transcripción"));
  await userEvent.type(screen.getByLabelText("Buscar en la transcripción"), "confia en");
  expect(screen.getByText("1 de 1")).toBeInTheDocument();
});

test("clic en una palabra va a ese momento; las palabras del clip van marcadas", async () => {
  const p = props();
  render(<Transcripcion {...p} />);
  await userEvent.click(screen.getByRole("button", { name: "fiel." }));
  expect(p.alBuscar).toHaveBeenCalledWith(2.1);
  expect(screen.getByRole("button", { name: "Confía" })).toHaveClass("en-clip");
  expect(screen.getByRole("button", { name: "fiel." })).not.toHaveClass("en-clip");
});

test("doble clic corrige: solo aquí o en toda la prédica", async () => {
  const p = props();
  render(<Transcripcion {...p} />);
  fireEvent.doubleClick(screen.getAllByRole("button", { name: "Dios" })[1]);
  const dialogo = screen.getByRole("dialog", { name: "Corregir «Dios»" });
  const campo = within(dialogo).getByLabelText("Palabra corregida");
  await userEvent.clear(campo);
  await userEvent.type(campo, "Señor");
  await userEvent.click(within(dialogo).getByRole("button", { name: "Solo aquí" }));
  expect(p.alCorregir).toHaveBeenLastCalledWith({ de: "Dios", a: "Señor", en: 11.6 });
  fireEvent.doubleClick(screen.getAllByRole("button", { name: "Dios" })[0]);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "En toda la prédica" }));
  expect(p.alCorregir).toHaveBeenLastCalledWith({ de: "Dios", a: "Dios" });
});

test("Mayús + clic elige un rango de palabras", async () => {
  const p = props();
  render(<Transcripcion {...p} />);
  await userEvent.click(screen.getByRole("button", { name: "es" }));
  fireEvent.click(screen.getByRole("button", { name: "en" }), { shiftKey: true });
  expect(p.alSeleccionar).toHaveBeenLastCalledWith({ inicio: 1.1, fin: 11.5 });
  expect(screen.getByRole("button", { name: "Confía" })).toHaveClass("elegida");
});
