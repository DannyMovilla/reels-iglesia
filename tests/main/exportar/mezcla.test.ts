import { expect, test } from "vitest";
import { argsMedir, argsNormalizar, leerMedicion } from "../../../src/main/exportar/mezcla";

const SALIDA_LOUDNORM = `[Parsed_loudnorm_0 @ 0000] \n{\n\t"input_i" : "-10.09",\n\t"input_tp" : "-0.97",\n\t"input_lra" : "4.60",\n\t"input_thresh" : "-21.25",\n\t"output_i" : "-13.93",\n\t"target_offset" : "-0.07"\n}\n`;

test("primera pasada: medir con loudnorm", () => {
  expect(argsMedir("C:/r/reel.mp4")).toEqual(["-hide_banner", "-nostats", "-i", "C:/r/reel.mp4", "-vn", "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"]);
});

test("lee la medición del JSON que imprime loudnorm", () => {
  expect(leerMedicion(SALIDA_LOUDNORM)).toEqual({ i: "-10.09", tp: "-0.97", lra: "4.60", thresh: "-21.25", offset: "-0.07" });
  expect(leerMedicion("sin json")).toBeNull();
});

test("segunda pasada: −14 LUFS lineal con la medición, limitador y video sin recodificar", () => {
  expect(argsNormalizar("C:/r/reel.mp4", "C:/r/reel.norm.mp4", { i: "-10.09", tp: "-0.97", lra: "4.60", thresh: "-21.25", offset: "-0.07" })).toEqual([
    "-v", "error", "-y", "-i", "C:/r/reel.mp4", "-c:v", "copy",
    "-af", "loudnorm=I=-14:TP=-1:LRA=11:measured_I=-10.09:measured_TP=-0.97:measured_LRA=4.60:measured_thresh=-21.25:offset=-0.07:linear=true,alimiter=limit=0.891:level=false",
    "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "C:/r/reel.norm.mp4",
  ]);
});

test("revisión C2: un reel sin pista de audio (sin música ni voz) no se normaliza y no falla", async () => {
  const { normalizarAudio } = await import("../../../src/main/exportar/mezcla");
  const llamadas: string[] = [];
  await normalizarAudio("C:/r/reel.mp4", undefined, async (cmd, args) => {
    llamadas.push(cmd);
    return cmd === "ffprobe" ? { codigo: 0, stdout: "", stderr: "" } : { codigo: 1, stdout: "", stderr: "Output file does not contain any stream" };
  });
  expect(llamadas).toEqual(["ffprobe"]);
});
