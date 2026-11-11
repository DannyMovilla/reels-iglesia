import type { Tarea } from "@shared/tipos";

/**
 * Qué está trabajando: tareas de la cola pendientes o corriendo (prédicas y «Con IA», con id `ia:<id>`) y entregas
 * largas fuera de la cola (traducciones y frases). Lo usan las actualizaciones (no reiniciar), borrar y liberar espacio.
 */
export function crearOcupado(d: { tareas: () => Tarea[]; entregas: () => string[] }): { proyectoOcupado(id: string): boolean; hayTrabajo(): boolean } {
  const activas = () => d.tareas().filter((t) => t.estado === "pendiente" || t.estado === "corriendo");
  return {
    proyectoOcupado: (id) => activas().some((t) => t.proyectoId === id) || d.entregas().includes(id),
    hayTrabajo: () => activas().length > 0 || d.entregas().length > 0,
  };
}

/** Trabajo largo fuera de la cola (MP3, imágenes de frases, preparar una voz), por prédica. */
const enCurso = new Map<string, number>();

/** Corre `f` marcando la prédica como ocupada mientras dura (también si falla). */
export async function conTrabajo<T>(id: string, f: () => Promise<T>): Promise<T> {
  enCurso.set(id, (enCurso.get(id) ?? 0) + 1);
  try {
    return await f();
  } finally {
    const n = (enCurso.get(id) ?? 1) - 1;
    if (n > 0) enCurso.set(id, n);
    else enCurso.delete(id);
  }
}

/** Prédicas con trabajo fuera de la cola en curso. */
export const trabajosEnCurso = (): string[] => [...enCurso.keys()];
