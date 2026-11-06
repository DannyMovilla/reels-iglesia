/** Memoriza el resultado por clave, pero no los errores (el siguiente intento vuelve a probar). */
export function cacheSinErrores<T>(fn: (clave: string) => Promise<T>): (clave: string) => Promise<T> {
  const guardado = new Map<string, Promise<T>>();
  return (clave) => {
    const previo = guardado.get(clave);
    if (previo) return previo;
    const p = fn(clave).catch((e) => {
      guardado.delete(clave);
      throw e;
    });
    guardado.set(clave, p);
    return p;
  };
}
