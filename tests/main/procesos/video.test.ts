import { expect, test } from "vitest";
import { duracionVideo } from "../../../src/main/procesos/video";

test("si FFmpeg no está instalado, el mensaje lo dice en español", async () => {
  const ejecutar = async () => { throw Object.assign(new Error("spawn ffprobe ENOENT"), { code: "ENOENT" }); };
  await expect(duracionVideo("C:/v (1).mp4", ejecutar)).rejects.toThrow("No pude leer la duración del video. ¿Está instalado FFmpeg?");
});

test("lee la duración", async () => {
  expect(await duracionVideo("v.mp4", async () => ({ codigo: 0, stdout: "9600.5\n", stderr: "" }))).toBe(9600.5);
});
