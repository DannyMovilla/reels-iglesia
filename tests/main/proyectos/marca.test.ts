import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { aplicarEstilo, copiarLogo, crearProyecto, guardarJson, guardarMarca, leerClips, leerMarca } from "../../../src/main/proyectos/almacen";
import { completarClip, ESTILO_POR_DEFECTO } from "../../../src/shared/clip";

let datos: string;
beforeEach(() => { datos = mkdtempSync(join(tmpdir(), "reels-marca-")); process.env.REELS_IGLESIA_DATOS = datos; });

test("guardar y leer la marca", async () => {
  const m = await leerMarca();
  await guardarMarca({ ...m, nombre: "Iglesia Familia", redes: { instagram: "iglesiafamilia" }, logoEscala: 1.4 });
  const leida = await leerMarca();
  expect(leida.nombre).toBe("Iglesia Familia");
  expect(leida.redes.instagram).toBe("iglesiafamilia");
  expect(leida.logoEscala).toBe(1.4);
});

test("el logo se copia a la carpeta de la marca (aunque su ruta tenga #) y reemplaza al anterior", async () => {
  const origen = join(mkdtempSync(join(tmpdir(), "logo #1-")), "Logo Iglesia.PNG");
  writeFileSync(origen, Buffer.alloc(2 * 1024 * 1024, 7));
  const ruta = await copiarLogo(origen);
  expect(ruta).toBe(join(datos, "marca", "logo.png"));
  expect(readFileSync(ruta).length).toBe(2 * 1024 * 1024);
  const svg = join(mkdtempSync(join(tmpdir(), "logo-")), "logo.svg");
  writeFileSync(svg, "<svg xmlns='http://www.w3.org/2000/svg'/>");
  expect(await copiarLogo(svg)).toBe(join(datos, "marca", "logo.svg"));
  expect(existsSync(join(datos, "marca", "logo.png"))).toBe(false);
});

test("aplicar el estilo de la iglesia cambia los clips sin exportar y respeta los exportados", async () => {
  const p = await crearProyecto({ nombre: "Culto", video: { ruta: "C:/v.mp4", tamano: 1, modificado: 0, duracion: 100 }, rango: { inicio: 0, fin: 90 } });
  const base = { id: "a", titulo: "T", categoria: "Reflexión", descripcion: "", hashtags: [], estado: "sugerido",
    subtitulos: { activos: true, estilo: "pop", tamano: "m", altura: 0.7 }, musica: { pista: "auto", volumen: 0.12 }, cierre: true, formatos: ["9:16"] };
  await guardarJson(p.id, "clips.json", [base, { ...base, id: "b", estado: "exportado" }].map((c) => completarClip(c, ESTILO_POR_DEFECTO)));
  const m = await leerMarca();
  await guardarMarca({ ...m, estilo: { ...m.estilo, subtitulos: { estilo: "karaoke", tamano: "l" }, cierre: false, formatos: ["1:1"] } });
  await aplicarEstilo(p.id);
  const [a, b] = await leerClips(p.id);
  expect(a.subtitulos).toEqual({ activos: true, estilo: "karaoke", tamano: "l", altura: 0.7 });
  expect(a.cierre).toBe(false);
  expect(a.formatos).toEqual(["1:1"]);
  expect(b.subtitulos.estilo).toBe("pop");
});
