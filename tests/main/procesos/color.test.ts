import { expect, test } from "vitest";
import { argsMedirColor, promediosDesde } from "../../../src/main/procesos/color";

test("20 cuadros del tramo, cada uno reducido a un píxel RGB", () => {
  expect(argsMedirColor("C:/v/culto (1).mp4", 100, 140)).toEqual([
    "-v", "error", "-ss", "100.000", "-t", "40.000", "-i", "C:/v/culto (1).mp4",
    "-vf", "fps=0.5,scale=1:1:flags=area", "-frames:v", "20", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ]);
});

test("los bytes RGB se leen de a tres", () => {
  expect(promediosDesde(Buffer.from([200, 180, 100, 210, 190, 110, 7]))).toEqual([[200, 180, 100], [210, 190, 110]]);
});
