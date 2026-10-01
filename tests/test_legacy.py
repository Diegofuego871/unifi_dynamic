"""
Ältere, Stub-basierte Tests (tests/legacy/*.py) ohne Home Assistant.

Sie ersetzen Home Assistant durch kleine Attrappen und laufen deshalb je in
einem eigenen Prozess, getrennt von den Tests mit echtem Home Assistant.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

LEGACY = Path(__file__).parent / "legacy"
SCRIPTS = sorted(p.name for p in LEGACY.glob("*_unit.py"))


@pytest.mark.parametrize("script", SCRIPTS)
def test_legacy_script(script: str) -> None:
    result = subprocess.run(
        [sys.executable, str(LEGACY / script)],
        capture_output=True,
        text=True,
        timeout=300,
        check=False,
    )
    output = result.stdout + result.stderr
    failures = [line for line in output.splitlines() if line.startswith("FAIL")]
    assert result.returncode == 0, output[-3000:]
    assert not failures, "\n".join(failures)
    assert "PASS" in output, output[-3000:]
