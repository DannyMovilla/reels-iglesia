import { useState } from "react";
import { BarraTitulo } from "./componentes/BarraTitulo";
import { Riel, type Seccion } from "./componentes/Riel";

export function App() {
  const [seccion, setSeccion] = useState<Seccion>("predicas");
  return (
    <div className="app">
      <BarraTitulo migas={[]} />
      <Riel actual={seccion} alCambiar={setSeccion} />
      <main className="contenido" aria-label="Contenido" />
    </div>
  );
}
