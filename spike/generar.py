"""Prueba: genera una composición HyperFrames de un reel a partir de la transcripción y las caras.

Uso:
    python spike/generar.py --formato 9:16
    (escribe spike/prueba-hf/index.html)
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
PROY = os.path.join(AQUI, "prueba-hf")

# Clip de prueba (lo que Claude devolvería). Tiempos en segundos del archivo culto.mp4.
CLIP = {
    "titulo": "El quebrantamiento activa la gloria",
    "gancho": "Tu quebranto abre el cielo",
    "inicio": 30.93,
    "fin": 63.88,
    "intro_frase": "ese quebrantamiento terrenal va a activar la gloria celestial",
    "palabras_clave": ["quebrantamiento", "gloria", "oración", "humillación"],
    "versiculo": {
        "ref": "Salmo 51:17",
        # Reina-Valera 1909 (dominio público)
        "texto": "Los sacrificios de Dios son el espíritu quebrantado: al corazón contrito y humillado no despreciarás tú, oh Dios.",
        "en": 12.0,  # segundos desde que empieza el clip principal
    },
}
MARCA = {"nombre": "Iglesia Familia", "color": "#f5c542", "cta": "Síguenos · Domingos 10:00 AM"}
VIDEO = "culto.mp4"
ANCHO_FUENTE, ALTO_FUENTE = 1280, 720
CIERRE = 2.6
FLASH = 0.3


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9ñ]+", "", s.lower())


def palabras(datos):
    return [{"s": w[0], "e": w[1], "t": w[2]} for seg in datos["segmentos"] for w in seg["w"]]


def buscar_frase(ws, frase, a, b):
    objetivo = [norm(x) for x in frase.split() if norm(x)]
    cand = [w for w in ws if w["s"] >= a - 0.5 and w["e"] <= b + 0.5]
    mejor, puntos = -1, 0
    for i in range(len(cand)):
        p = sum(1 for j, o in enumerate(objetivo) if i + j < len(cand) and norm(cand[i + j]["t"]) == o)
        if p > puntos:
            mejor, puntos = i, p
    if mejor < 0 or puntos < len(objetivo) * 0.5:
        return None
    ult = min(len(cand) - 1, mejor + len(objetivo) - 1)
    return cand[mejor]["s"] - 0.15, cand[ult]["e"] + 0.25


def pista_cara(caras, a, b):
    """Cámara con zona muerta: [(t, x, y)] en tiempo del archivo."""
    muestras = [(t, l) for t, l in caras if a - 1 <= t <= b + 1]
    previo, crudo = None, []
    for t, lista in muestras:
        fs = [f for f in lista if f[3] >= 0.7]
        if fs:
            previo = min(fs, key=lambda f: (abs(f[0] - previo[0]) * 2 if previo else 0) - f[2] * 4)
        crudo.append((t, previo))
    primero = next((f for _, f in crudo if f), [0.5, 0.3])
    cam, salida, ultimo = None, [], primero
    for t, f in crudo:
        f = f or ultimo
        ultimo = f
        if cam is None:
            cam = [f[0], f[1]]
        else:
            if abs(f[0] - cam[0]) > 0.15:
                cam = [f[0], f[1]]
            elif abs(f[0] - cam[0]) > 0.035:
                cam[0] += (f[0] - cam[0]) * 0.5
            if abs(f[1] - cam[1]) > 0.05:
                cam[1] += (f[1] - cam[1]) * 0.4
        salida.append((t, cam[0], cam[1]))
    return salida


def bloques_subtitulos(ws, a, b, claves):
    claves = {norm(k) for k in claves}
    bloques, actual = [], None
    for w in ws:
        if w["e"] <= a or w["s"] >= b:
            continue
        texto = w["t"].strip()
        if not texto:
            continue
        previo = actual["ws"][-1] if actual else None
        chars = sum(len(x["t"]) + 1 for x in actual["ws"]) if actual else 0
        if (not actual or len(actual["ws"]) >= 3 or chars + len(texto) > 16
                or w["s"] - previo["e"] > 0.6 or re.search(r"[.?!¿¡:;]$", previo["t"])):
            actual = {"s": w["s"], "e": w["e"], "ws": []}
            bloques.append(actual)
        n = norm(texto)
        actual["ws"].append({"s": w["s"], "e": w["e"], "t": texto, "clave": len(n) > 2 and n in claves})
        actual["e"] = w["e"]
    for i in range(len(bloques) - 1):
        if bloques[i + 1]["s"] - bloques[i]["e"] < 0.5:
            bloques[i]["e"] = bloques[i + 1]["s"]
    return bloques


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--formato", choices=["9:16", "1:1", "4:5"], default="9:16")
    ap.add_argument("--zoom", type=float, default=1.25)
    args = ap.parse_args()
    W = 1080
    H = {"9:16": 1920, "1:1": 1080, "4:5": 1350}[args.formato]

    datos = json.load(open(os.path.join(PROY, "culto.pulpito.json"), encoding="utf-8"))
    ws = palabras(datos)
    c = CLIP
    intro = buscar_frase(ws, c["intro_frase"], c["inicio"], c["fin"])
    partes = []  # (inicio en archivo, fin en archivo, b/n)
    if intro:
        partes.append((intro[0], intro[1], True))
    partes.append((c["inicio"], c["fin"], False))
    total_video = sum(e - s for s, e, _ in partes)
    total = total_video + CIERRE

    # tamaño del video dentro del cuadro: llenar el alto, con zoom
    esc = H / ALTO_FUENTE * args.zoom
    vw, vh = ANCHO_FUENTE * esc, ALTO_FUENTE * esc
    pista = pista_cara(datos.get("caras", []), min(p[0] for p in partes), c["fin"])

    def pos(x, y):
        left = min(0, max(W - vw, W / 2 - x * vw))
        top = min(0, max(H - vh, H * 0.33 - y * vh))
        return round(left, 1), round(top, 1)

    color = MARCA["color"]
    elementos, js = [], []
    t0 = 0.0
    for i, (s, e, bn) in enumerate(partes):
        d = e - s
        vid = f"v{i}"
        filtro = "filter: grayscale(1) contrast(1.15) brightness(0.95);" if bn else ""
        l0, tp0 = pos(*(pista[0][1:] if pista else (0.5, 0.3)))
        elementos.append(
            f'<video id="{vid}" class="clip video" src="{VIDEO}" data-start="{t0:.3f}" data-duration="{d:.3f}" '
            f'data-media-start="{s:.3f}" data-has-audio="true" playsinline '
            f'style="width:{vw:.0f}px;height:{vh:.0f}px;left:{l0}px;top:{tp0}px;{filtro}"></video>')
        # encuadre: un tween por muestra de cara (2 por segundo)
        prev = None
        for (t, x, y) in pista:
            if t < s or t > e:
                continue
            lx, ty = pos(x, y)
            at = t0 + (t - s)
            if prev and abs(lx - prev[0]) > W * 0.6:  # cambio de cámara: corte seco
                js.append(f'tl.set("#{vid}", {{left:{lx}, top:{ty}}}, {at:.3f});')
            else:
                js.append(f'tl.to("#{vid}", {{left:{lx}, top:{ty}, duration:0.5, ease:"sine.inOut"}}, {max(t0, at - 0.5):.3f});')
            prev = (lx, ty)
        if bn:
            elementos.append(f'<div class="clip viñeta" data-start="{t0:.3f}" data-duration="{d:.3f}"></div>')
        t0 += d

    # destello al pasar de la apertura al clip
    if intro:
        dI = intro[1] - intro[0]
        elementos.append(f'<div id="flash" class="clip flash" data-start="{dI:.3f}" data-duration="{FLASH}"></div>')
        js.append(f'tl.fromTo("#flash", {{opacity:0.85}}, {{opacity:0, duration:{FLASH}, ease:"power2.out"}}, {dI:.3f});')

    # gancho: durante la apertura (o 4.5 s)
    dG = (intro[1] - intro[0]) if intro else 4.5
    cara_y = pista[0][2] if pista else 0.3
    gancho_y = H * (0.53 if cara_y < 0.5 and args.formato == "9:16" else 0.12)
    elementos.append(
        f'<div id="gancho" class="clip gancho" data-start="0" data-duration="{dG:.3f}" style="top:{gancho_y:.0f}px">'
        f'{html.escape(c["gancho"])}<i></i></div>')
    js.append('tl.from("#gancho", {opacity:0, y:30, scale:0.92, duration:0.35, ease:"back.out(1.7)"}, 0);')
    js.append(f'tl.to("#gancho", {{opacity:0, y:-20, duration:0.3, ease:"power2.in"}}, {dG - 0.3:.3f});')

    # Regla: mientras aparece la cita bíblica no se muestran subtítulos (la cita no compite con el texto).
    v = c["versiculo"]
    vt = ((intro[1] - intro[0]) if intro else 0) + v["en"]
    VDUR = 6.0

    # subtítulos palabra por palabra
    sub_y = H * (0.74 if args.formato == "9:16" else 0.80)
    bi = 0
    t0 = 0.0
    for (s, e, _bn) in partes:
        bloques = bloques_subtitulos(ws, s, e, c["palabras_clave"])
        for k, b in enumerate(bloques):
            bs, be = max(b["s"], s), min(b["e"], e)
            sig = bloques[k + 1]["s"] if k + 1 < len(bloques) else e
            ini, dur = t0 + bs - s, max(0.2, min(be + 0.15, sig, e) - bs)
            if ini < vt and ini + dur > vt:
                dur = vt - ini  # se corta justo cuando entra la cita
                if dur < 0.3:
                    continue
            elif ini < vt + VDUR and ini + dur > vt:
                continue
            spans = []
            for j, w in enumerate(b["ws"]):
                cls = "w clave" if w["clave"] else "w"
                spans.append(f'<span id="b{bi}w{j}" class="{cls}">{html.escape(w["t"].upper())}</span>')
                ws_at = t0 + w["s"] - s
                if ws_at >= ini:
                    js.append(f'tl.fromTo("#b{bi}w{j}", {{scale:1.18, color:"{color}"}}, {{scale:1, duration:0.18, ease:"power2.out", immediateRender:false}}, {ws_at:.3f});')
                    if not w["clave"]:
                        js.append(f'tl.to("#b{bi}w{j}", {{color:"#ffffff", duration:0.05}}, {t0 + w["e"] - s + 0.05:.3f});')
            elementos.append(
                f'<div id="b{bi}" class="clip sub" data-start="{ini:.3f}" data-duration="{dur:.3f}" style="top:{sub_y:.0f}px">{" ".join(spans)}</div>')
            js.append(f'tl.from("#b{bi}", {{opacity:0, y:16, duration:0.12}}, {ini:.3f});')
            bi += 1
        t0 += e - s

    # tarjeta del versículo: ocupa el lugar de los subtítulos, debajo de la cara
    vy = H * (0.62 if args.formato == "9:16" else 0.60)
    elementos.append(
        f'<div id="vers" class="clip vers" data-start="{vt:.3f}" data-duration="{VDUR}" style="top:{vy:.0f}px">'
        f'<b>{html.escape(v["ref"])}</b><p>{html.escape(v["texto"])}</p></div>')
    js.append(f'tl.from("#vers", {{x:-1100, duration:0.55, ease:"power3.out"}}, {vt:.3f});')
    js.append(f'tl.from("#vers p", {{opacity:0, duration:0.4}}, {vt + 0.35:.3f});')
    js.append(f'tl.to("#vers", {{x:-1100, duration:0.4, ease:"power2.in"}}, {vt + 5.6:.3f});')

    # marca abajo durante el video
    elementos.append(f'<div class="clip marca" data-start="0" data-duration="{total_video:.3f}">{html.escape(MARCA["nombre"])}</div>')
    # barra de progreso
    elementos.append(f'<div id="prog" class="clip prog" data-start="0" data-duration="{total_video:.3f}"></div>')
    js.append(f'tl.fromTo("#prog", {{scaleX:0}}, {{scaleX:1, duration:{total_video:.3f}, ease:"none"}}, 0);')

    # cierre con llamado a la acción
    elementos.append(
        f'<div id="cierre" class="clip cierre" data-start="{total_video:.3f}" data-duration="{CIERRE}">'
        f'<div class="logo">{html.escape(MARCA["nombre"][:1])}</div><h2>{html.escape(MARCA["nombre"])}</h2>'
        f'<p>{html.escape(MARCA["cta"])}</p></div>')
    js.append(f'tl.from("#cierre", {{opacity:0, duration:0.3}}, {total_video:.3f});')
    js.append(f'tl.from("#cierre .logo", {{scale:0.4, opacity:0, duration:0.5, ease:"back.out(2)"}}, {total_video + 0.1:.3f});')
    js.append(f'tl.from("#cierre h2, #cierre p", {{y:40, opacity:0, duration:0.45, stagger:0.12, ease:"power3.out"}}, {total_video + 0.3:.3f});')

    pagina = f"""<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Figtree:wght@600;800&display=swap" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      :root {{ --marca: {color}; --ground: #000; --ink: #fff; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: var(--ground); }}
      #root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; font-family: Figtree, sans-serif; }}
      .video {{ position: absolute; object-fit: fill; }}
      .viñeta {{ position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.6) 100%); }}
      .flash {{ position: absolute; inset: 0; background: #fff; }}
      .gancho {{ position: absolute; left: 50%; transform: translateX(-50%); max-width: 920px; width: max-content;
        background: #fff; color: #111; font: 800 60px/1.15 Figtree, sans-serif; text-align: center; padding: 26px 44px 34px;
        border-radius: 26px; box-shadow: 0 14px 40px rgba(0,0,0,.35); }}
      .gancho i {{ position: absolute; left: 36px; right: 36px; bottom: 12px; height: 8px; border-radius: 4px; background: var(--marca); }}
      .sub {{ position: absolute; left: 60px; right: 60px; text-align: center; transform: translateY(-50%);
        font: 900 68px/1.25 Montserrat, sans-serif; color: #fff; }}
      .sub .w {{ display: inline-block; margin: 0 0.14em; -webkit-text-stroke: 12px #0b0b0b; paint-order: stroke fill;
        text-shadow: 0 6px 18px rgba(0,0,0,.5); }}
      .sub .clave {{ color: var(--marca); }}
      .vers {{ position: absolute; left: 0; width: 900px; background: rgba(12,14,28,.82); color: #fff; padding: 26px 34px 30px 46px;
        border-radius: 0 22px 22px 0; border-left: 12px solid var(--marca); }}
      .vers b {{ display: block; font: 800 44px/1.1 Figtree, sans-serif; color: var(--marca); margin-bottom: 10px; }}
      .vers p {{ font: 600 34px/1.35 Figtree, sans-serif; }}
      .marca {{ position: absolute; left: 0; right: 0; bottom: 70px; text-align: center; color: #fff;
        font: 700 38px Figtree, sans-serif; text-shadow: 0 4px 14px rgba(0,0,0,.6); }}
      .prog {{ position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: var(--marca); transform-origin: left center; }}
      .cierre {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px;
        background: radial-gradient(circle at 50% 40%, #2a2340 0%, #0b0b14 70%); color: #fff; text-align: center; }}
      .cierre .logo {{ width: 220px; height: 220px; border-radius: 50%; background: var(--marca); color: #111;
        display: grid; place-items: center; font: 900 120px Montserrat, sans-serif; }}
      .cierre h2 {{ font: 900 76px/1.1 Montserrat, sans-serif; }}
      .cierre p {{ font: 700 44px Figtree, sans-serif; color: var(--marca); }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="{W}" data-height="{H}">
      {chr(10).join("      " + x for x in elementos).strip()}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      {chr(10).join("      " + x for x in js).strip()}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""
    open(os.path.join(PROY, "index.html"), "w", encoding="utf-8").write(pagina)
    print(f"Formato {args.formato} ({W}x{H}) · duración {total:.1f} s · apertura {'sí' if intro else 'no'} · "
          f"{bi} bloques de subtítulos · {len(pista)} puntos de cara")


if __name__ == "__main__":
    main()
