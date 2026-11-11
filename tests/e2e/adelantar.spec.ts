import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

/** Regresión: con Electron 35 el protocolo propio no dejaba adelantar ("PIPELINE_ERROR_READ"). Usa un culto real si está en el PC. */
// El culto largo no está en el repositorio: su ruta va en la variable REELS_CULTO_LARGO.
const CULTO = process.env.REELS_CULTO_LARGO ?? "";
test("se puede adelantar un culto largo hasta la prédica", async () => {
  test.skip(!existsSync(CULTO), "Sin video largo de prueba en este PC");
  const app = await electron.launch({
    args: [resolve(__dirname, "../../out/main/index.js")],
    env: { ...process.env, REELS_IGLESIA_DATOS: mkdtempSync(join(tmpdir(), "dbg-")), REELS_VIDEO_PRUEBA: CULTO },
  });
  const v = await app.firstWindow();
  await v.getByRole("button", { name: "Nueva prédica" }).first().click();
  await v.getByRole("button", { name: /Elige el video del culto/ }).click();
  await v.waitForSelector("video");
  await v.waitForTimeout(1500);
  await v.evaluate(() => { const e = document.querySelector("video")!; e.muted = true; e.currentTime = 6300; void e.play(); });
  await v.waitForTimeout(8000);
  const estado = await v.evaluate(() => { const e = document.querySelector("video")!; return { t: e.currentTime, err: e.error?.message ?? null }; });
  expect(estado.err).toBeNull();
  expect(estado.t).toBeGreaterThan(6300);
  await app.close().catch(() => {});
});
