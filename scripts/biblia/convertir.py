"""Descarga la Reina-Valera 1909 (dominio público) de eBible.org y la convierte a JSON.

Uso: python scripts/biblia/convertir.py
Salida: resources/biblia/rv1909.json  →  {"Génesis": {"1": {"1": "En el principio..."}}}
"""
from __future__ import annotations

import io
import json
import re
import urllib.request
import zipfile
from pathlib import Path

URL = "https://ebible.org/Scriptures/spaRV1909_vpl.zip"
SALIDA = Path(__file__).resolve().parents[2] / "resources" / "biblia" / "rv1909.json"

LIBROS = {
    "GEN": "Génesis", "EXO": "Éxodo", "LEV": "Levítico", "NUM": "Números", "DEU": "Deuteronomio",
    "JOS": "Josué", "JDG": "Jueces", "RUT": "Rut", "1SA": "1 Samuel", "2SA": "2 Samuel",
    "1KI": "1 Reyes", "2KI": "2 Reyes", "1CH": "1 Crónicas", "2CH": "2 Crónicas", "EZR": "Esdras",
    "NEH": "Nehemías", "EST": "Ester", "JOB": "Job", "PSA": "Salmos", "PRO": "Proverbios",
    "ECC": "Eclesiastés", "SOL": "Cantares", "ISA": "Isaías", "JER": "Jeremías", "LAM": "Lamentaciones",
    "EZE": "Ezequiel", "DAN": "Daniel", "HOS": "Oseas", "JOE": "Joel", "AMO": "Amós",
    "OBA": "Abdías", "JON": "Jonás", "MIC": "Miqueas", "NAH": "Nahúm", "HAB": "Habacuc",
    "ZEP": "Sofonías", "HAG": "Hageo", "ZEC": "Zacarías", "MAL": "Malaquías",
    "MAT": "Mateo", "MAR": "Marcos", "LUK": "Lucas", "JOH": "Juan", "ACT": "Hechos",
    "ROM": "Romanos", "1CO": "1 Corintios", "2CO": "2 Corintios", "GAL": "Gálatas", "EPH": "Efesios",
    "PHI": "Filipenses", "COL": "Colosenses", "1TH": "1 Tesalonicenses", "2TH": "2 Tesalonicenses",
    "1TI": "1 Timoteo", "2TI": "2 Timoteo", "TIT": "Tito", "PHM": "Filemón", "HEB": "Hebreos",
    "JAM": "Santiago", "1PE": "1 Pedro", "2PE": "2 Pedro", "1JO": "1 Juan", "2JO": "2 Juan",
    "3JO": "3 Juan", "JUD": "Judas", "REV": "Apocalipsis",
}

# Códigos del archivo VPL de eBible (no son todos USFM: SOL, EZE, JOH, JAM...).
LINEA = re.compile(r"^([1-3A-Z]{3}) (\d+):(\d+) (.*)$")


def main() -> None:
    print(f"Descargando {URL} ...")
    pedido = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReelsIglesia/0.1"})
    datos = urllib.request.urlopen(pedido, timeout=60).read()
    biblia: dict[str, dict[str, dict[str, str]]] = {}
    with zipfile.ZipFile(io.BytesIO(datos)) as z:
        nombre = next(n for n in z.namelist() if n.endswith("_vpl.txt"))
        texto = z.read(nombre).decode("utf-8-sig")
    for linea in texto.splitlines():
        m = LINEA.match(linea.strip())
        if not m or m.group(1) not in LIBROS:
            continue
        libro, cap, vers, t = LIBROS[m.group(1)], m.group(2), m.group(3), m.group(4).strip()
        t = re.sub(r"\s+", " ", t.replace("¶", "")).strip()
        biblia.setdefault(libro, {}).setdefault(cap, {})[vers] = t
    faltan = [n for n in LIBROS.values() if n not in biblia]
    if faltan:
        raise SystemExit(f"Faltan libros: {faltan}")
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(biblia, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(len(v) for c in biblia.values() for v in c.values())
    print(f"Guardado {SALIDA} · {len(biblia)} libros · {total} versículos")


if __name__ == "__main__":
    main()
