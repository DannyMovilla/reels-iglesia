import { LoaderCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Chequeos } from "../componentes/Chequeos";
import { useSistema } from "./PrimerUso";

export function Ajustes() {
  const { estado, enCurso, error, revisar, accion, cancelar } = useSistema();
  const [revisando, setRevisando] = useState(false);
  const volver = async () => {
    setRevisando(true);
    try {
      await revisar();
    } finally {
      setRevisando(false);
    }
  };
  return (
    <section className="pantalla" aria-labelledby="t-ajustes">
      <div className="pantalla-cabeza">
        <h1 id="t-ajustes">Ajustes</h1>
        <button type="button" className="btn" onClick={() => void volver()} disabled={revisando || !!enCurso}>
          {revisando ? <LoaderCircle size={16} className="girar" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          Volver a revisar
        </button>
      </div>
      <p className="ayuda">Reels Iglesia necesita estas piezas en tu computadora. Si alguna falta, toca su botón y la app la instala.</p>
      <Chequeos estado={estado} enCurso={enCurso} alAccion={(a) => void accion(a)} alCancelar={cancelar} />
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
