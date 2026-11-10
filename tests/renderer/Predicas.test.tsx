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
