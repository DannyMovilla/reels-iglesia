import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Exportados, formatoDeArchivo } from "../../src/renderer/pantallas/Exportados";

test("plan 9: el formato sale del nombre del archivo", () => {
  expect(formatoDeArchivo("juan-8-12-9x16.mp4")).toBe("9:16");
  expect(formatoDeArchivo("clip-4x5.mp4")).toBe("4:5");
  expect(formatoDeArchivo("clip-1x1.mp4")).toBe("1:1");
  expect(formatoDeArchivo("notas.txt")).toBeNull();
});

test("plan 9: cada grupo dice cuántos reels tiene y cada reel su formato", async () => {
  (window as unknown as { reels: unknown }).reels = {
    listarExportados: vi.fn(async () => [
      { proyectoId: "p1", nombre: "Culto", archivos: [{ nombre: "a-9x16.mp4", tamano: 1e6 }, { nombre: "a-4x5.mp4", tamano: 1e6 }] },
      { proyectoId: "ia:c1", nombre: "Con IA · Juan 8:12", archivos: [{ nombre: "juan-8-12-9x16.mp4", tamano: 1e6 }] },
    ]),
    alCambiarTareas: () => () => {},
    urlExportado: () => "",
  };
  render(<Exportados />);
  expect(await screen.findByText("2 reels")).toBeInTheDocument();
  expect(screen.getByText("1 reel")).toBeInTheDocument();
  expect(screen.getAllByText("9:16")).toHaveLength(2);
  expect(screen.getByText("4:5")).toBeInTheDocument();
});

test("plan 10: borrar un reel y borrar todos, con confirmación", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  const api = {
    listarExportados: vi.fn(async () => [{ proyectoId: "p1", nombre: "Culto", archivos: [{ nombre: "a-9x16.mp4", tamano: 2e6 }, { nombre: "a-4x5.mp4", tamano: 3e6 }] }]),
    alCambiarTareas: () => () => {}, urlExportado: () => "", borrarReels: vi.fn(async () => ({ bytes: 2e6 })),
  };
  (window as unknown as { reels: unknown }).reels = api;
  render(<Exportados />);
  await userEvent.click(await screen.findByRole("button", { name: "Borrar a-9x16.mp4" }));
  expect(screen.getByText("¿Mandar este reel a la Papelera?")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
  expect(api.borrarReels).toHaveBeenCalledWith("p1", ["a-9x16.mp4"]);
  await userEvent.click(screen.getByRole("button", { name: "Borrar todos los reels de Culto" }));
  expect(screen.getByText("Se van a la Papelera 2 reels (5 MB).")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
  expect(api.borrarReels).toHaveBeenLastCalledWith("p1", "todos");
});
