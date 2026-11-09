import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ListaClips } from "../../src/renderer/componentes/ListaClips";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const base: Omit<ClipSpec, "id" | "titulo" | "puntaje" | "versiculos"> = {
  gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50, apertura: null, palabrasClave: [],
  razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3,
  cierre: true, formatos: ["9:16", "4:5"], estado: "sugerido",
};
const clips: ClipSpec[] = [
  { ...base, id: "a", titulo: "Bajo", puntaje: 70, versiculos: [] },
  { ...base, id: "b", titulo: "Alto", puntaje: 92, versiculos: [{ ref: "Salmos 51:17", texto: "", en: 3, activo: true, confirmado: false }] },
  { ...base, id: "c", titulo: "Medio", puntaje: 85, versiculos: [] },
];

test("ordena por puntaje, muestra el anillo accesible y filtra los que tienen versículo", async () => {
  render(<ListaClips clips={clips} seleccionado="b" alElegir={() => {}} />);
  const lista = screen.getByRole("list", { name: "Clips sugeridos" });
  expect(within(lista).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Alto", "Medio", "Bajo"]);
  expect(screen.getByLabelText("Puntaje 92")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Con versículo" }));
  expect(within(lista).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Alto"]);
  expect(screen.getByText("Salmos 51:17")).toBeInTheDocument();
});

describe("plan 5: buscador, filtros, favoritos y ocultos", () => {
  const conMas: ClipSpec[] = [
    ...clips,
    { ...base, id: "d", titulo: "Escondido", puntaje: 99, versiculos: [], oculto: true },
    { ...base, id: "e", titulo: "Corto de fe", puntaje: 60, versiculos: [], inicio: 0, fin: 20, categoria: "Llamado" },
  ];
  function Prueba({ alCambiar }: { alCambiar: (c: ClipSpec) => void }) {
    const [cs, setCs] = useState(conMas);
    return <ListaClips clips={cs} alElegir={() => {}} alCambiar={(c) => { setCs((x) => x.map((y) => (y.id === c.id ? c : y))); alCambiar(c); }} />;
  }
  const titulos = () => within(screen.getByRole("list", { name: "Clips sugeridos" })).getAllByRole("heading").map((h) => h.textContent);

  test("buscar, ordenar y contar lo que se muestra", async () => {
    render(<Prueba alCambiar={() => {}} />);
    expect(screen.getByText("Mostrando 4 de 5")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Buscar clips"), "FE");
    expect(titulos()).toEqual(["Corto de fe"]);
    await userEvent.clear(screen.getByLabelText("Buscar clips"));
    await userEvent.selectOptions(screen.getByLabelText("Ordenar"), "cortos");
    expect(titulos()[0]).toBe("Corto de fe");
  });

  test("favorito y ocultar; «Ver ocultos» los muestra", async () => {
    const alCambiar = vi.fn();
    render(<Prueba alCambiar={alCambiar} />);
    await userEvent.click(screen.getByRole("button", { name: "Marcar «Medio» como favorito" }));
    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ id: "c", favorito: true }));
    await userEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    expect(titulos()).toEqual(["Medio"]);
    await userEvent.click(screen.getByRole("button", { name: "Todos" }));
    await userEvent.click(screen.getByRole("button", { name: "Ocultar «Bajo»" }));
    expect(titulos()).not.toContain("Bajo");
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Ver ocultos" }));
    expect(titulos()).toEqual(expect.arrayContaining(["Bajo", "Escondido"]));
    await userEvent.click(screen.getByRole("button", { name: "Mostrar «Escondido»" }));
    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ id: "d", oculto: false }));
  });

  test("filtros de categoría, duración y puntaje", async () => {
    render(<Prueba alCambiar={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Llamado" }));
    expect(titulos()).toEqual(["Corto de fe"]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Llamado" }));
    await userEvent.selectOptions(screen.getByLabelText("Duración"), "media");
    expect(titulos()).toEqual(["Alto", "Medio", "Bajo"]);
    fireEvent.change(screen.getByLabelText("Puntaje mínimo"), { target: { value: "80" } });
    expect(titulos()).toEqual(["Alto", "Medio"]);
  });
});
