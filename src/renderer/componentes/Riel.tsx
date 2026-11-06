import type { LucideIcon } from "lucide-react";
import { AudioLines, Clapperboard, FolderOpen, MicVocal, Music, Palette, Settings, WandSparkles } from "lucide-react";

export type Seccion = "predicas" | "proyectos" | "ia" | "exportados" | "marca" | "musica" | "ajustes";

const PRINCIPALES: { id: Seccion; texto: string; Icono: LucideIcon }[] = [
  { id: "predicas", texto: "Prédicas", Icono: MicVocal },
  { id: "proyectos", texto: "Proyectos", Icono: FolderOpen },
  { id: "ia", texto: "Con IA", Icono: WandSparkles },
  { id: "exportados", texto: "Exportados", Icono: Clapperboard },
  { id: "marca", texto: "Marca", Icono: Palette },
  { id: "musica", texto: "Música", Icono: AudioLines },
];
const PRONTO: { texto: string; Icono: LucideIcon }[] = [
  { texto: "Canciones", Icono: Music },
];

interface Props {
  actual: Seccion;
  alCambiar(id: Seccion): void;
}

export function Riel({ actual, alCambiar }: Props) {
  const enlace = (id: Seccion, texto: string, Icono: LucideIcon) => (
    <a
      key={id}
      href="#"
      aria-current={actual === id ? "page" : undefined}
      onClick={(e) => {
        e.preventDefault();
        alCambiar(id);
      }}
    >
      <Icono size={19} strokeWidth={1.8} aria-hidden="true" />
      {texto}
    </a>
  );
  return (
    <nav className="riel" aria-label="Secciones">
      {PRINCIPALES.map(({ id, texto, Icono }) => enlace(id, texto, Icono))}
      <span className="separador" />
      <span className="pronto">Pronto</span>
      {PRONTO.map(({ texto, Icono }) => (
        <a key={texto} href="#" aria-disabled="true" title="Próximamente" onClick={(e) => e.preventDefault()}>
          <Icono size={19} strokeWidth={1.8} aria-hidden="true" />
          {texto}
        </a>
      ))}
      <span className="espacio" />
      {enlace("ajustes", "Ajustes", Settings)}
    </nav>
  );
}
