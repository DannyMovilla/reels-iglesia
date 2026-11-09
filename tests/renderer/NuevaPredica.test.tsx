import { act, render, screen, within } from "@testing-library/react";
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

test("con un enlace: se descarga mostrando el progreso y después se marca la prédica igual que con un archivo", async () => {
  let progreso: (p: number) => void = () => {};
  let terminar: (v: unknown) => void = () => {};
  window.reels = {
    urlArchivo: () => "",
    alProgresoDescarga: (cb: (p: number) => void) => { progreso = cb; return () => {}; },
    descargarVideo: vi.fn(() => new Promise((r) => { terminar = r; })),
    cancelarDescarga: vi.fn(async () => {}),
  } as unknown as ApiReels;
  render(<NuevaPredica alCrear={() => {}} alCancelar={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Enlace" }));
  const enlace = screen.getByLabelText("Enlace del video del culto");
  const descargar = screen.getByRole("button", { name: "Descargar" });
  await userEvent.type(enlace, "culto del domingo");
  expect(descargar).toBeDisabled();
  await userEvent.clear(enlace);
  await userEvent.type(enlace, "https://www.facebook.com/iglesia/videos/123");
  await userEvent.click(descargar);
  expect(window.reels!.descargarVideo).toHaveBeenCalledWith("https://www.facebook.com/iglesia/videos/123");
  act(() => progreso(42.5));
  expect(screen.getByRole("progressbar", { name: "Descarga del video" })).toHaveAttribute("aria-valuenow", "42.5");
  expect(screen.getByRole("button", { name: "Cancelar descarga" })).toBeInTheDocument();
  await act(async () => terminar({ ruta: "C:/datos/videos/Culto.mp4", tamano: 1, modificado: 0, duracion: 5400 }));
  expect(await screen.findByLabelText("Fin de la prédica")).toHaveValue("1:30:00");
});

test("un error de descarga se explica y se puede volver a intentar", async () => {
  window.reels = {
    urlArchivo: () => "",
    alProgresoDescarga: () => () => {},
    descargarVideo: async () => { throw new Error("Error invoking remote method 'video:descargar': Error: Ese video es privado o pide iniciar sesión."); },
  } as unknown as ApiReels;
  render(<NuevaPredica alCrear={() => {}} alCancelar={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Enlace" }));
  await userEvent.type(screen.getByLabelText("Enlace del video del culto"), "https://youtu.be/x");
  await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Ese video es privado o pide iniciar sesión.");
  expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled();
});

test("revisión M3: salir de la pantalla durante una descarga la cancela", async () => {
  const cancelarDescarga = vi.fn(async () => {});
  window.reels = { urlArchivo: () => "", alProgresoDescarga: () => () => {}, descargarVideo: () => new Promise(() => {}), cancelarDescarga } as unknown as ApiReels;
  const { unmount } = render(<NuevaPredica alCrear={() => {}} alCancelar={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Enlace" }));
  await userEvent.type(screen.getByLabelText("Enlace del video del culto"), "https://youtu.be/x");
  await userEvent.click(screen.getByRole("button", { name: "Descargar" }));
  unmount();
  expect(cancelarDescarga).toHaveBeenCalled();
});

test("plan 5: instrucción para Claude (opcional) y duración de los clips", async () => {
  const crearProyecto = vi.fn(async (d: unknown) => ({ id: "p", ...(d as object) }));
  window.reels = { urlArchivo: () => "", crearProyecto, procesar: async () => {}, leerMarca: async () => ({}) } as unknown as ApiReels;
  render(<NuevaPredica videoInicial={video} alCrear={() => {}} alCancelar={() => {}} />);
  const grupo = screen.getByRole("group", { name: "Duración de los clips" });
  expect(within(grupo).getByRole("button", { name: /Normales/ })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(within(grupo).getByRole("button", { name: /Cortos/ }));
  await userEvent.type(screen.getByLabelText("Instrucción para Claude (opcional)"), "prioriza la ansiedad");
  expect(screen.getByText("20/300")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Procesar prédica" }));
  expect(crearProyecto).toHaveBeenCalledWith(expect.objectContaining({ analisis: { duracion: "corta", instruccion: "prioriza la ansiedad" } }));
});
