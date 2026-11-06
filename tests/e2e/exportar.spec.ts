import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("exportar un clip deja un MP4 de 1080×1920 en la carpeta de la prédica", async () => {
  test.setTimeout(400_000);
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const datos = mkdtempSync(join(tmpdir(), "reels-e2e-exp-"));
  const app = await electron.launch({
    args: [join(RAIZ, "out/main/index.js")],
    env: {
      ...process.env, REELS_IGLESIA_DATOS: datos, REELS_VIDEO_PRUEBA: video, REELS_WHISPER_MODELO: "tiny",
      REELS_CLAUDE_COMANDO: `node "${join(RAIZ, "tests/fixtures/claude/falso-claude.mjs")}"`, FALSO_CLAUDE_MODO: "corto",
    },
  });
  const v = await app.firstWindow();
  await v.getByRole("button", { name: "Nueva prédica" }).first().click();
  await v.getByRole("button", { name: /Elige el video del culto/ }).click();
  await expect(v.getByLabel("Fin de la prédica")).not.toHaveValue("");
  await v.getByRole("button", { name: "Procesar prédica" }).click();
  try {
    await expect(v.getByRole("list", { name: "Proceso" }).locator(".paso.ok")).toHaveCount(4, { timeout: 240_000 });
  } catch (e) {
    console.log("PANEL:", await v.getByRole("list", { name: "Proceso" }).innerText());
    throw e;
  }

  // El versículo sin texto bloquea la exportación: se escribe y se confirma.
  await v.getByLabel("Texto RVR1960 de Romanos 8:28").fill("Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.");
  await v.getByRole("button", { name: "Confirmar texto" }).click();
  await v.getByRole("group", { name: "Formatos" }).getByRole("button", { name: /4:5/ }).click(); // solo 9:16
  await v.waitForTimeout(700);
  await v.getByRole("button", { name: "Exportar este clip" }).click();
  try {
    await expect(v.getByText("1 reel listo")).toBeVisible({ timeout: 300_000 });
  } catch (e) {
    console.log("COLA:", await v.locator(".cola-exportacion").innerText().catch(() => "(sin panel)"));
    await v.screenshot({ path: join(RAIZ, "test-results", "exportar-fallo.png") });
    throw e;
  }

  const proyecto = readdirSync(join(datos, "proyectos"))[0];
  const exportados = join(datos, "proyectos", proyecto, "exportados");
  expect(readdirSync(exportados)).toEqual(["el-quebrantamiento-activa-la-gloria-9x16.mp4"]);
  const dims = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x",
    join(exportados, "el-quebrantamiento-activa-la-gloria-9x16.mp4")], { encoding: "utf8" }).trim();
  expect(dims).toBe("1080x1920");
  await app.close();
});
