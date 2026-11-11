/** Bytes en palabras con coma decimal: «820 KB», «12,4 MB», «1,2 GB». */
export function formatoTamano(bytes: number): string {
  const coma = (x: number) => x.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (bytes >= 1e9) return `${coma(bytes / 1e9)} GB`;
  if (bytes >= 1e6) return `${coma(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}
