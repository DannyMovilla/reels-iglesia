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
  if (entrada.includes("ESTILO DE UN REEL")) {
    // Comprueba que pidieron permiso para leer los cuadros y que los cuadros existen.
    const i = process.argv.indexOf("--add-dir");
    const carpeta = i >= 0 ? process.argv[i + 1] : "";
    const lee = process.argv.includes("--allowedTools") && process.argv.includes("Read") && modo !== "estilo-ciego";
    const cuadros = [...entrada.matchAll(/^- (.+cuadro-\d+\.jpg)$/gm)].map((m) => m[1]).filter((c) => carpeta && c.startsWith(carpeta));
    const r = { subtitulos: "karaoke", tamano: "L", altura: 0.7, fuente_titulos: "montserrat", fuente_subtitulos: "inventada", animo: "victoria", intensidad: "fuerte", look: "cine",
      cuadros_vistos: lee ? cuadros.filter((c) => existsSync(c)).length : 0,
      explicacion: lee && cuadros.length && cuadros.every((c) => existsSync(c)) ? `Miré ${cuadros.length} cuadros.` : "No pude mirar los cuadros." };
    console.log(JSON.stringify({ type: "result", is_error: false, result: JSON.stringify(r) }));
    return;
  }
  if (entrada.includes("TRADUCCIÓN DE SUBTÍTULOS")) {
    if (modo === "traduccion-sin-sesion") {
      console.log(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }));
      process.exit(1);
    }
    if (modo === "traduccion-error-primera" && n === 1) {
      console.error("Error de conexión");
      process.exit(1);
    }
    if (modo === "traduccion-lenta") {
      setInterval(() => {}, 1000); // nunca responde (para cancelar)
      return;
    }
    // Devuelve cada bloque con el código del idioma delante; "traduccion-corta" se come el último.
    const idioma = /idioma: (\w+)/.exec(entrada)?.[1] ?? "xx";
    let bloques = JSON.parse(entrada.slice(entrada.indexOf("Bloques (JSON):") + "Bloques (JSON):".length));
    bloques = bloques.map((b) => ({ n: b.n, texto: `[${idioma}] ${b.texto}` }));
    if (modo === "traduccion-corta") bloques = bloques.slice(0, -1);
    console.log(JSON.stringify({ type: "result", is_error: false, result: "```json" + String.fromCharCode(10) + JSON.stringify(bloques) + String.fromCharCode(10) + "```" }));
    return;
  }
  if (entrada.includes("FRASES DE LA PRÉDICA")) {
    if (modo === "frases-invalido-luego-ok" && n === 1) {
      console.log(JSON.stringify({ type: "result", is_error: false, result: "Estas son mis frases favoritas, sin JSON." }));
      return;
    }
    if (modo === "frases-inventadas") {
      const r = [{ texto: "El amor de Dios nunca falla aunque el mundo se caiga", en: "0:00:10" }];
      console.log(JSON.stringify({ type: "result", is_error: false, result: JSON.stringify(r) }));
      return;
    }
    if (modo === "frases-lenta") {
      setTimeout(() => console.log(JSON.stringify({ type: "result", is_error: false, result: "[]" })), 5000);
      return;
    }
    const r = readFileSync(join(aqui, "respuesta-frases.json"), "utf8").trim();
    console.log(JSON.stringify({ type: "result", is_error: false, result: "Aquí están:" + String.fromCharCode(10) + "```json" + String.fromCharCode(10) + r + String.fromCharCode(10) + "```" }));
    return;
  }
  if (entrada.includes("CAPÍTULOS DE UNA PRÉDICA")) {
    const r = readFileSync(join(aqui, "respuesta-capitulos.json"), "utf8").trim();
    console.log(JSON.stringify({ type: "result", is_error: false, result: "```json" + String.fromCharCode(10) + r + String.fromCharCode(10) + "```" }));
    return;
  }
  if (entrada.includes("CAMBIOS DE UN CLIP")) {
    if (modo === "cambios-invalido") {
      console.log(JSON.stringify({ type: "result", is_error: false, result: "No sé qué hacer." }));
      return;
    }
    const r = readFileSync(join(aqui, "respuesta-cambios.json"), "utf8");
    console.log(JSON.stringify({ type: "result", is_error: false, result: "Listo:\n```json\n" + r.trim() + "\n```" }));
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
