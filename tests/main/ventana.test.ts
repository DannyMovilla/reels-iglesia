import { EventEmitter } from "node:events";
import { expect, test, vi } from "vitest";
import { protegerNavegacion } from "../../src/main/ventana";

test("soltar un archivo o seguir un enlace no reemplaza la app", () => {
  const wc = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() });
  protegerNavegacion(wc as never);
  const evento = { preventDefault: vi.fn() };
  wc.emit("will-navigate", evento, "file:///C:/culto.mp4");
  expect(evento.preventDefault).toHaveBeenCalled();
  const manejador = wc.setWindowOpenHandler.mock.calls[0][0];
  expect(manejador({ url: "https://x" })).toEqual({ action: "deny" });
});
