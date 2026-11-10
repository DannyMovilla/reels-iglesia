import { useEffect, useRef, useState } from "react";
import "@hyperframes/player";
import { ImagePlus, TriangleAlert, Type, X } from "lucide-react";
import { construirMuestraMarca } from "@shared/reel/composicion";
import { MULETILLAS_POR_DEFECTO } from "@shared/reel/cortes-voz";
import { Segmentos } from "../componentes/Inspector";
import type { Marca as TMarca } from "@shared/tipos";

type Red = keyof TMarca["redes"];
const REDES: [Red, string][] = [["instagram", "Instagram"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["youtube", "YouTube"]];

/** "C:\…\marca\logo.png" → "marca/logo.png" (servido por reels-comp:// en la vista previa). */
export const urlLogoVista = (logo?: string): string | undefined => (logo ? `marca/${logo.split(/[\\/]/).pop()}` : undefined);

let version = 0;

/** Marca de la iglesia: lo que aparece en el cierre de cada reel, con vista previa en vivo. */
export function Marca() {
  const [marca, setMarca] = useState<TMarca | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [errorFuente, setErrorFuente] = useState<string | null>(null);
  const guardando = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reproductor = useRef<(HTMLElement & { seek(t: number): void }) | null>(null);

  useEffect(() => {
    void window.reels!.leerMarca().then(setMarca);
  }, []);

  // Vista previa: la tarjeta de cierre con la marca actual.
  useEffect(() => {
    if (!marca) return;
    const espera = setTimeout(async () => {
      const m = construirMuestraMarca({
        marca, formato: "9:16", modo: "vista",
        recursos: { gsap: "recursos/gsap.min.js", fuentes: "recursos/fuentes", runtime: "recursos/hyperframe.runtime.iife.js", logo: urlLogoVista(marca.logo) },
      });
      // El parámetro cambia la URL del logo para que el reproductor no muestre uno viejo.
      setSrc(await window.reels!.registrarVista(`marca-${++version}`, m.html.replace(/(marca\/logo\.\w+)/, `$1?v=${version}`)));
    }, 250);
    return () => clearTimeout(espera);
  }, [marca]);

  // Al cargar la muestra, mostrar la tarjeta ya armada (la animación de entrada dura ~1 s).
  useEffect(() => {
    const el = reproductor.current;
    if (!el || !src) return;
    const alListo = () => el.seek(1.6);
    el.addEventListener("ready", alListo);
    return () => el.removeEventListener("ready", alListo);
  }, [src]);

  if (!marca) return <div className="cargando">Cargando…</div>;

  const cambiar = (parcial: Partial<TMarca>) => {
    const nueva = { ...marca, ...parcial };
    setMarca(nueva);
    if (guardando.current) clearTimeout(guardando.current);
    guardando.current = setTimeout(() => void window.reels!.guardarMarca(nueva), 400);
  };

  const elegirFuente = async () => {
    setErrorFuente(null);
    try {
      const ruta = await window.reels!.elegirFuente();
      if (ruta) cambiar({ fuente: ruta });
    } catch (e) {
      setErrorFuente((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
    }
  };

  const elegirLogo = async () => {
    const ruta = await window.reels!.elegirLogo();
    if (ruta) cambiar({ logo: ruta });
  };

  return (
    <section className="pantalla marca-pantalla" aria-labelledby="t-marca">
      <div className="pantalla-cabeza"><h1 id="t-marca">Marca</h1></div>
      <p className="ayuda">Así aparece tu iglesia al final de cada reel. Los cambios se guardan solos.</p>
      <div className="marca-grid">
        <div className="marca-form">
          <label className="campo">Nombre de la iglesia
            <input className="entrada" value={marca.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
          </label>
          <label className="campo">Invitación
            <input className="entrada" value={marca.invitacion} placeholder="Síguenos · Domingos 10:00 AM" onChange={(e) => cambiar({ invitacion: e.target.value })} />
          </label>
          <div className="campo">Color principal
            <div className="fila">
              <input type="color" aria-label="Color principal" value={marca.color} onChange={(e) => cambiar({ color: e.target.value })} />
              <input key={marca.color} className="entrada mono corta" aria-label="Color en hexadecimal" defaultValue={marca.color}
                onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && cambiar({ color: e.target.value })} />
            </div>
          </div>
          <div className="campo">Logo
            <div className="fila">
              <button type="button" className="btn" onClick={() => void elegirLogo()}><ImagePlus size={16} aria-hidden="true" />{marca.logo ? "Cambiar logo" : "Elegir logo"}</button>
              {marca.logo && <span className="ayuda">PNG con fondo transparente se ve mejor.</span>}
            </div>
          </div>
          <div className="campo">Fuente de la iglesia
            <div className="fila">
              <button type="button" className="btn" onClick={() => void elegirFuente()}><Type size={16} aria-hidden="true" />{marca.fuente ? "Cambiar fuente de la iglesia" : "Elegir fuente de la iglesia"}</button>
              {marca.fuente && <span className="ayuda mono">{marca.fuente.split(/[\\/]/).pop()}</span>}
              {marca.fuente && <button type="button" className="btn pequeno fantasma" onClick={() => cambiar({ fuente: undefined })}>Quitar fuente</button>}
            </div>
            <span className="ayuda">Un archivo TTF, OTF, WOFF o WOFF2. Luego elígela en cada clip o en el estilo de la iglesia.</span>
            {errorFuente && <span className="error" role="alert">{errorFuente}</span>}
          </div>
          <MarcaDuranteReel marca={marca} alCambiar={(marcaReel) => cambiar({ marcaReel })} />
          <label className="campo">
            <span className="campo-cabeza">Tamaño del logo <span className="mono">{Math.round(marca.logoEscala * 100)} %</span></span>
            <input type="range" aria-label="Tamaño del logo" min={50} max={150} step={5} value={Math.round(marca.logoEscala * 100)} onChange={(e) => cambiar({ logoEscala: Number(e.target.value) / 100 })} />
          </label>
          <fieldset className="grupo-redes">
            <legend>Redes de la iglesia</legend>
            {REDES.map(([red, nombre]) => (
              <label key={red} className="campo">{nombre}
                <input className="entrada" value={marca.redes[red] ? `@${marca.redes[red]}` : ""} placeholder="@usuario"
                  onChange={(e) => cambiar({ redes: { ...marca.redes, [red]: e.target.value.replace(/^@+/, "").trim() || undefined } })} />
              </label>
            ))}
          </fieldset>
          <label className="campo">Predicador por defecto
            <input className="entrada" value={marca.predicador ?? ""} placeholder="Pastor Juan Pérez" onChange={(e) => cambiar({ predicador: e.target.value || undefined })} />
          </label>
          <Muletillas lista={marca.estilo.cortes.lista ?? MULETILLAS_POR_DEFECTO}
            alCambiar={(lista) => cambiar({ estilo: { ...marca.estilo, cortes: { ...marca.estilo.cortes, lista } } })} />
        </div>
        <div className="marca-vista" aria-label="Vista previa del cierre">
          <div className="pantalla-reel" style={{ aspectRatio: "1080 / 1920" }}>
            {src && <hyperframes-player ref={reproductor as never} src={src} width={1080} height={1920} controls />}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Muletillas que se quitan de los clips (solo cuando van sueltas). Llegan a los clips con "Aplicar a todos los clips". */
function Muletillas({ lista, alCambiar }: { lista: string[]; alCambiar(l: string[]): void }) {
  const [nueva, setNueva] = useState("");
  const agregar = () => {
    const t = nueva.trim().toLowerCase();
    if (t && !lista.includes(t)) alCambiar([...lista, t]);
    setNueva("");
  };
  return (
    <fieldset className="grupo-redes muletillas">
      <legend>Muletillas que se quitan</legend>
      <p className="ayuda">Solo se quitan cuando van sueltas, con una pausa antes o después.</p>
      <div className="chips">
        {lista.map((m) => (
          <span key={m} className="chip">{m}
            <button type="button" aria-label={`Quitar «${m}»`} onClick={() => alCambiar(lista.filter((x) => x !== m))}><X size={12} aria-hidden="true" /></button>
          </span>
        ))}
      </div>
      <div className="fila">
        <input className="entrada" aria-label="Agregar muletilla" placeholder="Escribe y presiona Enter" value={nueva}
          onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }} />
        <button type="button" className="btn pequeno fantasma" onClick={() => alCambiar([...MULETILLAS_POR_DEFECTO])}>Restablecer</button>
      </div>
    </fieldset>
  );
}

/** Qué se ve abajo durante el reel: el nombre, el logo o los dos, con su tamaño y una muestra. */
function MarcaDuranteReel({ marca, alCambiar }: { marca: TMarca; alCambiar(m: NonNullable<TMarca["marcaReel"]>): void }) {
  const actual = marca.marcaReel ?? { modo: "texto" as const, tamano: 1 };
  /** El archivo del logo ya no está (se borró o se movió): se avisa y la muestra usa el nombre. */
  const [roto, setRoto] = useState<string | null>(null);
  const logoRoto = !!marca.logo && roto === marca.logo;
  const conLogo = actual.modo !== "texto" && !!marca.logo && !logoRoto;
  const conTexto = !conLogo || actual.modo === "ambos";
  const logoVista = urlLogoVista(marca.logo);
  return (
    <div className="campo">Marca durante el reel
      <Segmentos etiqueta="Marca durante el reel" valor={actual.modo}
        opciones={[["texto", "Texto"], ["logo", "Logo"], ["ambos", "Logo y texto"]] as ["texto" | "logo" | "ambos", string][]}
        alCambiar={(modo) => alCambiar({ ...actual, modo })} />
      {actual.modo !== "texto" && !marca.logo && <span className="ayuda">Todavía no hay logo: se verá el nombre hasta que elijas uno.</span>}
      {logoRoto && <p className="aviso-chico" role="alert"><TriangleAlert size={13} aria-hidden="true" />No encuentro el archivo del logo: elige otro</p>}
      <span className="campo-cabeza">Tamaño de la marca <span className="mono">{Math.round(actual.tamano * 100)} %</span></span>
      <input type="range" aria-label="Tamaño de la marca" min={50} max={150} step={5} value={Math.round(actual.tamano * 100)}
        onChange={(e) => alCambiar({ ...actual, tamano: Number(e.target.value) / 100 })} />
      <div className="muestra-marca" aria-label="Muestra de la marca durante el reel">
        {conLogo && logoVista && <img src={window.reels?.urlMarca?.(marca.logo!) ?? logoVista} alt="" style={{ height: Math.round(28 * actual.tamano) }}
          onError={() => setRoto(marca.logo ?? null)} />}
        {conTexto && <span style={{ fontSize: Math.round(14 * actual.tamano) }}>{marca.nombre}</span>}
      </div>
    </div>
  );
}
