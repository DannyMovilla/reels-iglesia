import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

test("la app abre con el nombre Reels Iglesia", async () => {
  const app = await electron.launch({
    args: ["out/main/index.js"],
    env: { ...process.env, REELS_IGLESIA_DATOS: mkdtempSync(join(tmpdir(), "reels-arranque-")) },
  });
  const ventana = await app.firstWindow();
  await expect(ventana.locator(".barra-titulo")).toContainText("Reels Iglesia");
  await expect(ventana).toHaveTitle("Reels Iglesia");
  await app.close();
});
