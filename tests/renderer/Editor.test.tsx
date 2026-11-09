import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, vi } from "vitest";
import { Editor } from "../../src/renderer/pantallas/Editor";
import type { ClipSpec, Proyecto } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const clip: ClipSpec = {
  id: "c", titulo: "El quebrantamiento", gancho: "Tu quebranto abre el cielo", ganchosAlternativos: [],
  categoria: "Exhortación", inicio: 30, fin: 60, apertura: { activa: false, inicio: 39, fin: 44, frase: "x" }, palabrasClave: [],
  versiculos: [{ ref: "Salmos 51:17", texto: "Los sacrificios de Dios son el espíritu quebrantado", en: 12, activo: true, confirmado: false }],
  puntaje: 92, razon: "", descripcion: "", hashtags: [],
  encuadre: { modo: "auto", x: 0.5, zoom: 1.25 }, subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 },
  ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
};
const proyecto = {
  id: "p", nombre: "Culto", creado: "2026-11-06T00:00:00Z", video: { ruta: "C:/v.mp4", nombre: "v.mp4", tamano: 1, duracion: 100 },
  rango: { inicio: 0, fin: 100 }, estado: "listo", videoDisponible: true,
  pasos: { transcripcion: { estado: "pendiente" }, audio: { estado: "pendiente" }, caras: { estado: "pendiente" }, analisis: { estado: "ok" } },
} as unknown as Proyecto;

test("confirmar el versículo y exportar enseguida guarda el clip antes de encolar la exportación", async () => {
  const orden: string[] = [];
  const guardado: ClipSpec[] = [];
  (window as unknown as { reels: unknown }).reels = {
    leerProyecto: async () => proyecto, leerClips: async () => [clip], tareas: async () => [], alCambiarTareas: () => () => {},
    leerTranscripcion: async () => null, leerCaras: async () => null, leerMarca: async () => null, infoVideo: async () => null,
    urlVideo: () => "", guardarClip: vi.fn(async (_id: string, c: ClipSpec) => { orden.push("guardar"); guardado.push(c); }),
    exportar: vi.fn(async () => { orden.push("exportar"); }),
  };
  render(<Editor proyectoId="p" />);
  await userEvent.click(await screen.findByRole("button", { name: "Confirmar texto" }));
  await userEvent.click(screen.getByRole("button", { name: "Exportar este clip" }));
  await vi.waitFor(() => expect(orden).toContain("exportar"));
  expect(orden).toEqual(["guardar", "exportar"]);
  expect(guardado[0].versiculos[0].confirmado).toBe(true);
});

describe("plan 5: vista Transcripción", () => {
  const t = {
    formato: "pulpito-transcripcion/1", inicio: 0, fin: 100, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 31, e: 34, t: "Dios es fiel", w: [[31, 32, "Dios"], [32.1, 33, "es"], [33.1, 34, "fiel"]] }],
  };
  const conTranscripcion = { ...proyecto, pasos: { ...proyecto.pasos, transcripcion: { estado: "ok" } } } as unknown as Proyecto;
  const api = () => {
    const a = {
      leerProyecto: async () => conTranscripcion, leerClips: async () => [clip], tareas: async () => [], alCambiarTareas: () => () => {},
      leerTranscripcion: async () => t, leerCaras: async () => null, leerMarca: async () => null, infoVideo: async () => null,
      urlVideo: () => "", guardarClip: vi.fn(async () => {}), exportar: vi.fn(async () => {}),
      corregir: vi.fn(async (_id: string, c: { a: string }) => ({ ...t, segmentos: [{ ...t.segmentos[0], w: [[31, 32, c.a], ...t.segmentos[0].w.slice(1)] }] })),
    };
    (window as unknown as { reels: unknown }).reels = a;
    return a;
  };

  test("corregir una palabra la guarda y la muestra corregida", async () => {
    const a = api();
    render(<Editor proyectoId="p" />);
    await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Dios" }));
    const campo = screen.getByLabelText("Palabra corregida");
    await userEvent.clear(campo);
    await userEvent.type(campo, "DIOS");
    await userEvent.click(screen.getByRole("button", { name: "En toda la prédica" }));
    expect(a.corregir).toHaveBeenCalledWith("p", { de: "Dios", a: "DIOS" });
    expect(await screen.findByRole("button", { name: "DIOS" })).toBeInTheDocument();
  });

  test("un tramo elegido dentro del clip se puede quitar del clip", async () => {
    const a = api();
    render(<Editor proyectoId="p" />);
    await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
    await userEvent.click(await screen.findByRole("button", { name: "es" }));
    fireEvent.click(screen.getByRole("button", { name: "fiel" }), { shiftKey: true });
    await userEvent.click(screen.getByRole("button", { name: "Quitar del clip" }));
    await vi.waitFor(() => expect(a.guardarClip).toHaveBeenCalled(), { timeout: 2000 });
    expect((a.guardarClip.mock.calls.at(-1) as unknown as [string, ClipSpec])[1].cortes.quitados).toEqual([{ inicio: 32.1, fin: 34 }]);
  });
});
