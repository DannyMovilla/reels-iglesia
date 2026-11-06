import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, vi } from "vitest";
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

test("en Estilo se guarda el estilo de la iglesia o se aplica a todos los clips", async () => {
  const alGuardarEstilo = vi.fn();
  const alAplicarEstilo = vi.fn();
  render(<Inspector clip={base} avisos={[]} alCambiar={() => {}} alGuardarEstilo={alGuardarEstilo} alAplicarEstilo={alAplicarEstilo} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  await userEvent.click(screen.getByRole("button", { name: "Guardar como estilo de la iglesia" }));
  expect(alGuardarEstilo).toHaveBeenCalledWith(base);
  await userEvent.click(screen.getByRole("button", { name: "Aplicar a todos los clips" }));
  expect(alAplicarEstilo).toHaveBeenCalled();
});

test("en Estilo se elige la música: modo, ánimo, tonalidad del pad y volumen", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  await userEvent.click(screen.getByRole("button", { name: "Pad" }));
  expect(alCambiar.mock.calls.at(-1)![0].musica.modo).toBe("pad");
  await userEvent.selectOptions(screen.getByLabelText("Ánimo de la música"), "victoria");
  expect(alCambiar.mock.calls.at(-1)![0].musica.animo).toBe("victoria");
  await userEvent.selectOptions(screen.getByLabelText("Tonalidad"), "Sol");
  expect(alCambiar.mock.calls.at(-1)![0].musica.tonalidad).toBe("Sol");
  await userEvent.click(screen.getByRole("button", { name: "Sin música" }));
  expect(alCambiar.mock.calls.at(-1)![0].musica.modo).toBe("ninguna");
  expect(screen.queryByLabelText("Volumen de la música")).toBeNull();
});

test("en Estilo se apagan los cortes de pausas y muletillas", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  await userEvent.click(screen.getByRole("switch", { name: "Quitar muletillas" }));
  expect(alCambiar.mock.calls.at(-1)![0].cortes.muletillas).toBe(!base.cortes.muletillas);
});

test("en Estilo hay 7 estilos de subtítulos con nombre en español", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  const grupo = screen.getByRole("group", { name: "Estilo de subtítulos" });
  const nombres = within(grupo).getAllByRole("button").map((b) => b.textContent);
  expect(nombres).toEqual(["Pop", "Caja", "Limpio", "Resaltado", "Karaoke", "Impacto", "Neón"]);
  await userEvent.click(within(grupo).getByRole("button", { name: "Karaoke" }));
  expect(alCambiar.mock.calls.at(-1)![0].subtitulos.estilo).toBe("karaoke");
});

test("en Estilo se eligen los efectos: transición, grano y rótulo del predicador", async () => {
  const alCambiar = vi.fn();
  render(<Prueba alCambiar={alCambiar} />);
  await userEvent.click(screen.getByRole("tab", { name: "Estilo" }));
  await userEvent.click(within(screen.getByRole("group", { name: "Transición" })).getByRole("button", { name: "Luz" }));
  expect(alCambiar.mock.calls.at(-1)![0].efectos.transicion).toBe("luz");
  await userEvent.click(screen.getByRole("switch", { name: "Grano de película" }));
  expect(alCambiar.mock.calls.at(-1)![0].efectos.grano).toBe(!base.efectos.grano);
  await userEvent.click(screen.getByRole("switch", { name: "Nombre del predicador" }));
  expect(alCambiar.mock.calls.at(-1)![0].efectos.rotulo).toBe(!base.efectos.rotulo);
});

describe("Publicar", () => {
  const conRedes = { ...base, redes: { instagram: { texto: "Texto IG", hashtags: ["#fe"] }, tiktok: { texto: "Texto TT", hashtags: ["#oracion"] },
    facebook: { texto: "Texto FB" }, youtube: { titulo: "Título YT", texto: "Texto YT" } } };
  function PruebaRedes({ alCambiar }: { alCambiar: (c: ClipSpec) => void }) {
    const [c, setC] = useState<ClipSpec>(conRedes);
    return <Inspector clip={c} avisos={[]} alCambiar={(n) => { setC(n); alCambiar(n); }} />;
  }

  test("cada red tiene su texto; YouTube además su título", async () => {
    render(<PruebaRedes alCambiar={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: "Publicar" }));
    expect(screen.getByLabelText("Texto para Instagram")).toHaveValue("Texto IG");
    await userEvent.click(within(screen.getByRole("group", { name: "Red" })).getByRole("button", { name: "TikTok" }));
    expect(screen.getByLabelText("Texto para TikTok")).toHaveValue("Texto TT");
    await userEvent.click(within(screen.getByRole("group", { name: "Red" })).getByRole("button", { name: "YouTube Shorts" }));
    expect(screen.getByLabelText("Título para YouTube Shorts")).toHaveValue("Título YT");
  });

  test("pasarse del límite marca el campo y el contador en rojo", async () => {
    render(<PruebaRedes alCambiar={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: "Publicar" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Red" })).getByRole("button", { name: "YouTube Shorts" }));
    const titulo = screen.getByLabelText("Título para YouTube Shorts");
    fireEvent.change(titulo, { target: { value: "x".repeat(105) } });
    expect(titulo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("105 / 100")).toHaveClass("pasado");
  });

  test("Copiar deja en el portapapeles el texto y los hashtags", async () => {
    const escribir = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText: escribir }, configurable: true });
    render(<PruebaRedes alCambiar={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: "Publicar" }));
    await userEvent.click(screen.getByRole("button", { name: /Copiar para Instagram/ }));
    expect(escribir).toHaveBeenCalledWith("Texto IG\n\n#fe");
    expect(await screen.findByText("Copiado")).toBeInTheDocument();
  });
});

test("un versículo que quedó fuera del corte lo avisa", async () => {
  const c = { ...base, versiculos: [{ ...base.versiculos[0], activo: false, fuera: true }] };
  render(<Inspector clip={c} avisos={[]} alCambiar={() => {}} />);
  expect(screen.getByText(/Quedó fuera del corte/)).toBeInTheDocument();
});
