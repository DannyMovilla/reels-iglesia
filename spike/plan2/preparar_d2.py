"""D2: la composición de la prueba apuntando al video original de 1 GB con ruta absoluta."""
import re
import shutil
from pathlib import Path

raiz = Path(__file__).resolve().parents[2]
origen = raiz / "spike" / "prueba-hf"
destino = Path(__file__).resolve().parent / "d2"
destino.mkdir(parents=True, exist_ok=True)
for f in ["index.html", "hyperframes.json", "meta.json", "package.json"]:
    shutil.copy(origen / f, destino / f)

video = "C:/Users/djmov/Downloads/FDownloader.net-943096285322125-(1280p).mp4"
html = (destino / "index.html").read_text(encoding="utf-8")
html = html.replace('src="culto.mp4"', f'src="{video}"')
html = re.sub(r'data-media-start="([0-9.]+)"', lambda m: f'data-media-start="{float(m.group(1)) + 6590:.3f}"', html)
(destino / "index.html").write_text(html, encoding="utf-8")
print(re.findall(r"<video[^>]*>", html)[0][:300])
