import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { FrasesPublicar } from "../../src/renderer/componentes/FrasesPublicar";
import type { Frase } from "../../src/shared/frases";

const A = "Y ese quebrantamiento terrenal va a activar la gloria celestial";
const D = "por eso es importante entender que el quebrantamiento nos va a acercar a la presencia";
const frases = (): Frase[] => [
  { texto: A, en: 39.02, original: A, fondo: "marca", clave: "gloria", versiculo: { ref: "Salmos 51:17", texto: "Los sacrificios de Dios…", confirmado: false } },
  { texto: D, en: 65.68, original: D, fondo: "marca" },
];

let api: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  api = {
    leerFrases: vi.fn(async () => [] as Frase[]),
    sacarFrases: vi.fn(async () => ({ frases: frases(), aviso: "Claude encontró 2 frases textuales." })),
    cancelarFrases: vi.fn(async () => true),
    guardarFrases: vi.fn(async () => {}),
    guardarImagenesFrases: vi.fn(async () => ({ archivos: ["frases/culto-frase-1.png", "frases/culto-frase-2.png", "culto-frases.txt"], avisos: ["La foto del momento no está disponible: el video original no se encuentra."] })),
  };
  (window as unknown as { reels: unknown }).reels = api;
});

const lista = () => screen.getByRole("list", { name: "Frases" });

test("al abrir muestra las frases ya guardadas", async () => {
  api.leerFrases.mockResolvedValue(frases());
  render(<FrasesPublicar proyectoId="p" />);
  expect(await screen.findByDisplayValue(A)).toBeInTheDocument();
  expect(api.leerFrases).toHaveBeenCalledWith("p");
  expect(within(lista()).getByText("0:39")).toBeInTheDocument();
});

test("sacar frases: mientras busca se deshabilita, luego las lista con el aviso", async () => {
  let soltar: (v: unknown) => void = () => {};
  api.sacarFrases.mockReturnValue(new Promise((r) => { soltar = r; }));
  render(<FrasesPublicar proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Sacar 7 frases" }));
  expect(screen.getByRole("button", { name: /Buscando frases/ })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(api.cancelarFrases).toHaveBeenCalledWith("p");
  soltar({ frases: frases(), aviso: "Claude encontró 2 frases textuales." });
  expect(await screen.findByDisplayValue(D)).toBeInTheDocument();
  expect(screen.getByText("Claude encontró 2 frases textuales.")).toBeInTheDocument();
});

test("copiar, ir al momento y quitar", async () => {
  api.leerFrases.mockResolvedValue(frases());
  const escribir = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
  const alIrA = vi.fn();
  render(<FrasesPublicar proyectoId="p" alIrA={alIrA} />);
  await screen.findByDisplayValue(A);
  const primera = within(lista()).getAllByRole("listitem")[0];
  await userEvent.click(within(primera).getByRole("button", { name: "Copiar" }));
  expect(escribir).toHaveBeenCalledWith(A);
  await userEvent.click(within(primera).getByRole("button", { name: "Ir al momento" }));
  expect(alIrA).toHaveBeenCalledWith(39.02);
  await userEvent.click(within(primera).getByRole("button", { name: "Quitar" }));
  expect(api.guardarFrases).toHaveBeenLastCalledWith("p", [frases()[1]]);
});

test("fondo: elegir pintura guarda; la foto del momento no se puede sin video", async () => {
  api.leerFrases.mockResolvedValue(frases());
  render(<FrasesPublicar proyectoId="p" videoDisponible={false} />);
  await screen.findByDisplayValue(A);
  const primera = within(lista()).getAllByRole("listitem")[0];
  expect(within(primera).getByRole("button", { name: "Foto del momento" })).toBeDisabled();
  await userEvent.click(within(primera).getByRole("button", { name: "Pintura" }));
  expect(api.guardarFrases.mock.calls.at(-1)![1][0].fondo).toBe("pintura");
});

test("corregir de más avisa que ya no es lo que dijo el predicador; se guarda al salir", async () => {
  api.leerFrases.mockResolvedValue(frases());
  render(<FrasesPublicar proyectoId="p" />);
  const campo = await screen.findByDisplayValue(A);
  fireEvent.change(campo, { target: { value: "Y este dolor terrenal va a encender la gloria celestial" } });
  expect(screen.getByText("Ya no es lo que dijo el predicador")).toBeInTheDocument();
  fireEvent.blur(campo);
  expect(api.guardarFrases.mock.calls.at(-1)![1][0].texto).toBe("Y este dolor terrenal va a encender la gloria celestial");
});

test("el versículo hay que confirmarlo", async () => {
  api.leerFrases.mockResolvedValue(frases());
  render(<FrasesPublicar proyectoId="p" />);
  await screen.findByDisplayValue(A);
  await userEvent.click(screen.getByRole("button", { name: "Confirmar Salmos 51:17" }));
  expect(api.guardarFrases.mock.calls.at(-1)![1][0].versiculo.confirmado).toBe(true);
});

test("guardar imágenes muestra cuántas y los avisos", async () => {
  api.leerFrases.mockResolvedValue(frases());
  render(<FrasesPublicar proyectoId="p" />);
  await screen.findByDisplayValue(A);
  await userEvent.click(screen.getByRole("button", { name: "Guardar imágenes" }));
  expect(await screen.findByText("Listo: 2 imágenes en exportados/frases")).toBeInTheDocument();
  expect(screen.getByText("La foto del momento no está disponible: el video original no se encuentra.")).toBeInTheDocument();
});

test("un error se muestra con Reintentar", async () => {
  api.sacarFrases.mockRejectedValueOnce(new Error("Error invoking remote method 'entregas:frases': Error: Claude no encontró frases textuales. Prueba de nuevo."));
  render(<FrasesPublicar proyectoId="p" />);
  await userEvent.click(screen.getByRole("button", { name: "Sacar 7 frases" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Claude no encontró frases textuales. Prueba de nuevo.");
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(api.sacarFrases).toHaveBeenCalledTimes(2);
});
