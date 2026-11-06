// Simula `claude -p --output-format json` para las pruebas.
// FALSO_CLAUDE_MODO: ok | invalido-luego-ok | sin-sesion. FALSO_CLAUDE_CONTADOR: archivo donde contar llamadas.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const modo = process.env.FALSO_CLAUDE_MODO ?? "ok";
const contador = process.env.FALSO_CLAUDE_CONTADOR;
let n = 1;
if (contador) {
  n = (existsSync(contador) ? Number(readFileSync(contador, "utf8")) : 0) + 1;
  writeFileSync(contador, String(n));
}
let entrada = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => (entrada += d));
process.stdin.on("end", () => {
  if (entrada.includes("REEL DE VERSÍCULO")) {
    const r = JSON.parse(readFileSync(join(aqui, "respuesta-versiculo.json"), "utf8"));
    if (modo === "versiculo-vacio") r.ref = "";
    console.log(JSON.stringify({ type: "result", is_error: false, result: "Aquí está:\n```json\n" + JSON.stringify(r) + "\n```" }));
    return;
  }
  if (!entrada.includes("Transcripción:")) {
    console.log(JSON.stringify({ type: "result", is_error: true, result: "Prompt vacío" }));
    process.exit(1);
  }
  if (modo === "colgado") {
    setInterval(() => {}, 1000); // nunca responde
    return;
  }
  if (modo === "invalido-siempre") {
    console.log(JSON.stringify({ type: "result", is_error: false, result: '[{"titulo": 5}]' }));
    return;
  }
  if (modo === "vacio") {
    console.log(JSON.stringify({ type: "result", is_error: false, result: "[]" }));
    return;
  }
  if (modo === "sin-sesion") {
    console.log(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }));
    process.exit(1);
  }
  let clips = readFileSync(join(aqui, "respuesta-ok.json"), "utf8");
  if (modo === "corto") {
    // Para el video de prueba de ~20 s: un clip que cubre todo el video.
    const lista = JSON.parse(clips);
    lista[0].inicio = "0:00:00";
    lista[0].fin = "0:00:30";
    lista[0].intro_frase = "la fidelidad de Dios no depende de nuestras circunstancias";
    lista[0].versiculos = [{ ref: "Romanos 8:28", cita: "todas las cosas ayudan a bien" }];
    clips = JSON.stringify([lista[0]]);
  }
  const resultado = modo === "invalido-luego-ok" && n === 1 ? "Lo siento, no pude." : "Aquí van los clips:\n```json\n" + clips + "\n```\nBendiciones";
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: resultado }));
});
