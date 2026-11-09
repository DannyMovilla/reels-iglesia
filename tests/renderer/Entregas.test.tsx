import { render, screen } from "@testing-library/react";
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
