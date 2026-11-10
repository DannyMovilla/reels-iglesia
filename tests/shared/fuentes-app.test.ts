import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const RAIZ = resolve(__dirname, "../..");
const leer = (p: string) => readFileSync(join(RAIZ, p), "utf8");

test("plan 7: la app no pide fuentes a internet; trae Geist, Geist Mono y Fraunces incluidas", () => {
  for (const archivo of ["src/renderer/estilos/base.css", "src/renderer/index.html"]) expect(leer(archivo)).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  const main = leer("src/renderer/main.tsx");
  expect(main).toContain("@fontsource/geist-sans/latin-400.css");
  expect(main).toContain("@fontsource/geist-mono/latin-400.css");
  expect(main).toContain("@fontsource/fraunces/latin-600.css");
  expect(leer("src/renderer/estilos/tokens.css")).toMatch(/--font-ui: "Geist Sans"/);
  expect(leer("NOTICE.md")).toContain("Geist");
});

test("plan 7: el tema claro tiene su paleta y el tema se aplica antes de pintar (script en el head)", () => {
  const tokens = leer("src/renderer/estilos/tokens.css");
  expect(tokens).toMatch(/:root\[data-tema="claro"\]\s*\{[^}]*--bg-0:[^}]*color-scheme: light/);
  const html = leer("src/renderer/index.html");
  expect(html.indexOf('<script src="./tema.js"></script>')).toBeGreaterThan(-1);
  expect(html.indexOf('<script src="./tema.js"></script>')).toBeLessThan(html.indexOf("</head>"));
  // Los colores claros fijos (blanco translúcido) pasaron a variables del tema (salvo el brillo del botón dorado).
  for (const archivo of ["src/renderer/estilos/pulido.css", "src/renderer/estilos/base.css"]) {
    const lineas = leer(archivo).split(/?
/).filter((l) => !l.includes(".btn.primario"));
    expect(lineas.join("
")).not.toMatch(/rgba\(255, *255, *255/);
  }
});
