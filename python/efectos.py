"""
Efectos de sonido propios de Reels Iglesia (sin derechos de terceros), generados con numpy.

    python efectos.py --salida ../resources/efectos

- whoosh.wav (0,6 s): ruido filtrado que barre de 300 Hz a 4 kHz, sube y baja (transiciones).
- whoosh-suave.wav (0,8 s): el mismo, más lento y 6 dB más bajo (entre tarjetas del versículo).
- pop.wav (0,12 s): un "pop" corto, seno de 900 a 500 Hz con caída rápida (cuando aparece el gancho).

WAV 48 kHz mono 16 bits, pico −3 dBFS como mucho, siempre igual (semilla fija).
"""
from __future__ import annotations

import argparse
import wave
from pathlib import Path

import numpy as np

SR = 48000
PICO = 10 ** (-3 / 20)  # −3 dBFS


def _guardar(ruta: Path, s: np.ndarray, pico: float = PICO) -> None:
    s = s / (np.max(np.abs(s)) or 1.0) * pico
    datos = np.round(s * 32767).astype(np.int16)
    with wave.open(str(ruta), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(datos.tobytes())


def _barrido(n: int, desde: float, hasta: float, semilla: int) -> np.ndarray:
    """Ruido blanco pasado por un filtro de banda que se mueve (exponencial) de `desde` a `hasta` Hz."""
    rng = np.random.default_rng(semilla)
    ruido = rng.standard_normal(n)
    fc = desde * (hasta / desde) ** np.linspace(0, 1, n)
    # Filtro de estado variable (pasa banda) de 2.º orden, muestra por muestra.
    y = np.zeros(n)
    bajo = banda = 0.0
    q = 1.4
    for i in range(n):
        f = 2 * np.sin(np.pi * fc[i] / SR)
        alto = ruido[i] - bajo - banda / q
        banda += f * alto
        bajo += f * banda
        y[i] = banda
    return y


def _envolvente_campana(n: int, subida: float = 0.6) -> np.ndarray:
    """Sube hasta `subida` (fracción) y baja; empieza y termina en 0."""
    t = np.linspace(0, 1, n)
    e = np.where(t < subida, np.sin(np.pi / 2 * t / subida) ** 2, np.cos(np.pi / 2 * (t - subida) / (1 - subida)) ** 2)
    e[0] = e[-1] = 0.0
    return e


def whoosh(dur: float, semilla: int) -> np.ndarray:
    n = int(round(dur * SR))
    return _barrido(n, 300, 4000, semilla) * _envolvente_campana(n)


def pop(dur: float = 0.12) -> np.ndarray:
    n = int(round(dur * SR))
    t = np.arange(n) / SR
    f = 500 + 400 * np.exp(-t / 0.02)
    fase = 2 * np.pi * np.cumsum(f) / SR
    e = (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.03)
    e[-1] = 0.0
    return np.sin(fase) * e


def generar(carpeta: Path | str) -> None:
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    _guardar(carpeta / "whoosh.wav", whoosh(0.6, 11))
    _guardar(carpeta / "whoosh-suave.wav", whoosh(0.8, 23), PICO * 10 ** (-6 / 20))
    _guardar(carpeta / "pop.wav", pop())


if __name__ == "__main__":
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument("--salida", required=True)
    generar(a.parse_args().salida)
