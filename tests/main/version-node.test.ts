import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

const RAIZ = resolve(__dirname, "../..");

/** El CLI de HyperFrames se ejecuta con el Node que trae Electron (ELECTRON_RUN_AS_NODE) y exige Node >= 22. */
test("el Node que trae Electron cumple lo que pide HyperFrames", () => {
  const exigido = JSON.parse(readFileSync(join(RAIZ, "node_modules/hyperframes/package.json"), "utf8")).engines?.node ?? ">=22";
  const minimo = Number(/(\d+)/.exec(exigido)![1]);
  const electron = join(RAIZ, "node_modules/electron/dist/electron.exe");
  const version = execFileSync(electron, ["-e", "process.stdout.write(process.versions.node)"], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8",
  });
  expect(Number(version.split(".")[0])).toBeGreaterThanOrEqual(minimo);
});
