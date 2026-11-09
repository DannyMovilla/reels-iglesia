import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { SelectorZona, ZonaSegura, type RedZona } from "../../src/renderer/componentes/ZonaSegura";

function Prueba() {
  const [red, setRed] = useState<RedZona>("instagram");
  return <><SelectorZona valor={red} alCambiar={setRed} /><ZonaSegura red={red} formato="9:16" /></>;
}

test("cada red dibuja su propia zona; «Sin zona segura» no dibuja nada", async () => {
  const { container } = render(<Prueba />);
  const alto = () => (container.querySelector(".zs-abajo") as HTMLElement | null)?.style.height;
  expect(alto()).toBe(`${(340 / 1920) * 100}%`);
  expect(screen.getByText("Instagram tapa estas zonas")).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Zona segura"), "tiktok");
  expect(alto()).toBe(`${(380 / 1920) * 100}%`);
  expect((container.querySelector(".zs-derecha") as HTMLElement).style.width).toBe(`${(150 / 1080) * 100}%`);
  await userEvent.selectOptions(screen.getByLabelText("Zona segura"), "ninguna");
  expect(container.querySelector(".zona-segura")).toBeNull();
});
