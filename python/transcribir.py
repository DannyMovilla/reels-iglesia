"""Púlpito Clips: transcribe la prédica de un culto con marcas de tiempo por palabra.

Uso:
    python transcribir.py "C:/ruta/culto.mp4" --inicio 0:42:10 --fin 1:28:00

Genera junto al video:
    culto.pulpito.json  -> se carga en la página de Púlpito Clips
    culto.srt           -> subtítulos normales, por si los quieres en otro lado

Solo procesa el tramo entre --inicio y --fin (la prédica), así tarda menos.
Usa la GPU NVIDIA si está lista; si no, la CPU.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import subprocess
import sys
import time
import warnings

# Avisos de Hugging Face que no afectan el resultado (symlinks en Windows, token opcional).
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
warnings.filterwarnings("ignore", module="huggingface_hub")

PROMPT_INICIAL = (
    "Prédica cristiana en español. Dios, Jesús, Cristo, Espíritu Santo, iglesia, "
    "hermanos, amén, aleluya, gloria a Dios, la Biblia dice, versículo, Romanos 8:28, "
    "Juan 3:16, Salmo 23."
)


def a_segundos(texto: str | None) -> float | None:
    """Convierte '1:05:30', '65:30' o '3930' a segundos."""
    if texto is None or texto == "":
        return None
    partes = [float(p) for p in texto.strip().split(":")]
    total = 0.0
    for p in partes:
        total = total * 60 + p
    return total


def a_srt(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def preparar_dlls_cuda() -> None:
    """En Windows, las DLL de los paquetes pip nvidia-* no están en el PATH."""
    if os.name != "nt":
        return
    for base in sys.path:
        for carpeta in glob.glob(os.path.join(base, "nvidia", "*", "bin")):
            try:
                os.add_dll_directory(carpeta)
                os.environ["PATH"] = carpeta + os.pathsep + os.environ.get("PATH", "")
            except OSError:
                pass


def duracion_video(ruta: str) -> float:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ruta],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(salida)


def extraer_audio(video: str, inicio: float, fin: float):
    """Devuelve el audio del tramo como arreglo float32 mono a 16 kHz."""
    import numpy as np

    crudo = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", f"{inicio:.3f}", "-i", video,
         "-t", f"{fin - inicio:.3f}", "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(crudo, dtype=np.float32)


def cargar_modelo(nombre: str | None, dispositivo: str):
    from faster_whisper import WhisperModel

    intentos = []
    if dispositivo in ("auto", "cuda"):
        intentos.append(("cuda", "int8_float16", nombre or "large-v3-turbo"))
    if dispositivo in ("auto", "cpu"):
        intentos.append(("cpu", "int8", nombre or "small"))

    ultimo_error = None
    for disp, tipo, modelo in intentos:
        try:
            print(f"Cargando modelo '{modelo}' en {disp.upper()}...", flush=True)
            m = WhisperModel(modelo, device=disp, compute_type=tipo)
            if disp == "cuda":
                # Cargar el modelo no basta: las librerías de CUDA recién se usan al transcribir.
                import numpy as np
                segs, _ = m.transcribe(np.zeros(16000, dtype=np.float32), language="es")
                list(segs)
            return m, modelo, disp
        except Exception as e:  # noqa: BLE001 - probamos el siguiente
            ultimo_error = e
            print(f"  No se pudo usar {disp.upper()}: {str(e).splitlines()[0]}", flush=True)
    raise SystemExit(f"No se pudo cargar ningún modelo: {ultimo_error}")


MODELO_CARAS_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/"
    "face_detection_yunet_2023mar.onnx"
)


def dimensiones_video(ruta: str) -> tuple[int, int]:
    salida = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height", "-of", "csv=p=0:s=x", ruta],
        capture_output=True, text=True, check=True,
    ).stdout.strip().splitlines()[0]
    w, h = salida.split("x")[:2]
    return int(w), int(h)


PROGRESO_JSON = False


def emitir_progreso(etapa: str, pct: float, texto: str | None = None) -> None:
    """Una línea JSON por stdout que la app de escritorio interpreta como progreso."""
    datos = {"etapa": etapa, "pct": round(float(pct), 1)}
    if texto:
        datos["texto"] = texto
    print(json.dumps(datos, ensure_ascii=False), flush=True)


def ruta_modelo_caras() -> str:
    # El modelo vive en <repo>/modelos (este script está en <repo>/python).
    carpeta = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "modelos")
    ruta = os.path.join(carpeta, "face_detection_yunet_2023mar.onnx")
    if not os.path.isfile(ruta):
        import urllib.request

        os.makedirs(carpeta, exist_ok=True)
        print("Descargando el detector de caras (230 KB)...", flush=True)
        urllib.request.urlretrieve(MODELO_CARAS_URL, ruta)
    return ruta


def detectar_caras(video: str, inicio: float, fin: float, fps: float = 2.0, ancho: int = 640):
    """Busca caras 2 veces por segundo. Devuelve [[t, [[x, y, w, score], ...]], ...] normalizado 0-1."""
    import cv2
    import numpy as np

    try:
        cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_ERROR)
    except AttributeError:
        pass
    vw, vh = dimensiones_video(video)
    alto = int(round(ancho * vh / vw / 2)) * 2
    det = cv2.FaceDetectorYN.create(ruta_modelo_caras(), "", (ancho, alto), 0.6, 0.3, 50)
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-ss", f"{inicio:.3f}", "-i", video, "-t", f"{fin - inicio:.3f}",
         "-an", "-vf", f"fps={fps},scale={ancho}:{alto}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE,
    )
    tam = ancho * alto * 3
    total = int((fin - inicio) * fps)
    salida = []
    i = 0
    t0 = time.time()
    while True:
        buf = proc.stdout.read(tam)
        if len(buf) < tam:
            break
        img = np.frombuffer(buf, np.uint8).reshape(alto, ancho, 3)
        _, caras = det.detect(img)
        lista = []
        if caras is not None:
            for c in caras:
                x, y, w, h = (float(v) for v in c[:4])
                lista.append([round((x + w / 2) / ancho, 3), round((y + h / 2) / alto, 3),
                              round(w / ancho, 3), round(float(c[-1]), 2)])
        salida.append([round(inicio + i / fps, 2), lista])
        i += 1
        if i % 20 == 0:
            pct = min(100, i / max(total, 1) * 100)
            if PROGRESO_JSON:
                emitir_progreso("caras", pct)
            else:
                print(f"\r  Caras: {pct:5.1f}%", end="", flush=True)
    proc.wait()
    if PROGRESO_JSON:
        emitir_progreso("caras", 100)
    else:
        print(f"\r  Caras: 100.0%  ({time.time() - t0:.0f} s)", flush=True)
    return salida


def transcribir(video: str, inicio: float, fin: float, args):
    preparar_dlls_cuda()
    modelo, nombre_modelo, disp = cargar_modelo(args.modelo, args.dispositivo)

    print(f"Extrayendo audio {a_srt(inicio)[:8]} -> {a_srt(fin)[:8]}...", flush=True)
    audio = extraer_audio(video, inicio, fin)

    t0 = time.time()
    segmentos, _ = modelo.transcribe(
        audio,
        language="es",
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        initial_prompt=PROMPT_INICIAL,
        condition_on_previous_text=False,
    )
    dur = fin - inicio
    resultado = []
    for seg in segmentos:
        palabras = [
            [round(w.start + inicio, 2), round(w.end + inicio, 2), w.word.strip()]
            for w in (seg.words or []) if w.word.strip()
        ]
        resultado.append({
            "s": round(seg.start + inicio, 2),
            "e": round(seg.end + inicio, 2),
            "t": seg.text.strip(),
            "w": palabras,
        })
        pct = min(100, seg.end / dur * 100)
        if PROGRESO_JSON:
            emitir_progreso("transcripcion", pct, seg.text.strip()[:60])
        else:
            print(f"\r  {pct:5.1f}%  [{a_srt(seg.start + inicio)[:8]}] {seg.text.strip()[:60]:<60}", end="", flush=True)
    if PROGRESO_JSON:
        emitir_progreso("transcripcion", 100)
    else:
        print(f"\nTranscripción lista en {time.time() - t0:.0f} s.", flush=True)
    return resultado, nombre_modelo, disp


def guardar_json(ruta: str, datos) -> None:
    tmp = ruta + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, ruta)


def main_salida(args, video: str) -> None:
    """Modo de la app: escribe transcripcion.json y/o caras.json en --salida."""
    os.makedirs(args.salida, exist_ok=True)
    total = duracion_video(video)
    inicio = a_segundos(args.inicio) or 0.0
    fin = min(a_segundos(args.fin) or total, total)
    if fin <= inicio:
        raise SystemExit("--fin tiene que ser mayor que --inicio")
    if not args.solo_caras:
        resultado, nombre_modelo, disp = transcribir(video, inicio, fin, args)
        guardar_json(os.path.join(args.salida, "transcripcion.json"), {
            "formato": "pulpito-transcripcion/1",
            "video": os.path.basename(video),
            "tamano": os.path.getsize(video),
            "inicio": round(inicio, 2),
            "fin": round(fin, 2),
            "modelo": nombre_modelo,
            "dispositivo": disp,
            "segmentos": resultado,
        })
    if args.solo_caras or not (args.solo_transcripcion or args.sin_caras):
        guardar_json(os.path.join(args.salida, "caras.json"), detectar_caras(video, inicio, fin))


def crear_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Transcribe la prédica para Reels Iglesia")
    p.add_argument("video", help="Ruta del video del culto")
    p.add_argument("--inicio", help="Dónde empieza la prédica, ej. 0:42:10", default="0")
    p.add_argument("--fin", help="Dónde termina la prédica (opcional)")
    p.add_argument("--modelo", help="tiny, base, small, medium, large-v3-turbo... (por defecto: turbo en GPU, small en CPU)")
    p.add_argument("--dispositivo", choices=["auto", "cuda", "cpu"], default="auto")
    p.add_argument("--sin-caras", action="store_true", help="No buscar caras (el encuadre se hace a mano)")
    p.add_argument("--solo-caras", action="store_true",
                   help="Solo busca caras (con --salida usa --inicio/--fin; sin --salida, el .pulpito.json existente)")
    p.add_argument("--solo-transcripcion", action="store_true", help="Solo transcribe, sin buscar caras")
    p.add_argument("--salida", help="Carpeta donde escribir transcripcion.json / caras.json (modo app)")
    p.add_argument("--progreso-json", action="store_true", help="Progreso como líneas JSON (modo app)")
    return p


def main() -> None:
    global PROGRESO_JSON
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    args = crear_parser().parse_args()
    PROGRESO_JSON = args.progreso_json

    video = os.path.abspath(args.video)
    if not os.path.isfile(video):
        raise SystemExit(f"No encuentro el video: {video}")
    if args.salida:
        main_salida(args, video)
        return
    base = os.path.splitext(video)[0]

    if args.solo_caras:
        try:
            with open(base + ".pulpito.json", encoding="utf-8") as f:
                datos = json.load(f)
        except FileNotFoundError:
            raise SystemExit(f"No encuentro {base}.pulpito.json. Corre primero la transcripción.")
        datos["caras"] = detectar_caras(video, datos["inicio"], datos["fin"])
    else:
        total = duracion_video(video)
        inicio = a_segundos(args.inicio) or 0.0
        fin = min(a_segundos(args.fin) or total, total)
        if fin <= inicio:
            raise SystemExit("--fin tiene que ser mayor que --inicio")
        resultado, nombre_modelo, disp = transcribir(video, inicio, fin, args)
        datos = {
            "formato": "pulpito-transcripcion/1",
            "video": os.path.basename(video),
            "tamano": os.path.getsize(video),
            "duracionVideo": round(total, 2),
            "inicio": round(inicio, 2),
            "fin": round(fin, 2),
            "modelo": nombre_modelo,
            "dispositivo": disp,
            "segmentos": resultado,
        }
        if not args.sin_caras:
            print("Buscando la cara del predicador...", flush=True)
            datos["caras"] = detectar_caras(video, inicio, fin)
        with open(base + ".srt", "w", encoding="utf-8") as f:
            for i, s in enumerate(resultado, 1):
                f.write(f"{i}\n{a_srt(s['s'])} --> {a_srt(s['e'])}\n{s['t']}\n\n")
        print(f"Guardado: {base}.srt")

    with open(base + ".pulpito.json", "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Guardado: {base}.pulpito.json")
    print("Ahora abre Púlpito Clips y carga el archivo .pulpito.json")


if __name__ == "__main__":
    main()
