import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { Capitulos } from "../../src/renderer/componentes/Capitulos";

const caps = { resumen: "Resumen.", capitulos: [{ t: 0, titulo: "Lectura" }, { t: 125, titulo: "La fe" }, { t: 300, titulo: "Llamado" }] };

test("sin capítulos: botón para crearlos; luego el texto para YouTube con tiempos del video completo", async () => {
  let responder: (v: unknown) => void = () => {};
  const a = { leerCapitulos: vi.fn(async () => null), crearCapitulos: vi.fn(() => new Promise((r) => { responder = r; })) };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Capitulos proyectoId="p" inicioRango={6284} />);
  await userEvent.click(await screen.findByRole("button", { name: "Crear capítulos" }));
  expect(screen.getByText("Claude está leyendo la prédica…")).toBeInTheDocument();
  responder(caps);
  const texto = await screen.findByLabelText("Texto para YouTube");
  expect((texto as HTMLTextAreaElement).value).toContain("0:00:00 Inicio del culto\n1:44:44 Lectura");
  await userEvent.click(screen.getByRole("switch", { name: "Tiempos del video completo" }));
  expect((texto as HTMLTextAreaElement).value).toContain("0:00 Lectura\n2:05 La fe");
  expect(screen.getByRole("button", { name: "Crear de nuevo" })).toBeInTheDocument();
});

test("copiar pone el texto en el portapapeles; un error se muestra en español", async () => {
  const escribir = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
  const a = { leerCapitulos: vi.fn(async () => caps), crearCapitulos: vi.fn(async () => { throw new Error("Error invoking remote method 'x': Error: Claude no tiene sesión iniciada."); }) };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Capitulos proyectoId="p" inicioRango={0} />);
  await userEvent.click(await screen.findByRole("button", { name: "Copiar" }));
  expect(escribir).toHaveBeenCalledWith(expect.stringContaining("0:00 Lectura"));
  await userEvent.click(screen.getByRole("button", { name: "Crear de nuevo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Claude no tiene sesión iniciada.");
});
