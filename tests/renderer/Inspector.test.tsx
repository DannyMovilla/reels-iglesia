import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { Inspector } from "../../src/renderer/componentes/Inspector";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const base: ClipSpec = {
  id: "c", titulo: "El quebrantamiento", gancho: "Tu quebranto abre el cielo", ganchosAlternativos: ["¿Oras o solo hablas?", "Cuando te humillas, Dios responde"],
  categoria: "Exhortación", inicio: 30, fin: 60, apertura: { activa: true, inicio: 39, fin: 44, frase: "ese quebrantamiento" }, palabrasClave: [],
  versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado", en: 12, activo: true, confirmado: false }],
  puntaje: 92, razon: "Frase memorable.", descripcion: "¿Cuándo oraste así?", hashtags: ["#fe"],
  encuadre: { modo: "auto", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, cierre: true, formatos: ["9:16", "4:5"], estado: "sugerido",
};

/** Envoltura con estado para ver los cambios como los vería el editor. */
function Prueba({ alCambiar, avisos = [] }: { alCambiar: (c: ClipSpec) => void; avisos?: string[] }) {
  const [c, setC] = useState(base);
  return <Inspector clip={c} avisos={avisos} alCambiar={(n) => { setC(n); alCambiar(n); }} />;
}

test("tocar una alternativa la pone como gancho y el gancho anterior pasa a las alternativas", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("button", { name: "¿Oras o solo hablas?" }));
  const c: ClipSpec = alCambiar.mock.calls.at(-1)![0];
  expect(c.gancho).toBe("¿Oras o solo hablas?");
  expect(c.ganchosAlternativos).toEqual(["Tu quebranto abre el cielo", "Cuando te humillas, Dios responde"]);
  expect(screen.getByLabelText("Gancho en pantalla")).toHaveValue("¿Oras o solo hablas?");
});

test("el versículo se puede apagar y su texto RVR1960 hay que confirmarlo", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  expect(screen.getByText(/Revisa el texto RVR1960/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar texto" }));
  expect(alCambiar.mock.calls.at(-1)![0].versiculos[0].confirmado).toBe(true);
  await userEvent.click(screen.getByRole("switch", { name: "Mostrar Salmos 51:17" }));
  expect(alCambiar.mock.calls.at(-1)![0].versiculos[0].activo).toBe(false);
});

test("muestra los avisos de la composición", () => {
  render(<Prueba alCambiar={() => {}} avisos={["Confirma el texto RVR1960 de Salmos 51:17 antes de exportar."]} />);
  expect(screen.getByRole("status")).toHaveTextContent("Confirma el texto RVR1960 de Salmos 51:17 antes de exportar.");
});

test("en Estilo se cambia el estilo de subtítulos", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  await userEvent.click(screen.getByRole("button", { name: "Caja" }));
  expect(alCambiar.mock.calls.at(-1)![0].subtitulos.estilo).toBe("caja");
});
