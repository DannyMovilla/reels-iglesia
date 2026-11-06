import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ConIA } from "../../src/renderer/pantallas/ConIA";
import { ESTILO_POR_DEFECTO } from "../../src/shared/clip";
import type { Creacion } from "../../src/shared/tipos";

vi.mock("@hyperframes/player", () => ({})); // el reproductor real no corre en jsdom

const base: Creacion = {
  id: "c1", creado: "2026-11-06T10:00:00Z", entrada: { tipo: "versiculo", texto: "Juan 8:12" },
  versiculo: { ref: "Juan 8:12", texto: "Yo soy la luz del mundo", confirmado: false },
  gancho: "No camines a oscuras", reflexion: "Jesús es tu luz.", palabrasClave: ["luz"],
  musica: { modo: "auto", pista: null, animo: "esperanza", tonalidad: "Re", volumen: 0.18 }, subtitulos: { estilo: "pop" },
  fondo: { tipo: "escena", escena: "luz" },
  redes: { instagram: { texto: "IG", hashtags: [] }, tiktok: { texto: "", hashtags: [] }, facebook: { texto: "" }, youtube: { titulo: "", texto: "" } },
  formatos: ["9:16"], estado: "borrador",
};

function api(extra: Record<string, unknown> = {}) {
  let guardada = structuredClone(base);
  const a = {
    listarCreaciones: vi.fn(async () => [structuredClone(base)]),
    crearCreacion: vi.fn(async () => ({ ...structuredClone(base), versiculo: { ref: "", texto: "", confirmado: false }, gancho: "" })),
    escribirCreacion: vi.fn(async () => structuredClone(base)),
    leerCreacion: vi.fn(async () => structuredClone(guardada)),
    guardarCreacion: vi.fn(async (c: Creacion) => { guardada = structuredClone(c); }),
    borrarCreacion: vi.fn(async () => {}),
    elegirFondo: vi.fn(async () => "C:/datos/ia/c1/fondo.jpg"),
    exportarCreacion: vi.fn(async () => {}),
    leerMarca: vi.fn(async () => ({ nombre: "Iglesia", color: "#f2b544", invitacion: "Síguenos", logoEscala: 1, redes: {}, estilo: ESTILO_POR_DEFECTO })),
    registrarVista: vi.fn(async () => "reels-comp://v/index.html"),
    urlFondo: () => "http://127.0.0.1/x/fondo-ia/c1/fondo.jpg",
    urlMusicaCreacion: vi.fn(async () => null),
    listarPistas: vi.fn(async () => []),
    tareas: vi.fn(async () => []),
    alCambiarTareas: () => () => {},
    cancelar: vi.fn(),
    abrirCarpetaExportados: vi.fn(),
    ...extra,
  };
  (window as unknown as { reels: unknown }).reels = a;
  return a;
}

test("crear un reel nuevo desde un tema: Claude lo escribe y se abre el editor", async () => {
  const a = api();
  render(<ConIA />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo reel de versículo" }));
  await userEvent.click(screen.getByRole("radio", { name: "Un tema" }));
  await userEvent.type(screen.getByLabelText("Tema"), "esperanza en la prueba");
  await userEvent.click(screen.getByRole("button", { name: "Crear con Claude" }));
  expect(a.crearCreacion).toHaveBeenCalledWith({ tipo: "tema", texto: "esperanza en la prueba" });
  expect(a.escribirCreacion).toHaveBeenCalledWith("c1");
  expect(await screen.findByLabelText("Gancho")).toHaveValue("No camines a oscuras");
});

test("si Claude falla, se explica y el reel queda para escribirlo a mano", async () => {
  api({ escribirCreacion: vi.fn(async () => { throw new Error("Error invoking remote method 'ia:escribir': Error: Claude no encontró ese versículo. Escríbelo a mano o prueba con otra referencia."); }) });
  render(<ConIA />);
  await userEvent.click(await screen.findByRole("button", { name: "Nuevo reel de versículo" }));
  await userEvent.type(screen.getByLabelText("Versículo"), "Hezequías 4:99");
  await userEvent.click(screen.getByRole("button", { name: "Crear con Claude" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Claude no encontró ese versículo. Escríbelo a mano o prueba con otra referencia.");
  expect(screen.getByLabelText("Referencia")).toBeInTheDocument();
});

test("el editor: confirmar RVR1960 habilita exportar; fondo de escena, foto o degradado; exportar en los formatos marcados", async () => {
  const a = api();
  render(<ConIA />);
  await userEvent.click(await screen.findByRole("button", { name: /Juan 8:12/ }));
  const exportar = await screen.findByRole("button", { name: "Exportar" });
  expect(exportar).toBeDisabled();
  expect(screen.getByText(/Confirma el texto RVR1960/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar texto" }));
  expect(exportar).toBeEnabled();

  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  const fondo = screen.getByRole("group", { name: "Fondo" });
  expect(within(fondo).getAllByRole("button").map((b) => b.textContent)).toEqual(["Escena animada", "Degradado", "Foto o video"]);
  expect(within(screen.getByLabelText("Escena")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Luz", "Amanecer", "Aurora", "Nubes", "Atardecer", "Destello"]);
  await userEvent.click(within(fondo).getByRole("button", { name: "Foto o video" }));
  await userEvent.click(screen.getByRole("button", { name: "Elegir foto o video" }));
  expect(a.elegirFondo).toHaveBeenCalledWith("c1");

  await userEvent.click(exportar);
  expect(a.exportarCreacion).toHaveBeenCalledWith("c1", ["9:16"]);
  await vi.waitFor(() => expect(a.guardarCreacion).toHaveBeenLastCalledWith(expect.objectContaining({ fondo: { tipo: "imagen", archivo: "C:/datos/ia/c1/fondo.jpg" } })));
});
