"""D3: un tono de 6 kHz como 'música' con y sin data-fx-carve que escucha a los <video> (voz)."""
import shutil
import subprocess
from pathlib import Path

aqui = Path(__file__).resolve().parent
for nombre, carve in [("d3_con", True), ("d3_sin", False)]:
    d = aqui / nombre
    d.mkdir(exist_ok=True)
    for f in ["hyperframes.json", "meta.json", "package.json"]:
        shutil.copy(aqui / "d2" / f, d / f)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "sine=f=6000:d=42", "-af", "volume=0.3",
                    str(d / "musica.wav")], check=True)
    html = (aqui / "d2" / "index.html").read_text(encoding="utf-8")
    fx = ' data-fx-carve=\'{"enabled":true,"sources":["v0","v1"],"strength":0.5}\'' if carve else ""
    audio = f'<audio id="musica" class="clip" src="musica.wav" data-start="0" data-duration="40" data-volume="1"{fx}></audio>\n'
    html = html.replace('<div id="prog"', audio + '      <div id="prog"', 1)
    (d / "index.html").write_text(html, encoding="utf-8")
print("ok")
