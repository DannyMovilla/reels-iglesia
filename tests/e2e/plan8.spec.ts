import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const RAIZ = resolve(__dirname, "../..");
const SALIDA = join(RAIZ, ".superpowers", "sdd", "2026-11-09-reels-iglesia-plan-8-subtitulos-gancho-frases");

/** Color promedio de la esquina de abajo a la derecha (40×40) de un PNG de 1080×1350. */
function esquina(png: string): number[] {
  const r = execFileSync("ffmpeg", ["-v", "error", "-i", png, "-vf", "crop=40:40:1040:1310", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"]);
  const s = [0, 0, 0];
  for (let i = 0; i + 2 < r.length; i += 3) for (let c = 0; c < 3; c++) s[c] += r[i + c];
  return s.map((v) => v / (r.length / 3));
}

/** Ancho y alto de un PNG (encabezado IHDR). */
const medidas = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test("plan 8: galerías de estilo y frases para publicar", async () => {
  test.setTimeout(600_000);
  const video = execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", join(RAIZ, "tests/fixtures/crear-fixture.ps1")], { encoding: "utf8" })
    .trim().split(/\r?\n/).pop()!;
  const datos = mkdtempSync(join(tmpdir(), "reels-e2e-p8-"));
  const app = await electron.launch({
    args: [join(RAIZ, "out/main/index.js")],
    env: {
      ...process.env, REELS_IGLESIA_DATOS: datos, REELS_VIDEO_PRUEBA: video, REELS_WHISPER_MODELO: "tiny",
      REELS_CLAUDE_COMANDO: `node "${join(RAIZ, "tests/fixtures/claude/falso-claude.mjs")}"`, FALSO_CLAUDE_MODO: "corto", FALSO_CLAUDE_FRASES: "entrada",
    },
  });
  const v = await app.firstWindow();
  await v.getByRole("button", { name: "Nueva prédica" }).first().click();
  await v.getByRole("button", { name: /Elige el video del culto/ }).click();
  await expect(v.getByLabel("Fin de la prédica")).not.toHaveValue("");
  await v.getByLabel("Nombre").fill("Culto de prueba");
  await v.getByRole("button", { name: "Procesar prédica" }).click();
  await expect(v.getByRole("list", { name: "Proceso" }).locator(".paso.ok")).toHaveCount(4, { timeout: 240_000 });

  // Galerías: estilo del gancho (Clip) y de subtítulos (Estilo).
  await v.getByRole("tab", { name: /^Clip$/ }).click();
  await v.getByRole("radiogroup", { name: "Estilo del gancho" }).getByRole("radio", { name: "Gigante" }).click();
  await v.getByRole("tab", { name: /Estilo/ }).click();
  const galeria = v.getByRole("radiogroup", { name: "Estilo de subtítulos" });
  await expect(galeria.getByRole("radio")).toHaveCount(15);
  await galeria.getByRole("radio", { name: "Viral" }).click();
  await expect(galeria.getByRole("radio", { name: "Viral" })).toHaveAttribute("aria-checked", "true");
  await v.waitForTimeout(900);
  await galeria.screenshot({ path: join(SALIDA, "galeria-subtitulos.png") });
  await v.screenshot({ path: join(SALIDA, "editor-galeria.png") });

  // Frases para publicar.
  await v.getByRole("tab", { name: /Entregas/ }).click();
  await v.getByRole("button", { name: "Sacar 7 frases" }).click();
  const lista = v.getByRole("list", { name: "Frases" });
  await expect(lista.getByRole("listitem").first()).toBeVisible({ timeout: 60_000 });
  const n = await lista.getByRole("listitem").count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(7);
  await v.getByRole("button", { name: "Guardar imágenes" }).click();
  await expect(v.getByText(new RegExp(`Listo: ${n} imágen`))).toBeVisible({ timeout: 120_000 });

  const proyecto = readdirSync(join(datos, "proyectos"))[0];
  const carpeta = join(datos, "proyectos", proyecto, "exportados");
  const pngs = readdirSync(join(carpeta, "frases")).filter((f) => f.endsWith(".png")).sort();
  expect(pngs).toHaveLength(n);
  for (const p of pngs) {
    const archivo = join(carpeta, "frases", p);
    expect(medidas(readFileSync(archivo))).toEqual([1080, 1350]);
    expect(statSync(archivo).size).toBeGreaterThan(10_000);
    // Fondo «marca»: el degradado termina en #0b0d14 abajo. Si la tarjeta salió recortada, la esquina es más clara.
    for (const c of esquina(archivo)) expect(c).toBeLessThan(25);
  }
  execFileSync("powershell", ["-NoProfile", "-Command", `Copy-Item -LiteralPath '${join(carpeta, "frases", pngs[0])}' -Destination '${join(SALIDA, "frase-1.png")}'`]);
  expect(readFileSync(join(carpeta, "culto-de-prueba-frases.txt"), "utf8")).toContain("«");

  const clips = JSON.parse(readFileSync(join(datos, "proyectos", proyecto, "clips.json"), "utf8"));
  expect(clips[0].subtitulos.estilo).toBe("viral");
  expect(clips[0].estiloGancho).toBe("gigante");
  await app.close();
});
