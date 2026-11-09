import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { medirBalance } from "../../src/main/procesos/color";

test("un video amarillento: el balance baja el rojo/verde o sube el azul y deja el promedio más cerca del gris", async () => {
  const dir = mkdtempSync(join(tmpdir(), "reels-color-"));
  const video = join(dir, "amarillo.mp4");
  // Video de prueba teñido de amarillo (como la luz de un templo).
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=10:duration=6",
    "-vf", "colorchannelmixer=rr=1:gg=0.95:bb=0.6", "-pix_fmt", "yuv420p", video]);
  const [r, g, b] = await medirBalance(video, 0, 6);
  expect(b).toBeGreaterThan(1);
  expect(b).toBeGreaterThan(r);
  expect(b).toBeGreaterThan(g);
  for (const x of [r, g, b]) {
    expect(x).toBeGreaterThanOrEqual(0.7);
    expect(x).toBeLessThanOrEqual(1.4);
  }
}, 60_000);
