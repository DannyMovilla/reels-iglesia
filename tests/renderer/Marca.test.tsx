import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

vi.mock("@hyperframes/player", () => ({})); // el reproductor real no corre en jsdom
import { Marca } from "../../src/renderer/pantallas/Marca";
import { ESTILO_POR_DEFECTO } from "../../src/shared/clip";
import type { Marca as TMarca } from "../../src/shared/tipos";

const marca: TMarca = { nombre: "Mi iglesia", color: "#f2b544", invitacion: "Síguenos", logoEscala: 1, redes: {}, estilo: ESTILO_POR_DEFECTO };

function api(extra: Record<string, unknown> = {}) {
  const a = {
    leerMarca: vi.fn(async () => structuredClone(marca)),
    guardarMarca: vi.fn(async () => {}),
    elegirLogo: vi.fn(async () => "C:/datos/marca/logo.png"),
    registrarVista: vi.fn(async () => "reels-comp://m/index.html"),
    ...extra,
  };
  (window as unknown as { reels: unknown }).reels = a;
  return a;
}

test("editar nombre, invitación y redes guarda la marca y actualiza la vista previa", async () => {
  const a = api();
  render(<Marca />);
  const nombre = await screen.findByLabelText("Nombre de la iglesia");
  await userEvent.clear(nombre);
  await userEvent.type(nombre, "Iglesia Familia");
  await userEvent.type(screen.getByLabelText("Instagram"), "@iglesiafamilia");
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ nombre: "Iglesia Familia", redes: { instagram: "iglesiafamilia" } })), { timeout: 2000 });
  await vi.waitFor(() => expect(a.registrarVista).toHaveBeenLastCalledWith(expect.any(String), expect.stringContaining("Iglesia Familia")), { timeout: 2000 });
});

test("el logo se elige y su tamaño va de 50 % a 150 %", async () => {
  const a = api();
  render(<Marca />);
  await userEvent.click(await screen.findByRole("button", { name: /Elegir logo/ }));
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ logo: "C:/datos/marca/logo.png" })), { timeout: 2000 });
  const tam = screen.getByLabelText("Tamaño del logo");
  expect(tam).toHaveAttribute("min", "50");
  expect(tam).toHaveAttribute("max", "150");
  fireEvent.change(tam, { target: { value: "140" } });
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ logoEscala: 1.4 })), { timeout: 2000 });
  await vi.waitFor(() => expect(a.registrarVista).toHaveBeenLastCalledWith(expect.any(String), expect.stringContaining("marca/logo.png")), { timeout: 2000 });
});

test("muletillas: se agregan con Enter, se quitan con × y se restablecen", async () => {
  const a = api();
  render(<Marca />);
  const nueva = await screen.findByLabelText("Agregar muletilla");
  await userEvent.type(nueva, "este{Enter}");
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({
    estilo: expect.objectContaining({ cortes: expect.objectContaining({ lista: ["eh", "ehh", "em", "emm", "mm", "mmm", "este"] }) }),
  })), { timeout: 2000 });
  await userEvent.click(screen.getByRole("button", { name: "Quitar «eh»" }));
  await vi.waitFor(() => expect((a.guardarMarca.mock.calls.at(-1) as unknown as [TMarca])[0].estilo.cortes.lista).not.toContain("eh"), { timeout: 2000 });
  await userEvent.click(screen.getByRole("button", { name: "Restablecer" }));
  await vi.waitFor(() => expect((a.guardarMarca.mock.calls.at(-1) as unknown as [TMarca])[0].estilo.cortes.lista).toEqual(["eh", "ehh", "em", "emm", "mm", "mmm"]), { timeout: 2000 });
});
