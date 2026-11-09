import { execFile } from "node:child_process";
import { balanceDesde } from "@shared/reel/color";

/** FFmpeg: 20 cuadros repartidos en el tramo, cada uno reducido a su color promedio (un píxel RGB). */
export function argsMedirColor(video: string, inicio: number, fin: number): string[] {
  const dur = Math.max(1, fin - inicio);
  return [
    "-v", "error", "-ss", inicio.toFixed(3), "-t", dur.toFixed(3), "-i", video,
    "-vf", `fps=${Math.round((20 / dur) * 1000) / 1000},scale=1:1:flags=area`, "-frames:v", "20", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ];
}

/** Bytes RGB (de a tres) → colores promedio de cada cuadro. */
export function promediosDesde(b: Buffer): [number, number, number][] {
  const r: [number, number, number][] = [];
  for (let i = 0; i + 2 < b.length; i += 3) r.push([b[i], b[i + 1], b[i + 2]]);
  return r;
}

/** Balance de blancos del video en ese tramo (ganancias R, G, B) para «Corregir tono amarillo». */
export function medirBalance(video: string, inicio: number, fin: number): Promise<[number, number, number]> {
  return new Promise((resolver, rechazar) => {
    execFile("ffmpeg", argsMedirColor(video, inicio, fin), { encoding: "buffer", maxBuffer: 1 << 20, windowsHide: true }, (err, stdout) => {
      const promedios = promediosDesde(stdout ?? Buffer.alloc(0));
      if (err || !promedios.length) rechazar(new Error("No pude medir el color del video. Revisa que el video original siga en su lugar."));
      else resolver(balanceDesde(promedios));
    });
  });
}
