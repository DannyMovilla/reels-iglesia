import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Predicas } from "../../src/renderer/pantallas/Predicas";
import type { Proyecto } from "../../src/shared/tipos";

const proyecto: Proyecto = {
  id: "p1", nombre: "Culto dominical", creado: "2026-11-09T10:00:00Z", estado: "listo",
  video: { ruta: "C:/videos/culto.mp4", tamano: 1, modificado: 0, duracion: 4000 }, rango: { inicio: 600, fin: 3000 },
  pasos: { transcripcion: { estado: "ok" }, audio: { estado: "ok" }, caras: { estado: "ok" }, analisis: { estado: "ok" } },
};

function api() {
  (window as unknown as { reels: unknown }).reels = {
    listarProyectos: vi.fn(async () => [proyecto]),
    alCambiarTareas: () => () => {},
    urlVideo: (id: string) => `http://127.0.0.1:1/c/proyecto/${id}`,
  };
}

test("plan 9: cada prédica muestra su duración y una portada de la prédica", async () => {
  api();
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  expect(await screen.findByText("Prédica de 40 min")).toBeInTheDocument();
  const video = document.querySelector(".proyecto video") as HTMLVideoElement;
  expect(video.getAttribute("src")).toBe("http://127.0.0.1:1/c/proyecto/p1#t=620");
  expect(video.muted).toBe(true);
});

test("plan 9: sin video la portada queda lisa", async () => {
  api();
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  await screen.findByText("Culto dominical");
  fireEvent.error(document.querySelector(".proyecto video")!);
  expect(document.querySelector(".proyecto video")).toBeNull();
  expect(document.querySelector(".proyecto .portada-vacia")).not.toBeNull();
});

test("revisión plan 9: una prédica de menos de un minuto dice «Prédica de 1 min»", async () => {
  (window as unknown as { reels: unknown }).reels = {
    listarProyectos: vi.fn(async () => [{ ...proyecto, rango: { inicio: 0, fin: 20 } }]), alCambiarTareas: () => () => {}, urlVideo: () => "",
  };
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  expect(await screen.findByText("Prédica de 1 min")).toHaveClass("duracion-predica");
});

test("plan 10: cada tarjeta dice cuánto ocupa y si falta el video", async () => {
  (window as unknown as { reels: unknown }).reels = {
    listarProyectos: vi.fn(async () => [{ ...proyecto, videoDisponible: false }]),
    alCambiarTareas: () => () => {},
    urlVideo: vi.fn(() => "http://127.0.0.1:1/x"),
    espacioProyectos: vi.fn(async () => ({ p1: 1_234_567_890 })),
  };
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  expect(await screen.findByText("1,2 GB")).toBeInTheDocument();
  expect(screen.getByText("Video no encontrado")).toBeInTheDocument();
  expect(document.querySelector(".proyecto video")).toBeNull();
});

test("plan 10: borrar una prédica pide confirmación con lo que se va y recarga", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  let lista = [proyecto];
  const api = {
    listarProyectos: vi.fn(async () => lista),
    alCambiarTareas: () => () => {},
    urlVideo: () => "",
    espacioProyectos: vi.fn(async () => ({})),
    resumenBorrado: vi.fn(async () => ({ clips: 6, reels: 4, bytes: 1_200_000_000 })),
    borrarProyecto: vi.fn(async () => { lista = []; }),
  };
  (window as unknown as { reels: unknown }).reels = api;
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Más opciones de Culto dominical" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Borrar prédica" }));
  expect(await screen.findByText("Se van a la Papelera la transcripción, 6 clips, 4 reels exportados y las frases (1,2 GB). El video original del culto no se borra.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(api.borrarProyecto).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Más opciones de Culto dominical" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Borrar prédica" }));
  await userEvent.click(await screen.findByRole("button", { name: "Borrar" }));
  expect(api.borrarProyecto).toHaveBeenCalledWith("p1");
  expect(await screen.findByText("Todavía no hay prédicas")).toBeInTheDocument();
});

test("plan 10: si no se puede borrar, el error se ve en el aviso", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  (window as unknown as { reels: unknown }).reels = {
    listarProyectos: vi.fn(async () => [proyecto]), alCambiarTareas: () => () => {}, urlVideo: () => "",
    resumenBorrado: vi.fn(async () => ({ clips: 1, reels: 0, bytes: 1000 })),
    borrarProyecto: vi.fn(async () => { throw new Error("Error invoking remote method 'datos:borrarProyecto': Error: Espera a que termine lo que está haciendo esta prédica."); }),
  };
  render(<Predicas alAbrir={() => {}} alNueva={() => {}} />);
  await userEvent.click(await screen.findByRole("button", { name: "Más opciones de Culto dominical" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Borrar prédica" }));
  await userEvent.click(await screen.findByRole("button", { name: "Borrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Espera a que termine lo que está haciendo esta prédica.");
});
