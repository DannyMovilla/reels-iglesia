import { useState } from "react";
import { BarraTitulo } from "./componentes/BarraTitulo";
import { Riel, type Seccion } from "./componentes/Riel";
import { Ajustes } from "./pantallas/Ajustes";

export function App() {
  const [seccion, setSeccion] = useState<Seccion>("predicas");
  return (
    <div className="app">
      <BarraTitulo migas={seccion === "ajustes" ? ["Ajustes"] : []} />
      <Riel actual={seccion} alCambiar={setSeccion} />
      <main className="contenido" aria-label="Contenido">
        {seccion === "ajustes" && <Ajustes />}
      </main>
    </div>
  );
}
