import { cssEstilosSub } from "./estilos-sub";

/** CSS de la composición del reel (HyperFrames). Las fuentes vienen de la carpeta local de recursos. */
export function cssComposicion(p: { ancho: number; alto: number; color: string; fuentes: string; tamanoSub: number; estiloSub: string }): string {
  const f = p.fuentes;
  return `
@font-face { font-family: "Montserrat"; font-weight: 900; src: url("${f}/montserrat/files/montserrat-latin-900-normal.woff2") format("woff2"); }
@font-face { font-family: "Montserrat"; font-weight: 800; src: url("${f}/montserrat/files/montserrat-latin-800-normal.woff2") format("woff2"); }
@font-face { font-family: "Figtree"; font-weight: 600; src: url("${f}/figtree/files/figtree-latin-600-normal.woff2") format("woff2"); }
@font-face { font-family: "Figtree"; font-weight: 800; src: url("${f}/figtree/files/figtree-latin-800-normal.woff2") format("woff2"); }
:root { --marca: ${p.color}; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${p.ancho}px; height: ${p.alto}px; overflow: hidden; background: #000; }
#root { position: relative; width: ${p.ancho}px; height: ${p.alto}px; overflow: hidden; font-family: Figtree, sans-serif; }
.video { position: absolute; left: 0; top: 0; object-fit: fill; }
.vineta { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.6) 100%); }
.sombra { position: absolute; left: 0; right: 0; bottom: 0; height: 40%; background: linear-gradient(transparent, rgba(0,0,0,.55)); }
.flash { position: absolute; inset: 0; background: #fff; }
.gancho { position: absolute; left: 50%; transform: translate(-50%, -50%); max-width: ${p.ancho - 160}px; width: max-content;
  background: #fff; color: #111; font: 800 60px/1.15 Figtree, sans-serif; text-align: center; padding: 26px 44px 34px;
  border-radius: 26px; box-shadow: 0 14px 40px rgba(0,0,0,.35); }
.gancho i { position: absolute; left: 36px; right: 36px; bottom: 12px; height: 8px; border-radius: 4px; background: var(--marca); }
.sub { position: absolute; left: 60px; right: 60px; text-align: center; transform: translateY(-50%); color: #fff; line-height: 1.25; }
.sub .w { display: inline-block; margin: 0 0.14em; }
.sub.pop { font: 900 ${p.tamanoSub}px/1.25 Montserrat, sans-serif; }
.sub.pop .w { -webkit-text-stroke: ${Math.round(p.tamanoSub * 0.17)}px #0b0b0b; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0,0,0,.5); }
.sub.caja { font: 900 ${p.tamanoSub}px/1.3 Montserrat, sans-serif; }
.sub.caja .w { padding: 0 0.18em; border-radius: 14px; -webkit-text-stroke: ${Math.round(p.tamanoSub * 0.15)}px #0b0b0b; paint-order: stroke fill; }
.sub.limpio { font: 800 ${p.tamanoSub}px/1.3 Figtree, sans-serif; text-shadow: 0 3px 16px rgba(0,0,0,.75); }
.sub .clave { color: var(--marca); }
.vers { position: absolute; left: 0; width: ${Math.round(p.ancho * 0.84)}px; background: rgba(12,14,28,.84); color: #fff;
  padding: 26px 34px 30px 46px; border-radius: 0 22px 22px 0; border-left: 12px solid var(--marca); }
.vers b { display: block; font: 800 44px/1.1 Figtree, sans-serif; color: var(--marca); margin-bottom: 10px; }
.vers b small { font: 600 26px Figtree, sans-serif; color: rgba(255,255,255,.7); margin-left: 12px; }
.vers p { font: 600 34px/1.35 Figtree, sans-serif; }
.marca { position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; color: #fff; font: 700 38px Figtree, sans-serif; text-shadow: 0 4px 14px rgba(0,0,0,.6); }
.prog { position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: var(--marca); transform-origin: left center; }
.cierre { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px;
  background: radial-gradient(circle at 50% 40%, #2a2340 0%, #0b0b14 70%); color: #fff; text-align: center; }
.cierre .logo { width: 220px; height: 220px; border-radius: 50%; background: var(--marca); color: #111; display: grid; place-items: center; font: 900 120px Montserrat, sans-serif; overflow: hidden; }
.cierre .logo img { width: 100%; height: 100%; object-fit: contain; }
.cierre .logo.con-imagen { border-radius: 0; background: none; overflow: visible; }
.muestra-fondo { position: absolute; inset: 0; background: radial-gradient(circle at 50% 35%, #2a3352, #0a0c16 70%); }
.cierre h2 { font: 900 76px/1.1 Montserrat, sans-serif; padding: 0 40px; }
.cierre p { font: 700 44px Figtree, sans-serif; color: var(--marca); padding: 0 40px; }
.luz { position: absolute; inset: -16%; overflow: hidden; pointer-events: none; mix-blend-mode: screen; }
.luz i { position: absolute; inset: -20%; }
.luz .ambar { background: radial-gradient(ellipse 52% 110% at 10% 58%, rgb(255 241 197 / 92%), transparent 45%), radial-gradient(ellipse 72% 120% at 24% 54%, rgb(255 126 57 / 78%), transparent 66%); filter: blur(28px); }
.luz .rojo { background: radial-gradient(ellipse 58% 105% at 78% 34%, rgb(255 79 61 / 60%), rgb(255 44 92 / 22%) 48%, transparent 76%); filter: blur(40px); }
.luz .oro { background: linear-gradient(104deg, transparent 24%, rgb(255 144 62 / 30%) 40%, rgb(255 247 205 / 72%) 51%, rgb(255 144 62 / 30%) 62%, transparent 78%); filter: blur(18px); }
.grano { position: absolute; inset: -40px; pointer-events: none; opacity: 0.06; mix-blend-mode: overlay;
  background: repeating-radial-gradient(circle at 17% 32%, rgba(255,255,255,.9) 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 73% 61%, rgba(0,0,0,.9) 0 1px, transparent 1px 4px), repeating-radial-gradient(circle at 41% 87%, rgba(255,255,255,.7) 0 1px, transparent 1px 5px);
  background-size: 7px 7px, 11px 11px, 13px 13px; }
.rotulo { position: absolute; left: 70px; transform: translateY(-50%); display: flex; align-items: center; gap: 18px; background: #fff; border-radius: 999px; padding: 18px 36px 18px 24px; box-shadow: 0 16px 46px rgba(15,17,21,.28); transform-origin: 0% 50%; }
.rotulo .punto { width: 18px; height: 18px; border-radius: 50%; background: var(--marca); flex-shrink: 0; }
.rotulo b { font: 800 42px/1.05 Figtree, sans-serif; color: #0f1115; white-space: nowrap; }
.cierre .seguir { display: flex; align-items: center; gap: 14px; margin-top: 18px; padding: 16px 34px 16px 18px; border-radius: 999px; background: #fff; color: #111; font: 600 38px Figtree, sans-serif; }
.cierre .seguir b { font-weight: 800; }
.cierre .seguir .mas { width: 52px; height: 52px; border-radius: 50%; background: var(--marca); color: #111; display: grid; place-items: center; font: 800 40px/1 Figtree, sans-serif; }
${cssEstilosSub(p.tamanoSub)}
`;
}
