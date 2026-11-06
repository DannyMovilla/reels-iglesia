import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListaClips } from "../../src/renderer/componentes/ListaClips";
import type { ClipSpec } from "../../src/shared/tipos";

const base: Omit<ClipSpec, "id" | "titulo" | "puntaje" | "versiculos"> = {
  gancho: "", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50, apertura: null, palabrasClave: [],
  razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, musica: { pista: "auto", volumen: 0.12 },
  cierre: true, formatos: ["9:16", "4:5"], estado: "sugerido",
};
const clips: ClipSpec[] = [
  { ...base, id: "a", titulo: "Bajo", puntaje: 70, versiculos: [] },
  { ...base, id: "b", titulo: "Alto", puntaje: 92, versiculos: [{ ref: "Salmo 51:17", texto: "", en: 3, activo: true }] },
  { ...base, id: "c", titulo: "Medio", puntaje: 85, versiculos: [] },
];

test("ordena por puntaje, muestra el anillo accesible y filtra los que tienen versículo", async () => {
  render(<ListaClips clips={clips} seleccionado="b" alElegir={() => {}} />);
  const lista = screen.getByRole("list", { name: "Clips sugeridos" });
  expect(within(lista).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Alto", "Medio", "Bajo"]);
  expect(screen.getByLabelText("Puntaje 92")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Con versículo" }));
  expect(within(lista).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Alto"]);
  expect(screen.getByText("Salmo 51:17")).toBeInTheDocument();
});
