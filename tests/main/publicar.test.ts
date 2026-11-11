import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const RAIZ = resolve(__dirname, "../..");

test("revisión: publicar sube un release normal (las apps no ven los borradores) a DannyMovilla/reels-iglesia", () => {
  const yml = readFileSync(join(RAIZ, "electron-builder.yml"), "utf8");
  const lineas = yml.split(/\r?\n/);
  const inicio = lineas.indexOf("publish:");
  expect(inicio).toBeGreaterThan(-1);
  const bloque: string[] = [];
  for (const l of lineas.slice(inicio + 1)) {
    if (!/^\s/.test(l)) break;
    bloque.push(l.trim());
  }
  for (const linea of ["provider: github", "owner: DannyMovilla", "repo: reels-iglesia", "releaseType: release"]) expect(bloque).toContain(linea);
  const pkg = JSON.parse(readFileSync(join(RAIZ, "package.json"), "utf8"));
  expect(pkg.scripts.publicar).toBe("electron-vite build && electron-builder --win --publish always");
  expect(pkg.version).toBe("0.2.0");
});
