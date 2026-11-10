import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("nueva prédica → procesar → ver clips sugeridos", async () => {
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const app = await electron.launch({
    args: [join(RAIZ, "out/main/index.js")],
    env: {
      ...process.env,
      REELS_IGLESIA_DATOS: mkdtempSync(join(tmpdir(), "reels-e2e-")),
      REELS_VIDEO_PRUEBA: video,
      REELS_WHISPER_MODELO: "tiny",
      REELS_CLAUDE_COMANDO: `node "${join(RAIZ, "tests/fixtures/claude/falso-claude.mjs")}"`,
      FALSO_CLAUDE_MODO: "corto",
    },
  });
  const v = await app.firstWindow();
  await expect(v.getByText("Todavía no hay prédicas")).toBeVisible();
  await v.getByRole("button", { name: "Nueva prédica" }).first().click();
  await v.getByRole("button", { name: /Elige el video del culto/ }).click();
  await expect(v.getByLabel("Fin de la prédica")).not.toHaveValue("");
  await v.getByRole("button", { name: "Procesar prédica" }).click();

  const pasos = v.getByRole("list", { name: "Proceso" });
  await expect(pasos.locator(".paso.ok")).toHaveCount(4, { timeout: 240_000 });
  const lista = v.getByRole("list", { name: "Clips sugeridos" });
  await expect(lista.getByRole("heading", { name: "El quebrantamiento activa la gloria" })).toBeVisible();
  await v.getByRole("tab", { name: "Versículo" }).click();
  await expect(v.getByLabel("Datos del clip")).toContainText("Romanos 8:28");
  await v.getByRole("tab", { name: "Gancho" }).click();

  // Vista previa en vivo: el reproductor de HyperFrames queda listo con la composición del clip.
  let listo = false;
  for (let i = 0; i < 100 && !listo; i++) {
    listo = await v.evaluate(() => Boolean((document.querySelector("hyperframes-player") as unknown as { ready?: boolean } | null)?.ready));
    if (!listo) await v.waitForTimeout(200);
  }
  expect(listo).toBe(true);
  await v.waitForTimeout(1500);
  await v.screenshot({ path: join(RAIZ, "test-results", "editor.png") });

  // Editar el gancho se guarda solo y sobrevive a reabrir el proyecto.
  const gancho = v.getByLabel("Gancho en pantalla");
  await gancho.fill("Dios sigue siendo fiel");
  await v.waitForTimeout(800);
  await v.getByRole("link", { name: "Prédicas" }).click();
  await v.getByRole("list", { name: "Prédicas" }).getByRole("button").first().click();
  await expect(v.getByLabel("Gancho en pantalla")).toHaveValue("Dios sigue siendo fiel");
  await app.close();
});
