import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
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

test("si no se puede leer el video elegido, se explica en pantalla", async () => {
  window.reels = {
    urlArchivo: () => "",
    elegirVideo: async () => { throw new Error("Error invoking remote method 'video:elegir': Error: No pude leer la duración del video. ¿Está instalado FFmpeg?"); },
  } as unknown as ApiReels;
  render(<NuevaPredica alCrear={() => {}} alCancelar={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: /Elige el video del culto/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pude leer la duración del video. ¿Está instalado FFmpeg?");
});

test("el predicador (opcional) se guarda con la prédica", async () => {
  const crearProyecto = vi.fn(async (d: unknown) => ({ id: "p", ...(d as object) }));
  window.reels = { urlArchivo: () => "", crearProyecto, procesar: async () => {}, leerMarca: async () => ({ predicador: "Pastor Juan" }) } as unknown as ApiReels;
  render(<NuevaPredica videoInicial={video} alCrear={() => {}} alCancelar={() => {}} />);
  const campo = await screen.findByLabelText("Predicador (opcional)");
  await vi.waitFor(() => expect(campo).toHaveValue("Pastor Juan")); // viene de la marca
  await userEvent.clear(campo);
  await userEvent.type(campo, "Pastora Ana");
  await userEvent.click(screen.getByRole("button", { name: "Procesar prédica" }));
  expect(crearProyecto).toHaveBeenCalledWith(expect.objectContaining({ predicador: "Pastora Ana" }));
});
