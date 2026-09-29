"""Sensoren der Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.const import PERCENTAGE, UnitOfTime
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from . import ping as ping_mod
from .const import DOMAIN
from .coordinator import (
    UnifiDynamicCoordinator,
    client_slug,
    preferred_client_name,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: UnifiDynamicCoordinator = hass.data[DOMAIN][entry.entry_id]

    known: set[tuple[str, str]] = set()

    @callback
    def _forget(mac: str) -> None:
        """Gepurgte MAC vergessen, damit sie bei Rückkehr neu angelegt wird."""
        for kind, _cls in SENSOR_TYPES:
            known.discard((mac, kind))

    entry.async_on_unload(coordinator.async_add_removal_callback(_forget))

    @callback
    def _add_new_entities() -> None:
        new: list[SensorEntity] = []

        for mac, data in (coordinator.data or {}).items():
            slug = client_slug(data or {}, mac)

            for kind, cls in SENSOR_TYPES:
                key = (mac, kind)
                if key in known:
                    continue

                # Reine Kabel-Clients bekommen keine WLAN-Sensoren. Bewusst vor
                # known.add: sobald der Client einmal im WLAN auftaucht, werden
                # die Entities beim nächsten Update nachgelegt.
                required = WIRELESS_ONLY.get(kind)
                if required and not (data or {}).get(required):
                    continue

                known.add(key)

                sensor = cls(coordinator, entry.entry_id, mac)
                # Nur wirksam beim erstmaligen Anlegen; danach gewinnt die
                # entity_id aus der Registry.
                sensor.entity_id = f"sensor.{DOMAIN}_{slug}_{kind}"
                new.append(sensor)

        if new:
            async_add_entities(new)

    _add_new_entities()
    entry.async_on_unload(coordinator.async_add_listener(_add_new_entities))

    # Ping-Entitäten: nur für Clients, die der Nutzer in der Geräteansicht
    # ausgewählt hat. Abgewählte entfernt der WebSocket-Befehl aus der
    # Registry; hier werden sie nur vergessen, damit ein erneutes Anwählen
    # sie wieder anlegt.
    ping_known: set[str] = set()

    @callback
    def _sync_ping_entities() -> None:
        wanted = set(ping_mod.ping_entity_macs(entry))
        ping_known.intersection_update(wanted)
        cache = coordinator.data or {}
        new: list[SensorEntity] = []
        for mac in sorted(wanted - ping_known):
            if mac not in cache:
                continue
            ping_known.add(mac)
            slug = client_slug(cache[mac] or {}, mac)
            for cls in (PingSensor, PacketLossSensor):
                sensor = cls(coordinator, entry.entry_id, mac)
                sensor.entity_id = f"sensor.{DOMAIN}_{slug}_{cls._kind}"
                new.append(sensor)
        if new:
            async_add_entities(new)

    entry.async_on_unload(coordinator.async_add_removal_callback(ping_known.discard))
    _sync_ping_entities()
    entry.async_on_unload(
        async_dispatcher_connect(
            hass, ping_mod.ping_entities_signal(entry.entry_id), _sync_ping_entities
        )
    )
    entry.async_on_unload(coordinator.async_add_listener(_sync_ping_entities))


class _UnifiDynamicSensor(CoordinatorEntity[UnifiDynamicCoordinator], SensorEntity):
    """
    Basisklasse.

    Es wird nichts in der Entity zwischengespeichert: der Coordinator-Cache
    behält bereits alle letzten bekannten Werte und überlebt Neustarts.
    """

    _attr_has_entity_name = True
    _kind: str = ""

    def __init__(
        self, coordinator: UnifiDynamicCoordinator, entry_id: str, mac: str
    ) -> None:
        super().__init__(coordinator)
        self._mac = mac
        self._attr_unique_id = f"{DOMAIN}.{entry_id}.{self._kind}.{mac}"

    @property
    def available(self) -> bool:
        # Bewusst immer verfügbar: Entities bleiben bis zum Purge bestehen und
        # zeigen den letzten bekannten Wert.
        return True

    @property
    def _data(self) -> dict[str, Any]:
        return self.coordinator.client_data(self._mac)

    @property
    def device_info(self) -> DeviceInfo:
        return DeviceInfo(
            identifiers={(DOMAIN, self._mac)},
            name=preferred_client_name(self._data, self._mac),
            manufacturer="Ubiquiti",
        )


class MacSensor(_UnifiDynamicSensor):
    _kind = "mac"
    _attr_name = "MAC"
    _attr_icon = "mdi:network-outline"

    @property
    def native_value(self) -> str:
        return self._data.get("mac") or self._mac


class IpSensor(_UnifiDynamicSensor):
    _kind = "ip"
    _attr_name = "IP"
    _attr_icon = "mdi:ip-network-outline"

    @property
    def native_value(self) -> str | None:
        return self._data.get("ip")


class LastSeenSensor(_UnifiDynamicSensor):
    """
    Zeitpunkt der letzten eigenen Sichtung (_seen_at).

    Bewusst nicht das UniFi-Feld last_seen: _seen_at ist immer gesetzt, kennt
    keine Millisekunden-Varianten und ist unabhängig von der Controller-Uhr.
    unique_id und entity_id bleiben unverändert.
    """

    _kind = "last_seen"
    _attr_name = "Last seen"
    _attr_icon = "mdi:clock-outline"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    @property
    def native_value(self) -> datetime | None:
        seen = self.coordinator.seen_at(self._mac)
        if seen is None:
            return None
        return dt_util.utc_from_timestamp(seen)


class ConnectionSensor(_UnifiDynamicSensor):
    _kind = "connection"
    _attr_name = "Connection"
    _attr_icon = "mdi:lan-connect"

    @property
    def native_value(self) -> str | None:
        is_wired = self._data.get("is_wired")
        if is_wired is None:
            return None
        return "wired" if is_wired else "wlan"


class AccessPointSensor(_UnifiDynamicSensor):
    """
    Access Point, an dem der Client hängt.

    Existiert nur für Clients, die mindestens einmal im WLAN gesehen wurden.
    Die API liefert nur die MAC des AP; der Name kommt aus der UniFi-Geräteliste
    und fällt auf die MAC zurück, solange diese nicht abrufbar ist.
    """

    _kind = "access_point"
    _attr_name = "Access Point"
    _attr_icon = "mdi:access-point"

    @property
    def native_value(self) -> str | None:
        return self.coordinator.access_point_name(self._data.get("ap_mac"))


class SsidSensor(_UnifiDynamicSensor):
    """
    SSID des Clients.

    Existiert nur für Clients, die mindestens einmal im WLAN gesehen wurden.
    Für Geräte, die zwischen Kabel und WLAN wechseln, bleibt die zuletzt
    bekannte SSID stehen, statt auf "Unbekannt" zu fallen; ob aktuell Kabel
    oder WLAN aktiv ist, sagt der Connection-Sensor.
    """

    _kind = "ssid"
    _attr_name = "SSID"
    _attr_icon = "mdi:wifi"

    @property
    def native_value(self) -> str | None:
        return self._data.get("essid")


SENSOR_TYPES: tuple[tuple[str, type[_UnifiDynamicSensor]], ...] = (
    ("mac", MacSensor),
    ("ip", IpSensor),
    ("last_seen", LastSeenSensor),
    ("connection", ConnectionSensor),
    ("ssid", SsidSensor),
    ("access_point", AccessPointSensor),
)

# Sensor-Art -> Cache-Feld, das mindestens einmal vorhanden sein muss. Fehlt es,
# ist der Client reiner Kabel-Client und bekommt die Entity nicht.
WIRELESS_ONLY: dict[str, str] = {
    "ssid": "essid",
    "access_point": "ap_mac",
}


class _PingSensor(_UnifiDynamicSensor):
    """
    Basis der Ping-Entitäten: Werte der letzten Ping-Runde.

    Aktualisiert sich nach jeder Runde der Messung, nicht mit dem Poll des
    Controllers. Ohne Messwert (Client offline, Ping aus) unbekannt.
    """

    _attr_state_class = SensorStateClass.MEASUREMENT

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        monitor = self.coordinator.ping
        if monitor is not None:
            self.async_on_remove(monitor.async_add_listener(self.async_write_ha_state))

    @property
    def _last(self) -> dict[str, Any] | None:
        monitor = self.coordinator.ping
        return monitor.last(self._mac) if monitor is not None else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        monitor = self.coordinator.ping
        summary = monitor.summary(self._mac) if monitor is not None else None
        last = self._last or {}
        return {
            "jitter": last.get("jitter"),
            "median_24h": summary["median"] if summary else None,
            "jitter_24h": summary["jitter"] if summary else None,
            "packet_loss_24h": summary["loss"] if summary else None,
            "ip": last.get("ip"),
        }


class PingSensor(_PingSensor):
    """Median der Antwortzeit der letzten Runde (Millisekunden)."""

    _kind = "ping"
    _attr_name = "Ping"
    _attr_icon = "mdi:timer-outline"
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_native_unit_of_measurement = UnitOfTime.MILLISECONDS
    _attr_suggested_display_precision = 1

    @property
    def native_value(self) -> float | None:
        return (self._last or {}).get("median")


class PacketLossSensor(_PingSensor):
    """Paketverlust der letzten Runde in Prozent."""

    _kind = "packet_loss"
    _attr_name = "Packet loss"
    _attr_icon = "mdi:lan-disconnect"
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_suggested_display_precision = 0

    @property
    def native_value(self) -> float | None:
        return (self._last or {}).get("loss")
