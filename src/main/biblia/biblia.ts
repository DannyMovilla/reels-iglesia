import { readFileSync } from "node:fs";
import { join } from "node:path";
import { raizApp } from "../rutas";

type Biblia = Record<string, Record<string, Record<string, string>>>;

export interface Referencia {
  libro: string;
  capitulo: number;
  desde: number;
  hasta: number;
}

let biblia: Biblia | null = null;
const cargar = (): Biblia => (biblia ??= JSON.parse(readFileSync(join(raizApp(), "resources", "biblia", "rv1909.json"), "utf8")) as Biblia);

const LIBROS = [
  "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut", "1 Samuel", "2 Samuel",
  "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras", "Nehemías", "Ester", "Job", "Salmos", "Proverbios",
  "Eclesiastés", "Cantares", "Isaías", "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós",
  "Abdías", "Jonás", "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías",
  "Mateo", "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios", "Gálatas", "Efesios",
  "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses", "1 Timoteo", "2 Timoteo", "Tito", "Filemón",
  "Hebreos", "Santiago", "1 Pedro", "2 Pedro", "1 Juan", "2 Juan", "3 Juan", "Judas", "Apocalipsis",
];

/** Abreviaturas que no son un prefijo del nombre. */
const ALIAS: Record<string, string> = {
  jn: "juan", mt: "mateo", mc: "marcos", mr: "marcos", lc: "lucas", stg: "santiago", ap: "apocalipsis",
  cantar: "cantares", cantardeloscantares: "cantares", hch: "hechos", hechosdelosapostoles: "hechos",
};

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clave = (libro: string) => sinTildes(libro).replace(/[^a-z0-9]/g, "");
const CLAVES = LIBROS.map((l) => [clave(l), l] as const);

function normalizarLibro(texto: string): string {
  let t = sinTildes(texto).replace(/\./g, " ").trim();
  t = t.replace(/^(el libro de|libro de)\s+/, "").replace(/^(san|santo|santa)\s+/, "");
  t = t.replace(/^(primera|primero|1ra|1ro|1a|1o|i)\s+(de\s+)?/, "1 ")
    .replace(/^(segunda|segundo|2da|2do|2a|2o|ii)\s+(de\s+)?/, "2 ")
    .replace(/^(tercera|tercero|3ra|3ro|3a|3o|iii)\s+(de\s+)?/, "3 ");
  t = t.replace(/^(\d)\s+(san|santo)\s+/, "$1 ");
  return t.replace(/[^a-z0-9]/g, "");
}

function buscarLibro(texto: string): string | null {
  const n = normalizarLibro(texto);
  if (!/[a-z]/.test(n)) return null;
  const numero = /^\d/.test(n) ? n[0] : "";
  const resto = numero ? n.slice(1) : n;
  const k = numero + (ALIAS[resto] ?? resto);
  const exacto = CLAVES.find(([c]) => c === k);
  if (exacto) return exacto[1];
  if (resto.length < 2) return null;
  const prefijo = CLAVES.find(([c]) => c.startsWith(k));
  if (prefijo) return prefijo[1];
  // "Salmo" → "Salmos": el nombre empieza con lo escrito sin la "s" final
  const singular = CLAVES.find(([c]) => c.replace(/s$/, "") === k);
  return singular ? singular[1] : null;
}

/** "Salmo 51:17", "1 Co 13:4-7", "Romanos 8,28", "San Juan 3:16", "Primera de Juan 4:8" */
export function parsearReferencia(ref: string): Referencia | null {
  const m = /^(.*?[A-Za-zÁÉÍÓÚáéíóúÑñ].*?)\s*(\d+)\s*[:,.]\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(ref.trim());
  if (!m) return null;
  const libro = buscarLibro(m[1]);
  if (!libro) return null;
  const desde = Number(m[3]);
  const hasta = m[4] ? Math.max(desde, Number(m[4])) : desde;
  return { libro, capitulo: Number(m[2]), desde, hasta };
}

/** Texto de la Reina-Valera 1909, o null si la referencia no existe. */
export function textoVersiculo(ref: string): string | null {
  const r = parsearReferencia(ref);
  if (!r) return null;
  const cap = cargar()[r.libro]?.[String(r.capitulo)];
  if (!cap?.[String(r.desde)]) return null;
  const partes: string[] = [];
  for (let v = r.desde; v <= r.hasta && cap[String(v)]; v++) partes.push(cap[String(v)]);
  return partes.join(" ");
}
