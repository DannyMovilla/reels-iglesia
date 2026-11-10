import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { iniciarServidorMedios, type ServidorMedios } from "../../src/main/servidor-medios";

let srv: ServidorMedios;
const contenido = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

beforeAll(async () => {
  const archivo = join(mkdtempSync(join(tmpdir(), "medios-")), "culto [1] ñ.mp4");
  writeFileSync(archivo, contenido);
  srv = await iniciarServidorMedios(async (tipo, valor) => (tipo === "archivo" && valor === "culto" ? archivo : null));
});
afterAll(() => srv.cerrar());

test("solo escucha en el propio PC y con la clave", async () => {
  expect(srv.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/[a-f0-9]{32}$/);
  const sinClave = await fetch(srv.base.replace(/\/[a-f0-9]{32}$/, "/otra") + "/archivo/culto");
  expect(sinClave.status).toBe(403);
  expect((await fetch(`${srv.base}/archivo/nada`)).status).toBe(404);
});

test("entrega el archivo completo", async () => {
  const r = await fetch(`${srv.base}/archivo/culto`);
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toBe("video/mp4");
  expect(r.headers.get("accept-ranges")).toBe("bytes");
  expect(Buffer.from(await r.arrayBuffer()).equals(contenido)).toBe(true);
});

test("atiende los pedazos que pide el reproductor al adelantar (206 + Content-Range)", async () => {
  const r = await fetch(`${srv.base}/archivo/culto`, { headers: { Range: "bytes=100-199" } });
  expect(r.status).toBe(206);
  expect(r.headers.get("content-range")).toBe("bytes 100-199/1000");
  expect(Buffer.from(await r.arrayBuffer()).equals(contenido.subarray(100, 200))).toBe(true);
  const final = await fetch(`${srv.base}/archivo/culto`, { headers: { Range: "bytes=900-" } });
  expect(final.headers.get("content-range")).toBe("bytes 900-999/1000");
  expect((await final.arrayBuffer()).byteLength).toBe(100);
  const ultimos = await fetch(`${srv.base}/archivo/culto`, { headers: { Range: "bytes=-50" } });
  expect(ultimos.headers.get("content-range")).toBe("bytes 950-999/1000");
  const fuera = await fetch(`${srv.base}/archivo/culto`, { headers: { Range: "bytes=5000-" } });
  expect(fuera.status).toBe(416);
});

test("revisión plan 7: el logo se entrega con su tipo de imagen (un SVG sin tipo no se ve)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "medios-logo-"));
  const tipos: Record<string, string> = { "logo.svg": "image/svg+xml", "logo.png": "image/png", "logo.webp": "image/webp", "logo.jpeg": "image/jpeg" };
  for (const n of Object.keys(tipos)) writeFileSync(join(dir, n), "x");
  const s = await iniciarServidorMedios(async (tipo, valor) => (tipo === "marca" ? join(dir, valor) : null));
  try {
    for (const [n, t] of Object.entries(tipos)) expect((await fetch(`${s.base}/marca/${n}`)).headers.get("content-type")).toBe(t);
  } finally {
    s.cerrar();
  }
});

test("plan 9: la fuente de la iglesia se entrega con su tipo (para la galería)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "medios-fuente-"));
  const tipos: Record<string, string> = { "fuente.ttf": "font/ttf", "fuente.otf": "font/otf", "fuente.woff": "font/woff", "fuente.woff2": "font/woff2" };
  for (const n of Object.keys(tipos)) writeFileSync(join(dir, n), "x");
  const s = await iniciarServidorMedios(async (tipo, valor) => (tipo === "marca" ? join(dir, valor) : null));
  try {
    for (const [n, t] of Object.entries(tipos)) expect((await fetch(`${s.base}/marca/${n}`)).headers.get("content-type")).toBe(t);
  } finally {
    s.cerrar();
  }
});
