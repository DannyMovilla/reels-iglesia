/**
 * Pinturas clásicas de dominio público (Wikimedia Commons) incluidas en la app, en resources/pinturas/<id>.jpg
 * (reducidas a 1600 px de alto). Se acreditan en NOTICE.md.
 */
export interface Pintura { obra: string; autor: string; anio: string; tema: string; fuente: string }

const commons = (archivo: string) => `https://commons.wikimedia.org/wiki/File:${archivo.replace(/ /g, "_")}`;

export const PINTURAS: Record<string, Pintura> = {
  prodigo: { obra: "El regreso del hijo pródigo", autor: "Rembrandt", anio: "hacia 1668", tema: "perdón, volver a casa, la gracia del Padre", fuente: commons("Rembrandt Harmensz van Rijn - Return of the Prodigal Son - Google Art Project.jpg") },
  llamado: { obra: "La vocación de san Mateo", autor: "Caravaggio", anio: "1599–1600", tema: "el llamado de Jesús, dejarlo todo, una vida nueva", fuente: commons("Calling-of-st-matthew.jpg") },
  tormenta: { obra: "Cristo en la tormenta en el mar de Galilea", autor: "Rembrandt", anio: "1633", tema: "fe en medio de la prueba, el miedo, la paz de Dios", fuente: commons("Rembrandt Christ in the Storm on the Lake of Galilee.jpg") },
  emaus: { obra: "La cena de Emaús", autor: "Caravaggio", anio: "1601", tema: "la resurrección, Jesús se revela, la comunión", fuente: commons("1602-3 Caravaggio,Supper at Emmaus National Gallery, London.jpg") },
  moises: { obra: "Moisés con las tablas de la ley", autor: "Rembrandt", anio: "1659", tema: "la Palabra de Dios, la obediencia, los mandamientos", fuente: commons("Rembrandt - Moses with the Ten Commandments - Google Art Project.jpg") },
  monte: { obra: "El sermón del monte", autor: "Carl Bloch", anio: "1877", tema: "la enseñanza de Jesús, las bienaventuranzas", fuente: commons("Bloch-SermonOnTheMount.jpg") },
  pastor: { obra: "El buen pastor", autor: "Bartolomé Esteban Murillo", anio: "hacia 1660", tema: "el cuidado de Dios, el Señor es mi pastor", fuente: commons("BuenPastorMurillo1660.jpg") },
  cruz: { obra: "Cristo abrazado a la cruz", autor: "El Greco", anio: "hacia 1600", tema: "la cruz, el sacrificio de Jesús, seguirle", fuente: commons("Cristo abrazado a la cruz (El Greco, Museo del Prado).jpg") },
  montana: { obra: "La cruz en la montaña", autor: "Caspar David Friedrich", anio: "1808", tema: "esperanza, una fe firme, la cruz que permanece", fuente: commons("Caspar David Friedrich - Das Kreuz im Gebirge.jpg") },
  transfiguracion: { obra: "La transfiguración", autor: "Rafael", anio: "1516–1520", tema: "la gloria de Dios, la revelación, escuchar a Jesús", fuente: commons("Transfiguration Raphael.jpg") },
  marta: { obra: "Cristo en casa de Marta y María", autor: "Johannes Vermeer", anio: "hacia 1655", tema: "escuchar a Jesús, el descanso, lo más importante", fuente: commons("Johannes (Jan) Vermeer - Christ in the House of Martha and Mary - Google Art Project.jpg") },
};

/** ¿Es una de las pinturas incluidas? (sin aceptar claves heredadas como «constructor»). */
export const esPintura = (id: string | undefined | null): id is string => !!id && Object.hasOwn(PINTURAS, id);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const n = (x: number) => String(Math.round(x * 100) / 100);

/** Fondo con la pintura: llena el cuadro sin deformarse, se acerca y se mueve despacio, con velo para leer el texto. */
export function htmlPintura(id: string, base: string, D: number): { el: string[]; js: string[] } {
  return {
    el: [`<img id="pintura" class="pintura" src="${esc(`${base}/${id}.jpg`)}" alt="">`, `<div class="velo-fondo"></div>`],
    js: [`tl.fromTo("#pintura", { scale: 1.04, x: -20, y: 10 }, { scale: 1.16, x: 20, y: -10, duration: ${n(D)}, ease: "sine.inOut" }, 0);`],
  };
}
