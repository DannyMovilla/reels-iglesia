import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");

test("D1: hyperframes-player en Electron con video reels-video://", async () => {
  test.setTimeout(180_000);
  const html = readFileSync(join(RAIZ, "spike/prueba-hf/index.html"), "utf8");
  const app = await electron.launch({
    args: [join(RAIZ, "out/main/index.js")],
    env: { ...process.env, REELS_IGLESIA_DATOS: mkdtempSync(join(tmpdir(), "d1-")), REELS_VIDEO_PRUEBA: join(RAIZ, "spike/prueba-hf/culto.mp4") },
  });
  const v = await app.firstWindow();
  const errores: string[] = [];
  v.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errores.push(m.text()); });
  for (let i = 0; i < 50 && !(await v.evaluate(() => typeof (window as any).__montarPrueba === "function")); i++) await v.waitForTimeout(100);
  await v.evaluate((h) => { (window as any).__htmlPrueba = h; return (window as any).__montarPrueba(); }, html);
  const listo = await v.evaluate(() => new Promise((res) => {
    const p = (window as any).__player;
    const t = setTimeout(() => res({ ready: p.ready, timeout: true }), 30000);
    p.addEventListener("ready", () => { clearTimeout(t); res({ ready: true, duracion: p.duration }); });
    p.addEventListener("error", (e: any) => { clearTimeout(t); res({ error: String(e.detail?.message ?? e.detail) }); });
  }));
  console.log("READY", JSON.stringify(listo));
  const ticks = await v.evaluate(() => new Promise((res) => {
    const p = (window as any).__player; let n = 0;
    p.addEventListener("timeupdate", () => n++);
    p.play(); setTimeout(() => { p.pause(); res({ n, t: p.currentTime }); }, 3000);
  }));
  console.log("PLAY", JSON.stringify(ticks));
  await v.evaluate(() => (window as any).__player.seek(12));
  await v.waitForTimeout(1500);
  await v.screenshot({ path: join(RAIZ, "spike/plan2/d1-seek12.png") });
  await v.evaluate(() => (window as any).__player.seek(19));
  await v.waitForTimeout(1500);
  await v.screenshot({ path: join(RAIZ, "spike/plan2/d1-seek19.png") });
  console.log("ERRORES", JSON.stringify(errores.slice(0, 8)));
  await app.close();
});


