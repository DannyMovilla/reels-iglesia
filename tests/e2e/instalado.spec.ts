import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");
const EXE = join(RAIZ, "dist", "win-unpacked", "Reels Iglesia.exe");

/** La app empaquetada (npm run dist:carpeta) funciona sin el repositorio: procesa y exporta un reel. */
test("la app instalada crea, procesa y exporta una prédica", async () => {
  test.skip(!existsSync(EXE), "Falta npm run dist:carpeta");
  test.setTimeout(600_000);
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const datos = mkdtempSync(join(tmpdir(), "reels instalado "));
  const app = await electron.launch({
    executablePath: EXE,
    env: {
      ...process.env, REELS_IGLESIA_DATOS: datos, REELS_VIDEO_PRUEBA: video, REELS_WHISPER_MODELO: "tiny",
      REELS_PYTHON: join(RAIZ, ".venv", "Scripts", "python.exe"),
      REELS_CLAUDE_COMANDO: `node "${join(RAIZ, "tests/fixtures/claude/falso-claude.mjs")}"`, FALSO_CLAUDE_MODO: "corto",
    },
  });
  const v = await app.firstWindow();
  await v.getByRole("button", { name: "Nueva prédica" }).first().click();
  await v.getByRole("button", { name: /Elige el video del culto/ }).click();
  await expect(v.getByLabel("Fin de la prédica")).not.toHaveValue("");
  await v.getByRole("button", { name: "Procesar prédica" }).click();
  await expect(v.getByRole("list", { name: "Proceso" }).locator(".paso.ok")).toHaveCount(4, { timeout: 300_000 });
  await v.getByRole("tab", { name: "Versículo" }).click();
  await v.getByLabel("Texto RVR1960 de Romanos 8:28").fill("Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.");
  await v.getByRole("button", { name: "Confirmar texto" }).click();
  await v.getByRole("tab", { name: "Publicar" }).click();
  await v.getByRole("group", { name: "Formatos" }).getByRole("button", { name: /4:5/ }).click();
  await v.waitForTimeout(700);
  await v.getByRole("button", { name: "Exportar este clip" }).click();
  await expect(v.getByText("1 reel listo")).toBeVisible({ timeout: 400_000 });
  const proyecto = readdirSync(join(datos, "proyectos"))[0];
  expect(readdirSync(join(datos, "proyectos", proyecto, "exportados")).some((a) => a.endsWith("-9x16.mp4"))).toBe(true);

  // Plan 10: el registro se crea en la carpeta de datos y Ajustes muestra la versión.
  const registros = join(datos, "registros");
  const hoy = readdirSync(registros).find((f) => /^reels-\d{4}-\d{2}-\d{2}\.log$/.test(f))!;
  const registro = readFileSync(join(registros, hoy), "utf8");
  expect(registro).toMatch(/ info app inicio 0\.2\.0 electron /);
  expect(registro).toMatch(/ info cola ok exportar /);
  await v.getByRole("link", { name: "Ajustes" }).click();
  await expect(v.getByText("Reels Iglesia 0.2.0")).toBeVisible();
  await app.close();
});
