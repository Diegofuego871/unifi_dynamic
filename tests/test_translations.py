"""Texte: Deutsch und Englisch vollständig, Schweizer Schreibweise (kein Eszett)."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

INTEGRATION = Path(__file__).resolve().parents[1] / "custom_components" / "unifi_dynamic"


def _keys(data: dict, prefix: str = "") -> set[str]:
    out: set[str] = set()
    for key, value in data.items():
        if isinstance(value, dict):
            out |= _keys(value, f"{prefix}{key}.")
        else:
            out.add(f"{prefix}{key}")
    return out


def _load(name: str) -> dict:
    return json.loads((INTEGRATION / name).read_text(encoding="utf-8"))


def test_strings_json_equals_english() -> None:
    assert _load("strings.json") == _load("translations/en.json")


def test_german_and_english_have_same_keys() -> None:
    en = _keys(_load("translations/en.json"))
    de = _keys(_load("translations/de.json"))
    assert en - de == set(), f"fehlt auf Deutsch: {sorted(en - de)}"
    assert de - en == set(), f"fehlt auf Englisch: {sorted(de - en)}"


def test_no_sharp_s() -> None:
    files = [*INTEGRATION.glob("*.py"), *INTEGRATION.glob("translations/*.json"), *INTEGRATION.glob("panel/*.js")]
    root = INTEGRATION.parents[1]
    files += [root / "README.de.md", root / "README.md", root / "CHANGELOG.md"]
    offenders = [str(f.relative_to(root)) for f in files if "\u00df" in f.read_text(encoding="utf-8")]
    assert not offenders, f"Eszett statt ss in: {offenders}"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js fehlt")
def test_panel_strings_complete() -> None:
    script = (
        "import(process.argv[1]).then(({ STRINGS }) => {"
        " const de = Object.keys(STRINGS.de), en = Object.keys(STRINGS.en);"
        " console.log(JSON.stringify({ onlyDe: de.filter((k) => !en.includes(k)), onlyEn: en.filter((k) => !de.includes(k)) }));"
        "})"
    )
    result = subprocess.run(
        ["node", "-e", script, (INTEGRATION / "panel" / "strings.js").as_uri()],
        capture_output=True,
        text=True,
        check=True,
    )
    diff = json.loads(result.stdout)
    assert diff == {"onlyDe": [], "onlyEn": []}
