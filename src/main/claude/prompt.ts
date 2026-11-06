import type { Transcripcion } from "@shared/tipos";

/** 6284 → "1:44:44" */
export function tiempoH(seg: number): string {
  const t = Math.floor(seg);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Prompt de selección de clips (versión del artefacto Púlpito Clips, ampliada). */
export function construirPrompt(t: Transcripcion, n: number): string {
  const lineas = t.segmentos.map((s) => `[${tiempoH(s.s)} - ${tiempoH(s.e)}] ${s.t}`).join("\n");
  return `Eres el editor de redes sociales de una iglesia cristiana hispana. Abajo está la transcripción, con marcas de tiempo, de una prédica de un culto. Elige los ${n} mejores momentos para convertirlos en reels verticales (Instagram, TikTok, Facebook, YouTube Shorts) que generen interacción: que la gente comente, comparta o guarde.

Cada clip debe:
- durar entre 30 y 90 segundos (lo ideal es 45 a 60); si la prédica es corta, puede bajar a 15 segundos y puedes devolver menos clips,
- entenderse solo, sin haber visto el resto de la prédica,
- empezar con una frase fuerte: nunca a mitad de idea, ni con "y entonces", saludos o avisos,
- terminar con la idea cerrada,
- ser fiel al mensaje: no saques frases de contexto para que digan algo que el predicador no quiso decir.

Prioriza: la verdad central del mensaje, frases memorables, explicaciones claras de un pasaje bíblico, historias o ilustraciones, momentos de esperanza o consuelo, exhortaciones y llamados a la acción. Evita: anuncios, ofrendas, oraciones largas, partes con música y clips que repitan la misma idea.

"inicio" debe ser el inicio de una línea de la transcripción y "fin" el final de una línea (usa exactamente esas marcas, en formato H:MM:SS).

Responde solo con un arreglo JSON, de mayor a menor puntaje, con esta forma:
[{"titulo":"La fidelidad de Dios en todo tiempo","gancho":"Tu prueba no es el final","ganchos_alternativos":["Dios no ha terminado contigo","¿Sientes que todo se acabó?"],"categoria":"Esperanza","inicio":"0:18:32","fin":"0:19:26","intro_frase":"Dios no ha terminado contigo","palabras_clave":["Dios","prueba","fiel"],"versiculos":[{"ref":"Romanos 8:28","cita":"todas las cosas les ayudan a bien","texto":"Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados."}],"puntaje":92,"razon":"Por qué generaría interacción, en una oración.","descripcion":"Texto para publicar, 1 o 2 oraciones, que termine con una pregunta que invite a comentar.","hashtags":["#fe","#esperanza"]}]

"gancho": máximo 8 palabras, va escrito como título en los primeros segundos.
"ganchos_alternativos": otras 2 opciones de gancho con un enfoque distinto.
"intro_frase": la frase más fuerte que se dice DENTRO del clip, copiada palabra por palabra de la transcripción, de 5 a 15 palabras (unos 3 a 6 segundos hablados). Se mostrará al inicio del reel, en blanco y negro, como adelanto antes del clip.
"palabras_clave": de 3 a 6 palabras importantes que se dicen en el clip, para resaltarlas en los subtítulos.
"versiculos": solo los pasajes bíblicos que el predicador menciona o lee DENTRO del clip. "ref" es la referencia (libro capítulo:versículo) y "cita" son 4 a 10 palabras exactas de la transcripción donde lo menciona y "texto" es el versículo completo en la Reina-Valera 1960, palabra por palabra (la persona lo revisará antes de publicar). Nunca inventes versículos; si no menciona ninguno, usa [].
"categoria": una de Enseñanza, Reflexión, Exhortación, Esperanza, Testimonio, Llamado.
"puntaje": de 0 a 100, qué tanto crees que va a funcionar.

Transcripción:
${lineas}`;
}
