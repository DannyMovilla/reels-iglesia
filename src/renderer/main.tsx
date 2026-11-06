import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./estilos/base.css";
import "./estilos/pantallas.css";

// Soltar un archivo sobre la ventana no debe abrirlo en lugar de la app.
for (const evento of ["dragover", "drop"]) document.addEventListener(evento, (e) => e.preventDefault());

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
