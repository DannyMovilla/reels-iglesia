import json

import transcribir as t


def test_a_segundos_acepta_formatos():
    assert t.a_segundos("1:05:30") == 3930
    assert t.a_segundos("65:30") == 3930
    assert t.a_segundos("3930") == 3930


def test_emitir_progreso_imprime_una_linea_json(capsys):
    t.emitir_progreso("caras", 12.345)
    salida = capsys.readouterr().out
    assert salida == '{"etapa": "caras", "pct": 12.3}\n'
    assert json.loads(salida) == {"etapa": "caras", "pct": 12.3}


def test_emitir_progreso_con_texto(capsys):
    t.emitir_progreso("transcripcion", 50, "Hermanos, hoy")
    assert json.loads(capsys.readouterr().out) == {"etapa": "transcripcion", "pct": 50.0, "texto": "Hermanos, hoy"}


def test_parser_acepta_las_opciones_nuevas():
    args = t.crear_parser().parse_args(
        ["culto (1280p) ñ.mp4", "--inicio", "1:44:44", "--salida", "C:/x", "--progreso-json", "--solo-transcripcion"]
    )
    assert args.video == "culto (1280p) ñ.mp4"
    assert args.salida == "C:/x"
    assert args.progreso_json is True
    assert args.solo_transcripcion is True
    assert t.crear_parser().parse_args(["v.mp4", "--solo-caras"]).solo_caras is True


def test_args_ffmpeg_caras_con_y_sin_gpu():
    con = t.args_ffmpeg_caras("v (1).mp4", 10.0, 70.0, 2.0, 640, 360, gpu=True)
    assert con[con.index("-hwaccel") + 1] == "cuda"
    assert con.index("-hwaccel") < con.index("-i")
    assert con[con.index("-i") + 1] == "v (1).mp4"
    assert "fps=2.0,scale=640:360" in con
    sin = t.args_ffmpeg_caras("v.mp4", 10.0, 70.0, 2.0, 640, 360, gpu=False)
    assert "-hwaccel" not in sin


def test_detectar_caras_recorre_todo_el_tramo_y_termina(tmp_path):
    """3 s de video a 2 fps → 6 cuadros; antes se quedaba leyendo el primer cuadro para siempre."""
    import subprocess
    import sys
    from pathlib import Path

    video = tmp_path / "prueba #1.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10", "-t", "4",
                    "-pix_fmt", "yuv420p", str(video)], check=True)
    codigo = (f"import sys; sys.path.insert(0, {str(Path(__file__).parent)!r}); import transcribir as t; "
              f"r = t.detectar_caras({str(video)!r}, 0.5, 3.5, gpu=False); print(len(r))")
    r = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True, timeout=60)
    assert r.stdout.strip().splitlines()[-1] == "6"


def test_caras_sin_gpu_por_defecto(monkeypatch):
    """Medido con el culto real (10 min): GPU 54 s, CPU 30 s → por defecto CPU; REELS_CARAS_GPU=1 la activa."""
    monkeypatch.delenv("REELS_CARAS_GPU", raising=False)
    assert t.caras_con_gpu() is False
    monkeypatch.setenv("REELS_CARAS_GPU", "1")
    assert t.caras_con_gpu() is True


def test_si_la_gpu_falla_a_mitad_repite_todo_en_cpu(tmp_path, monkeypatch):
    """La decodificación por GPU entrega 2 cuadros y se cae: se repite completa en CPU (sin caras perdidas)."""
    import subprocess
    import sys

    video = tmp_path / "prueba.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=10", "-t", "4",
                    "-pix_fmt", "yuv420p", str(video)], check=True)
    original = t.args_ffmpeg_caras

    def falso(v, inicio, fin, fps, ancho, alto, gpu):
        if gpu:
            codigo = f"import sys; sys.stdout.buffer.write(bytes({ancho * alto * 3 * 2})); sys.exit(1)"
            return [sys.executable, "-c", codigo]
        return original(v, inicio, fin, fps, ancho, alto, gpu)

    monkeypatch.setattr(t, "args_ffmpeg_caras", falso)
    monkeypatch.setenv("REELS_CARAS_GPU", "1")
    assert len(t.detectar_caras(str(video), 0.5, 3.5)) == 6
