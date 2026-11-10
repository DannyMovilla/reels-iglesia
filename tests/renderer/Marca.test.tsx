import { fireEvent, render, screen, within } from "@testing-library/react";
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

test("plan 6: elegir la fuente de la iglesia la guarda en la marca", async () => {
  const a = api({ elegirFuente: vi.fn(async () => "C:/datos/marca/fuente.ttf") });
  render(<Marca />);
  await userEvent.click(await screen.findByRole("button", { name: /Elegir fuente de la iglesia/ }));
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ fuente: "C:/datos/marca/fuente.ttf" })), { timeout: 2000 });
  expect(screen.getByText("fuente.ttf")).toBeInTheDocument();
});

test("plan 7: marca durante el reel — texto, logo o los dos, con su tamaño y una muestra", async () => {
  const a = api({ leerMarca: vi.fn(async () => ({ ...structuredClone(marca), logo: "C:/datos/marca/logo.png" })) });
  render(<Marca />);
  const grupo = await screen.findByRole("group", { name: "Marca durante el reel" });
  expect(within(grupo).getByRole("button", { name: "Texto" })).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(within(grupo).getByRole("button", { name: "Logo y texto" }));
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ marcaReel: { modo: "ambos", tamano: 1 } })), { timeout: 2000 });
  fireEvent.change(screen.getByLabelText("Tamaño de la marca"), { target: { value: "130" } });
  await vi.waitFor(() => expect(a.guardarMarca).toHaveBeenLastCalledWith(expect.objectContaining({ marcaReel: { modo: "ambos", tamano: 1.3 } })), { timeout: 2000 });
  const muestra = screen.getByLabelText("Muestra de la marca durante el reel");
  expect(muestra.querySelector("img")).not.toBeNull();
  expect(muestra).toHaveTextContent("Mi iglesia");
});

test("plan 7: sin logo, «Logo» avisa que se verá el nombre", async () => {
  api();
  render(<Marca />);
  const grupo = await screen.findByRole("group", { name: "Marca durante el reel" });
  await userEvent.click(within(grupo).getByRole("button", { name: "Logo" }));
  expect(await screen.findByText("Todavía no hay logo: se verá el nombre hasta que elijas uno.")).toBeInTheDocument();
});

test("plan 7: la fuente de la iglesia se puede quitar", async () => {
  const a = api({ leerMarca: vi.fn(async () => ({ ...structuredClone(marca), fuente: "C:/datos/marca/fuente.ttf" })) });
  render(<Marca />);
  await userEvent.click(await screen.findByRole("button", { name: "Quitar fuente" }));
  await vi.waitFor(() => expect((a.guardarMarca.mock.calls.at(-1) as unknown as [TMarca])[0].fuente).toBeUndefined(), { timeout: 2000 });
});
