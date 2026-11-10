import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Entregas } from "../../src/renderer/componentes/Entregas";

test("SRT: con tiempos del video completo por defecto; muestra el archivo creado y abre la carpeta", async () => {
  const a = { crearSrt: vi.fn(async () => "culto.srt"), abrirCarpetaExportados: vi.fn(async () => {}) };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Entregas proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Crear SRT" }));
  expect(a.crearSrt).toHaveBeenCalledWith("p", { completo: true });
  expect(await screen.findByText("Listo: culto.srt")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("switch", { name: "Tiempos del video completo" }));
  await userEvent.click(screen.getByRole("button", { name: "Crear SRT" }));
  expect(a.crearSrt).toHaveBeenLastCalledWith("p", { completo: false });
  await userEvent.click(screen.getByRole("button", { name: "Abrir carpeta" }));
  expect(a.abrirCarpetaExportados).toHaveBeenCalledWith("p");
});

test("un error se muestra en español", async () => {
  (window as unknown as { reels: unknown }).reels = { crearSrt: vi.fn(async () => { throw new Error("Error invoking remote method 'x': Error: No hay transcripción."); }) };
  render(<Entregas proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Crear SRT" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No hay transcripción.");
});

test("PDF de la transcripción", async () => {
  const a = { crearPdf: vi.fn(async () => "culto-transcripcion.pdf") };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Entregas proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Crear PDF" }));
  expect(a.crearPdf).toHaveBeenCalledWith("p");
  expect(await screen.findByText("Listo: culto-transcripcion.pdf")).toBeInTheDocument();
});

test("MP3 con el nivel de voz elegido", async () => {
  const a = { crearMp3: vi.fn(async () => "culto.mp3") };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Entregas proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Podcast" }));
  await userEvent.click(screen.getByRole("button", { name: "Crear MP3" }));
  expect(a.crearMp3).toHaveBeenCalledWith("p", "podcast");
  expect(await screen.findByText("Listo: culto.mp3")).toBeInTheDocument();
});

test("traducir: casillas de idiomas, progreso y archivos listos", async () => {
  let avisar: (t: string) => void = () => {};
  let responder: (v: string[]) => void = () => {};
  const a = {
    traducirSrt: vi.fn(() => new Promise<string[]>((r) => { responder = r; })),
    alProgresoEntregas: vi.fn((cb: (t: string) => void) => { avisar = cb; return () => {}; }),
  };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Entregas proyectoId="p" />);
  expect(screen.getByRole("button", { name: "Traducir" })).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: "Inglés" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Portugués" }));
  await userEvent.click(screen.getByRole("button", { name: "Traducir" }));
  expect(a.traducirSrt).toHaveBeenCalledWith("p", ["en", "pt"], { completo: true });
  act(() => avisar("Traduciendo al inglés (parte 2 de 4)…"));
  expect(screen.getByText("Traduciendo al inglés (parte 2 de 4)…")).toBeInTheDocument();
  await act(async () => responder(["culto.en.srt", "culto.pt.srt"]));
  expect(await screen.findByText("Listo: culto.en.srt, culto.pt.srt")).toBeInTheDocument();
});

test("revisión I4: «Traducir» usa la misma elección de tiempos que el SRT", async () => {
  const a = { traducirSrt: vi.fn(async () => ["c.en.srt"]), alProgresoEntregas: vi.fn(() => () => {}) };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Entregas proyectoId="p" />);
  await userEvent.click(screen.getByRole("switch", { name: "Tiempos del video completo" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "Inglés" }));
  await userEvent.click(screen.getByRole("button", { name: "Traducir" }));
  expect(a.traducirSrt).toHaveBeenCalledWith("p", ["en"], { completo: false });
});

test("plan 9: al volver a Entregas se ve el progreso de la traducción y se puede cancelar", async () => {
  let responder: (v: string[]) => void = () => {};
  let avisar: (t: string) => void = () => {};
  const a = {
    traducirSrt: vi.fn(() => new Promise<string[]>((r) => { responder = r; })),
    alProgresoEntregas: vi.fn((cb: (t: string) => void) => { avisar = cb; return () => {}; }),
    cancelarTraduccion: vi.fn(async () => true),
  };
  (window as unknown as { reels: unknown }).reels = a;
  const { unmount } = render(<Entregas proyectoId="p-volver" />);
  await userEvent.click(screen.getByRole("checkbox", { name: "Inglés" }));
  await userEvent.click(screen.getByRole("button", { name: "Traducir" }));
  act(() => avisar("Traduciendo al inglés (parte 1 de 1)…"));
  unmount();
  render(<Entregas proyectoId="p-volver" />);
  expect(await screen.findByText("Traduciendo al inglés (parte 1 de 1)…")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(a.cancelarTraduccion).toHaveBeenCalledWith("p-volver");
  expect(a.traducirSrt).toHaveBeenCalledTimes(1);
  await act(async () => responder(["culto.en.srt"]));
  expect(await screen.findByText("Listo: culto.en.srt")).toBeInTheDocument();
});
