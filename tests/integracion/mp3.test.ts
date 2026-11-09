import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { codificarMp3 } from "../../src/main/entregas/mp3";

test("MP3 real: −16 LUFS (±1), pico ≤ −1 dBTP, 128 kbps, etiquetas y carátula", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-mp3-"));
  const voz = join(dir, "voz.m4a");
  // Voz simulada bajita (−30 dB aprox.) con variaciones.
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=12", "-f", "lavfi", "-i", "sine=f=330:d=12",
    "-filter_complex", "[0][1]amix=inputs=2,volume=0.05,tremolo=f=2:d=0.6", "-c:a", "aac", voz]);
  const logo = join(dir, "logo.png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=orange:s=300x300:d=1", "-frames:v", "1", logo]);
  const salida = join(dir, "predica.mp3");
  await codificarMp3({ voz, salida, caratula: logo, titulo: "La fe que mueve", artista: "Pastor Juan", album: "Iglesia Familia", anio: "2026" });

  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", salida, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const resumen = r.slice(r.lastIndexOf("Summary:"));
  const lufs = Number(/I:\s+(-?[0-9.]+) LUFS/.exec(resumen)![1]);
  const pico = Number(/Peak:\s+(-?[0-9.]+) dBFS/.exec(resumen)![1]);
  expect(lufs).toBeGreaterThanOrEqual(-17);
  expect(lufs).toBeLessThanOrEqual(-15);
  expect(pico).toBeLessThanOrEqual(-1);
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format_tags:stream=codec_name,bit_rate,codec_type", "-of", "json", salida], { encoding: "utf8" }));
  expect(info.format.tags.title).toBe("La fe que mueve");
  expect(info.format.tags.artist).toBe("Pastor Juan");
  expect(info.format.tags.album).toBe("Iglesia Familia");
  const audio = info.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  expect(audio.codec_name).toBe("mp3");
  expect(Number(audio.bit_rate)).toBe(128000);
  expect(info.streams.some((s: { codec_type: string }) => s.codec_type === "video")).toBe(true); // carátula
  writeFileSync(join(dir, "ok"), "");
}, 60_000);
