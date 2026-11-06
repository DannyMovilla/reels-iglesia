// yt-dlp simulado para las pruebas. Modo con FALSO_YTDLP_MODO: ok | privado | no-video | sin-red | lento.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
const salida = args[args.indexOf("-o") + 1];
const carpeta = salida.slice(0, salida.lastIndexOf("/") >= 0 ? salida.lastIndexOf("/") : salida.lastIndexOf("\\"));
const modo = process.env.FALSO_YTDLP_MODO ?? "ok";
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
if (modo === "privado") { console.error("ERROR: [facebook] 123: This video is private. Login required"); process.exit(1); }
if (modo === "no-video") { console.error("ERROR: Unsupported URL: https://example.com/nada"); process.exit(1); }
if (modo === "sin-red") { console.error("ERROR: [generic] Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>"); process.exit(1); }
const parcial = join(carpeta, "Culto dominical.mp4.part");
writeFileSync(parcial, "x");
for (const p of [0.5, 25.0, 50.3, 99.9, 100]) {
  console.log(`[download]  ${p.toFixed(1)}% of  120.00MiB at  5.00MiB/s ETA 00:10`);
  await esperar(modo === "lento" ? 1500 : 10);
}
const final = join(carpeta, "Culto dominical.mp4");
writeFileSync(final, "video");
console.log(final);
