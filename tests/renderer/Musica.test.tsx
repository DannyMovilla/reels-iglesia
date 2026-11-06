import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Musica } from "../../src/renderer/pantallas/Musica";
import type { Pista } from "../../src/shared/reel/pistas";

const pista = (id: string, animo: Pista["animo"]): Pista => ({ id, archivo: `C:/m/${id}`, titulo: id.replace(".mp3", ""), autor: "", licencia: "", animo, duracion: 125, propia: true });

test("lista las pistas propias con su ánimo y duración, y se puede cambiar el ánimo", async () => {
  const api = {
    listarPistas: vi.fn(async () => [pista("Gracia.mp3", "adoracion")]),
    agregarPistas: vi.fn(async () => []),
    cambiarAnimo: vi.fn(async () => {}),
    urlPista: (id: string) => `reels-video://musica/${id}`,
  };
  (window as unknown as { reels: unknown }).reels = api;
  render(<Musica />);
  const fila = (await screen.findByText("Gracia")).closest("li")!;
  expect(within(fila).getByText("2:05")).toBeInTheDocument();
  await userEvent.selectOptions(within(fila).getByLabelText("Ánimo de Gracia"), "victoria");
  expect(api.cambiarAnimo).toHaveBeenCalledWith("Gracia.mp3", "victoria");
  await userEvent.click(screen.getByRole("button", { name: /Agregar mis pistas/ }));
  expect(api.agregarPistas).toHaveBeenCalled();
});

test("sin pistas explica que se usarán pads", async () => {
  (window as unknown as { reels: unknown }).reels = { listarPistas: async () => [], agregarPistas: async () => [], cambiarAnimo: async () => {}, urlPista: () => "" };
  render(<Musica />);
  expect(await screen.findByText(/pads/i)).toBeInTheDocument();
});
