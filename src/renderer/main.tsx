import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { aplicarTema, leerPreferencia } from "./tema";
// Fuentes incluidas en la app (sin internet): Geist, Geist Mono y Fraunces (OFL).
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-sans/latin-700.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import "@fontsource/fraunces/latin-600.css";
// Las del reel, para que las muestras de la galería se vean como el video.
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/figtree/latin-800.css";
import "./estilos/base.css";
import "./estilos/pantallas.css";
import "./estilos/pulido.css";

// tema.js ya pintó el tema guardado; con «Como Windows», esto además sigue los cambios de Windows.
aplicarTema(leerPreferencia());

// Soltar un archivo sobre la ventana no debe abrirlo en lugar de la app.
for (const evento of ["dragover", "drop"]) document.addEventListener(evento, (e) => e.preventDefault());

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
