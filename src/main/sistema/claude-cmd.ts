import { spawnSync } from "node:child_process";

/**
 * Decide cómo ejecutar Claude Code a partir de la salida de `where claude`.
 * claude.exe (winget/instalador) se ejecuta directo; claude.cmd (npm) necesita cmd.exe porque Node no ejecuta .cmd sin shell.
 */
export function comandoClaudeDesde(salidaWhere: string): [string, string[]] {
  const rutas = salidaWhere.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exe = rutas.find((r) => r.toLowerCase().endsWith(".exe"));
  if (exe) return [exe, []];
  if (rutas.some((r) => r.toLowerCase().endsWith(".cmd"))) return ["cmd.exe", ["/d", "/c", "claude"]];
  return ["claude", []];
}

let cache: [string, string[]] | null = null;

/** Comando para Claude Code: REELS_CLAUDE_COMANDO (pruebas) o lo que encuentre `where claude`. */
export function resolverComandoClaude(): [string, string[]] {
  const propio = process.env.REELS_CLAUDE_COMANDO;
  if (propio) {
    const partes = propio.match(/"[^"]*"|\S+/g)?.map((p) => p.replace(/^"|"$/g, "")) ?? ["claude"];
    return [partes[0], partes.slice(1)];
  }
  if (process.platform !== "win32") return ["claude", []];
  if (!cache) {
    const r = spawnSync("where.exe", ["claude"], { encoding: "utf8", windowsHide: true });
    cache = comandoClaudeDesde(r.status === 0 ? r.stdout : "");
  }
  return cache;
}
