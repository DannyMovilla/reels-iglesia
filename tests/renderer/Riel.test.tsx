import { render, screen } from "@testing-library/react";
import { Riel } from "../../src/renderer/componentes/Riel";

test("Riel marca la sección actual y deshabilita lo que viene pronto", () => {
  render(<Riel actual="predicas" alCambiar={() => {}} />);
  expect(screen.getByRole("link", { name: "Prédicas" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Canciones" })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("link", { name: "Con IA" })).toHaveAttribute("aria-disabled", "true");
});
