import { useEffect, useState } from "react";
import { BarraTitulo } from "./componentes/BarraTitulo";
import { Riel, type Seccion } from "./componentes/Riel";
import { Ajustes } from "./pantallas/Ajustes";
import { Editor } from "./pantallas/Editor";
import { Exportados } from "./pantallas/Exportados";
import { Marca } from "./pantallas/Marca";
import { Musica } from "./pantallas/Musica";
import { PrimerUso } from "./pantallas/PrimerUso";
import { ConIA } from "./pantallas/ConIA";
import { NuevaPredica } from "./pantallas/NuevaPredica";
import { Predicas } from "./pantallas/Predicas";

type Vista = { tipo: "predicas" } | { tipo: "nueva" } | { tipo: "editor"; id: string; nombre: string } | { tipo: "ajustes" } | { tipo: "exportados" } | { tipo: "marca" } | { tipo: "musica" } | { tipo: "ia" } | { tipo: "pronto"; seccion: Seccion };

export function App() {
  const [vista, setVista] = useState<Vista>({ tipo: "predicas" });
  const [primerUso, setPrimerUso] = useState(false);
  // Al abrir: si falta Python o FFmpeg, primero el asistente (revisión rápida, sin consultar a Claude).
  useEffect(() => {
    void window.reels?.verificarSistema().then((e) => setPrimerUso(!e.python.ok || !e.ffmpeg.ok)).catch(() => {});
  }, []);
  const seccion: Seccion = vista.tipo === "ajustes" ? "ajustes" : vista.tipo === "exportados" ? "exportados" : vista.tipo === "marca" ? "marca" : vista.tipo === "musica" ? "musica" : vista.tipo === "ia" ? "ia" : vista.tipo === "pronto" ? vista.seccion : "predicas";
  const migas = vista.tipo === "nueva" ? ["Prédicas", "Nueva prédica"] : vista.tipo === "editor" ? ["Prédicas", vista.nombre]
    : vista.tipo === "ajustes" ? ["Ajustes"] : vista.tipo === "exportados" ? ["Exportados"] : vista.tipo === "marca" ? ["Marca"] : vista.tipo === "musica" ? ["Música"] : vista.tipo === "ia" ? ["Con IA"] : [];

  const cambiar = (s: Seccion) => setVista(s === "predicas" ? { tipo: "predicas" } : s === "ajustes" ? { tipo: "ajustes" } : s === "exportados" ? { tipo: "exportados" } : s === "marca" ? { tipo: "marca" } : s === "musica" ? { tipo: "musica" } : s === "ia" ? { tipo: "ia" } : { tipo: "pronto", seccion: s });

  return (
    <div className="app">
      <BarraTitulo migas={migas} />
      <Riel actual={seccion} alCambiar={cambiar} />
      <main className={`contenido ${vista.tipo === "editor" && !primerUso ? "sin-scroll" : ""}`} aria-label="Contenido">
        {primerUso && <PrimerUso alListo={() => setPrimerUso(false)} />}
        {!primerUso && <>
        {vista.tipo === "predicas" && (
          <Predicas alNueva={() => setVista({ tipo: "nueva" })}
            alAbrir={(id) => void window.reels!.leerProyecto(id).then((p) => setVista({ tipo: "editor", id, nombre: p.nombre }))} />
        )}
        {vista.tipo === "nueva" && (
          <NuevaPredica alCancelar={() => setVista({ tipo: "predicas" })} alCrear={(p) => setVista({ tipo: "editor", id: p.id, nombre: p.nombre })} />
        )}
        {vista.tipo === "editor" && <Editor key={vista.id} proyectoId={vista.id} />}
        {vista.tipo === "ajustes" && <Ajustes />}
        {vista.tipo === "exportados" && <Exportados />}
        {vista.tipo === "marca" && <Marca />}
        {vista.tipo === "musica" && <Musica />}
        {vista.tipo === "ia" && <ConIA />}
        {vista.tipo === "pronto" && (
          <section className="pantalla"><h1>Muy pronto</h1><p className="ayuda">Esta sección llega en la siguiente etapa de Reels Iglesia.</p></section>
        )}
        </>}
      </main>
    </div>
  );
}
