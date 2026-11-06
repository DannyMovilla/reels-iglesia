import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuevaPredica } from "../../src/renderer/pantallas/NuevaPredica";
import type { ApiReels } from "../../src/shared/api";

beforeEach(() => {
  window.reels = { urlArchivo: (r: string) => `reels-video://archivo/${encodeURIComponent(r)}` } as unknown as ApiReels;
});

const video = { ruta: "C:/Descargas/culto (1280p).mp4", tamano: 1, modificado: 0, duracion: 9600 };

test("un rango inválido muestra el error y deshabilita Procesar prédica", async () => {
  render(<NuevaPredica videoInicial={video} alCrear={() => {}} alCancelar={() => {}} />);
  const inicio = screen.getByLabelText("Inicio de la prédica");
  const fin = screen.getByLabelText("Fin de la prédica");
  await userEvent.clear(inicio);
  await userEvent.type(inicio, "0:50:00");
  await userEvent.clear(fin);
  await userEvent.type(fin, "0:40:00");
  expect(screen.getByText("El fin de la prédica debe ser después del inicio.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Procesar prédica" })).toBeDisabled();
});

test("un rango válido habilita Procesar prédica", async () => {
  render(<NuevaPredica videoInicial={video} alCrear={() => {}} alCancelar={() => {}} />);
  await userEvent.clear(screen.getByLabelText("Inicio de la prédica"));
  await userEvent.type(screen.getByLabelText("Inicio de la prédica"), "1:44:44");
  await userEvent.clear(screen.getByLabelText("Fin de la prédica"));
  await userEvent.type(screen.getByLabelText("Fin de la prédica"), "2:32:35");
  expect(screen.getByRole("button", { name: "Procesar prédica" })).toBeEnabled();
});
