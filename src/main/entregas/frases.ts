import { execFile } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { elegirFrases, htmlTarjetaFrase, MAX_FRASES, type Candidata, type Frase } from "@shared/frases";
import { esPintura, PINTURAS } from "@shared/reel/pinturas";
import { palabrasDe } from "@shared/reel/tiempo";
import { ERROR_SESION, ERROR_SIN_CLAUDE, extraerJson, partirComando, preguntar } from "../claude/analizar";
import { guardarJson, leerJson, leerMarca, leerProyecto, leerTranscripcion } from "../proyectos/almacen";
import { carpetaProyecto, raizApp, rutaPinturas } from "../rutas";
import { resolverComandoClaude } from "../sistema/claude-cmd";
import { baseEntregas, carpetaEntregas, validarIdProyecto } from "./entregas";

const DIEZ_MINUTOS = 10 * 60 * 1000;
export const AVISO_SIN_VIDEO = "La foto del momento no está disponible: el video original no se encuentra.";

const hms = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const minuto = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return t >= 3600 ? hms(t) : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Prompt para sacar frases de la prédica (líneas "[H:MM:SS] texto"). */
export function promptFrases(lineas: string): string {
  return `FRASES DE LA PRÉDICA. Eres el editor de redes sociales de una iglesia cristiana hispana. De esta prédica, elige 10 frases que inspiren y se puedan publicar solas como imagen.

Reglas:
- Cada frase va copiada palabra por palabra de la transcripción: no la mejores, no la resumas, no juntes partes distintas.
- De 6 a 25 palabras, con una idea completa que se entienda sin contexto.
- Nada de saludos, avisos, ofrendas, oraciones largas ni frases de relleno.
- Que no repitan la misma idea.
- "en" es la marca de tiempo de la línea donde empieza la frase (formato H:MM:SS).
- "clave" es una palabra importante de la misma frase, para resaltarla.
- "versiculo" solo si el predicador cita un pasaje bíblico en esa frase: "ref" (libro capítulo:versículo) y "texto" en la Reina-Valera 1960, palabra por palabra. Nunca agregues versículos que el predicador no citó.

Responde solo con un arreglo JSON de la forma [{"texto":"…","en":"0:12:30","clave":"…"},{"texto":"…","en":"0:20:05","clave":"…","versiculo":{"ref":"Romanos 8:28","texto":"…"}}].

Transcripción:
${lineas}`;
}

/** Pedidos en curso (uno por prédica), para poder cancelarlos. */
const enCurso = new Map<string, AbortController>();

/** Prédicas con un pedido de frases en curso. */
export const frasesEnCurso = (): string[] => [...enCurso.keys()];

/** Aviso cuando Claude encontró menos de 7 frases («1 frase textual», «3 frases textuales»). */
export function avisoFrases(n: number): string | undefined {
  if (n >= MAX_FRASES) return undefined;
  return n === 1 ? "Claude encontró 1 frase textual." : `Claude encontró ${n} frases textuales.`;
}

export function cancelarFrases(proyectoId: string): boolean {
  const c = enCurso.get(proyectoId);
  if (!c) return false;
  c.abort();
  return true;
}

/** Una consulta; los errores que reintentar no arregla suben tal cual, cualquier otro cuenta como respuesta vacía. */
async function consultar(comando: [string, string[]], prompt: string, senal: AbortSignal): Promise<string> {
  try {
    return await preguntar(comando, prompt, senal, AbortSignal.timeout(DIEZ_MINUTOS));
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (senal.aborted || m === ERROR_SESION || m === ERROR_SIN_CLAUDE) throw e;
    return "";
  }
}

const leerCandidatas = (respuesta: string): Candidata[] | null => {
  try {
    const v = extraerJson(respuesta);
    return Array.isArray(v) ? (v as Candidata[]) : null;
  } catch {
    return null;
  }
};

/**
 * Pide a Claude 10 frases de la prédica, se queda con las que dijo el predicador (como mucho 7) y las guarda en
 * frases.json. Con menos de 7 devuelve un aviso.
 */
export async function sacarFrases(proyectoId: string, o: { comando?: string; senal?: AbortSignal } = {}): Promise<{ frases: Frase[]; aviso?: string }> {
  validarIdProyecto(proyectoId);
  if (enCurso.has(proyectoId)) throw new Error("Ya se están sacando las frases de esta prédica.");
  const control = new AbortController();
  enCurso.set(proyectoId, control);
  try {
    return await sacar(proyectoId, o.comando, o.senal ? AbortSignal.any([o.senal, control.signal]) : control.signal);
  } catch (e) {
    if (control.signal.aborted) throw new Error("Se canceló.");
    throw e;
  } finally {
    enCurso.delete(proyectoId);
  }
}

async function sacar(proyectoId: string, comandoTexto: string | undefined, senal: AbortSignal): Promise<{ frases: Frase[]; aviso?: string }> {
  const t = await leerTranscripcion(proyectoId);
  if (!t?.segmentos.length) throw new Error("Primero hay que transcribir la prédica.");
  const proyecto = await leerProyecto(proyectoId);
  const comando = comandoTexto ? partirComando(comandoTexto) : resolverComandoClaude();
  const lineas = t.segmentos.filter((s) => s.e > proyecto.rango.inicio && s.s < proyecto.rango.fin).map((s) => `[${hms(s.s)}] ${s.t.trim()}`).join("\n");
  const prompt = promptFrases(lineas);
  let candidatas = leerCandidatas(await consultar(comando, prompt, senal));
  if (!candidatas) {
    const otraVez = prompt.replace("Transcripción:", "Tu respuesta anterior no era un arreglo JSON válido. Responde solo con el arreglo JSON.\n\nTranscripción:");
    candidatas = leerCandidatas(await consultar(comando, otraVez, senal));
  }
  if (!candidatas) throw new Error("Claude no respondió con frases. Prueba de nuevo.");
  const frases = elegirFrases(candidatas, palabrasDe(t), proyecto.rango);
  if (!frases.length) throw new Error("Claude no encontró frases textuales. Prueba de nuevo.");
  await guardarJson(proyectoId, "frases.json", frases);
  const aviso = avisoFrases(frases.length);
  return { frases, ...(aviso ? { aviso } : {}) };
}

const esFrase = (f: unknown): f is Frase => {
  const x = f as Frase;
  return !!x && typeof x.texto === "string" && typeof x.original === "string" && typeof x.en === "number" && Number.isFinite(x.en)
    && ["marca", "momento", "pintura"].includes(x.fondo);
};

/** Las frases válidas; un versículo mal formado se quita (la frase se conserva). */
function limpiar(lista: unknown): Frase[] {
  return (Array.isArray(lista) ? lista : []).filter(esFrase).map((f) => {
    const v = f.versiculo as Partial<NonNullable<Frase["versiculo"]>> | undefined;
    if (v === undefined) return f;
    if (typeof v?.ref === "string" && typeof v.texto === "string" && typeof v.confirmado === "boolean") return f;
    const { versiculo: _malo, ...resto } = f;
    return resto;
  });
}

export async function leerFrases(proyectoId: string): Promise<Frase[]> {
  validarIdProyecto(proyectoId);
  return limpiar(await leerJson<unknown[]>(proyectoId, "frases.json"));
}

export async function guardarFrases(proyectoId: string, frases: Frase[]): Promise<void> {
  validarIdProyecto(proyectoId);
  await guardarJson(proyectoId, "frases.json", limpiar(frases));
}

/** Un cuadro del video en el segundo `t` (1080 de ancho). false si FFmpeg no pudo. */
export function cuadroDelMomento(video: string, t: number, destino: string): Promise<boolean> {
  return new Promise((r) => execFile("ffmpeg", ["-v", "error", "-y", "-ss", String(Math.max(0, t)), "-i", video, "-frames:v", "1", "-vf", "scale=1080:-2", "-q:v", "3", destino],
    { windowsHide: true }, (err) => r(!err)));
}

/**
 * HTML → PNG de 1080×1350. El tamaño lo fija el protocolo de DevTools (una ventana no puede ser más alta que la
 * pantalla: en una laptop la imagen saldría recortada). La ventana se muestra sin activarse, transparente y fuera de la
 * vista: una ventana oculta no siempre dibuja y la captura se queda esperando.
 */
export async function pintarPng(html: string): Promise<Buffer> {
  const { BrowserWindow } = await import("electron");
  const archivo = join(tmpdir(), `reels-frase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  await writeFile(archivo, html, "utf8");
  const v = new BrowserWindow({
    show: false, opacity: 0, skipTaskbar: true, focusable: false, x: -4000, y: -4000, width: 1080, height: 1350, useContentSize: true,
    webPreferences: { sandbox: true },
  });
  try {
    await v.loadFile(archivo);
    v.showInactive();
    const d = v.webContents.debugger;
    d.attach("1.3");
    try {
      await d.sendCommand("Emulation.setDeviceMetricsOverride", { width: 1080, height: 1350, deviceScaleFactor: 1, mobile: false });
      await v.webContents.executeJavaScript("document.fonts.ready.then(() => true)");
      const captura = d.sendCommand("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1080, height: 1350, scale: 1 }, captureBeyondViewport: true }) as Promise<{ data: string }>;
      const r = await Promise.race([captura, new Promise<never>((_, no) => setTimeout(() => no(new Error("No pude pintar la imagen de la frase. Prueba de nuevo.")), 20_000))]);
      return Buffer.from(r.data, "base64");
    } finally {
      d.detach();
    }
  } finally {
    v.destroy();
    await rm(archivo, { force: true });
  }
}

/**
 * Pinta las frases guardadas en exportados/frases/<base>-frase-<n>.png y escribe exportados/<base>-frases.txt.
 * Una foto del momento sin video sale con el fondo de la marca y un aviso (nunca falla el lote).
 */
export async function guardarImagenesFrases(proyectoId: string, pintar: (html: string) => Promise<Buffer> = pintarPng): Promise<{ archivos: string[]; avisos: string[] }> {
  validarIdProyecto(proyectoId);
  const frases = await leerFrases(proyectoId);
  if (!frases.length) throw new Error("Primero saca las frases de la prédica.");
  const [proyecto, marca] = await Promise.all([leerProyecto(proyectoId), leerMarca()]);
  const base = await baseEntregas(proyectoId);
  const carpeta = await carpetaEntregas(proyectoId);
  const dir = join(carpeta, "frases");
  await mkdir(dir, { recursive: true });
  // Las imágenes de una vez anterior se borran: si no, una frase quitada seguiría en la carpeta.
  const prefijo = `${base}-frase-`;
  const vieja = (f: string) => f.startsWith(prefijo) && f.endsWith(".png") && /^\d+$/.test(f.slice(prefijo.length, -4));
  for (const f of await readdir(dir)) if (vieja(f)) await rm(join(dir, f), { force: true });
  const tmp = join(carpetaProyecto(proyectoId), "tmp");
  await mkdir(tmp, { recursive: true });
  const predicador = proyecto.predicador?.trim() || marca.predicador?.trim() || undefined;
  const fuentes = pathToFileURL(join(raizApp(), "node_modules", "@fontsource")).href;
  const url = (ruta?: string) => (ruta ? pathToFileURL(ruta).href : undefined);
  const avisos = new Set<string>();
  const archivos: string[] = [];
  const temporales: string[] = [];
  try {
    for (let i = 0; i < frases.length; i++) {
      const f = frases[i];
      let fondo: { tipo: Frase["fondo"]; src?: string } = { tipo: "marca" };
      if (f.fondo === "momento") {
        const cuadro = join(tmp, `frase-${i + 1}.jpg`);
        if (proyecto.videoDisponible && await cuadroDelMomento(proyecto.video.ruta, f.en + 0.5, cuadro)) {
          temporales.push(cuadro);
          fondo = { tipo: "momento", src: url(cuadro) };
        } else avisos.add(AVISO_SIN_VIDEO);
      } else if (f.fondo === "pintura") {
        const id = esPintura(f.pintura) ? f.pintura : Object.keys(PINTURAS)[0];
        fondo = { tipo: "pintura", src: url(join(rutaPinturas(), `${id}.jpg`)) };
      }
      const html = htmlTarjetaFrase({
        frase: f, marca, predicador, claves: f.clave ? [f.clave] : [], fondo, fuentes,
        logo: url(marca.logo), fuentePropia: url(marca.fuente),
      });
      const nombre = `${base}-frase-${i + 1}.png`;
      await writeFile(join(dir, nombre), await pintar(html));
      archivos.push(`frases/${nombre}`);
    }
  } finally {
    for (const t of temporales) await rm(t, { force: true });
  }
  const lineas = [`Frases de «${proyecto.nombre}»${predicador ? ` — ${predicador}` : ""}`, ""];
  for (const f of frases) {
    lineas.push(`«${f.texto}» — ${minuto(f.en)}`);
    if (f.versiculo?.confirmado) lineas.push(`   ${f.versiculo.ref} (RVR1960): ${f.versiculo.texto}`);
  }
  const txt = `${base}-frases.txt`;
  await writeFile(join(carpeta, txt), lineas.join("\n") + "\n", "utf8");
  archivos.push(txt);
  return { archivos, avisos: [...avisos] };
}
