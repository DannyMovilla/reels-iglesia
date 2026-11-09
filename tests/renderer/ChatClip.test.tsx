import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { ChatClip, type EntradaChat } from "../../src/renderer/componentes/ChatClip";
import type { ClipSpec } from "../../src/shared/tipos";
import { PLAN3 } from "../ayuda/plan3";

const clip: ClipSpec = {
  id: "c", titulo: "T", gancho: "Original", ganchosAlternativos: [], categoria: "Esperanza", inicio: 10, fin: 70, apertura: null, palabrasClave: [],
  versiculos: [], puntaje: 80, razon: "", descripcion: "", hashtags: [], encuadre: { modo: "auto", x: 0.5, zoom: 1.25 },
  subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.74 }, ...PLAN3, cierre: true, formatos: ["9:16"], estado: "sugerido",
};

function Prueba({ alAplicar }: { alAplicar: (c: ClipSpec) => void }) {
  const [c, setC] = useState(clip);
  const [h, setH] = useState<EntradaChat[]>([]);
  return <ChatClip proyectoId="p" clip={c} historial={h} alHistorial={setH} alAplicar={(n) => { setC(n); alAplicar(n); }} />;
}

test("un pedido muestra «pensando», aplica el cambio con su resumen y se puede deshacer", async () => {
  let responder: (v: unknown) => void = () => {};
  const pedirCambios = vi.fn(() => new Promise((r) => { responder = r; }));
  (window as unknown as { reels: unknown }).reels = { pedirCambios };
  const alAplicar = vi.fn();
  render(<Prueba alAplicar={alAplicar} />);
  await userEvent.click(screen.getByRole("button", { name: "Menos de 60 segundos" }));
  expect(screen.getByLabelText("¿Qué quieres cambiar?")).toHaveValue("Hazlo de menos de 60 segundos");
  await userEvent.click(screen.getByRole("button", { name: "Pedir a Claude" }));
  expect(screen.getByText("Claude está pensando…")).toBeInTheDocument();
  expect(pedirCambios).toHaveBeenCalledWith("p", clip, "Hazlo de menos de 60 segundos", []);
  responder({ clip: { ...clip, fin: 60, gancho: "Nuevo" }, resumen: "Lo dejé en 50 segundos.", avisos: ["No encontré la frase de apertura dentro del clip; dejé la de antes."] });
  expect(await screen.findByText("Lo dejé en 50 segundos.")).toBeInTheDocument();
  expect(screen.getByText(/No encontré la frase de apertura/)).toBeInTheDocument();
  expect(alAplicar).toHaveBeenLastCalledWith(expect.objectContaining({ fin: 60, gancho: "Nuevo" }));
  expect(screen.getByLabelText("¿Qué quieres cambiar?")).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(alAplicar).toHaveBeenLastCalledWith(expect.objectContaining({ fin: 70, gancho: "Original" }));
  expect(screen.getByText("Deshecho")).toBeInTheDocument();
});

test("el segundo pedido lleva el historial; un error se muestra en español", async () => {
  const pedirCambios = vi.fn()
    .mockResolvedValueOnce({ clip: { ...clip, gancho: "Uno" }, resumen: "Cambié el gancho.", avisos: [] })
    .mockRejectedValueOnce(new Error("Error invoking remote method 'claude:cambios': Error: Claude tardó demasiado en responder."));
  (window as unknown as { reels: unknown }).reels = { pedirCambios };
  render(<Prueba alAplicar={() => {}} />);
  await userEvent.type(screen.getByLabelText("¿Qué quieres cambiar?"), "otro gancho");
  await userEvent.click(screen.getByRole("button", { name: "Pedir a Claude" }));
  await screen.findByText("Cambié el gancho.");
  await userEvent.type(screen.getByLabelText("¿Qué quieres cambiar?"), "más corto");
  await userEvent.click(screen.getByRole("button", { name: "Pedir a Claude" }));
  expect(pedirCambios).toHaveBeenLastCalledWith("p", expect.objectContaining({ gancho: "Uno" }), "más corto", [{ pedido: "otro gancho", resumen: "Cambié el gancho." }]);
  expect(await screen.findByRole("alert")).toHaveTextContent("Claude tardó demasiado en responder.");
  expect(screen.getByLabelText("¿Qué quieres cambiar?")).toHaveValue("más corto");
});

test("revisión I6: lo que la persona edita mientras Claude piensa (o después) no se pierde al aplicar ni al deshacer", async () => {
  let responder: (v: unknown) => void = () => {};
  (window as unknown as { reels: unknown }).reels = { pedirCambios: vi.fn(() => new Promise((r) => { responder = r; })) };
  const alAplicar = vi.fn();
  function Externo() {
    const [c, setC] = useState(clip);
    const [h, setH] = useState<EntradaChat[]>([]);
    return (
      <>
        <button type="button" onClick={() => setC((x) => ({ ...x, titulo: `${x.titulo} editado` }))}>Editar título</button>
        <span data-testid="estado">{JSON.stringify({ titulo: c.titulo, gancho: c.gancho, fin: c.fin })}</span>
        <ChatClip proyectoId="p" clip={c} historial={h} alHistorial={setH} alAplicar={(n) => { setC(n); alAplicar(n); }} />
      </>
    );
  }
  render(<Externo />);
  await userEvent.type(screen.getByLabelText("¿Qué quieres cambiar?"), "otro gancho");
  await userEvent.click(screen.getByRole("button", { name: "Pedir a Claude" }));
  await userEvent.click(screen.getByRole("button", { name: "Editar título" })); // mientras Claude piensa
  responder({ clip: { ...clip, gancho: "Nuevo" }, resumen: "Cambié el gancho.", avisos: [] });
  await screen.findByText("Cambié el gancho.");
  expect(JSON.parse(screen.getByTestId("estado").textContent!)).toEqual({ titulo: "T editado", gancho: "Nuevo", fin: 70 });
  await userEvent.click(screen.getByRole("button", { name: "Editar título" })); // después del cambio
  await userEvent.click(screen.getByRole("button", { name: "Deshacer" }));
  expect(JSON.parse(screen.getByTestId("estado").textContent!)).toEqual({ titulo: "T editado editado", gancho: "Original", fin: 70 });
});
