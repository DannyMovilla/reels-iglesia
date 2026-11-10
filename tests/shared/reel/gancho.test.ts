import { expect, test } from "vitest";
import { aJs } from "../../../src/shared/reel/pasos";
import { ALTO_GANCHO_PX, ESTILOS_GANCHO, MEDIO_GANCHO_ESTILO, NOMBRE_GANCHO, cssGancho, htmlGancho, palabraEnColor, pasosGancho } from "../../../src/shared/reel/gancho";

test("la palabra en color: la primera clave del gancho, si no la más larga", () => {
  expect(palabraEnColor("Tu prueba no es el final", ["prueba"])).toBe(1);
  expect(palabraEnColor("Tu prueba no es el final", [])).toBe(1);
  expect(palabraEnColor("Dios no ha terminado contigo", [])).toBe(3);
  expect(palabraEnColor("Él está aquí", ["esta"])).toBe(1);
  expect(palabraEnColor("¿Sientes que todo se acabó?", ["acabo"])).toBe(4);
});

test("5 estilos con nombre en español; tarjeta es el de siempre", () => {
  expect(ESTILOS_GANCHO).toEqual(["tarjeta", "gigante", "marca", "subrayado", "golpe"]);
  expect(NOMBRE_GANCHO).toEqual({ tarjeta: "Tarjeta", gigante: "Gigante", marca: "Franja de marca", subrayado: "Subrayado", golpe: "Golpe" });
  expect(htmlGancho("tarjeta", "Tu <b>prueba</b>", 1)).toBe("Tu &lt;b&gt;prueba&lt;/b&gt;<i></i>");
});

test.each(["gigante", "marca", "subrayado", "golpe"] as const)("%s: una palabra por id, escapada y con la palabra en color", (e) => {
  const html = htmlGancho(e, `Dijo "ven" <ahora> & ya`, 1);
  for (const j of [0, 1, 2, 3, 4]) expect(html).toContain(`id="g${j}"`);
  expect(html).not.toContain("id=\"g5\"");
  expect(html).toContain("&quot;ven&quot;");
  expect(html).toContain("&lt;ahora&gt;");
  expect(html).toMatch(/id="g1" class="g color"/);
});

test("tarjeta anima igual que antes del plan 8", () => {
  expect(pasosGancho("tarjeta", 5, 4.5).map(aJs)).toEqual([
    `tl.from("#gancho", { opacity: 0, scale: 0.92, duration: 0.35, ease: "back.out(1.7)" }, 0);`,
    `tl.to("#gancho", { opacity: 0, duration: 0.3, ease: "power2.in" }, 4.2);`,
  ]);
});

test("cada estilo nuevo se va en los últimos 0,3 s; golpe anima cada palabra", () => {
  for (const e of ESTILOS_GANCHO) {
    const js = pasosGancho(e, 4, 3).map(aJs);
    expect(js.at(-1)).toBe(`tl.to("#gancho", { opacity: 0, duration: 0.3, ease: "power2.in" }, 2.7);`);
  }
  const golpe = pasosGancho("golpe", 4, 3);
  for (const j of [0, 1, 2, 3]) expect(golpe.some((p) => p.sel === `#g${j}` && p.metodo === "fromTo")).toBe(true);
});

test("gigante: 120 px en 9:16, 104 en 4:5 y 92 en 1:1, sin pasarse del ancho", () => {
  expect(cssGancho("9:16", 1080, "#f5c542")).toMatch(/\.gancho\.gigante[^}]*font: 900 120px/);
  expect(cssGancho("4:5", 1080, "#f5c542")).toMatch(/\.gancho\.gigante[^}]*font: 900 104px/);
  expect(cssGancho("1:1", 1080, "#f5c542")).toMatch(/\.gancho\.gigante[^}]*font: 900 92px/);
  expect(cssGancho("1:1", 1080, "#f5c542")).toContain("max-width: 960px");
});

test("franja de marca: texto oscuro sobre color claro, blanco sobre oscuro", () => {
  expect(cssGancho("9:16", 1080, "#f5c542")).toMatch(/\.gancho\.marca \{[^}]*color: #111111/);
  expect(cssGancho("9:16", 1080, "#202060")).toMatch(/\.gancho\.marca \{[^}]*color: #ffffff/);
});

test("medidas por estilo: tarjeta conserva las de siempre", () => {
  expect(MEDIO_GANCHO_ESTILO.tarjeta).toEqual({ "9:16": 0.055, "4:5": 0.075, "1:1": 0.095 });
  expect(MEDIO_GANCHO_ESTILO.gigante).toEqual({ "9:16": 0.09, "4:5": 0.11, "1:1": 0.13 });
  expect(ALTO_GANCHO_PX).toEqual({ tarjeta: 200, gigante: 400, marca: 260, subrayado: 300, golpe: 400 });
});
