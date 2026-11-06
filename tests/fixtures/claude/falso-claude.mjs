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
  if (!entrada.includes("Transcripción:")) {
    console.log(JSON.stringify({ type: "result", is_error: true, result: "Prompt vacío" }));
    process.exit(1);
  }
  if (modo === "sin-sesion") {
    console.log(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }));
    process.exit(1);
  }
  const clips = readFileSync(join(aqui, "respuesta-ok.json"), "utf8");
  const resultado = modo === "invalido-luego-ok" && n === 1 ? "Lo siento, no pude." : "Aquí van los clips:\n```json\n" + clips + "\n```\nBendiciones";
  console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: resultado }));
});
