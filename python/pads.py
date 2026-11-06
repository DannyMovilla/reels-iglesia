"""
Pads de adoración: fondos suaves de sintetizador, generados en el PC (sin derechos de autor).

    python pads.py --duracion 40 --tonalidad Re --animo esperanza --semilla 7 --salida pad.wav

Acordes I–V–vi–IV (esperanza, victoria, adoración) o i–VI–III–VII (reflexivo, tensión),
cada uno de ~4 s con entrada y salida lentas, voces un poco desafinadas entre sí (coro),
bajo una octava abajo y una reverberación simple. WAV 48 kHz estéreo, pico −6 dBFS.
"""
from __future__ import annotations

import argparse
import wave

import numpy as np

SR = 48000
NOTAS = {"Do": 0, "Do#": 1, "Reb": 1, "Re": 2, "Re#": 3, "Mib": 3, "Mi": 4, "Fa": 5, "Fa#": 6, "Solb": 6,
         "Sol": 7, "Sol#": 8, "Lab": 8, "La": 9, "La#": 10, "Sib": 10, "Si": 11}
DO3 = 130.8128

# Grados en semitonos desde la tónica: (raíz del acorde, intervalos del acorde).
MAYOR = [(0, (0, 4, 7)), (7, (0, 4, 7)), (9, (0, 3, 7)), (5, (0, 4, 7))]   # I V vi IV
MENOR = [(0, (0, 3, 7)), (8, (0, 4, 7)), (3, (0, 4, 7)), (10, (0, 4, 7))]  # i VI III VII
SEGUNDOS_ACORDE = {"esperanza": 4.0, "victoria": 3.0, "adoracion": 4.5, "reflexivo": 5.0, "tension": 4.0}


def _envolvente(n: int, ataque: int, salida: int) -> np.ndarray:
    e = np.ones(n)
    e[:ataque] = np.sin(np.linspace(0, np.pi / 2, ataque)) ** 2
    e[n - salida:] = np.cos(np.linspace(0, np.pi / 2, salida)) ** 2
    return e


def _voz(f: float, n: int, rng: np.random.Generator) -> np.ndarray:
    """Una nota de pad: tres osciladores apenas desafinados (efecto coro) con algo de segundo armónico."""
    t = np.arange(n) / SR
    s = np.zeros(n)
    for _ in range(3):
        d = f * (1 + rng.uniform(-0.003, 0.003))
        fase = rng.uniform(0, 2 * np.pi)
        s += np.sin(2 * np.pi * d * t + fase) + 0.25 * np.sin(4 * np.pi * d * t + fase)
    return s / 3


def _reverberacion(x: np.ndarray) -> np.ndarray:
    """Reverberación simple: cuatro ecos con realimentación (filtros peine)."""
    salida = x.copy()
    for retardo_ms, ganancia in ((29.7, 0.55), (37.1, 0.5), (41.1, 0.45), (43.7, 0.4)):
        r = int(SR * retardo_ms / 1000)
        y = x.copy()
        for i in range(r, len(y), r):
            y[i:i + r] += ganancia * y[i - r:i][: len(y[i:i + r])]
        salida += 0.25 * y
    return salida


def generar_pad(duracion: float, tonalidad: str, animo: str, semilla: int, salida: str) -> None:
    rng = np.random.default_rng(semilla)
    tonica = DO3 * 2 ** (NOTAS.get(tonalidad, NOTAS["Re"]) / 12)
    acordes = MENOR if animo in ("reflexivo", "tension") else MAYOR
    largo = SEGUNDOS_ACORDE.get(animo, 4.0)
    total = int(round(duracion * SR))
    traslape = int(1.2 * SR)
    mezcla = np.zeros(total + traslape)
    paso = int(largo * SR)
    for k, inicio in enumerate(range(0, total, paso)):
        raiz, intervalos = acordes[k % len(acordes)]
        n = min(paso + traslape, total + traslape - inicio)
        acorde = np.zeros(n)
        for j, iv in enumerate(intervalos):
            f = tonica * 2 ** ((raiz + iv) / 12)
            while f > tonica * 1.95:  # voces cerca de la tónica (registro cómodo, sin saltos)
                f /= 2
            acorde += (1.0 if j == 0 else 0.45) * _voz(f, n, rng)
        acorde += 0.5 * _voz(tonica * 2 ** (raiz / 12) / 2, n, rng)  # bajo
        mezcla[inicio:inicio + n] += acorde * _envolvente(n, int(1.5 * SR), traslape)
    mezcla = _reverberacion(mezcla[:total])
    mezcla *= _envolvente(total, int(1.0 * SR), int(1.5 * SR))
    mezcla *= 10 ** (-6.5 / 20) / max(np.max(np.abs(mezcla)), 1e-9)
    # Estéreo sin retardo entre canales (un retardo haría "peine" al sumar a mono en el celular).
    izq, der = mezcla, mezcla * 0.96
    pcm = (np.stack([izq, der], axis=1) * 32767).astype(np.int16)
    with wave.open(salida, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def main() -> None:
    p = argparse.ArgumentParser(description="Genera un pad de adoración (WAV).")
    p.add_argument("--duracion", type=float, required=True)
    p.add_argument("--tonalidad", default="Re")
    p.add_argument("--animo", default="esperanza")
    p.add_argument("--semilla", type=int, default=1)
    p.add_argument("--salida", required=True)
    a = p.parse_args()
    generar_pad(a.duracion, a.tonalidad, a.animo, a.semilla, a.salida)


if __name__ == "__main__":
    main()
