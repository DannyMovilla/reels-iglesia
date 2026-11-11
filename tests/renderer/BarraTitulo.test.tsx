import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { BarraTitulo } from "../../src/renderer/componentes/BarraTitulo";
import type { ApiReels } from "../../src/shared/api";

type Estado = Awaited<ReturnType<ApiReels["estadoActualizacion"]>>;

function api(inicial: Estado, reiniciar = true) {
  let avisar: (e: Estado) => void = () => {};
  const a = {
    estadoActualizacion: vi.fn(async () => inicial),
    alCambiarActualizacion: vi.fn((cb: (e: Estado) => void) => { avisar = cb; return () => {}; }),
    reiniciarParaActualizar: vi.fn(async () => reiniciar),
  };
  window.reels = a as unknown as ApiReels;
  return { a, avisar: (e: Estado) => act(() => avisar(e)) };
}

test("sin actualización lista no hay aviso", async () => {
  api({ fase: "al-dia" });
  render(<BarraTitulo migas={[]} />);
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "Reiniciar ahora" })).toBeNull();
});

test("con la versión lista: aviso y «Reiniciar ahora»", async () => {
  const { a } = api({ fase: "lista", version: "0.3.0" });
  render(<BarraTitulo migas={[]} />);
  expect(await screen.findByText("La versión 0.3.0 está lista: se instala al cerrar")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reiniciar ahora" }));
  expect(a.reiniciarParaActualizar).toHaveBeenCalled();
});

test("si hay trabajo en curso, avisa que se instalará al terminar", async () => {
  const { avisar } = api({ fase: "al-dia" }, false);
  render(<BarraTitulo migas={[]} />);
  avisar({ fase: "lista", version: "0.3.0" });
  await userEvent.click(await screen.findByRole("button", { name: "Reiniciar ahora" }));
  expect(await screen.findByText("Se instalará al terminar lo que está haciendo")).toBeInTheDocument();
});
