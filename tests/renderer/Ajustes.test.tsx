import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { Ajustes } from "../../src/renderer/pantallas/Ajustes";
import type { ApiReels, EstadoSistema } from "../../src/shared/api";

const estado: EstadoSistema = {
  ffmpeg: { ok: true, detalle: "FFmpeg 9.0.2" },
  python: { ok: true, detalle: "Python listo" },
  gpu: { ok: true, detalle: "GPU NVIDIA lista" },
  claude: { ok: false, detalle: "Falta iniciar sesión", accion: "iniciar-sesion-claude" },
};

test("muestra cada chequeo y el botón de iniciar sesión solo cuando hace falta", async () => {
  const accionSistema = vi.fn(async () => {});
  window.reels = { verificarSistema: async () => estado, accionSistema, alProgresoSistema: () => () => {} } as unknown as ApiReels;
  render(<Ajustes />);
  expect(await screen.findByText("FFmpeg 9.0.2")).toBeInTheDocument();
  expect(screen.getByText("GPU NVIDIA lista")).toBeInTheDocument();
  expect(screen.getByText("Falta iniciar sesión")).toBeInTheDocument();
  const botones = screen.getAllByRole("button", { name: "Iniciar sesión en Claude" });
  expect(botones).toHaveLength(1);
  await userEvent.click(botones[0]);
  expect(accionSistema).toHaveBeenCalledWith("iniciar-sesion-claude");
});

test("preparar el entorno se hace con un botón y muestra el progreso", async () => {
  let progreso: (p: { pct: number; texto?: string }) => void = () => {};
  let terminar: () => void = () => {};
  const accionSistema = vi.fn(() => new Promise<void>((r) => { terminar = r; }));
  window.reels = {
    verificarSistema: async () => ({ ...estado, python: { ok: false, detalle: "Falta preparar el entorno de Python de la app.", accion: "crear-venv" },
      claude: { ok: true, detalle: "Sesión iniciada" } }),
    accionSistema, alProgresoSistema: (cb: typeof progreso) => { progreso = cb; return () => {}; },
  } as unknown as ApiReels;
  render(<Ajustes />);
  await userEvent.click(await screen.findByRole("button", { name: "Preparar el entorno" }));
  expect(accionSistema).toHaveBeenCalledWith("crear-venv");
  act(() => progreso({ pct: 40, texto: "Instalando numpy…" }));
  expect(screen.getByText("Instalando numpy…")).toBeInTheDocument();
  await act(async () => terminar());
});
