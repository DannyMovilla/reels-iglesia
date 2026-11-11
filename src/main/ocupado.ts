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
