import wave

import numpy as np

import efectos


def leer(ruta):
    with wave.open(str(ruta), "rb") as w:
        assert w.getframerate() == 48000
        assert w.getnchannels() == 1
        assert w.getsampwidth() == 2
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0


def test_genera_los_tres_sonidos_con_su_duracion_y_pico(tmp_path):
    efectos.generar(tmp_path)
    duraciones = {"whoosh.wav": 0.6, "whoosh-suave.wav": 0.8, "pop.wav": 0.12}
    for nombre, dur in duraciones.items():
        s = leer(tmp_path / nombre)
        assert abs(len(s) / 48000 - dur) < 0.01, nombre
        pico = np.max(np.abs(s))
        assert 0.05 < pico <= 10 ** (-3 / 20) + 1e-3, (nombre, pico)  # sin silencio total, pico ≤ −3 dBFS


def test_el_suave_es_mas_bajo_que_el_normal(tmp_path):
    efectos.generar(tmp_path)
    rms = lambda n: np.sqrt(np.mean(leer(tmp_path / n) ** 2))
    assert rms("whoosh-suave.wav") < rms("whoosh.wav") * 0.7


def test_misma_semilla_mismo_resultado(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    a.mkdir()
    b.mkdir()
    efectos.generar(a)
    efectos.generar(b)
    for n in ("whoosh.wav", "whoosh-suave.wav", "pop.wav"):
        assert (a / n).read_bytes() == (b / n).read_bytes()


def test_empieza_y_termina_en_silencio(tmp_path):
    efectos.generar(tmp_path)
    for n in ("whoosh.wav", "whoosh-suave.wav", "pop.wav"):
        s = leer(tmp_path / n)
        assert abs(s[0]) < 0.01 and abs(s[-1]) < 0.01, n
