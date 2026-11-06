import { z } from "zod";
import { ANIMOS, CATEGORIAS, type Animo, type Categoria } from "@shared/tipos";

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Acepta "Reflexion", "reflexión", etc. y devuelve la categoría canónica. */
const categoria = z.preprocess(
  (v) => (typeof v === "string" ? CATEGORIAS.find((c) => sinTildes(c) === sinTildes(v)) ?? v : v),
  z.enum(CATEGORIAS),
) as z.ZodType<Categoria>;

/** Acepta "Adoración", "ADORACION", etc.; un ánimo desconocido se ignora (se usa el de la categoría). */
const animo = z.preprocess(
  (v) => (typeof v === "string" ? ANIMOS.find((a) => sinTildes(a) === sinTildes(v)) : undefined),
  z.enum(ANIMOS as unknown as [Animo, ...Animo[]]).optional(),
) as z.ZodType<Animo | undefined>;

const conHashtags = z.object({ texto: z.string().default(""), hashtags: z.array(z.string()).default([]) });
const redes = z.object({
  instagram: conHashtags,
  tiktok: conHashtags,
  facebook: z.object({ texto: z.string().default("") }),
  youtube: z.object({ titulo: z.string().default(""), texto: z.string().default("") }),
}).optional().catch(undefined);

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
  animo,
  redes,
});

export const RespuestaClaude = z.array(ClipClaude);
export type ClipClaude = z.infer<typeof ClipClaude>;
