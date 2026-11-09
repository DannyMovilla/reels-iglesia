import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { argsVozLimpia } from "../../src/main/procesos/audio";
import type { NivelVoz } from "../../src/shared/tipos";

test("FFmpeg real acepta los filtros de los tres niveles de voz", () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-voz-"));
  const video = join(dir, "tono.mp4");
  // 3 s de voz simulada (tono) con ruido, y un cuadro negro.
  const g = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=220:d=3", "-f", "lavfi", "-i", "anoisesrc=d=3:a=0.05",
    "-f", "lavfi", "-i", "color=c=black:s=64x64:d=3", "-filter_complex", "[0:a][1:a]amix=inputs=2[a]", "-map", "2:v", "-map", "[a]", "-shortest", video], { encoding: "utf8" });
  expect(g.status, g.stderr).toBe(0);
  for (const nivel of ["ligera", "limpia", "podcast"] as NivelVoz[]) {
    const salida = join(dir, `voz-${nivel}.m4a`);
    const r = spawnSync("ffmpeg", argsVozLimpia(video, 0.5, 2.5, salida, nivel), { encoding: "utf8" });
    expect(r.status, `${nivel}: ${r.stderr}`).toBe(0);
    expect(existsSync(salida)).toBe(true);
  }
}, 60_000);
