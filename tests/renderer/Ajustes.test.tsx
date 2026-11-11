import { act, render, screen, within } from "@testing-library/react";
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

test("menor: preparar el entorno se puede cancelar", async () => {
  const accionSistema = vi.fn((a: string) => (a === "cancelar" ? Promise.resolve() : new Promise<void>(() => {})));
  window.reels = {
    verificarSistema: async () => ({ ...estado, python: { ok: false, detalle: "Falta preparar el entorno", accion: "crear-venv" }, claude: { ok: true, detalle: "ok" } }),
    accionSistema, alProgresoSistema: () => () => {},
  } as unknown as ApiReels;
  render(<Ajustes />);
  await userEvent.click(await screen.findByRole("button", { name: "Preparar el entorno" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(accionSistema).toHaveBeenCalledWith("cancelar");
});

test("plan 7: Apariencia — Oscuro, Claro o Como Windows; se aplica enseguida y se recuerda", async () => {
  window.reels = { verificarSistema: async () => estado, accionSistema: vi.fn(), alProgresoSistema: () => () => {} } as unknown as ApiReels;
  localStorage.removeItem("reels-tema");
  render(<Ajustes />);
  const grupo = await screen.findByRole("group", { name: "Apariencia" });
  expect(within(grupo).getByRole("button", { name: "Oscuro" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(within(grupo).getByRole("button", { name: "Claro" }));
  expect(document.documentElement.dataset.tema).toBe("claro");
  expect(localStorage.getItem("reels-tema")).toBe("claro");
  await userEvent.click(within(grupo).getByRole("button", { name: "Como Windows" }));
  expect(localStorage.getItem("reels-tema")).toBe("sistema");
  expect(["claro", "oscuro"]).toContain(document.documentElement.dataset.tema);
  await userEvent.click(within(grupo).getByRole("button", { name: "Oscuro" }));
  expect(document.documentElement.dataset.tema).toBe("oscuro");
});

test("plan 10: copiar el diagnóstico y abrir la carpeta de registros", async () => {
  const escribir = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
  const api = { verificarSistema: async () => estado, accionSistema: vi.fn(), alProgresoSistema: () => () => {},
    diagnostico: vi.fn(async () => "Reels Iglesia 0.2.0\n…"), abrirRegistros: vi.fn(async () => {}) };
  window.reels = api as unknown as ApiReels;
  render(<Ajustes />);
  await userEvent.click(await screen.findByRole("button", { name: "Copiar diagnóstico" }));
  expect(escribir).toHaveBeenCalledWith("Reels Iglesia 0.2.0\n…");
  expect(await screen.findByText("Copiado")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Abrir carpeta de registros" }));
  expect(api.abrirRegistros).toHaveBeenCalled();
});

test("plan 10: la versión, buscar actualizaciones y su estado", async () => {
  let avisar: (e: { fase: string; pct?: number }) => void = () => {};
  const api = { verificarSistema: async () => estado, accionSistema: vi.fn(), alProgresoSistema: () => () => {},
    versionApp: vi.fn(async () => "0.2.0"), estadoActualizacion: vi.fn(async () => ({ fase: "al-dia" })),
    alCambiarActualizacion: vi.fn((cb: typeof avisar) => { avisar = cb; return () => {}; }), buscarActualizacion: vi.fn(async () => {}) };
  window.reels = api as unknown as ApiReels;
  render(<Ajustes />);
  expect(await screen.findByText("Reels Iglesia 0.2.0")).toBeInTheDocument();
  expect(await screen.findByText("Estás al día")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Buscar actualizaciones" }));
  expect(api.buscarActualizacion).toHaveBeenCalled();
  act(() => avisar({ fase: "descargando", pct: 42 }));
  expect(screen.getByText("Descargando 42 %")).toBeInTheDocument();
});

test("plan 10: espacio total y liberar espacio", async () => {
  const api = { verificarSistema: async () => estado, accionSistema: vi.fn(), alProgresoSistema: () => () => {},
    espacioTotal: vi.fn(async () => 3_400_000_000), liberarEspacio: vi.fn(async () => ({ liberado: 820_000_000, saltadas: 1 })) };
  window.reels = api as unknown as ApiReels;
  render(<Ajustes />);
  expect(await screen.findByText(/La app ocupa 3,4 GB/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Liberar espacio" }));
  expect(api.liberarEspacio).toHaveBeenCalledWith();
  expect(await screen.findByText("Liberé 820 MB. 1 prédica se saltó porque está trabajando.")).toBeInTheDocument();
});
