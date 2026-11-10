import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("plan 6: entregas (SRT, PDF, MP3, traducción), color y fuente, y exportar", async () => {
  test.setTimeout(600_000);
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const datos = mkdtempSync(join(tmpdir(), "reels-e2e-p6-"));
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
  await v.getByLabel("Nombre").fill("Culto de prueba");
  await v.getByRole("button", { name: "Procesar prédica" }).click();
  await expect(v.getByRole("list", { name: "Proceso" }).locator(".paso.ok")).toHaveCount(4, { timeout: 240_000 });

  // Entregas de la semana.
  await v.getByRole("tab", { name: /Entregas/ }).click();
  await v.getByRole("button", { name: "Crear SRT" }).click();
  await expect(v.getByText("Listo: culto-de-prueba.srt")).toBeVisible({ timeout: 30_000 });
  await v.getByRole("button", { name: "Crear PDF" }).click();
  await expect(v.getByText("Listo: culto-de-prueba-transcripcion.pdf")).toBeVisible({ timeout: 60_000 });
  await v.getByRole("button", { name: "Crear MP3" }).click();
  await expect(v.getByText("Listo: culto-de-prueba.mp3")).toBeVisible({ timeout: 120_000 });
  await v.getByRole("checkbox", { name: "Inglés" }).check();
  await v.getByRole("button", { name: "Traducir" }).click();
  await expect(v.getByText("Listo: culto-de-prueba.en.srt")).toBeVisible({ timeout: 60_000 });

  // Color y fuente en el clip, y exportar.
  await v.getByRole("tab", { name: /Vista previa/ }).click();
  await v.getByRole("tab", { name: "Versículo" }).click();
  await v.getByLabel("Texto RVR1960 de Romanos 8:28").fill("Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.");
  await v.getByRole("button", { name: "Confirmar texto" }).click();
  await v.getByRole("tab", { name: "Imagen" }).click();
  await v.getByRole("group", { name: "Look de color" }).getByRole("button", { name: "Cine" }).click();
  await v.getByRole("tab", { name: "Subtítulos" }).click();
  await v.getByLabel("Fuente de títulos").selectOption("montserrat");
  await v.getByRole("tab", { name: "Publicar" }).click();
  await v.getByRole("group", { name: "Formatos" }).getByRole("button", { name: /4:5/ }).click();
  await v.waitForTimeout(700);
  await v.getByRole("button", { name: "Exportar este clip" }).click();
  await expect(v.getByText("1 reel listo")).toBeVisible({ timeout: 300_000 });

  const proyecto = readdirSync(join(datos, "proyectos"))[0];
  const carpeta = join(datos, "proyectos", proyecto, "exportados");
  const archivos = readdirSync(carpeta);
  expect(archivos).toEqual(expect.arrayContaining([
    "culto-de-prueba.srt", "culto-de-prueba-transcripcion.pdf", "culto-de-prueba.mp3", "culto-de-prueba.en.srt",
    "el-quebrantamiento-activa-la-gloria-9x16.mp4",
  ]));
  expect(readFileSync(join(carpeta, "culto-de-prueba-transcripcion.pdf")).subarray(0, 4).toString()).toBe("%PDF");
  expect(readFileSync(join(carpeta, "culto-de-prueba.en.srt"), "utf8")).toContain("[en] ");
  const clips = JSON.parse(readFileSync(join(datos, "proyectos", proyecto, "clips.json"), "utf8"));
  expect(clips[0].color.look).toBe("cine");
  expect(clips[0].fuentes.titulos).toBe("montserrat");
  await app.close();
});
