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

test("plan 5: niveles de voz (Ligera, Limpia por defecto, Podcast) y su archivo", async () => {
  const { archivoVoz, FILTRO_VOZ } = await import("../../../src/main/procesos/audio");
  const filtro = (n?: "ligera" | "limpia" | "podcast") => {
    const a = n ? argsVozLimpia("v.mp4", 0, 10, "s.m4a", n) : argsVozLimpia("v.mp4", 0, 10, "s.m4a");
    return a[a.indexOf("-af") + 1];
  };
  expect(filtro()).toBe("highpass=f=80,afftdn=nf=-25,lowpass=f=12000,dynaudnorm=f=200:g=15");
  expect(filtro("ligera")).toBe("highpass=f=80,dynaudnorm=f=200:g=15");
  expect(filtro("podcast")).toBe(`${FILTRO_VOZ.limpia},equalizer=f=3500:t=q:w=1.2:g=3,deesser=i=0.4,acompressor=threshold=-20dB:ratio=3:attack=10:release=150:makeup=2`);
  expect([archivoVoz("limpia"), archivoVoz("ligera"), archivoVoz("podcast")]).toEqual(["voz.m4a", "voz-ligera.m4a", "voz-podcast.m4a"]);
});
