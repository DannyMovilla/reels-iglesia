import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { Inspector, type Categoria } from "../../src/renderer/componentes/Inspector";
import { Galeria, muestraSub } from "../../src/renderer/componentes/Galeria";
import { FAMILIAS_SUB } from "../../src/renderer/componentes/familias";
import { LineaTiempo } from "../../src/renderer/componentes/LineaTiempo";
import { PanelProceso } from "../../src/renderer/componentes/PanelProceso";
import { ESTILOS_SUB, NOMBRE_ESTILO } from "../../src/shared/reel/estilos-sub";
import type { ClipSpec, EstiloSub, Proyecto } from "../../src/shared/tipos";
import { PLAN3, SIN_MUSICA } from "../ayuda/plan3";

const base: ClipSpec = {
  id: "c", titulo: "El quebrantamiento", gancho: "Tu quebranto abre el cielo", ganchosAlternativos: [],
  categoria: "Exhortación", inicio: 30, fin: 60, apertura: null, palabrasClave: [],
  versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios de Dios", en: 12, activo: true, confirmado: false }],
  puntaje: 92, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "auto", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, musica: SIN_MUSICA, cierre: true, formatos: ["9:16"], estado: "sugerido",
};

test("el panel tiene un riel de categorías y empieza en Gancho", () => {
  render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} />);
  const riel = screen.getByRole("tablist", { name: "Categorías de ajustes" });
  expect(riel).toHaveAttribute("aria-orientation", "vertical");
  const nombres = within(riel).getAllByRole("tab").map((t) => t.textContent);
  expect(nombres).toEqual(["Gancho", "Subtítulos", "Versículo", "Imagen", "Audio", "Ritmo", "Publicar", "Mi estilo"]);
  expect(screen.getByRole("tab", { name: "Gancho" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("heading", { name: "Gancho" })).toBeInTheDocument();
  expect(screen.getByLabelText("Gancho en pantalla")).toBeInTheDocument();
  // Lo de otras categorías no aparece hasta elegirlas.
  expect(screen.queryByRole("radiogroup", { name: "Estilo de subtítulos" })).not.toBeInTheDocument();
});

test("cada categoría muestra solo lo suyo", async () => {
  render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Subtítulos" }));
  expect(screen.getByRole("radiogroup", { name: "Estilo de subtítulos" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Gancho en pantalla")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "Audio" }));
  expect(screen.getByRole("group", { name: "Nivel de voz" })).toBeInTheDocument();
  expect(screen.queryByRole("radiogroup", { name: "Estilo de subtítulos" })).not.toBeInTheDocument();
});

test("con las flechas de arriba y abajo se cambia de categoría", async () => {
  render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} />);
  screen.getByRole("tab", { name: "Gancho" }).focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(screen.getByRole("tab", { name: "Subtítulos" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Subtítulos" })).toHaveFocus();
  await userEvent.keyboard("{ArrowUp}{ArrowUp}");
  expect(screen.getByRole("tab", { name: "Mi estilo" })).toHaveAttribute("aria-selected", "true");
});

test("el riel avisa cuando falta confirmar un versículo", () => {
  const { rerender } = render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} />);
  expect(screen.getByRole("tab", { name: "Versículo" })).toHaveAccessibleDescription("Falta confirmar el texto");
  rerender(<Inspector clip={{ ...base, versiculos: [{ ...base.versiculos[0], confirmado: true }] }} avisos={[]} alCambiar={() => {}} />);
  expect(screen.getByRole("tab", { name: "Versículo" })).not.toHaveAccessibleDescription();
});

test("la categoría se puede manejar desde afuera (la línea de tiempo la abre)", async () => {
  const alCategoria = vi.fn();
  function Prueba() {
    const [cat, setCat] = useState<Categoria>("ritmo");
    return <Inspector clip={base} avisos={[]} alCambiar={() => {}} categoria={cat} alCategoria={(c) => { setCat(c); alCategoria(c); }} />;
  }
  render(<Prueba />);
  expect(screen.getByRole("tab", { name: "Ritmo" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(screen.getByRole("tab", { name: "Imagen" }));
  expect(alCategoria).toHaveBeenCalledWith("imagen");
  expect(screen.getByRole("group", { name: "Look de color" })).toBeInTheDocument();
});

test("una sección se pliega y muestra su valor actual en la cabecera", async () => {
  render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} categoria="subtitulos" />);
  const cabeza = screen.getByRole("button", { name: /^Tamaño/ });
  expect(cabeza).toHaveTextContent("Medio");
  expect(cabeza).toHaveAttribute("aria-expanded", "true");
  await userEvent.click(cabeza);
  expect(cabeza).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("group", { name: "Tamaño de subtítulos" })).not.toBeInTheDocument();
});

test("la galería de subtítulos se filtra por familia sin perder ningún estilo", async () => {
  const opciones = ESTILOS_SUB.map((e) => [e, NOMBRE_ESTILO[e]] as [EstiloSub, string]);
  expect(FAMILIAS_SUB.flatMap(([, , ids]) => ids).sort()).toEqual([...ESTILOS_SUB].sort());
  render(<Galeria etiqueta="Estilo de subtítulos" opciones={opciones} valor="pop" alCambiar={() => {}} muestra={(e) => muestraSub(e, "#f5c542")} familias={FAMILIAS_SUB} />);
  const familias = screen.getByRole("group", { name: "Familias de estilos" });
  expect(within(familias).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByRole("radio")).toHaveLength(15);
  await userEvent.click(within(familias).getByRole("button", { name: "Virales" }));
  const virales = FAMILIAS_SUB.find(([id]) => id === "virales")![2];
  expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(virales.map((e) => NOMBRE_ESTILO[e]));
});

test("las pistas de la línea de tiempo abren su categoría", async () => {
  const alElegirPista = vi.fn();
  render(<LineaTiempo clip={base} palabras={[]} tiempoActual={0} alBuscar={() => {}} alCambiarCorte={() => {}} alElegirPista={alElegirPista} />);
  await userEvent.click(screen.getByRole("button", { name: "Subtítulos" }));
  expect(alElegirPista).toHaveBeenLastCalledWith("subtitulos");
  await userEvent.click(screen.getByRole("button", { name: "Video" }));
  expect(alElegirPista).toHaveBeenLastCalledWith("imagen");
  await userEvent.click(screen.getByRole("button", { name: "Música" }));
  expect(alElegirPista).toHaveBeenLastCalledWith("audio");
  await userEvent.click(screen.getByRole("button", { name: "Versículo" }));
  expect(alElegirPista).toHaveBeenLastCalledWith("versiculo");
  await userEvent.click(screen.getByRole("button", { name: "Gancho" }));
  expect(alElegirPista).toHaveBeenLastCalledWith("gancho");
});

test("la línea de tiempo muestra el gancho y la música en sus pistas", () => {
  render(<LineaTiempo clip={{ ...base, musica: { ...base.musica, modo: "auto" } }} palabras={[]} tiempoActual={0} alBuscar={() => {}} alCambiarCorte={() => {}} />);
  expect(screen.getByText("Tu quebranto abre el cielo")).toBeInTheDocument();
  expect(screen.getByText("Música · Automática")).toBeInTheDocument();
});

const proyecto = (todo: boolean): Proyecto => ({
  id: "p1", nombre: "Culto", creado: "", video: { ruta: "v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 60 },
  estado: todo ? "listo" : "analizando",
  pasos: { transcripcion: { estado: "ok", segundos: 30 }, audio: { estado: "ok", segundos: 5 }, caras: { estado: "ok" }, analisis: { estado: todo ? "ok" : "pendiente" } },
});

test("con los 4 pasos listos el proceso se resume en una línea y se puede abrir", async () => {
  const { rerender } = render(<PanelProceso proyecto={proyecto(false)} tareas={[]} alReintentar={() => {}} alProcesar={() => {}} />);
  expect(screen.getByText("Transcripción")).toBeVisible();
  rerender(<PanelProceso proyecto={proyecto(true)} tareas={[]} alReintentar={() => {}} alProcesar={() => {}} />);
  const resumen = screen.getByRole("button", { name: /Prédica lista/ });
  expect(resumen).toHaveAttribute("aria-expanded", "false");
  // La lista sigue ahí (los pasos cuentan como listos), pero compacta.
  expect(screen.getByRole("list", { name: "Proceso" }).querySelectorAll(".paso.ok")).toHaveLength(4);
  expect(screen.queryByText("Listo en 30 s")).not.toBeInTheDocument();
  await userEvent.click(resumen);
  expect(screen.getByText("Listo en 30 s")).toBeInTheDocument();
});

test("la pista de la categoría abierta se ve marcada", () => {
  render(<LineaTiempo clip={base} palabras={[]} tiempoActual={0} alBuscar={() => {}} alCambiarCorte={() => {}} alElegirPista={() => {}} categoriaActiva="subtitulos" />);
  expect(screen.getByRole("button", { name: "Subtítulos" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Gancho" })).toHaveAttribute("aria-pressed", "false");
});
