import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { CopiarEstilo } from "../../src/renderer/componentes/CopiarEstilo";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const clip: ClipSpec = {
  id: "c", titulo: "T", gancho: "G", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 50, apertura: null, palabrasClave: [],
  versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
};
const estilo = { subtitulos: "karaoke", tamano: "l", altura: 0.7, fuenteTitulos: "montserrat", fuenteSubtitulos: "figtree", animo: "victoria", intensidad: "fuerte", look: "cine", explicacion: "Ritmo rápido y subtítulos grandes." };

test("analiza un reel, muestra lo propuesto y lo aplica al clip o lo guarda como estilo", async () => {
  const copiarEstilo = vi.fn(async () => ({ estilo, avisos: ["El video no tiene audio: no pude medir el volumen."] }));
  (window as unknown as { reels: unknown }).reels = { copiarEstilo };
  const alAplicar = vi.fn(), alGuardarEstilo = vi.fn();
  render(<CopiarEstilo clip={clip} alAplicar={alAplicar} alGuardarEstilo={alGuardarEstilo} />);
  await userEvent.click(screen.getByRole("button", { name: "Elegir un reel de referencia" }));
  expect(copiarEstilo).toHaveBeenCalledWith(clip);
  expect(await screen.findByText("Ritmo rápido y subtítulos grandes.")).toBeInTheDocument();
  expect(screen.getByText(/Cortes: Fuerte · Color: Cine/)).toBeInTheDocument();
  expect(screen.getByText("El video no tiene audio: no pude medir el volumen.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Aplicar a este clip" }));
  expect(alAplicar.mock.calls[0][0]).toMatchObject({ titulo: "T", gancho: "G", subtitulos: { estilo: "karaoke" }, color: { look: "cine" } });
  await userEvent.click(screen.getByRole("button", { name: "Guardar como estilo de la iglesia" }));
  expect(alGuardarEstilo.mock.calls[0][0].cortes.intensidad).toBe("fuerte");
});

test("si la persona cancela no pasa nada; un error se muestra en español", async () => {
  const copiarEstilo = vi.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Error invoking remote method 'x': Error: No pude leer ese video. Prueba con un MP4 o MOV."));
  (window as unknown as { reels: unknown }).reels = { copiarEstilo };
  render(<CopiarEstilo clip={clip} alAplicar={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Elegir un reel de referencia" }));
  expect(screen.queryByLabelText("Estilo propuesto")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Elegir un reel de referencia" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No pude leer ese video. Prueba con un MP4 o MOV.");
});
