import { expect, test } from "vitest";
import { argsMp3 } from "../../../src/main/entregas/mp3";

const m = { i: "-20.1", tp: "-3.2", lra: "6.0", thresh: "-30.5", offset: "0.4" };
const base = { voz: "C:/datos/p/voz.m4a", salida: "C:/datos/p/exportados/culto.mp3", medicion: m, titulo: 'La fe "que mueve"', artista: "Pastor Juan", album: "Iglesia Familia", anio: "2026" };

test("MP3 a −16 LUFS, 128 kbps, con etiquetas ID3 y sin carátula", () => {
  expect(argsMp3(base)).toEqual([
    "-v", "error", "-y", "-i", "C:/datos/p/voz.m4a",
    "-map", "0:a", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-20.1:measured_TP=-3.2:measured_LRA=6.0:measured_thresh=-30.5:offset=0.4:linear=true,alimiter=limit=0.891:level=false",
    "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", "-id3v2_version", "3",
    "-metadata", 'title=La fe "que mueve"', "-metadata", "artist=Pastor Juan", "-metadata", "album=Iglesia Familia", "-metadata", "date=2026",
    "C:/datos/p/exportados/culto.mp3",
  ]);
});

test("con el logo como carátula: cuadrada, sobre fondo blanco (sin negro donde era transparente)", async () => {
  const { argsCaratula } = await import("../../../src/main/entregas/mp3");
  const c = argsCaratula("C:/datos/marca/logo.webp", "C:/tmp/c.jpg");
  const filtro = c[c.indexOf("-filter_complex") + 1];
  expect(filtro).toContain("color=c=white:s=600x600");
  expect(filtro).toContain("force_original_aspect_ratio=decrease");
  expect(filtro).toContain("overlay=(W-w)/2:(H-h)/2");
  const a = argsMp3({ ...base, caratula: "C:/tmp/c.jpg" });
  expect(a.slice(3, 7)).toEqual(["-i", "C:/datos/p/voz.m4a", "-i", "C:/tmp/c.jpg"]);
  expect(a).toEqual(expect.arrayContaining(["-map", "1:v", "-c:v", "mjpeg", "-disposition:v", "attached_pic"]));
  expect(a.join(" ")).toContain("-metadata:s:v title=Album cover");
});
