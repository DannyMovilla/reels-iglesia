import { expect, test } from "vitest";
import { argsVozLimpia } from "../../../src/main/procesos/audio";

test("voz limpia del tramo de la prédica: sin graves de ruido, sin siseo, volumen parejo", () => {
  expect(argsVozLimpia("C:/Videos/Culto #45 (1280p).mp4", 6284, 9155.5, "C:/datos/p/voz.m4a")).toEqual([
    "-v", "error", "-y", "-progress", "pipe:1", "-nostats",
    "-ss", "6284.000", "-t", "2871.500", "-i", "C:/Videos/Culto #45 (1280p).mp4",
    "-vn", "-af", "highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15",
    "-ar", "48000", "-ac", "2", "-c:a", "aac", "-b:a", "192k", "C:/datos/p/voz.m4a",
  ]);
});
