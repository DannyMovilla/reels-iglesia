import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("plan 5: corregir, clip a mano, pedir a Claude, favoritos, aviso de capítulos y exportar", async () => {
  test.setTimeout(600_000);
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const datos = mkdtempSync(join(tmpdir(), "reels-e2e-p5-"));
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
  await v.getByRole("group", { name: "Duración de los clips" }).getByRole("button", { name: /Cortos/ }).click();
  await v.getByLabel("Instrucción para Claude (opcional)").fill("prioriza la fidelidad de Dios");
  await v.getByRole("button", { name: "Procesar prédica" }).click();
  await expect(v.getByRole("list", { name: "Proceso" }).locator(".paso.ok")).toHaveCount(4, { timeout: 240_000 });

  // 1. Corregir una palabra en toda la prédica.
  await v.getByRole("tab", { name: /Transcripción/ }).click();
  const primera = v.locator(".transcripcion-texto .palabra").first();
  const original = (await primera.innerText()).trim();
  await primera.dblclick();
  await v.getByLabel("Palabra corregida").fill("PALABRA");
  await v.getByRole("button", { name: "En toda la prédica" }).click();
  await expect(v.locator(".transcripcion-texto .palabra").first()).toHaveText(/PALABRA/);
  expect(original.length).toBeGreaterThan(0);

  // 2. Clip a mano desde un tramo de la transcripción.
  const palabras = v.locator(".transcripcion-texto .palabra");
  await palabras.nth(2).click();
  await palabras.nth(9).click({ modifiers: ["Shift"] });
  await v.getByRole("button", { name: "Crear clip con esto" }).click();
  await expect(v.locator(".clips .tag", { hasText: "A mano" })).toBeVisible();

  // 3. Pedir un cambio a Claude y deshacerlo.
  await v.getByRole("tab", { name: /Claude/ }).click();
  await v.getByRole("button", { name: "Menos de 60 segundos" }).click();
  await v.getByRole("button", { name: "Pedir a Claude" }).click();
  await expect(v.getByText(/Acorté el clip/)).toBeVisible({ timeout: 60_000 });
  await v.getByRole("button", { name: "Deshacer" }).click();
  await expect(v.getByText("Deshecho")).toBeVisible();

  // 4. Favorito y filtro.
  await v.locator(".clips li").first().hover();
  await v.getByRole("button", { name: /como favorito$/ }).first().click();
  await v.getByRole("button", { name: "Favoritos", exact: true }).click();
  await expect(v.locator(".clips li:not(.vacio)")).toHaveCount(1);
  await v.getByRole("button", { name: "Todos", exact: true }).click();

  // 5. Capítulos: una prédica de 19 s no alcanza para 3 capítulos de 10 s (regla de YouTube): aviso claro.
  await v.getByRole("tab", { name: /Capítulos/ }).click();
  await v.getByRole("button", { name: "Crear capítulos" }).click();
  await expect(v.getByRole("alert")).toHaveText("Claude no encontró al menos 3 partes en la prédica.", { timeout: 60_000 });

  // 6. Exportar el clip de Claude (con su versículo confirmado) en 9:16.
  await v.getByRole("tab", { name: /Vista previa/ }).click();
  await v.locator(".clips li", { hasText: "El quebrantamiento" }).locator("button.clip").click();
  await v.getByRole("tab", { name: "Versículo" }).click();
  await v.getByLabel("Texto RVR1960 de Romanos 8:28").fill("Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.");
  await v.getByRole("button", { name: "Confirmar texto" }).click();
  await v.getByRole("tab", { name: "Publicar" }).click();
  await v.getByRole("group", { name: "Formatos" }).getByRole("button", { name: /4:5/ }).click();
  await v.waitForTimeout(700);
  await v.getByRole("button", { name: "Exportar este clip" }).click();
  await expect(v.getByText("1 reel listo")).toBeVisible({ timeout: 300_000 });

  const proyecto = readdirSync(join(datos, "proyectos"))[0];
  const exportados = readdirSync(join(datos, "proyectos", proyecto, "exportados"));
  expect(exportados).toEqual(expect.arrayContaining([
    "el-quebrantamiento-activa-la-gloria-9x16.mp4", "el-quebrantamiento-activa-la-gloria-9x16-portada.jpg",
    "el-quebrantamiento-activa-la-gloria-textos.txt",
  ]));
  expect(exportados).not.toContain("capitulos.txt");
  const p = JSON.parse(readFileSync(join(datos, "proyectos", proyecto, "proyecto.json"), "utf8"));
  expect(p.analisis).toEqual({ duracion: "corta", instruccion: "prioriza la fidelidad de Dios" });
  await app.close();
});
