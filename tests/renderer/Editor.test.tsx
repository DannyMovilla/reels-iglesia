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

test("plan 5: un tramo elegido en la transcripción se convierte en un clip a mano", async () => {
  const t = {
    formato: "pulpito-transcripcion/1", inicio: 0, fin: 100, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 70, e: 73, t: "Dios es fiel", w: [[70, 71, "Dios"], [71.1, 72, "es"], [72.1, 73, "fiel"]] }],
  };
  const nuevo = { ...clip, id: "m", titulo: "Dios es fiel", inicio: 70, fin: 75, origen: "manual" as const, puntaje: 0 };
  const a = {
    leerProyecto: async () => ({ ...proyecto, pasos: { ...proyecto.pasos, transcripcion: { estado: "ok" } } }), leerClips: vi.fn(async () => [clip]),
    tareas: async () => [], alCambiarTareas: () => () => {}, leerTranscripcion: async () => t, leerCaras: async () => null,
    leerMarca: async () => null, infoVideo: async () => null, urlVideo: () => "", guardarClip: vi.fn(async () => {}),
    crearClip: vi.fn(async () => nuevo),
  };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Editor proyectoId="p" />);
  await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
  await userEvent.click(await screen.findByRole("button", { name: "Dios" }));
  fireEvent.click(screen.getByRole("button", { name: "fiel" }), { shiftKey: true });
  await userEvent.click(screen.getByRole("button", { name: "Crear clip con esto" }));
  expect(a.crearClip).toHaveBeenCalledWith("p", 70, 73);
  expect(await screen.findByRole("heading", { name: "Dios es fiel", level: 2 })).toBeInTheDocument();
});

test("revisión I3: «Quitar del clip» no deja un clip de menos de 5 s", async () => {
  const t = {
    formato: "pulpito-transcripcion/1", inicio: 0, fin: 100, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 30, e: 60, t: "Dios es fiel", w: [[30, 31, "Dios"], [31.1, 58, "es"], [58.1, 60, "fiel"]] }],
  };
  const a = {
    leerProyecto: async () => ({ ...proyecto, pasos: { ...proyecto.pasos, transcripcion: { estado: "ok" } } }), leerClips: async () => [clip],
    tareas: async () => [], alCambiarTareas: () => () => {}, leerTranscripcion: async () => t, leerCaras: async () => null,
    leerMarca: async () => null, infoVideo: async () => null, urlVideo: () => "", guardarClip: vi.fn(async () => {}),
  };
  (window as unknown as { reels: unknown }).reels = a;
  render(<Editor proyectoId="p" />);
  await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
  await userEvent.click(await screen.findByRole("button", { name: "Dios" }));
  fireEvent.click(screen.getByRole("button", { name: "es" }), { shiftKey: true });
  await userEvent.click(screen.getByRole("button", { name: "Quitar del clip" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se puede quitar: el clip quedaría con menos de 5 segundos.");
  await new Promise((r) => setTimeout(r, 600));
  expect(a.guardarClip).not.toHaveBeenCalled();
});

describe("plan 6: detalles del editor", () => {
  const t = {
    formato: "pulpito-transcripcion/1", inicio: 0, fin: 100, modelo: "m", dispositivo: "cpu",
    segmentos: [{ s: 31, e: 34, t: "Dios es fiel", w: [[31, 32, "Dios"], [32.1, 33, "es"], [33.1, 34, "fiel"]] },
      { s: 80, e: 82, t: "Fuera del clip", w: [[80, 81, "Fuera"], [81.1, 82, "afuera"]] }],
  };
  const api = (extra: Record<string, unknown> = {}) => {
    const a = {
      leerProyecto: async () => ({ ...proyecto, pasos: { ...proyecto.pasos, transcripcion: { estado: "ok" } } }),
      leerClips: async () => [clip, { ...clip, id: "o", titulo: "Oculto", oculto: true }, { ...clip, id: "v", titulo: "Visible" }],
      tareas: async () => [], alCambiarTareas: () => () => {}, leerTranscripcion: async () => t, leerCaras: async () => null,
      leerMarca: async () => null, infoVideo: async () => null, urlVideo: () => "", guardarClip: vi.fn(async () => {}),
      exportar: vi.fn(async () => {}), ...extra,
    };
    (window as unknown as { reels: unknown }).reels = a;
    return a;
  };

  test("los ocultos no cuentan ni se exportan con «Exportar N clips»", async () => {
    const a = api();
    render(<Editor proyectoId="p" />);
    expect(await screen.findByText("2 sugeridos")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Exportar 2 clips/ }));
    await vi.waitFor(() => expect(a.exportar).toHaveBeenCalledWith("p", ["c", "v"]));
  });

  test("si falla corregir o crear un clip, se ve el mensaje en español", async () => {
    api({
      corregir: vi.fn(async () => { throw new Error("Error invoking remote method 'proyectos:corregir': Error: No hay transcripción para corregir."); }),
      crearClip: vi.fn(async () => { throw new Error("Error invoking remote method 'proyectos:crearClip': Error: No pude crear el clip con ese tramo."); }),
    });
    render(<Editor proyectoId="p" />);
    await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Dios" }));
    await userEvent.click(screen.getByRole("button", { name: "En toda la prédica" }));
    expect(await screen.findByText("No hay transcripción para corregir.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dios" }));
    fireEvent.click(screen.getByRole("button", { name: "fiel" }), { shiftKey: true });
    await userEvent.click(screen.getByRole("button", { name: "Crear clip con esto" }));
    expect(await screen.findByText("No pude crear el clip con ese tramo.")).toBeInTheDocument();
  });

  test("clic en una palabra fuera del clip lo dice y ofrece crear un clip desde ahí", async () => {
    const a = api({ crearClip: vi.fn(async () => ({ ...clip, id: "n", titulo: "Fuera afuera", inicio: 80, fin: 110 })) });
    render(<Editor proyectoId="p" />);
    await userEvent.click(await screen.findByRole("tab", { name: /Transcripción/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Fuera" }));
    expect(screen.getByText("Esta parte no está en el clip.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Crear clip desde aquí" }));
    expect((a as unknown as { crearClip: ReturnType<typeof vi.fn> }).crearClip).toHaveBeenCalledWith("p", 80, 100); // 30 s, sin pasar del fin de la prédica
  });
});

test("plan 6: el aviso de voz se borra al elegir un clip con voz Limpia", async () => {
  const t = { formato: "pulpito-transcripcion/1", inicio: 0, fin: 100, modelo: "m", dispositivo: "cpu", segmentos: [{ s: 31, e: 34, t: "Dios", w: [[31, 34, "Dios"]] }] };
  (window as unknown as { reels: unknown }).reels = {
    leerProyecto: async () => ({ ...proyecto, pasos: { ...proyecto.pasos, transcripcion: { estado: "ok" }, audio: { estado: "ok" } } }),
    leerClips: async () => [{ ...clip, id: "a", titulo: "Con podcast", puntaje: 99, voz: "podcast" }, { ...clip, id: "b", titulo: "Con limpia", puntaje: 10 }],
    tareas: async () => [], alCambiarTareas: () => () => {}, leerTranscripcion: async () => t, leerCaras: async () => null,
    leerMarca: async () => null, infoVideo: async () => null, urlVideo: () => "", guardarClip: vi.fn(async () => {}),
    prepararVoz: vi.fn(async () => { throw new Error("falló"); }),
  };
  render(<Editor proyectoId="p" />);
  expect(await screen.findByText(/No se pudo preparar ese nivel de voz/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("heading", { name: "Con limpia" }));
  await vi.waitFor(() => expect(screen.queryByText(/No se pudo preparar ese nivel de voz/)).toBeNull());
});
