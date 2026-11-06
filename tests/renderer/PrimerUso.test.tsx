import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PrimerUso } from "../../src/renderer/pantallas/PrimerUso";
import type { EstadoSistema } from "../../src/shared/api";

const listo: EstadoSistema = {
  ffmpeg: { ok: true, detalle: "FFmpeg 7" }, python: { ok: true, detalle: "Python y modelos listos" },
  gpu: { ok: true, detalle: "GPU NVIDIA lista" }, claude: { ok: true, detalle: "Sesión iniciada" },
};
function api(estado: EstadoSistema) {
  const a = { verificarSistema: vi.fn(async () => estado), accionSistema: vi.fn(async () => {}), alProgresoSistema: () => () => {} };
  (window as unknown as { reels: unknown }).reels = a;
  return a;
}

test("sin Python: explica y ofrece instalarlo", async () => {
  const a = api({ ...listo, python: { ok: false, detalle: "No encuentro Python en esta PC.", accion: "instalar-python" } });
  render(<PrimerUso alListo={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Instalar Python" }));
  expect(a.accionSistema).toHaveBeenCalledWith("instalar-python");
});

test("con el entorno listo pero sin FFmpeg: solo FFmpeg queda pendiente", async () => {
  api({ ...listo, ffmpeg: { ok: false, detalle: "FFmpeg no está instalado.", accion: "instalar-ffmpeg" } });
  render(<PrimerUso alListo={() => {}} />);
  expect(await screen.findByRole("button", { name: "Instalar FFmpeg" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Preparar|Instalar Python/ })).toBeNull();
});

test("todo listo: sigue a la app; también se puede saltar", async () => {
  const alListo = vi.fn();
  api(listo);
  render(<PrimerUso alListo={alListo} />);
  await userEvent.click(await screen.findByRole("button", { name: "Empezar" }));
  expect(alListo).toHaveBeenCalled();
});
