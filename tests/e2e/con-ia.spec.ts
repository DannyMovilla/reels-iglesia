import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("Con IA: Claude escribe el reel de un versículo, se confirma y se exporta", async () => {
  test.setTimeout(400_000);
  const datos = mkdtempSync(join(tmpdir(), "reels-e2e-ia-"));
  const app = await electron.launch({
    args: [join(RAIZ, "out/main/index.js")],
    env: { ...process.env, REELS_IGLESIA_DATOS: datos, REELS_CLAUDE_COMANDO: `node "${join(RAIZ, "tests/fixtures/claude/falso-claude.mjs")}"` },
  });
  const v = await app.firstWindow();
  await v.getByRole("link", { name: "Con IA" }).click();
  await v.getByRole("button", { name: "Nuevo reel de versículo" }).click();
  await v.getByLabel("Versículo", { exact: true }).fill("Juan 8:12");
  await v.getByRole("button", { name: "Crear con Claude" }).click();
  await expect(v.getByLabel("Gancho")).toHaveValue("No tienes que caminar a oscuras", { timeout: 60_000 });
  await expect(v.getByRole("button", { name: "Exportar" })).toBeDisabled();
  await v.getByRole("button", { name: "Confirmar texto" }).click();
  // Vista previa en vivo: el reproductor queda listo con la escena.
  let listo = false;
  for (let i = 0; i < 100 && !listo; i++) {
    listo = await v.evaluate(() => Boolean((document.querySelector("hyperframes-player") as unknown as { ready?: boolean } | null)?.ready));
    if (!listo) await v.waitForTimeout(200);
  }
  expect(listo).toBe(true);
  await v.getByRole("tab", { name: "Estilo" }).click();
  await v.getByRole("checkbox", { name: "4:5" }).uncheck();
  await v.waitForTimeout(700);
  await v.getByRole("button", { name: "Exportar" }).click();
  await expect(v.getByText("1 reel listo")).toBeVisible({ timeout: 300_000 });
  const id = readdirSync(join(datos, "ia"))[0];
  const exportados = readdirSync(join(datos, "ia", id, "exportados"));
  expect(exportados).toContain("juan-8-12-9x16.mp4");
  expect(exportados).toContain("juan-8-12-9x16-portada.jpg");
  await v.getByRole("link", { name: "Exportados" }).click();
  await expect(v.getByText("Con IA · Juan 8:12")).toBeVisible();
  await app.close();
});
