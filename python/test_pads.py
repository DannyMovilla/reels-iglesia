import wave

import numpy as np

import pads


def leer(ruta):
    with wave.open(str(ruta), "rb") as w:
        assert w.getframerate() == 48000
        assert w.getnchannels() == 2
        datos = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2)
    return datos.astype(np.float64) / 32768.0


def frecuencia_dominante(senal, desde_hz, hasta_hz, sr=48000):
    mono = senal.mean(axis=1)
    espectro = np.abs(np.fft.rfft(mono * np.hanning(len(mono))))
    f = np.fft.rfftfreq(len(mono), 1 / sr)
    rango = (f >= desde_hz) & (f <= hasta_hz)
    return f[rango][np.argmax(espectro[rango])]


def test_duracion_y_pico(tmp_path):
    salida = tmp_path / "pad.wav"
    pads.generar_pad(30.0, "Re", "esperanza", 7, str(salida))
    x = leer(salida)
    assert abs(len(x) / 48000 - 30.0) < 0.05
    pico_db = 20 * np.log10(np.max(np.abs(x)))
    assert pico_db <= -6.0
    assert pico_db > -12.0  # se oye: no queda casi en silencio


def test_misma_semilla_mismo_archivo(tmp_path):
    a, b = tmp_path / "a.wav", tmp_path / "b.wav"
    pads.generar_pad(12.0, "Sol", "reflexivo", 7, str(a))
    pads.generar_pad(12.0, "Sol", "reflexivo", 7, str(b))
    assert a.read_bytes() == b.read_bytes()


def test_la_tonalidad_cambia_la_nota_base(tmp_path):
    la, re = tmp_path / "la.wav", tmp_path / "re.wav"
    pads.generar_pad(8.0, "La", "esperanza", 1, str(la))
    pads.generar_pad(8.0, "Re", "esperanza", 1, str(re))
    primer_acorde = slice(int(1.0 * 48000), int(3.0 * 48000))
    assert abs(frecuencia_dominante(leer(la)[primer_acorde], 100, 260) - 220.0) < 2.0
    assert abs(frecuencia_dominante(leer(re)[primer_acorde], 100, 260) - 146.83) < 2.0


def test_tonalidad_desconocida_usa_re(tmp_path):
    salida = tmp_path / "x.wav"
    pads.generar_pad(4.0, "Zeta", "victoria", 1, str(salida))
    assert abs(frecuencia_dominante(leer(salida)[48000:3 * 48000], 100, 260) - 146.83) < 2.0
