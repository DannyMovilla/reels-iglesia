import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PanelProceso } from "../../src/renderer/componentes/PanelProceso";
import type { Proyecto } from "../../src/shared/tipos";

const proyecto: Proyecto = {
  id: "p1", nombre: "Culto", creado: "", video: { ruta: "v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 60 },
  estado: "error",
  pasos: { transcripcion: { estado: "ok", segundos: 30 }, audio: { estado: "ok", segundos: 5 }, caras: { estado: "error", detalle: "Se interrumpió al cerrar la app." }, analisis: { estado: "pendiente" } },
};

test("un paso con error y sin tarea en la cola igual ofrece Reintentar desde ese paso", async () => {
  const alProcesar = vi.fn();
  render(<PanelProceso proyecto={proyecto} tareas={[]} alReintentar={() => {}} alProcesar={alProcesar} />);
  expect(screen.getByText("Se interrumpió al cerrar la app.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(alProcesar).toHaveBeenCalledWith("caras");
});

test("muestra el paso de audio limpio", () => {
  render(<PanelProceso proyecto={proyecto} tareas={[]} alReintentar={() => {}} alProcesar={() => {}} />);
  expect(screen.getByText("Audio limpio")).toBeInTheDocument();
});
