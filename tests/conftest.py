"""Gemeinsame Fixtures: echtes Home Assistant über pytest-homeassistant-custom-component."""

from __future__ import annotations

import pytest

pytest_plugins = "pytest_homeassistant_custom_component"

HOST = "10.0.0.1"
SITES_URL = f"https://{HOST}/proxy/network/integration/v1/sites"


def sites_payload(*sites: tuple[str, str]) -> dict:
    """Antwort der Integration-API mit (interne Bezeichnung, Name)."""
    return {"data": [{"id": f"id-{ref}", "internalReference": ref, "name": name} for ref, name in sites]}


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations):
    """Lädt custom_components/unifi_dynamic in jedem Test."""
    yield


@pytest.fixture(autouse=True)
def no_early_update_check(monkeypatch):
    """
    Die erste tägliche Update-Prüfung startet im Betrieb nach einer
    Zufallszeit von 5 bis 65 Minuten. Tests, die die Zeit um Minuten
    vorschieben, lösen sie sonst je nach Zufallswert aus, und der Aufruf an
    GitHub hat keinen Mock. Feste, lange Wartezeit macht das deterministisch.
    """
    from custom_components.unifi_dynamic import update_check

    monkeypatch.setattr(update_check, "FIRST_CHECK_DELAY", (6 * 3600, 6 * 3600))
    yield


@pytest.fixture(autouse=True)
def skip_frontend(hass):
    """
    Das Frontend gilt als geladen: das Testpaket bringt das
    HA-Frontend nicht mit. Panel und Bild registriert die Integration ohnehin
    nur bestmöglich (Fehler werden geloggt, Setup läuft weiter).
    """
    hass.config.components.add("frontend")
    yield
