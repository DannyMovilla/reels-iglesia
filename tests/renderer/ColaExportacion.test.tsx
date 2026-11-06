import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ColaExportacion } from "../../src/renderer/componentes/ColaExportacion";
import type { ClipSpec, Tarea } from "../../src/shared/tipos";

const instantanea = { titulo: "La oración profunda" } as ClipSpec;
const t = (id: string, estado: Tarea["estado"], pct = 0, proyectoId = "p1"): Tarea =>
  ({ id, proyectoId, tipo: "exportar", estado, pct, creada: "", formato: "9:16", instantanea });

test("muestra lo que se está exportando, el porcentaje y cuántas quedan; Cancelar llama cancelar", async () => {
  const alCancelar = vi.fn();
  render(<ColaExportacion proyectoId="p1" tareas={[t("a", "corriendo", 64), t("b", "pendiente"), t("c", "pendiente"), t("x", "pendiente", 0, "otro")]}
    alCancelar={alCancelar} alAbrirCarpeta={() => {}} />);
  expect(screen.getByText(/La oración profunda/)).toBeInTheDocument();
  expect(screen.getByText("64 %")).toBeInTheDocument();
  expect(screen.getByText("2 en cola")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar exportación" }));
  expect(alCancelar).toHaveBeenCalledWith("a");
});

test("cuando termina ofrece abrir la carpeta y avisa los errores", async () => {
  const alAbrirCarpeta = vi.fn();
  render(<ColaExportacion proyectoId="p1" tareas={[t("a", "ok", 100), { ...t("b", "error"), error: "Confirma el texto de Salmos 51:17 antes de exportar." }]}
    alCancelar={() => {}} alAbrirCarpeta={alAbrirCarpeta} />);
  expect(screen.getByText("1 reel listo")).toBeInTheDocument();
  expect(screen.getByText("Confirma el texto de Salmos 51:17 antes de exportar.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Abrir carpeta" }));
  expect(alAbrirCarpeta).toHaveBeenCalled();
});

test("sin exportaciones no muestra nada", () => {
  const { container } = render(<ColaExportacion proyectoId="p1" tareas={[]} alCancelar={() => {}} alAbrirCarpeta={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test("revisión C1: también muestra las exportaciones de «Con IA» con su referencia", () => {
  const ia = (estado: "corriendo" | "ok"): Tarea => ({ id: `i-${estado}`, proyectoId: "ia:c1", tipo: "exportar-ia", estado, pct: 40, creada: "", formato: "9:16", creacionId: "c1",
    instantaneaIa: { versiculo: { ref: "Juan 8:12" } } as never });
  const { rerender } = render(<ColaExportacion proyectoId="ia:c1" tareas={[ia("corriendo")]} alCancelar={() => {}} alAbrirCarpeta={() => {}} />);
  expect(screen.getByText("«Juan 8:12» · 9:16")).toBeInTheDocument();
  rerender(<ColaExportacion proyectoId="ia:c1" tareas={[ia("ok")]} alCancelar={() => {}} alAbrirCarpeta={() => {}} />);
  expect(screen.getByText("1 reel listo")).toBeInTheDocument();
});
