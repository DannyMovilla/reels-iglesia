import { useEffect, useState } from "react";
import type { EstadoActualizacion } from "@shared/actualizacion";

/** Estado de las actualizaciones, al día con los avisos del proceso principal (null mientras no se sabe). */
export function useActualizacion(): EstadoActualizacion | null {
  const [estado, setEstado] = useState<EstadoActualizacion | null>(null);
  useEffect(() => {
    const api = window.reels;
    // Las pruebas de otras pantallas no simulan las actualizaciones.
    if (!api?.estadoActualizacion) return;
    let vivo = true;
    // Un aviso que llega antes que la respuesta inicial es más nuevo: la respuesta vieja no lo pisa.
    let avisado = false;
    void api.estadoActualizacion().then((e) => { if (vivo && !avisado) setEstado(e); });
    const quitar = api.alCambiarActualizacion((e) => { avisado = true; setEstado(e); });
    return () => { vivo = false; quitar(); };
  }, []);
  return estado;
}
