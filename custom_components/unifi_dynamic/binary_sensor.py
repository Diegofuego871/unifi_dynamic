"""Online-Status der Integration "UniFi Dynamic Clients"."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

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

    known: set[str] = set()

    @callback
    def _forget(mac: str) -> None:
        """Gepurgte MAC vergessen, damit sie bei Rückkehr neu angelegt wird."""
        known.discard(mac)

    entry.async_on_unload(coordinator.async_add_removal_callback(_forget))

    @callback
    def _add_new_entities() -> None:
        new: list[BinarySensorEntity] = []

        for mac, data in (coordinator.data or {}).items():
            if mac in known:
                continue
            known.add(mac)

            sensor = UnifiClientOnlineBinarySensor(coordinator, entry.entry_id, mac)
            # Nur wirksam beim erstmaligen Anlegen.
            sensor.entity_id = (
                f"binary_sensor.{DOMAIN}_{client_slug(data or {}, mac)}_online"
            )
            new.append(sensor)

        if new:
            async_add_entities(new)

    _add_new_entities()
    entry.async_on_unload(coordinator.async_add_listener(_add_new_entities))


class UnifiClientOnlineBinarySensor(
    CoordinatorEntity[UnifiDynamicCoordinator], BinarySensorEntity
):
    """Online, wenn der Client beim letzten erfolgreichen Poll gesehen wurde."""

    _attr_has_entity_name = True
    _attr_name = "Online"
    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY

    def __init__(
        self, coordinator: UnifiDynamicCoordinator, entry_id: str, mac: str
    ) -> None:
        super().__init__(coordinator)
        self._mac = mac
        self._attr_unique_id = f"{DOMAIN}.{entry_id}.client_online.{mac}"

    @property
    def available(self) -> bool:
        # Bewusst immer verfügbar, siehe sensor.py.
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

    @property
    def is_on(self) -> bool:
        return self.coordinator.is_client_online(self._mac)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self._data
        is_wired = data.get("is_wired")
        seen = self.coordinator.seen_at(self._mac)

        return {
            "mac": data.get("mac") or self._mac,
            "ip": data.get("ip"),
            # Attributname bewusst beibehalten; Inhalt ist jetzt _seen_at.
            "last_seen": dt_util.utc_from_timestamp(seen) if seen else None,
            "connection": None
            if is_wired is None
            else ("wired" if is_wired else "wlan"),
            "ssid": data.get("essid"),
            "rssi": data.get("rssi"),
            "ap": self.coordinator.access_point_name(data.get("ap_mac")),
            "ap_mac": data.get("ap_mac"),
        }
