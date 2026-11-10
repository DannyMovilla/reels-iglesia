/**
 * Tareas largas del renderer que deben seguir vivas aunque el componente que las lanzó se desmonte
 * (por ejemplo, buscar frases o traducir mientras la persona cambia de pestaña). Viven en el módulo, no en React.
 */
interface Entrada {
  promesa: Promise<unknown>;
  progreso: string | null;
  oyentes: Set<(p: string | null) => void>;
}

const tareas = new Map<string, Entrada>();

/** Corre `f` una sola vez por clave: si ya hay una en curso con esa clave, devuelve la misma promesa. */
export function lanzar<T>(clave: string, f: (alProgreso: (texto: string | null) => void) => Promise<T>): Promise<T> {
  const ya = tareas.get(clave);
  if (ya) return ya.promesa as Promise<T>;
  const e: Entrada = { promesa: Promise.resolve(), progreso: null, oyentes: new Set() };
  const avisar = (p: string | null) => { for (const o of e.oyentes) o(p); };
  const alProgreso = (texto: string | null) => { e.progreso = texto; avisar(texto); };
  const promesa = (async () => f(alProgreso))().finally(() => {
    tareas.delete(clave);
    avisar(null);
  });
  e.promesa = promesa;
  tareas.set(clave, e);
  return promesa;
}

/** La tarea en curso con esa clave (su promesa y el último progreso), si hay una. */
export function enCurso<T>(clave: string): { promesa: Promise<T>; progreso: string | null } | undefined {
  const e = tareas.get(clave);
  return e ? { promesa: e.promesa as Promise<T>, progreso: e.progreso } : undefined;
}

/** Avisa cada cambio de progreso de la tarea con esa clave, y una vez más (con null) cuando termina. */
export function alCambiar(clave: string, cb: (progreso: string | null) => void): () => void {
  const e = tareas.get(clave);
  if (!e) return () => {};
  e.oyentes.add(cb);
  return () => { e.oyentes.delete(cb); };
}
