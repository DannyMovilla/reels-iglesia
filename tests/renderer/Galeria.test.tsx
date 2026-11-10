import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import gsap from "gsap";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Galeria, aislarCss, muestraGancho, muestraSub } from "../../src/renderer/componentes/Galeria";
import { ESTILOS_SUB, NOMBRE_ESTILO } from "../../src/shared/reel/estilos-sub";
import { ESTILOS_GANCHO, NOMBRE_GANCHO } from "../../src/shared/reel/gancho";
import type { EstiloSub } from "../../src/shared/tipos";

const OPCIONES = ESTILOS_SUB.map((e) => [e, NOMBRE_ESTILO[e]] as [EstiloSub, string]);
let reducido = false;

beforeEach(() => {
  reducido = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") && reducido, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

const galeria = (alCambiar = vi.fn(), valor: EstiloSub = "pop") =>
  render(<Galeria etiqueta="Estilo de subtítulos" opciones={OPCIONES} valor={valor} alCambiar={alCambiar} muestra={(e) => muestraSub(e, "#f5c542")} />);

test("una opción por estilo y la elegida marcada", () => {
  galeria(vi.fn(), "karaoke");
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(15);
  expect(screen.getByRole("radiogroup", { name: "Estilo de subtítulos" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Karaoke" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("radio", { name: "Pop" })).toHaveAttribute("aria-checked", "false");
});

test("clic en Viral lo elige", async () => {
  const alCambiar = vi.fn();
  galeria(alCambiar);
  await userEvent.click(screen.getByRole("radio", { name: "Viral" }));
  expect(alCambiar).toHaveBeenCalledWith("viral");
});

test("con las flechas se elige el siguiente y el anterior", async () => {
  const alCambiar = vi.fn();
  galeria(alCambiar, "pop");
  screen.getByRole("radio", { name: "Pop" }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(alCambiar).toHaveBeenLastCalledWith("caja");
  expect(screen.getByRole("radio", { name: "Caja" })).toHaveFocus();
  screen.getByRole("radio", { name: "Pop" }).focus();
  await userEvent.keyboard("{ArrowLeft}");
  expect(alCambiar).toHaveBeenLastCalledWith("elegante");
});

test("con movimiento reducido no se anima nada y se ve la palabra clave", () => {
  reducido = true;
  const espia = vi.spyOn(gsap, "timeline");
  const { container } = galeria();
  expect(espia).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".muestra-lienzo .clave").length).toBeGreaterThanOrEqual(15);
  expect(container.querySelectorAll(".muestra-lienzo.quieta")).toHaveLength(15);
  espia.mockRestore();
});

test("sin reducción: una línea de tiempo en bucle por muestra que se mata al desmontar", () => {
  const lineas: { kill: ReturnType<typeof vi.fn> }[] = [];
  const real = gsap.timeline.bind(gsap);
  const espia = vi.spyOn(gsap, "timeline").mockImplementation((vars) => {
    expect(vars).toMatchObject({ repeat: -1 });
    const tl = real(vars);
    const original = tl.kill.bind(tl);
    const kill = vi.fn(() => original());
    lineas.push({ kill });
    return Object.assign(tl, { kill });
  });
  const { unmount } = galeria();
  expect(lineas).toHaveLength(15);
  unmount();
  expect(lineas.every((l) => l.kill.mock.calls.length > 0)).toBe(true);
  espia.mockRestore();
});

test("el CSS de la muestra queda dentro de su lienzo", () => {
  expect(aislarCss(".sub.pop { color: red; }\n.a, .b .c { x: 1; }", ".muestra-lienzo"))
    .toBe(".muestra-lienzo .sub.pop { color: red; }\n.muestra-lienzo .a, .muestra-lienzo .b .c { x: 1; }");
});

test("muestras de gancho: una por estilo con su texto", () => {
  for (const e of ESTILOS_GANCHO) {
    const m = muestraGancho(e, "#f5c542");
    expect(m.html).toMatch(/prueba/i);
    expect(m.dur).toBeGreaterThan(1);
  }
  expect(Object.keys(NOMBRE_GANCHO)).toHaveLength(5);
});

test("volver a pintar con lo mismo no reinicia las animaciones", () => {
  const espia = vi.spyOn(gsap, "timeline");
  const props = { etiqueta: "Estilo de subtítulos", opciones: OPCIONES, valor: "pop" as EstiloSub, alCambiar: vi.fn() };
  const { rerender } = render(<Galeria {...props} muestra={(e) => muestraSub(e, "#f5c542")} />);
  expect(espia).toHaveBeenCalledTimes(15);
  rerender(<Galeria {...props} opciones={[...OPCIONES]} muestra={(e) => muestraSub(e, "#f5c542")} />);
  expect(espia).toHaveBeenCalledTimes(15);
  espia.mockRestore();
});
