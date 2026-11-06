import { z } from "zod";
import { CATEGORIAS, type Categoria } from "@shared/tipos";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Acepta "Reflexion", "reflexión", etc. y devuelve la categoría canónica. */
const categoria = z.preprocess(
  (v) => (typeof v === "string" ? CATEGORIAS.find((c) => sinTildes(c) === sinTildes(v)) ?? v : v),
  z.enum(CATEGORIAS),
) as z.ZodType<Categoria>;

export const ClipClaude = z.object({
  titulo: z.string(),
  gancho: z.string(),
  ganchos_alternativos: z.array(z.string()).default([]).transform((a) => a.slice(0, 3)),
  categoria,
  inicio: z.string(),
  fin: z.string(),
  intro_frase: z.string().optional(),
  palabras_clave: z.array(z.string()).default([]),
  versiculos: z.array(z.object({ ref: z.string(), cita: z.string(), texto: z.string().default("") })).default([]),
  puntaje: z.coerce.number().min(0).max(100),
  razon: z.string().default(""),
  descripcion: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
});

export const RespuestaClaude = z.array(ClipClaude);
export type ClipClaude = z.infer<typeof ClipClaude>;
