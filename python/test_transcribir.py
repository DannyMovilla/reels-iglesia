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
